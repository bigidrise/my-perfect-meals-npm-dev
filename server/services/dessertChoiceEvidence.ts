import type { ChoiceCandidate } from "./createDish/finalChoices";

/**
 * Dessert's caller-owned novelty key for the shared coordinator. This is a
 * conservative comparison aid, never ingredient, nutrition or safety proof.
 * Renames, amounts, water, salt, seasoning and decorative additions do not
 * create another recipe. If constrained recipes share a base, show fewer.
 */
export function dessertChoiceSignature(candidate: ChoiceCandidate): string | null {
  const components = (candidate.ingredients ?? []).map((row: any) =>
    String(typeof row === "string" ? row : row?.name ?? row?.item ?? "")
      .normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ").trim(),
  ).filter(name => name && !/\b(?:garnish|decoration|decorative|sprinkles?|salt|cinnamon|nutmeg|zest|extract|essence)\b/.test(name) &&
    !/^(?:cold |warm |hot |filtered )?water$/.test(name));
  return components.length ? [...new Set(components)].sort().join("|") : null;
}
