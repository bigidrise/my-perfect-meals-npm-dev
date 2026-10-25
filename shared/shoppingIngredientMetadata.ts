import { z } from "zod";

const text = z.string().trim().min(1).max(2000);
const amount = z.union([z.number().finite(), z.string().max(200)]);
const requirement = z.object({
  value: text,
  origin: z.enum(["explicit_ingredient", "explicit_request", "profile_guidance"]),
  authorityReference: text.optional(),
}).strict();
const provenance = z.object({
  source: text,
  sourceRecordId: text.optional(),
  observedAt: text.optional(),
  retrievedAt: text.optional(),
  formulationDate: text.optional(),
}).strict();
const fact = z.object({
  kind: z.enum(["ingredients", "nutrition", "declared_allergens", "precautionary_allergens", "certification", "other"]),
  statement: text,
  target: text.optional(),
  measurement: z.object({
    value: z.number().finite(),
    unit: text,
    basis: z.enum(["per_100g", "per_100ml", "per_serving", "per_package"]),
    servingSize: text.optional(),
  }).strict().optional(),
  provenance,
}).strict();

/** Storage only. An assessment is historical evidence, never a safety clearance. */
export const shoppingIngredientMetadataSchema = z.object({
  version: z.literal(1),
  ingredient: z.object({
    originalName: text,
    matchingName: text,
    requirements: z.array(requirement).max(100),
  }).strict(),
  contributions: z.array(z.object({
    id: text,
    originalText: text,
    quantity: amount.optional(),
    unit: z.string().max(200),
    recipeId: text.optional(),
    recipeName: text.optional(),
    source: text.optional(),
  }).strict()).max(1000),
  selectedProduct: z.object({
    productKey: text,
    name: text,
    brand: text.optional(),
    variant: text.optional(),
    upc: z.string().regex(/^\d{8,14}$/).optional(),
    packageDescription: text.optional(),
    servingDescription: text.optional(),
    retailQuantity: amount.optional(),
    source: provenance,
    /** Original saved/catalog payload; opaque historical evidence, never a verdict. */
    sourcePayloadJson: z.string().max(100000).refine(value => {
      try { JSON.parse(value); return true; } catch { return false; }
    }, "Invalid source payload JSON").optional(),
    evidence: z.array(fact).max(200),
    assessment: z.object({
      status: z.enum(["unreviewed", "review_required", "profile_matched", "eligible_at_evaluation", "rejected"]),
      unresolvedRequirements: z.array(text).max(100),
      reasons: z.array(text).max(100),
      evaluatedAt: text.optional(),
      policyVersion: text.optional(),
      subjectReference: text.optional(),
      contextReference: text.optional(),
    }).strict(),
  }).strict().nullable().optional(),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.contributions.map(c => c.id)).size !== value.contributions.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate contribution identity" });
  }
});

export type ShoppingIngredientMetadata = z.infer<typeof shoppingIngredientMetadataSchema>;

/**
 * Narrow compatibility contract for Coach's knowledge-based Add action.
 * This does not enable the Development catalog or confer product eligibility.
 */
export function groceryCoachProductMetadata(value: unknown, ingredientName: string): ShoppingIngredientMetadata | undefined {
  if (value == null) return undefined;
  const metadata = shoppingIngredientMetadataSchema.parse(value);
  const product = metadata.selectedProduct;
  if (
    ingredientMatchingName(metadata.ingredient.originalName) !== ingredientMatchingName(ingredientName) ||
    !product || product.source.source !== "Product Scan by-name guidance" ||
    product.productKey !== `by_name:${JSON.stringify([metadata.ingredient.originalName.toLowerCase(), product.name.toLowerCase()])}` ||
    product.assessment.status !== "review_required" ||
    !product.assessment.unresolvedRequirements.includes("current_profile_and_label_review") ||
    product.evidence.length !== 0 ||
    !metadata.contributions.length ||
    metadata.contributions.some(c => c.source !== "grocery_coach")
  ) {
    throw new z.ZodError([{ code: "custom", path: ["ingredientMetadata"], message: "Invalid Grocery Coach product association" }]);
  }
  return metadata;
}

const qualifierPatterns: Array<[RegExp, string]> = [
  [/\blow[\s-]+sodium\b/i, "low sodium"],
  [/\breduced[\s-]+sodium\b/i, "reduced sodium"],
  [/\b(?:no[\s-]+added[\s-]+salt|unsalted|salt[\s-]+free|sodium[\s-]+free)\b/i, "no added salt"],
  [/\breduced[\s-]+sugar\b/i, "reduced sugar"],
  [/\blow[\s-]+sugar\b/i, "low sugar"],
  [/\bsugar[\s-]+free\b/i, "sugar free"],
  [/\bno[\s-]+added[\s-]+sugar\b/i, "no added sugar"],
  [/\bgluten[\s-]+free\b/i, "gluten free"],
  [/\b(?:dairy|lactose|nut|peanut|soy|egg)[\s-]+free\b/ig, ""],
  [/\b(?:vegan|vegetarian|halal|kosher)\b/ig, ""],
  [/\b(?:low|reduced)[\s-]+(?:fat|carb(?:ohydrate)?s?)\b/ig, ""],
];

