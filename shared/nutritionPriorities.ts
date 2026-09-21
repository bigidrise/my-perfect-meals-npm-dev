import { z } from "zod";

export const NUTRITION_PRIORITIES_REGISTRY_VERSION = "nutrition-priorities.v1" as const;
export const FOOD_INCLUSION_PRIORITIES_SCHEMA_VERSION = 1 as const;

export const foodInclusionPriorityIdSchema = z.enum([
  "fiber_rich_foods",
  "plant_variety",
  "fermented_foods",
  "omega_3_food_sources",
  "protein_rich_foods",
  "iron_rich_foods",
  "calcium_rich_foods",
  "magnesium_rich_foods",
]);
export type FoodInclusionPriorityId = z.infer<typeof foodInclusionPriorityIdSchema>;

export interface PediatricNutritionPriorityProjection {
  status: "approved" | "deferred";
  shortSummary: string;
  whyChooseIt: string;
  whatMpmDoes: string;
  limitations: string[];
}

export interface FoodInclusionPriorityDefinition {
  id: FoodInclusionPriorityId;
  label: string;
  shortSummary: string;
  whatItIs: string;
  whyChooseIt: string;
  whatMpmDoes: string;
  generallySupports: string;
  foodExamples: string[];
  limitations: string[];
  parentFacingPediatricExplanation: string;
  pediatricProjection: PediatricNutritionPriorityProjection;
  promptSafeCulinaryGuidance: string;
  citations: Array<{ title: string; url: string }>;
  evidenceStatus: "established_food_guidance" | "supported_food_pattern" | "emerging";
  lastReviewedOn: string;
  status: "active" | "inactive";
}

const reviewedOn = "2026-09-21";
export const FOOD_INCLUSION_PRIORITY_REGISTRY: Record<
  FoodInclusionPriorityId,
  FoodInclusionPriorityDefinition
