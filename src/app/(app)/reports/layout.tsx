import type { ReactNode } from "react";
import { ReportTabs } from "./report-tabs";

export default function ReportsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Relatórios</h1>
          <p className="mt-1 text-sm text-muted">Onde está indo a maior parte do seu dinheiro.</p>
        </div>
        <ReportTabs />
      </div>
      {children}
    </>
  );
}
