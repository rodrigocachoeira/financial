import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeftIcon } from "@/components/icons";
import { card, skeleton } from "@/components/ui";
import { requireSession } from "@/server/auth/session";
import { listCategoriesWithUsage } from "@/server/categorization/manage-categories";
import { getDb } from "@/server/db";
import { CategoryManager } from "./category-manager";

export const metadata: Metadata = { title: "Categorias | Financial" };

async function Categories() {
  await requireSession();
  return <CategoryManager categories={await listCategoriesWithUsage(getDb())} />;
}

function CategoriesSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando categorias">
      <div className={`${skeleton} h-10 w-40`} />
      <div className={`${card} divide-y divide-border`}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-3">
            <div className={`${skeleton} size-4 rounded-full`} />
            <div className="flex flex-1 flex-col gap-2">
              <div className={`${skeleton} h-3.5 w-1/3`} />
              <div className={`${skeleton} h-3 w-1/4`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <>
      <div className="mb-5">
        <Link
          href="/transactions"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon />
          Transações
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Categorias</h1>
        <p className="mt-1 text-sm text-muted">
          Crie, renomeie ou apague categorias. Para categorizar uma transação, use o selo dela na lista.
        </p>
      </div>
      <Suspense fallback={<CategoriesSkeleton />}>
        <Categories />
      </Suspense>
    </>
  );
}
