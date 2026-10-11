import Link from "next/link";
import type { ReactNode } from "react";
import { badge, card } from "@/components/ui";
import { formatCents, formatMonth, formatPercent } from "@/lib/format";
import type { CategoryComparison, CategorySpending, MerchantSpending, ReportCategory } from "@/lib/reports/reports";

/** Pieces shared by the monthly, yearly and recurring reports. */

export function Section(props: { title: string; description?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={`${card} flex flex-col gap-4 p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{props.title}</h2>
          {props.description && <p className="mt-0.5 text-sm text-muted">{props.description}</p>}
        </div>
        {props.action}
      </div>
      {props.children}
    </section>
  );
}

export const Empty = ({ children }: { children: ReactNode }) => <p className="text-sm text-muted">{children}</p>;

export function CategoryLabel({ category }: { category: ReportCategory | null }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className={`size-2.5 shrink-0 rounded-full ${category ? "" : "border-2 border-dashed border-muted"}`}
        style={category ? { backgroundColor: category.color } : undefined}
        aria-hidden="true"
      />
      <span className="truncate">{category?.name ?? "Sem categoria"}</span>
    </span>
  );
}

export function Tile(props: {
  label: string;
  /** Null shows a dash: there is no figure for the period. */
  cents: number | null;
  tone: string;
  icon: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`${card} flex min-w-0 flex-col gap-1.5 p-3 sm:p-4 ${props.className ?? ""}`}>
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <span className={`grid size-5 shrink-0 place-items-center rounded-full text-xs ${props.tone}`}>{props.icon}</span>
        {props.label}
      </dt>
      <dd className={`truncate text-lg font-semibold sm:text-xl ${props.cents === null ? "text-muted" : ""}`}>
        {props.cents === null ? "—" : formatCents(props.cents)}
      </dd>
      {props.children}
    </div>
  );
}

function AverageNote({ entry }: { entry: Partial<CategoryComparison> & CategorySpending }) {
  if (entry.averageCents === null || entry.averageCents === undefined) {
    return null;
  }
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      {entry.averageCents > 0 ? `média dos meses anteriores: ${formatCents(entry.averageCents)}` : "sem gasto nos meses anteriores"}
      {entry.unusual && (
        <span className={badge.negative}>
          {entry.deviation === null || entry.deviation === undefined
            ? "novo no período"
            : `▲ ${formatPercent(entry.deviation)} acima da média`}
        </span>
      )}
    </span>
  );
}

/**
 * Spending by category as horizontal bars. One hue for magnitude; the category's own color is
 * only the dot beside its name. Rows link somewhere when `hrefFor` is given.
 */
export function CategoryBars(props: {
  categories: (CategorySpending & Partial<CategoryComparison>)[];
  empty: string;
  hrefFor?: (category: ReportCategory | null) => string;
}) {
  const { categories, hrefFor } = props;
  if (categories.length === 0) {
    return <Empty>{props.empty}</Empty>;
  }
  const max = Math.max(...categories.map((entry) => entry.spentCents));
  const rowClass = "group -mx-2 flex flex-col gap-1.5 rounded-lg px-2 py-2";

  return (
    <ul className="flex flex-col">
      {categories.map((entry) => {
        const content = (
          <>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 font-medium">
                <CategoryLabel category={entry.category} />
              </span>
              <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                <span className="font-semibold">{formatCents(entry.spentCents)}</span>
                <span className="w-9 text-right text-xs text-muted">{formatPercent(entry.share)}</span>
              </span>
            </span>
            <span
              className="h-2 min-w-1 rounded-r bg-accent transition-opacity group-hover:opacity-85"
              style={{ width: `${(entry.spentCents / max) * 100}%` }}
              aria-hidden="true"
            />
            <AverageNote entry={entry} />
          </>
        );
        return (
          <li key={entry.category?.id ?? "none"}>
            {hrefFor ? (
              <Link
                href={hrefFor(entry.category)}
                className={`${rowClass} transition-colors hover:bg-surface-muted/60 focus-visible:outline-2 focus-visible:outline-accent`}
              >
                {content}
              </Link>
            ) : (
              <div className={rowClass}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function MerchantList({ merchants, empty }: { merchants: MerchantSpending[]; empty: string }) {
  if (merchants.length === 0) {
    return <Empty>{empty}</Empty>;
  }
  return (
    <ol className="flex flex-col divide-y divide-border">
      {merchants.map((entry, index) => (
        <li key={entry.merchant} className="flex items-center gap-3 py-2.5">
          <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" title={entry.merchant}>
              {entry.merchant}
            </p>
            <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
              <CategoryLabel category={entry.category} />
              <span className="shrink-0">
                · {entry.transactionCount} {entry.transactionCount === 1 ? "compra" : "compras"}
              </span>
            </p>
          </div>
          <p className="shrink-0 text-sm font-semibold tabular-nums">{formatCents(entry.spentCents)}</p>
        </li>
      ))}
    </ol>
  );
}

/** "2026-01" -> "jan/26" */
export const shortMonthAndYear = (month: string) =>
  `${formatMonth(month).split(" ")[0].slice(0, 3)}/${month.slice(2, 4)}`;

export interface MonthBar {
  /** YYYY-MM */
  month: string;
  /** Null when there is no figure for the month. */
  cents: number | null;
  /** Small text under the value, such as "até 10/10". */
  note?: string | null;
}

/** One figure per month as horizontal bars, with a gap where a month has no data. */
export function MonthBarList({ months, missing }: { months: MonthBar[]; missing: string }) {
  const max = Math.max(...months.map((entry) => entry.cents ?? 0), 1);

  return (
    <ul className="flex flex-col gap-2">
      {months.map((entry) => (
        <li key={entry.month} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 text-sm">
          <span className="text-muted">{shortMonthAndYear(entry.month)}</span>
          <span className="flex h-2 items-stretch" aria-hidden="true">
            {entry.cents !== null && entry.cents > 0 && (
              <span className="min-w-1 rounded-r bg-accent" style={{ width: `${(entry.cents / max) * 100}%` }} />
            )}
          </span>
          {entry.cents === null ? (
            <span className="text-xs text-muted">{missing}</span>
          ) : (
            <span className="text-right font-medium tabular-nums">
              {formatCents(entry.cents)}
              {entry.note && <span className="block text-xs font-normal text-muted">{entry.note}</span>}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
