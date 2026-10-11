import type { PrismaClient } from "../prisma";

export interface CategoryOption {
  id: string;
  name: string;
  /** Hex color. */
  color: string;
}

const collator = new Intl.Collator("pt-BR");

/** Every category, in alphabetical order. */
export async function listCategories(db: PrismaClient): Promise<CategoryOption[]> {
  const categories = await db.category.findMany({ select: { id: true, name: true, color: true } });
  return categories.sort((a, b) => collator.compare(a.name, b.name));
}
