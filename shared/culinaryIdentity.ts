import { z } from "zod";
import { myPerfectMenuCategorySchema, type MyPerfectMenuCategory } from "./myPerfectMenuCategory";

const compactText = z.string().trim().min(1).max(80);

export const culinaryIdentitySchema = z.object({
  dishForm: compactText,
  preparationStyle: compactText,
  texture: compactText.optional(),
  temperature: z.enum(["hot", "warm", "room_temperature", "chilled", "frozen"]).optional(),
  primaryProteinBase: compactText.nullable(),
  majorStarchBase: compactText.nullable(),
  flavorFamily: compactText,
  cuisineEvidence: compactText,
  definingComponents: z.array(compactText).min(1).max(8),
});

export type CulinaryIdentity = z.infer<typeof culinaryIdentitySchema>;

export const culinaryFingerprintSchema = z.object({
  occasion: myPerfectMenuCategorySchema,
  dishForm: compactText,
  preparationStyle: compactText,
  texture: compactText.optional(),
  temperature: z.enum(["hot", "warm", "room_temperature", "chilled", "frozen"]).optional(),
  primaryProteinBase: compactText.nullable(),
  majorStarchBase: compactText.nullable(),
  flavorFamily: compactText,
  cuisine: compactText,
  ingredients: z.array(compactText).min(1).max(12),
  fingerprint: z.string().trim().min(5).max(40),
});

export type CulinaryFingerprint = z.infer<typeof culinaryFingerprintSchema>;

export interface CulinaryConceptInput {
  title: string;
  primaryIngredients: string[];
  primaryProtein: string | null;
  cuisine: string;
  preparationMethod: string;
  culinaryIdentity?: CulinaryIdentity;
}

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, "_");
}

function canonicalDishForm(value: unknown): string {
  const normalized = normalize(value);
  const aliases: Array<[RegExp, string]> = [
    [/(^|_)(grain|rice|power|nourish)_bowl$|^bowl$/, "bowl"],
    [/(^|_)(chopped|composed|garden)_salad$|^salad$/, "salad"],
    [/(^|_)(tortilla_)?wrap$|^rolled_wrap$/, "wrap"],
    [/(^|_)(toasted_)?sandwich$|^panini$/, "sandwich"],
    [/(^|_)(kebab|kabob|skewers?)$/, "skewer"],
  ];
  return aliases.find(([pattern]) => pattern.test(normalized))?.[1] ?? normalized;
}

