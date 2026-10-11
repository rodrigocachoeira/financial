import {
  cleanCategoryName,
  isCategoryColor,
  pickCategoryColor,
  searchKey,
  validateCategoryName,
} from "@/lib/categorization/category-name";
import type { PrismaClient } from "../prisma";
import type { CategoryOption } from "./list-categories";

export type CategoryErrorCode = "NAME_EMPTY" | "NAME_TOO_LONG" | "NAME_TAKEN" | "INVALID_COLOR" | "NOT_FOUND";

export class CategoryError extends Error {
  constructor(readonly code: CategoryErrorCode) {
    super(code);
    this.name = "CategoryError";
  }
}

const SELECT = { id: true, name: true, color: true, countsAsSpending: true } as const;

type Client = Pick<PrismaClient, "category">;

function checkedName(name: string): string {
  const error = validateCategoryName(name);
  if (error) {
    throw new CategoryError(error === "EMPTY" ? "NAME_EMPTY" : "NAME_TOO_LONG");
  }
  return cleanCategoryName(name);
}

/** The category whose name is `name` apart from case, accents and spacing. */
async function findByName(db: Client, name: string): Promise<CategoryOption | null> {
  const key = searchKey(name);
  const categories = await db.category.findMany({ select: SELECT });
  return categories.find((category) => searchKey(category.name) === key) ?? null;
}

export interface NewCategory {
  name: string;
  /** Palette color; picked automatically when omitted. */
  color?: string;
  countsAsSpending?: boolean;
}

/** Creates a category. Fails with NAME_TAKEN when one with an equivalent name exists. */
export function createCategory(db: PrismaClient, input: NewCategory): Promise<CategoryOption> {
  const name = checkedName(input.name);
  if (input.color !== undefined && !isCategoryColor(input.color)) {
    throw new CategoryError("INVALID_COLOR");
  }

  return db.$transaction(async (tx) => {
    if (await findByName(tx, name)) {
      throw new CategoryError("NAME_TAKEN");
    }
    const used = await tx.category.findMany({ select: { color: true } });
    return tx.category.create({
      data: {
        name,
        color: input.color ?? pickCategoryColor(used.map((category) => category.color)),
        countsAsSpending: input.countsAsSpending ?? true,
      },
      select: SELECT,
    });
  });
}

/** The category with an equivalent name, created when there is none. For "create while categorizing". */
export async function findOrCreateCategory(db: PrismaClient, name: string): Promise<CategoryOption> {
  const cleaned = checkedName(name);
  return (await findByName(db, cleaned)) ?? createCategory(db, { name: cleaned });
}

export interface CategoryChanges {
  name?: string;
  color?: string;
  countsAsSpending?: boolean;
}

export function updateCategory(db: PrismaClient, id: string, changes: CategoryChanges): Promise<CategoryOption> {
  const name = changes.name === undefined ? undefined : checkedName(changes.name);
  if (changes.color !== undefined && !isCategoryColor(changes.color)) {
    throw new CategoryError("INVALID_COLOR");
  }

  return db.$transaction(async (tx) => {
    if (!(await tx.category.findUnique({ where: { id }, select: { id: true } }))) {
      throw new CategoryError("NOT_FOUND");
    }
    if (name !== undefined) {
      const sameName = await findByName(tx, name);
      if (sameName && sameName.id !== id) {
        throw new CategoryError("NAME_TAKEN");
      }
    }
    return tx.category.update({
      where: { id },
      data: { name, color: changes.color, countsAsSpending: changes.countsAsSpending },
      select: SELECT,
    });
  });
}

/**
 * Deletes a category. Its transactions and merchants go back to having no category,
 * manual corrections included, and its default rules are removed.
 * Returns how many transactions were affected.
 */
export function deleteCategory(db: PrismaClient, id: string): Promise<number> {
  return db.$transaction(async (tx) => {
    if (!(await tx.category.findUnique({ where: { id }, select: { id: true } }))) {
      throw new CategoryError("NOT_FOUND");
    }
    // A transaction left as MANUAL without a category would be shielded from rules forever.
    const { count } = await tx.transaction.updateMany({
      where: { categoryId: id },
      data: { categoryId: null, categorySource: null },
    });
    await tx.category.delete({ where: { id } });
    return count;
  });
}

export interface CategoryWithUsage extends CategoryOption {
  transactionCount: number;
  merchantCount: number;
}

const collator = new Intl.Collator("pt-BR");

/** Every category with how much it is used, in alphabetical order. */
export async function listCategoriesWithUsage(db: PrismaClient): Promise<CategoryWithUsage[]> {
  const categories = await db.category.findMany({
    select: { ...SELECT, _count: { select: { transactions: true, merchants: true } } },
  });
  return categories
    .map(({ _count, ...category }) => ({
      ...category,
      transactionCount: _count.transactions,
      merchantCount: _count.merchants,
    }))
    .sort((a, b) => collator.compare(a.name, b.name));
}