> = {
  fiber_rich_foods: {
    id: "fiber_rich_foods", label: "Fiber-Rich Foods",
    shortSummary: "Favor meals containing naturally fiber-rich foods.",
    whatItIs: "Beans, lentils, whole grains, vegetables, fruit, nuts, and seeds.",
    whyChooseIt: "To support digestive regularity, fullness, and a generally healthy food pattern.",
    whatMpmDoes: "Makes reasonable ingredient and side choices that increase fiber without forcing every meal to be high fiber.",
    generallySupports: "Digestive regularity and a varied food pattern.",
    foodExamples: ["beans", "lentils", "whole grains", "vegetables", "fruit", "nuts", "seeds"],
    limitations: ["Increase gradually when tolerance matters.", "Do not present as detoxification, treatment, or guaranteed weight loss."],
    parentFacingPediatricExplanation: "MPM may include age-appropriate fiber foods when tolerated; pediatric safety and feeding needs remain authoritative.",
    pediatricProjection: {
      status: "approved",
      shortSummary: "Consider age-appropriate fiber-rich foods when they fit and are tolerated.",
      whyChooseIt: "To make a range of naturally fiber-containing foods easier to include in ordinary meals.",
      whatMpmDoes: "May include age-appropriate fiber foods when they safely fit the meal and the child's feeding needs.",
      limitations: ["Selection does not require fiber-rich food in every meal.", "Increase gradually when tolerance matters.", "Age, allergies, texture, feeding ability, and clinical context remain authoritative."],
    },
    promptSafeCulinaryGuidance: "When natural for the dish, prefer or add a tolerated fiber-rich whole food; omission is valid.",
    citations: [
      { title: "Dietary Guidelines for Americans 2020–2025", url: "https://www.dietaryguidelines.gov/sites/default/files/2020-12/Dietary_Guidelines_for_Americans_2020-2025.pdf" },
      { title: "Carbohydrate quality and human health", url: "https://doi.org/10.1016/S0140-6736(18)31809-9" },
    ],
    evidenceStatus: "established_food_guidance", lastReviewedOn: reviewedOn, status: "active",
  },
  plant_variety: {
    id: "plant_variety", label: "Plant Variety",
    shortSummary: "Include a wider range of plant foods over time.",
    whatItIs: "Variety across vegetables, fruits, legumes, grains, nuts, seeds, herbs, and spices.",
    whyChooseIt: "To make eating more varied and provide different nutrients, flavors, and textures.",
    whatMpmDoes: "Rotates suitable plant ingredients when practical without imposing a count or quota.",
    generallySupports: "Dietary variety and exposure to different nutrient-dense foods.",
    foodExamples: ["vegetables", "fruit", "legumes", "whole grains", "nuts", "seeds", "herbs"],
    limitations: ["No fixed weekly plant count.", "Must respect sensory needs, culture, affordability, and the current request."],
    parentFacingPediatricExplanation: "MPM may offer familiar, age-appropriate plant variety without pressuring a child to eat or overriding feeding needs.",
    pediatricProjection: {
      status: "approved",
      shortSummary: "Consider a wider range of age-appropriate plant foods over time.",
      whyChooseIt: "To offer different flavors, textures, and ordinary food choices without setting a count or quota.",
      whatMpmDoes: "May rotate suitable plant foods in familiar forms without pressuring the child or forcing unrelated ingredients into a meal.",
      limitations: ["No fixed plant count or frequency.", "Selection does not mean the child will eat or accept a food.", "Sensory needs, culture, affordability, allergies, and the current request remain authoritative."],
    },
    promptSafeCulinaryGuidance: "Use a suitable range of plant foods over time; never add unrelated ingredients merely to increase variety.",
    citations: [{ title: "Dietary Guidelines for Americans 2020–2025", url: "https://www.dietaryguidelines.gov/sites/default/files/2020-12/Dietary_Guidelines_for_Americans_2020-2025.pdf" }],
    evidenceStatus: "supported_food_pattern", lastReviewedOn: reviewedOn, status: "active",
  },
  fermented_foods: {
    id: "fermented_foods", label: "Fermented Foods",
    shortSummary: "Consider appropriate fermented foods for culinary variety.",
    whatItIs: "Foods such as yogurt with live cultures, kefir, kimchi, sauerkraut, miso, and tempeh.",
    whyChooseIt: "For flavor, tradition, variety, and, depending on the product, live cultures.",
    whatMpmDoes: "Suggests product-specific fermented foods when they fit the cuisine and safety context.",
    generallySupports: "Culinary variety; some products provide live microorganisms.",
    foodExamples: ["yogurt with live cultures", "kefir", "kimchi", "sauerkraut", "miso", "tempeh"],
    limitations: ["Fermented does not automatically mean probiotic.", "Do not promise microbiome or therapeutic benefits.", "Consider sodium, alcohol, allergy, and tolerance."],
    parentFacingPediatricExplanation: "MPM may use child-appropriate fermented foods, but does not treat every fermented product as a proven probiotic.",
    pediatricProjection: {
      status: "approved",
      shortSummary: "Consider child-appropriate fermented foods when they fit the meal.",
      whyChooseIt: "For culinary variety, familiar traditions, and different flavors when the specific food is appropriate.",
      whatMpmDoes: "May suggest a specific child-appropriate fermented food when it fits the cuisine and safety context.",
      limitations: ["Fermented does not automatically mean probiotic.", "No microbiome, treatment, or guaranteed health claims.", "Sodium, alcohol, allergy, age, preparation, and tolerance remain authoritative."],
    },
    promptSafeCulinaryGuidance: "Use a product-specific fermented food only when safe and natural for the dish; never claim a probiotic benefit.",
    citations: [{ title: "NIH ODS Probiotics Consumer Fact Sheet", url: "https://ods.od.nih.gov/factsheets/Probiotics-Consumer/" }],
    evidenceStatus: "emerging", lastReviewedOn: reviewedOn, status: "active",
  },
  omega_3_food_sources: {
    id: "omega_3_food_sources", label: "Omega-3 Food Sources",
    shortSummary: "Consider foods that supply omega-3 fats.",
    whatItIs: "Lower-mercury fatty seafood for EPA/DHA and foods such as chia, flax, and walnuts for ALA.",
    whyChooseIt: "To include essential fats through ordinary foods.",
    whatMpmDoes: "Offers suitable seafood or plant sources without treating them as nutritionally identical.",
    generallySupports: "Inclusion of essential omega-3 fats in an overall food pattern.",
    foodExamples: ["salmon", "sardines", "trout", "chia seeds", "flaxseed", "walnuts"],
    limitations: ["ALA is not equivalent to EPA/DHA.", "Respect fish allergy, pregnancy guidance, and mercury advisories.", "No supplement substitution."],
    parentFacingPediatricExplanation: "MPM may suggest age-appropriate lower-mercury seafood or plant sources while respecting allergies and pediatric fish guidance.",
    pediatricProjection: {
      status: "approved",
      shortSummary: "Consider age-appropriate foods that provide omega-3 fats.",
      whyChooseIt: "To make suitable seafood or plant omega-3 food sources easier to include through ordinary meals.",
      whatMpmDoes: "May use an age-appropriate lower-mercury seafood source or a suitable plant source. If fish does not fit, MPM can omit it or consider a compatible plant food without claiming equivalence.",
      limitations: ["ALA plant sources are not equivalent to EPA/DHA seafood sources.", "Fish allergy, dietary identity, age, preparation safety, and pediatric seafood guidance remain authoritative.", "No supplement recommendations."],
    },
    promptSafeCulinaryGuidance: "When compatible, feature a lower-mercury seafood source or suitable plant ALA source; do not imply equivalence or supplement dosing.",
    citations: [{ title: "NIH ODS Omega-3 Fatty Acids", url: "https://ods.od.nih.gov/factsheets/Omega3FattyAcids-HealthProfessional/" }],
    evidenceStatus: "established_food_guidance", lastReviewedOn: reviewedOn, status: "active",
  },
  protein_rich_foods: {
    id: "protein_rich_foods", label: "Protein-Rich Foods",
    shortSummary: "Intentionally feature suitable protein-containing foods within existing nutrition targets.",
    whatItIs: "Seafood, eggs, poultry, meat, dairy, legumes, soy foods, nuts, and seeds.",
    whyChooseIt: "To make a balanced protein food more intentional within the meal.",
    whatMpmDoes: "Selects a compatible protein source without creating, increasing, or replacing any macro target.",
    generallySupports: "Balanced meal composition within authoritative nutrition targets.",
    foodExamples: ["beans", "lentils", "tofu", "eggs", "seafood", "poultry", "yogurt", "nuts"],
    limitations: ["Never changes protein or macro targets.", "Medical and clinician-set restrictions remain superior."],
    parentFacingPediatricExplanation: "MPM may feature an age-appropriate protein food within the child's existing pediatric context; it does not create a protein target.",
    pediatricProjection: {
      status: "approved",
      shortSummary: "Consider suitable protein-containing foods within the child's existing nutrition context.",
      whyChooseIt: "To make an appropriate protein food more intentional within an ordinary meal.",
      whatMpmDoes: "May feature an age-appropriate protein food that fits the child's established dietary, feeding, and clinical context.",
      limitations: ["Never creates or changes a protein, calorie, or macro target.", "Selection does not require a protein-rich food in every meal.", "Allergies, feeding ability, dietary identity, and clinician-set restrictions remain authoritative."],
    },
    promptSafeCulinaryGuidance: "Feature a compatible protein food within existing authoritative targets; never increase or replace a protein or macro target.",
    citations: [{ title: "Dietary Guidelines: Protein Foods", url: "https://www.dietaryguidelines.gov/food-sources-protein-foods" }],
    evidenceStatus: "established_food_guidance", lastReviewedOn: reviewedOn, status: "active",
  },
  iron_rich_foods: {
    id: "iron_rich_foods", label: "Iron-Rich Foods",
    shortSummary: "Include foods that naturally provide iron.",
    whatItIs: "Meat, seafood, poultry, legumes, tofu, fortified cereals, leafy greens, nuts, and seeds.",
    whyChooseIt: "To make iron-containing foods easier to include in ordinary meals.",
    whatMpmDoes: "Uses food sources and appropriate pairings; it never diagnoses deficiency or recommends supplements.",
    generallySupports: "Ordinary dietary iron intake.",
    foodExamples: ["meat", "seafood", "lentils", "beans", "tofu", "fortified cereal", "leafy greens"],
    limitations: ["Cannot diagnose or treat iron deficiency.", "No supplement advice.", "Clinical conditions remain authoritative."],
    parentFacingPediatricExplanation: "MPM may include age-appropriate iron-containing foods but cannot diagnose anemia or replace pediatric care.",
    pediatricProjection: {
      status: "approved",
      shortSummary: "Consider age-appropriate foods that naturally contain iron.",
      whyChooseIt: "To make ordinary iron-containing foods easier to include when they fit.",
      whatMpmDoes: "May include a suitable iron-containing food and an appropriate food pairing without changing the child's nutrition targets.",
      limitations: ["Cannot diagnose or treat iron deficiency or anemia.", "No supplement recommendations.", "Age, allergies, feeding safety, dietary identity, and clinical care remain authoritative."],
    },
    promptSafeCulinaryGuidance: "When natural for the meal, include a suitable iron-containing food and optionally pair plant sources with vitamin-C-rich food.",
    citations: [{ title: "NIH ODS Iron", url: "https://ods.od.nih.gov/factsheets/Iron-HealthProfessional/" }],
    evidenceStatus: "established_food_guidance", lastReviewedOn: reviewedOn, status: "active",
  },
  calcium_rich_foods: {
    id: "calcium_rich_foods", label: "Calcium-Rich Foods",
    shortSummary: "Include suitable calcium-containing foods.",
    whatItIs: "Dairy, fortified alternatives, calcium-set tofu, canned fish with bones, and selected greens.",
    whyChooseIt: "To make calcium-containing foods easier to include.",
    whatMpmDoes: "Offers compatible dairy or nondairy food sources while respecting allergies and dietary identity.",
    generallySupports: "Ordinary dietary calcium intake.",
    foodExamples: ["milk", "yogurt", "fortified plant beverages", "calcium-set tofu", "sardines", "kale"],
    limitations: ["Fortification and absorption vary.", "No supplement or osteoporosis-prevention claims.", "Respect allergy and clinical context."],
    parentFacingPediatricExplanation: "MPM may use age-appropriate calcium-containing foods while respecting milk allergy, tolerance, and the child's care context.",
    pediatricProjection: {
      status: "approved",
      shortSummary: "Consider suitable age-appropriate foods that contain calcium.",
      whyChooseIt: "To make calcium-containing foods easier to include through ordinary meals and snacks.",
      whatMpmDoes: "May use an appropriate dairy or nondairy calcium-containing food while respecting the child's established context.",
      limitations: ["Fortification and absorption vary by food and product.", "No supplement, treatment, growth, or bone-health guarantees.", "Milk allergy, tolerance, dietary identity, feeding safety, and clinical context remain authoritative."],
    },
    promptSafeCulinaryGuidance: "When suitable, include an allergy-compatible calcium-containing food; verify fortified products rather than assuming equivalence.",
    citations: [{ title: "NIH ODS Calcium", url: "https://ods.od.nih.gov/factsheets/Calcium-HealthProfessional/" }],
    evidenceStatus: "established_food_guidance", lastReviewedOn: reviewedOn, status: "active",
  },
  magnesium_rich_foods: {
    id: "magnesium_rich_foods", label: "Magnesium-Rich Foods",
    shortSummary: "Include foods that naturally provide magnesium.",
    whatItIs: "Nuts, seeds, legumes, whole grains, leafy greens, avocado, and selected seafood.",
    whyChooseIt: "To increase the presence of magnesium-containing whole foods.",
    whatMpmDoes: "Suggests ordinary food sources without supplement or treatment claims.",
    generallySupports: "Ordinary dietary magnesium intake.",
    foodExamples: ["pumpkin seeds", "almonds", "beans", "whole grains", "leafy greens", "avocado"],
    limitations: ["No supplement, sleep, cramp, or treatment claims.", "Clinical and renal context remain superior."],
    parentFacingPediatricExplanation: "MPM may include age-appropriate magnesium-containing foods while respecting allergy, texture, and feeding safety.",
    pediatricProjection: {
      status: "approved",
      shortSummary: "Consider age-appropriate foods that naturally contain magnesium.",
      whyChooseIt: "To make suitable magnesium-containing whole foods easier to include when they fit.",
      whatMpmDoes: "May include an appropriate magnesium-containing food while respecting the child's established dietary and feeding context.",
      limitations: ["No supplement, sleep, cramp, treatment, or growth claims.", "Selection does not create a magnesium target.", "Allergy, texture, feeding safety, and clinical or renal context remain authoritative."],
    },
    promptSafeCulinaryGuidance: "When natural and safe, include a suitable magnesium-containing whole food; do not imply supplement-equivalent effects.",
    citations: [{ title: "NIH ODS Magnesium", url: "https://ods.od.nih.gov/factsheets/Magnesium-HealthProfessional/" }],
    evidenceStatus: "established_food_guidance", lastReviewedOn: reviewedOn, status: "active",
  },
};

