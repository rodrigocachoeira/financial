export interface Rule {
  pattern: string;
  categoryId: string;
}

const isWordCharacter = (character: string | undefined) => character !== undefined && /[\p{L}\p{N}]/u.test(character);

/** True when some word of `name` starts with `pattern` ("POSTO" matches "MP *POSTO X", not "COMPOSTO"). */
function startsAWord(name: string, pattern: string): boolean {
  for (let index = name.indexOf(pattern); index !== -1; index = name.indexOf(pattern, index + 1)) {
    if (!isWordCharacter(name[index - 1])) {
      return true;
    }
  }
  return false;
}

/**
 * Category of the rule whose pattern starts a word of the merchant name.
 * With several matches the longest pattern wins; ties go to the alphabetically first.
 */
export function matchRule(merchantName: string, rules: Rule[]): string | null {
  const name = merchantName.toUpperCase();
  let best: { pattern: string; categoryId: string } | null = null;

  for (const rule of rules) {
    const pattern = rule.pattern.trim().toUpperCase();
    if (pattern === "" || !startsAWord(name, pattern)) {
      continue;
    }
    const better =
      best === null ||
      pattern.length > best.pattern.length ||
      (pattern.length === best.pattern.length && pattern < best.pattern);
    if (better) {
      best = { pattern, categoryId: rule.categoryId };
    }
  }
  return best?.categoryId ?? null;
}
