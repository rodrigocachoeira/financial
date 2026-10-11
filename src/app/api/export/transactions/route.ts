import type { NextRequest } from "next/server";
import { transactionsCsv } from "@/lib/export/transactions-csv";
import { parseMonth } from "@/lib/format";
import type { Source } from "@/lib/ofx";
import { isUuid } from "@/lib/uuid";
import { getSession } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { listTransactions, UNCATEGORIZED } from "@/server/transactions/list-transactions";

const isSource = (value: unknown): value is Source => value === "ACCOUNT" || value === "CREDIT_CARD";

/**
 * Downloads the user's transactions as CSV. `period` is a month (YYYY-MM) or a year (YYYY);
 * `account` and `category` narrow it like the filters of the transaction list.
 */
export async function GET(request: NextRequest) {
  if (!(await getSession())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const period = params.get("period") ?? "";
  if (!/^\d{4}$/.test(period) && !parseMonth(period)) {
    return Response.json({ error: "Invalid period" }, { status: 400 });
  }
  const account = params.get("account");
  const category = params.get("category");

  const { rows } = await listTransactions(getDb(), {
    month: period,
    source: isSource(account) ? account : undefined,
    category: category === UNCATEGORIZED || isUuid(category) ? category : undefined,
  });

  return new Response(transactionsCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transacoes-${period}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
