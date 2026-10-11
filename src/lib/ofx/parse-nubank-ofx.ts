import { toCents } from "../money";
import { child, children, descendant, parseSgml, type OfxNode } from "./sgml";

export type Source = "ACCOUNT" | "CREDIT_CARD";

export type TransactionKind =
  | "PIX_SENT"
  | "PIX_RECEIVED"
  | "DEBIT_PURCHASE"
  | "BILL_PAYMENT"
  | "CARD_PURCHASE"
  | "CARD_PAYMENT_RECEIVED"
  | "OTHER";

export interface Installment {
  number: number;
  total: number;
}

export interface ParsedTransaction {
  externalId: string;
  /** YYYY-MM-DD */
  date: string;
  /** Negative for money going out. */
  amountCents: number;
  /** Original MEMO, never altered. */
  description: string;
  kind: TransactionKind;
  merchant: string | null;
  installment: Installment | null;
}

export interface ParsedStatement {
  source: Source;
  accountId: string;
  /** YYYY-MM-DD */
  periodStart: string;
  /** YYYY-MM-DD */
  periodEnd: string;
  ledgerBalanceCents: number | null;
  ledgerBalanceDate: string | null;
  transactions: ParsedTransaction[];
}

export class OfxParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfxParseError";
  }
}

export function isInternalTransfer(kind: TransactionKind): boolean {
  return kind === "BILL_PAYMENT" || kind === "CARD_PAYMENT_RECEIVED";
}

const ACCOUNT_KINDS: [prefix: string, kind: TransactionKind][] = [
  ["Transferência enviada pelo Pix", "PIX_SENT"],
  ["Transferência recebida pelo Pix", "PIX_RECEIVED"],
  ["Compra no débito", "DEBIT_PURCHASE"],
  ["Pagamento de fatura", "BILL_PAYMENT"],
];

const CARD_PAYMENT_RECEIVED = "Pagamento recebido";
const PART_SEPARATOR = " - ";
const INSTALLMENT_SUFFIX = / - Parcela (\d+)\/(\d+)$/;
// Pix descriptions: kind, counterparty name, document, institution.
const PIX_PARTS = 4;

function requiredValue(node: OfxNode | undefined, tag: string, where: string): string {
  const value = node && child(node, tag)?.value;
  if (!value) {
    throw new OfxParseError(`Missing ${tag} in ${where}`);
  }
  return value;
}

function parseDate(value: string, tag: string, where: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(value);
  if (match) {
    const [, year, month, day] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    const iso = `${year}-${month}-${day}`;
    if (date.toISOString().startsWith(iso)) {
      return iso;
    }
  }
  throw new OfxParseError(`Invalid date in ${tag} of ${where}`);
}

function parseAmount(value: string, tag: string, where: string): number {
  try {
    return toCents(value);
  } catch {
    throw new OfxParseError(`Invalid amount in ${tag} of ${where}`);
  }
}

function normalizeMerchant(text: string | undefined): string | null {
  const normalized = text?.trim().replace(/\s+/g, " ").toUpperCase();
  return normalized || null;
}

function classify(source: Source, description: string): TransactionKind {
  if (source === "CREDIT_CARD") {
    return description.startsWith(CARD_PAYMENT_RECEIVED) ? "CARD_PAYMENT_RECEIVED" : "CARD_PURCHASE";
  }
  return ACCOUNT_KINDS.find(([prefix]) => description.startsWith(prefix))?.[1] ?? "OTHER";
}

function parseInstallment(description: string): Installment | null {
  const match = INSTALLMENT_SUFFIX.exec(description);
  if (!match) {
    return null;
  }
  const number = Number(match[1]);
  const total = Number(match[2]);
  return number >= 1 && number <= total ? { number, total } : null;
}

function extractMerchant(kind: TransactionKind, description: string, installment: Installment | null): string | null {
  switch (kind) {
    case "PIX_SENT":
    case "PIX_RECEIVED": {
      const parts = description.split(PART_SEPARATOR);
      return parts.length >= PIX_PARTS ? normalizeMerchant(parts[1]) : null;
    }
    case "DEBIT_PURCHASE": {
      const separator = description.indexOf(PART_SEPARATOR);
      return separator === -1 ? null : normalizeMerchant(description.slice(separator + PART_SEPARATOR.length));
    }
    case "CARD_PURCHASE":
      return normalizeMerchant(installment ? description.replace(INSTALLMENT_SUFFIX, "") : description);
    default:
      return null;
  }
}

function parseTransaction(node: OfxNode, position: number, source: Source): ParsedTransaction {
  const where = `transaction ${position}`;
  const externalId = requiredValue(node, "FITID", where);
  const date = parseDate(requiredValue(node, "DTPOSTED", where), "DTPOSTED", where);
  const amountCents = parseAmount(requiredValue(node, "TRNAMT", where), "TRNAMT", where);
  const description = child(node, "MEMO")?.value ?? "";
  const kind = classify(source, description);
  const installment = kind === "CARD_PURCHASE" ? parseInstallment(description) : null;
  const merchant = extractMerchant(kind, description, installment);
  return { externalId, date, amountCents, description, kind, merchant, installment };
}

/** Parses the text of a Nubank OFX export (account or credit card). */
export function parseNubankOfx(content: string): ParsedStatement {
  const { root, unclosed } = parseSgml(content);
  const ofx = child(root, "OFX");
  if (!ofx) {
    throw new OfxParseError("Not an OFX file: missing OFX element");
  }
  if (unclosed.length > 0) {
    throw new OfxParseError(`Incomplete file: ${unclosed.at(-1)} is not closed`);
  }

  const accountStatement = descendant(ofx, "BANKMSGSRSV1", "STMTTRNRS", "STMTRS");
  const cardStatement = descendant(ofx, "CREDITCARDMSGSRSV1", "CCSTMTTRNRS", "CCSTMTRS");
  const statement = accountStatement ?? cardStatement;
  if (!statement) {
    throw new OfxParseError("No account or credit card statement found");
  }
  const source: Source = accountStatement ? "ACCOUNT" : "CREDIT_CARD";

  const accountFrom = child(statement, accountStatement ? "BANKACCTFROM" : "CCACCTFROM");
  const accountId = requiredValue(accountFrom, "ACCTID", "statement");

  const list = child(statement, "BANKTRANLIST");
  if (!list) {
    throw new OfxParseError("Missing BANKTRANLIST in statement");
  }
  const periodStart = parseDate(requiredValue(list, "DTSTART", "statement"), "DTSTART", "statement");
  const periodEnd = parseDate(requiredValue(list, "DTEND", "statement"), "DTEND", "statement");

  const seen = new Set<string>();
  const transactions = children(list, "STMTTRN").map((node, index) => {
    const transaction = parseTransaction(node, index + 1, source);
    if (seen.has(transaction.externalId)) {
      throw new OfxParseError(`Repeated FITID in transaction ${index + 1}`);
    }
    seen.add(transaction.externalId);
    return transaction;
  });

  const balance = child(statement, "LEDGERBAL");
  const ledgerBalanceCents = balance
    ? parseAmount(requiredValue(balance, "BALAMT", "LEDGERBAL"), "BALAMT", "LEDGERBAL")
    : null;
  const ledgerBalanceDate = balance
    ? parseDate(requiredValue(balance, "DTASOF", "LEDGERBAL"), "DTASOF", "LEDGERBAL")
    : null;

  return { source, accountId, periodStart, periodEnd, ledgerBalanceCents, ledgerBalanceDate, transactions };
}
