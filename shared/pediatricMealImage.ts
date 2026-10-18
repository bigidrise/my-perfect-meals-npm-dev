import { z } from "zod";

/** Visual instructions only. This does not resolve nutrition, allergies, or clinical authority. */
export const pediatricImageContextSchema = z.object({
  stage: z.string().trim().min(1).max(80),
  ageRange: z.string().max(80),
  portionNote: z.string().max(300),
  textureHint: z.string().max(4000).optional(),
  textureClass: z.enum(["puree_only", "mashed_soft", "soft_chopped", "family_modified", "family_table"]).optional(),
  textureStrategy: z.string().max(1000).optional(),
  presentationStrategy: z.string().max(1000).optional(),
  activeConditionIds: z.array(z.string().regex(/^COND-\d+$/)).max(50).optional(),
// Keep validated required fields explicit under the server's non-strict compiler too.
}).transform((value): PediatricImageContext => ({
  ...value, stage: value.stage, ageRange: value.ageRange, portionNote: value.portionNote,
}));

export interface PediatricImageContext {
  stage: string;
  ageRange: string;
  portionNote: string;
  textureHint?: string;
  textureClass?: string;
  textureStrategy?: string;
  presentationStrategy?: string;
  activeConditionIds?: string[];
}

export type PediatricImageSource = "meal" | "snack" | "dessert" | "beverage";
export type RecipeImageStatus = "generated" | "fallback" | "unavailable";

export interface PediatricImageGeneration {
  pediatricContext: PediatricImageContext;
  sourceType: PediatricImageSource;
  status: RecipeImageStatus;
  /** A completed contextual attempt, even if no photo could be produced. Never auto-loop. */
  attemptedWithPediatricContext: true;
  /** Stops repeated paid restoration if generation worked but durable storage did not. */
  automaticRepairAttempted?: true;
  fallbackUrl?: string;
}

const STAGE_VISUALS: Record<string, {
  label: string; ageRange: string; textureClass: string; presentation: string;
}> = {
  early_infant: { label: "Early Infant", ageRange: "Birth–~5 months", textureClass: "puree_only", presentation: "no solid food — breast milk or formula only, no plate" },
  beginning_foods: { label: "Beginning Foods", ageRange: "~6–11 months", textureClass: "puree_only", presentation: "tiny portion in a small infant bowl — completely smooth purée, no finger foods visible" },
  young_toddler: { label: "Young Toddler", ageRange: "12–23 months", textureClass: "mashed_soft", presentation: "small toddler plate with very soft bite-sized pieces, colorful and simply presented" },
  toddler: { label: "Toddler", ageRange: "2–3 years", textureClass: "soft_chopped", presentation: "small toddler plate with soft small pieces, fun and simple — not an adult portion" },
  preschool: { label: "Preschool", ageRange: "4–5 years", textureClass: "family_modified", presentation: "small child's plate, simply presented and colorful, cut into manageable pieces" },
  early_school_age: { label: "Early School Age", ageRange: "6–8 years", textureClass: "family_table", presentation: "child's plate with age-appropriate portions, familiar and approachable presentation" },
  growing_child: { label: "Growing Child", ageRange: "9–12 years", textureClass: "family_table", presentation: "standard child's plate with normal portions — not a full adult restaurant serving" },
};

export function buildPediatricImageContext(input: {
  stageKey: string;
  textureClass?: string;
  textureStrategy?: string;
  presentationStrategy?: string;
  textureAndChokingPreparation?: string;
  activeConditionIds?: string[];
}): PediatricImageContext {
  const stage = STAGE_VISUALS[input.stageKey];
  return {
    stage: stage?.label ?? input.stageKey,
    ageRange: stage?.ageRange ?? "child",
    portionNote: `small ${(stage?.label ?? "child").toLowerCase()} portion`,
    textureClass: input.textureClass ?? stage?.textureClass,
    textureStrategy: input.textureStrategy,
    // Keep the validated recipe's preparation instructions, not just a stage label.
    textureHint: input.textureAndChokingPreparation || undefined,
    presentationStrategy: input.presentationStrategy ?? stage?.presentation,
    activeConditionIds: [...new Set(input.activeConditionIds ?? [])].sort(),
  };
}

export function pediatricImageSource(occasion?: string): PediatricImageSource {
  switch (occasion?.toLowerCase()) {
    case "snack": return "snack";
    case "dessert": return "dessert";
    case "smoothie":
    case "beverage": return "beverage";
    default: return "meal";
  }
}

export function isFallbackMealImage(url?: string | null): boolean {
  if (!url) return false;
  // Recognize relative and absolute first-party placeholder URLs, including query strings.
  try {
    return new URL(url, "https://placeholder.invalid").pathname.startsWith("/images/fallback/");
  } catch {
    return false;
  }
}

export function recipeImageStatus(url?: string | null): RecipeImageStatus {
  return !url ? "unavailable" : isFallbackMealImage(url) ? "fallback" : "generated";
}
