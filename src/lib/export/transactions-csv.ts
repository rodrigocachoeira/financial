import { formatDate } from "../format";
import type { Installment, Source, TransactionKind } from "../ofx";
import { toCsv } from "./csv";

export interface ExportRow {
  /** YYYY-MM-DD */
  date: string;
  description: string;
  merchant: string | null;
  category: { name: string } | null;
  source: Source;
  kind: TransactionKind;
  installment: Installment | null;
  amountCents: number;
}

const SOURCES: Record<Source, string> = { ACCOUNT: "Conta", CREDIT_CARD: "Cartão" };

const KINDS: Record<TransactionKind, string> = {
  PIX_SENT: "Pix enviado",
  PIX_RECEIVED: "Pix recebido",
  DEBIT_PURCHASE: "Compra no débito",
  BILL_PAYMENT: "Pagamento de fatura",
  CARD_PURCHASE: "Compra no cartão",
  CARD_REFUND: "Estorno",
  CARD_PAYMENT_RECEIVED: "Pagamento recebido",
  OTHER: "Outro",
};

const HEADER = ["Data", "Descrição", "Estabelecimento", "Categoria", "Origem", "Tipo", "Parcela", "Valor"];

/** The user's own transactions, for a spreadsheet or a backup. */
export function transactionsCsv(rows: ExportRow[]): string {
  return toCsv(
    HEADER,
    rows.map((row) => [
      formatDate(row.date),
      row.description,
      row.merchant,
      row.category?.name ?? null,
      SOURCES[row.source],
      KINDS[row.kind],
      row.installment ? `${row.installment.number}/${row.installment.total}` : null,
      row.amountCents / 100,
    ]),
  );
}
