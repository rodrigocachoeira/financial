export const CATEGORY_NAME_MAX_LENGTH = 40;

/** Colors offered for categories. New categories take the first one not in use yet. */
export const CATEGORY_COLORS = [
  "#f97316",
  "#65a30d",
  "#0ea5e9",
  "#8b5cf6",
  "#ef4444",
  "#ec4899",
  "#6366f1",
  "#f59e0b",
  "#14b8a6",
  "#a16207",
  "#64748b",
  "#06b6d4",
  "#10b981",
  "#94a3b8",
  "#78716c",
  "#d946ef",
  "#84cc16",
  "#e11d48",
  "#0d9488",
  "#7c3aed",
];

/** Trims and collapses spaces: the form in which a name is stored and shown. */
export function cleanCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/**
 * Key for comparing names and for searching: no accents, no case, single spaces.
 * "Alimentação", "alimentacao" and " ALIMENTAÇÃO " are the same category.
 */
export function searchKey(text: string): string {
  return cleanCategoryName(text)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export type CategoryNameError = "EMPTY" | "TOO_LONG";

export function validateCategoryName(name: string): CategoryNameError | null {
  const cleaned = cleanCategoryName(name);
  if (cleaned === "") {
    return "EMPTY";
  }
  return cleaned.length > CATEGORY_NAME_MAX_LENGTH ? "TOO_LONG" : null;
}

/** True when `label` contains `query`, ignoring accents and case. An empty query matches everything. */
export function matchesSearch(label: string, query: string): boolean {
  return searchKey(label).includes(searchKey(query));
}

export function isCategoryColor(value: unknown): value is string {
  return typeof value === "string" && CATEGORY_COLORS.includes(value);
}

/** First palette color no category uses; when all are taken, the least used one. */
export function pickCategoryColor(usedColors: string[]): string {
  const uses = new Map(CATEGORY_COLORS.map((color) => [color, 0]));
  for (const color of usedColors) {
    if (uses.has(color)) {
      uses.set(color, uses.get(color)! + 1);
    }
  }
  return CATEGORY_COLORS.reduce((best, color) => (uses.get(color)! < uses.get(best)! ? color : best));
}