export const foodInclusionPrioritiesWriteSchema = z.object({
  schemaVersion: z.literal(FOOD_INCLUSION_PRIORITIES_SCHEMA_VERSION),
  registryVersion: z.literal(NUTRITION_PRIORITIES_REGISTRY_VERSION),
  selectedPriorityIds: z.array(foodInclusionPriorityIdSchema).max(8),
}).strict();

export const pediatricFoodInclusionPrioritiesWriteSchema =
  foodInclusionPrioritiesWriteSchema.superRefine((value, context) => {
    for (const id of value.selectedPriorityIds) {
      if (FOOD_INCLUSION_PRIORITY_REGISTRY[id].pediatricProjection.status !== "approved") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["selectedPriorityIds"],
          message: `${id} is not approved for pediatric use`,
        });
      }
    }
  });

export const foodInclusionPrioritiesDocumentSchema = foodInclusionPrioritiesWriteSchema.extend({
  updatedAt: z.string().datetime().nullable(),
}).strict();
export type FoodInclusionPrioritiesDocument = z.infer<typeof foodInclusionPrioritiesDocumentSchema>;

export function emptyFoodInclusionPrioritiesDocument(): FoodInclusionPrioritiesDocument {
  return {
    schemaVersion: FOOD_INCLUSION_PRIORITIES_SCHEMA_VERSION,
    registryVersion: NUTRITION_PRIORITIES_REGISTRY_VERSION,
    selectedPriorityIds: [],
    updatedAt: null,
  };
}

export function normalizeFoodInclusionPrioritiesDocument(value: unknown): FoodInclusionPrioritiesDocument {
  const parsed = foodInclusionPrioritiesDocumentSchema.safeParse(value);
  if (!parsed.success) return emptyFoodInclusionPrioritiesDocument();
  return {
    ...parsed.data,
    selectedPriorityIds: [...new Set(parsed.data.selectedPriorityIds)],
  };
}

export function normalizePediatricFoodInclusionPrioritiesDocument(
  value: unknown,
): FoodInclusionPrioritiesDocument {
  const document = normalizeFoodInclusionPrioritiesDocument(value);
  return {
    ...document,
    selectedPriorityIds: document.selectedPriorityIds.filter(
      (id) => FOOD_INCLUSION_PRIORITY_REGISTRY[id].pediatricProjection.status === "approved",
    ),
  };
}

export function createFoodInclusionPrioritiesDocument(
  input: z.infer<typeof foodInclusionPrioritiesWriteSchema>,
): FoodInclusionPrioritiesDocument {
  return {
    ...input,
    selectedPriorityIds: [...new Set(input.selectedPriorityIds)],
    updatedAt: new Date().toISOString(),
  };
}