function compactHash(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `ci1-${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizedIngredients(values: string[]): string[] {
  return [...new Set(values.map(normalize).filter(Boolean))].sort().slice(0, 12);
}

export function buildCulinaryFingerprint(
  concept: CulinaryConceptInput,
  occasion: MyPerfectMenuCategory,
): CulinaryFingerprint {
  const identity = concept.culinaryIdentity;
  const dishForm = canonicalDishForm(identity?.dishForm || concept.title);
  const preparationStyle = normalize(identity?.preparationStyle || concept.preparationMethod);
  const texture = identity?.texture ? normalize(identity.texture) : undefined;
  const primaryProteinBase = normalize(identity?.primaryProteinBase || concept.primaryProtein) || null;
  const majorStarchBase = normalize(identity?.majorStarchBase) || null;
  const flavorFamily = normalize(identity?.flavorFamily || "unspecified");
  const cuisine = normalize(identity?.cuisineEvidence || concept.cuisine);
  const ingredients = normalizedIngredients([
    ...concept.primaryIngredients,
    ...(identity?.definingComponents ?? []),
  ]);
  const canonicalFingerprint = [
    occasion,
    dishForm,
    preparationStyle,
    primaryProteinBase || "none",
    majorStarchBase || "none",
    flavorFamily,
    cuisine,
    ingredients.join("+"),
  ].join("|");
  const fingerprint = compactHash(canonicalFingerprint);

  return culinaryFingerprintSchema.parse({
    occasion,
    dishForm,
    preparationStyle,
    ...(texture ? { texture } : {}),
    ...(identity?.temperature ? { temperature: identity.temperature } : {}),
    primaryProteinBase,
    majorStarchBase,
    flavorFamily,
    cuisine,
    ingredients,
    fingerprint,
  });
}

function overlap(left: string[], right: string[]): number {
  if (!left.length || !right.length) return 0;
  const a = new Set(left);
  const b = new Set(right);
  let matches = 0;
  a.forEach((value) => {
    if (b.has(value)) matches += 1;
  });
  return matches / Math.max(a.size, b.size);
}

function same(left: string | null | undefined, right: string | null | undefined): number {
  return left && right && left === right ? 1 : 0;
}

export interface CulinarySimilarity {
  exact: boolean;
  ingredient: number;
  structural: number;
  sensory: number;
  nearDuplicate: boolean;
}

export function compareCulinaryFingerprints(
  left: CulinaryFingerprint,
  right: CulinaryFingerprint,
): CulinarySimilarity {
  if (left.occasion !== right.occasion) {
    return { exact: false, ingredient: 0, structural: 0, sensory: 0, nearDuplicate: false };
  }

  const ingredient = overlap(left.ingredients, right.ingredients);
  const structural =
    same(left.dishForm, right.dishForm) * 0.38 +
    same(left.preparationStyle, right.preparationStyle) * 0.2 +
    same(left.majorStarchBase, right.majorStarchBase) * 0.15 +
    same(left.primaryProteinBase, right.primaryProteinBase) * 0.07 +
    same(left.cuisine, right.cuisine) * 0.12 +
    same(left.flavorFamily, right.flavorFamily) * 0.08;
  const sensory =
    same(left.flavorFamily, right.flavorFamily) * 0.45 +
    same(left.texture, right.texture) * 0.3 +
    same(left.temperature, right.temperature) * 0.25;
  const exact = left.fingerprint === right.fingerprint;

  return {
    exact,
    ingredient,
    structural,
    sensory,
    nearDuplicate: exact || ingredient >= 0.75 || structural >= 0.73,
  };
}

export function culinaryBreadthPenalty(
  candidate: CulinaryFingerprint,
  history: CulinaryFingerprint[],
): number {
  if (!history.length) return 0;
  let strongest = 0;
  for (const prior of history) {
    const similarity = compareCulinaryFingerprints(candidate, prior);
    const score = similarity.exact
      ? 100
      : similarity.ingredient * 50 + similarity.structural * 38 + similarity.sensory * 12;
    strongest = Math.max(strongest, score);
  }

  const repeats = (field: keyof CulinaryFingerprint) =>
    history.filter((item) => candidate[field] && item[field] === candidate[field]).length;
  const repetitionPressure = Math.min(18, repeats("dishForm") * 3)
    + Math.min(8, repeats("preparationStyle") * 1.5)
    + Math.min(5, repeats("flavorFamily"));

  return Math.round((strongest + repetitionPressure) * 100) / 100;
}

export function selectCulinarilyBroadConcepts<T extends CulinaryConceptInput>(
  candidates: T[],
  occasion: MyPerfectMenuCategory,
  history: CulinaryFingerprint[],
  count = 3,
): T[] {
  const remaining = candidates.map((concept, index) => ({
    concept,
    index,
    fingerprint: buildCulinaryFingerprint(concept, occasion),
  }));
  const selected: typeof remaining = [];

  while (selected.length < count && remaining.length) {
    const comparisonHistory = [...history, ...selected.map((item) => item.fingerprint)];
    remaining.sort((left, right) => {
      const penaltyDelta =
        culinaryBreadthPenalty(left.fingerprint, comparisonHistory) -
        culinaryBreadthPenalty(right.fingerprint, comparisonHistory);
      return penaltyDelta || left.index - right.index;
    });
    selected.push(remaining.shift()!);
  }

  return selected.map((item) => item.concept);
}

export function hasMeaningfulCulinaryRepetition<T extends CulinaryConceptInput>(
  concepts: T[],
  occasion: MyPerfectMenuCategory,
): boolean {
  const fingerprints = concepts.map((concept) => buildCulinaryFingerprint(concept, occasion));
  return fingerprints.some((left, index) =>
    fingerprints.slice(index + 1).some((right) => compareCulinaryFingerprints(left, right).nearDuplicate),
  );
}