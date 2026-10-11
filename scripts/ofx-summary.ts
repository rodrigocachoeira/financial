// Prints totals for an OFX file without showing any description, name or document.
// Usage: yarn ofx:summary <file.ofx> [...]
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { decodeOfx, isInternalTransfer, parseNubankOfx } from "../src/lib/ofx";

const format = (cents: number) => (cents / 100).toFixed(2);

for (const path of process.argv.slice(2)) {
  const statement = parseNubankOfx(decodeOfx(readFileSync(path)));
  const { transactions } = statement;
  const sum = (filter: (cents: number) => boolean) =>
    transactions.reduce((total, t) => (filter(t.amountCents) ? total + t.amountCents : total), 0);

  const kinds: Record<string, number> = {};
  for (const t of transactions) {
    kinds[t.kind] = (kinds[t.kind] ?? 0) + 1;
  }

  console.log(`\n${basename(path)}`);
  console.log(`  source:        ${statement.source}`);
  console.log(`  period:        ${statement.periodStart} to ${statement.periodEnd}`);
  console.log(`  transactions:  ${transactions.length}`);
  console.log(`  total in:      ${format(sum((cents) => cents > 0))}`);
  console.log(`  total out:     ${format(sum((cents) => cents < 0))}`);
  console.log(`  balance:       ${statement.ledgerBalanceCents === null ? "n/a" : format(statement.ledgerBalanceCents)}`);
  console.log(`  kinds:         ${JSON.stringify(kinds)}`);
  console.log(`  internal:      ${transactions.filter((t) => isInternalTransfer(t.kind)).length}`);
  console.log(`  installments:  ${transactions.filter((t) => t.installment).length}`);
  console.log(`  no merchant:   ${transactions.filter((t) => t.merchant === null).length}`);
}