export function ingredientMatchingName(name: string): string {
  // Deliberately conservative: never remove qualifiers, brands or comma text.
  return name.trim().toLowerCase().replace(/[-‐‑–]/g, " ").replace(/\s+/g, " ");
}

export function explicitIngredientRequirements(name: string): ShoppingIngredientMetadata["ingredient"]["requirements"] {
  const found = new Set<string>();
  for (const [pattern, label] of qualifierPatterns) {
    for (const match of name.matchAll(new RegExp(pattern.source, "ig"))) {
      found.add(label || ingredientMatchingName(match[0]));
    }
  }
  return [...found].sort().map(value => ({ value, origin: "explicit_ingredient" as const }));
}

export function parseIngredientMetadata(value: unknown): ShoppingIngredientMetadata | undefined {
  if (value == null) return undefined;
  const parsed = shoppingIngredientMetadataSchema.parse(value);
  // Never trust caller-supplied matching fields to erase an explicit qualifier.
  const requirements = [...parsed.ingredient.requirements];
  for (const r of explicitIngredientRequirements(parsed.ingredient.originalName)) {
    if (!requirements.some(e => e.origin === r.origin && e.value === r.value)) requirements.push(r);
  }
  return {
    ...parsed,
    ingredient: {
      ...parsed.ingredient,
      matchingName: ingredientMatchingName(parsed.ingredient.originalName),
      requirements,
    },
  };
}

export function makeIngredientMetadata(input: {
  name: string;
  quantity?: number | string;
  unit?: string;
  originalText?: string;
  recipeId?: string;
  recipeName?: string;
  source?: string;
  ingredientMetadata?: unknown;
}): ShoppingIngredientMetadata {
  const existing = parseIngredientMetadata(input.ingredientMetadata);
  if (existing) return existing;
  return shoppingIngredientMetadataSchema.parse({
    version: 1,
    ingredient: {
      originalName: input.name,
      matchingName: ingredientMatchingName(input.name),
      requirements: explicitIngredientRequirements(input.name),
    },
    contributions: [{
      id: `contribution_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      originalText: input.originalText || input.name,
      quantity: input.quantity,
      unit: input.unit || "",
      recipeId: input.recipeId,
      recipeName: input.recipeName,
      source: input.source,
    }],
  });
}

export interface ShoppingIdentityInput {
  name: string;
  normalizedName?: string;
  productKey?: string | null;
  ingredientMetadata?: ShoppingIngredientMetadata | null;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return JSON.stringify(Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, JSON.parse(stable(v))]),
  ));
  return JSON.stringify(value);
}

export function shoppingIdentityKey(item: ShoppingIdentityInput): string {
  const m = parseIngredientMetadata(item.ingredientMetadata);
  if (!m) return stable(["legacy", (item.normalizedName || item.name).toLowerCase().trim(), item.productKey || null]);
  return stable([
    "v1", m.ingredient.matchingName,
    m.ingredient.requirements.map(r => stable(r)).sort(),
    // Different evidence/review snapshots stay separate rather than silently
    // promoting one assessment over another for the same UPC.
    m.selectedProduct || null, item.productKey || null,
  ]);
}

export function mergeIngredientMetadata(
  left?: ShoppingIngredientMetadata | null,
  right?: ShoppingIngredientMetadata | null,
): ShoppingIngredientMetadata | undefined {
  const a = parseIngredientMetadata(left), b = parseIngredientMetadata(right);
  if (!a) return b;
  if (!b) return a;
  if (shoppingIdentityKey({ name: "", ingredientMetadata: a }) !==
      shoppingIdentityKey({ name: "", ingredientMetadata: b })) {
    throw new Error("Incompatible shopping ingredient metadata");
  }
  return preserveRecipeContributions(a, b);
}

/** A retail choice update must never erase its original recipe provenance. */
export function preserveRecipeContributions(
  previous: ShoppingIngredientMetadata, next: ShoppingIngredientMetadata,
): ShoppingIngredientMetadata {
  const contributions = new Map(previous.contributions.map(c => [c.id, c]));
  for (const c of next.contributions) {
    const existing = contributions.get(c.id);
    if (existing && stable(existing) !== stable(c)) throw new Error("Conflicting recipe contribution");
    contributions.set(c.id, c);
  }
  return shoppingIngredientMetadataSchema.parse({ ...next, contributions: [...contributions.values()] });
}
