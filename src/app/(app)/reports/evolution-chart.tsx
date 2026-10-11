import Link from "next/link";
import { formatCents, formatCompactCents, formatMonth, formatShortMonth } from "@/lib/format";
import { niceCeiling, type MonthSpending } from "@/lib/reports/reports";

const TICKS = [1, 0.5, 0];

/**
 * Spending per month as columns. One series, so no legend. With a selected month, it wears the
 * accent and the others step back; without one, every column is in the accent. Each column links
 * to its month; values are in the tooltip, on one labelled column and in a table for screen readers.
 */
export function EvolutionChart({ months, selected }: { months: MonthSpending[]; selected: string | null }) {
  const highest = Math.max(...months.map((entry) => entry.spentCents));
  const max = niceCeiling(highest);
  // Label one column only: the selected month, or else the highest.
  const labelled = selected ?? months.find((entry) => entry.spentCents === highest && highest > 0)?.month ?? null;
  const dense = months.length > 8;

  return (
    <figure>
      <div className="flex gap-2" aria-hidden="true">
        <div className="flex h-44 flex-col justify-between pb-6 pt-5 text-right text-[11px] tabular-nums text-muted">
          {TICKS.map((tick, index) => (
            // Each label is centered on its gridline: the first hangs from the top line, the last sits on the baseline.
            <span
              key={tick}
              className={`leading-none ${index === 0 ? "-translate-y-1/2" : index === TICKS.length - 1 ? "translate-y-1/2" : ""}`}
            >
              {formatCompactCents(max * tick)}
            </span>
          ))}
        </div>

        <div className="relative h-44 min-w-0 flex-1">
          <div className="absolute inset-x-0 bottom-6 top-5 flex flex-col justify-between">
            {TICKS.map((tick) => (
              <span key={tick} className="h-px bg-border" />
            ))}
          </div>

          <ul className="absolute inset-0 flex">
            {months.map((entry, index) => {
              const current = entry.month === labelled;
              const emphasized = selected === null || entry.month === selected;
              // The value label is centered on its column, except at the edges, where it would leave the plot.
              const anchor =
                index === 0
                  ? "left-0"
                  : index === months.length - 1
                    ? "right-0"
                    : "left-1/2 -translate-x-1/2";
              const height = (entry.spentCents / max) * 100;
              return (
                <li key={entry.month} className="min-w-0 flex-1">
                  <Link
                    href={`/reports?month=${entry.month}`}
                    scroll={false}
                    aria-label={`${formatMonth(entry.month)}: ${formatCents(entry.spentCents)}`}
                    aria-current={entry.month === selected ? "true" : undefined}
                    className="group relative flex h-full flex-col items-center rounded-lg outline-none transition-colors hover:bg-surface-muted/60 focus-visible:bg-surface-muted/60 focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <span className="relative mt-5 flex w-full flex-1 items-end justify-center">
                      <span
                        className={`relative w-6 max-w-[60%] rounded-t transition-colors ${
                          emphasized
                            ? "bg-accent group-hover:opacity-85 group-focus-visible:opacity-85"
                            : "bg-muted/40 group-hover:bg-muted/60 group-focus-visible:bg-muted/60"
                        }`}
                        style={{ height: `${height}%`, minHeight: entry.spentCents > 0 ? 2 : 0 }}
                      >
                        <span
                          className={`pointer-events-none absolute bottom-full mb-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${anchor} ${
                            current
                              ? "text-foreground"
                              : "z-10 bg-foreground text-background opacity-0 shadow group-hover:opacity-100 group-focus-visible:opacity-100"
                          }`}
                        >
                          {formatCents(entry.spentCents)}
                        </span>
                      </span>
                    </span>
                    <span
                      className={`flex h-6 items-center ${dense ? "text-[10px]" : "text-xs"} ${
                        entry.month === selected ? "font-semibold text-foreground" : "text-muted"
                      }`}
                    >
                      {formatShortMonth(entry.month)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <table className="sr-only">
        <caption>Gasto por mês</caption>
        <thead>
          <tr>
            <th scope="col">Mês</th>
            <th scope="col">Gasto</th>
          </tr>
        </thead>
        <tbody>
          {months.map((entry) => (
            <tr key={entry.month}>
              <th scope="row">{formatMonth(entry.month)}</th>
              <td>{formatCents(entry.spentCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
