import type { Metadata } from "next";
import { Suspense } from "react";
import { badge, card, skeleton } from "@/components/ui";
import { formatCents, formatDate, formatMonth, formatPercent } from "@/lib/format";
import { RECURRING_MIN_MONTHS, recurringSpending, type RecurringSpending } from "@/lib/reports/reports";
import { requireSession } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { loadReportRows } from "@/server/reports/load-report-rows";
import { listMonths } from "@/server/transactions/list-transactions";
import { CategoryLabel, Empty, Section } from "../parts";

export const metadata: Metadata = { title: "Recorrentes | Financial" };

// Smaller differences are usually rounding or exchange rate, not a new price.
const PRICE_CHANGE_THRESHOLD = 0.05;

const dayAndMonth = (isoDate: string) => formatDate(isoDate).slice(0, 5);

function PriceChange({ entry }: { entry: RecurringSpending }) {
  if (Math.abs(entry.priceChange) < PRICE_CHANGE_THRESHOLD) {
    return null;
  }
  const up = entry.priceChange > 0;
  return (
    <span className={up ? badge.negative : badge.positive}>
      {up ? "▲ aumentou" : "▼ diminuiu"} {formatPercent(Math.abs(entry.priceChange))}: de {formatCents(entry.previousCents)}{" "}
      para {formatCents(entry.lastCents)}
    </span>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className={`${card} flex min-w-0 flex-col gap-1 p-3 sm:p-4`}>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="truncate text-lg font-semibold sm:text-xl">{value}</dd>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  );
}

async function Subscriptions() {
  await requireSession();
  const [month] = await listMonths(getDb());
  if (!month) {
    return (
      <div className={`${card} px-6 py-12 text-center`}>
        <Empty>Importe um extrato para identificar cobranças recorrentes.</Empty>
      </div>
    );
  }

  const recurring = recurringSpending(await loadReportRows(getDb(), month), month);
  // Totals at the current price of each charge, which is what the next months will cost.
  const monthly = recurring.reduce((total, entry) => total + entry.lastCents, 0);
  const increases = recurring.filter((entry) => entry.priceChange >= PRICE_CHANGE_THRESHOLD).length;

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        <Figure
          label="Por mês"
          value={formatCents(monthly)}
          note={`${recurring.length} ${recurring.length === 1 ? "cobrança" : "cobranças"}`}
        />
        <Figure label="Por ano" value={formatCents(monthly * 12)} note="se nada mudar" />
        <div className="col-span-2 sm:col-span-1">
          <Figure
            label="Aumentos de preço"
            value={String(increases)}
            note={increases > 0 ? "na última cobrança" : "nenhum na última cobrança"}
          />
        </div>
      </dl>

      <Section
        title="Cobranças recorrentes"
        description={`Mesmo estabelecimento, valor parecido, por ${RECURRING_MIN_MONTHS} meses seguidos ou mais, até ${formatMonth(month)}. Parcelas não entram.`}
      >
        {recurring.length === 0 ? (
          <Empty>
            Nenhuma cobrança repetida por {RECURRING_MIN_MONTHS} meses seguidos. Com menos de {RECURRING_MIN_MONTHS} meses
            de histórico importado, esta lista fica vazia.
          </Empty>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {recurring.map((entry) => (
              <li key={entry.merchant} className="flex flex-col gap-1.5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-medium" title={entry.merchant}>
                    {entry.merchant}
                  </p>
                  <p className="shrink-0 text-right text-sm font-semibold tabular-nums">
                    {formatCents(entry.lastCents)}
                    <span className="text-xs font-normal text-muted">/mês</span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <CategoryLabel category={entry.category} />
                    <span>· há {entry.months} meses</span>
                  </span>
                  <span className="tabular-nums">{formatCents(entry.yearlyCents)} por ano</span>
                </div>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                  <span>
                    última em {dayAndMonth(entry.lastDate)} · próxima por volta de {dayAndMonth(entry.nextDate)}
                  </span>
                  <PriceChange entry={entry} />
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function SubscriptionsSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Carregando recorrentes">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className={`${skeleton} h-20 ${index === 2 ? "col-span-2 sm:col-span-1" : ""}`} />
        ))}
      </div>
      <div className={`${skeleton} h-64`} />
    </div>
  );
}

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={<SubscriptionsSkeleton />}>
      <Subscriptions />
    </Suspense>
  );
}
