/**
 * Pediatric Resolver — My Perfect Beginning
 *
 * Single entry point that reads the active child profile + all embedded
 * registries and produces a structured PediatricMealGenerationContext.
 *
 * KEY RULE: This resolver does NOT generate meals and NEVER calls OpenAI.
 * It produces a fully-assembled context object. The AI's only job is to
 * write the recipe from that context.
 *
 * Priority order (outer → inner):
 *   1. Rule Registry      — safety rules (RULE-XXXX), hard stops
 *   2. Protocol Registry  — medical condition guidance blocks (COND-XXXX)
 *   3. Food Behavior Registry — food acceptance & behavioral strategy
 *   4. Ingredient Intelligence — allergen removals, cross-contact flags
 *   5. Behavior/Acceptance — sensory + picky-eater directives
 *   6. Culinary Registry  — stage-appropriate cooking methods
 *   7. Kitchen Reality    — time, budget, equipment constraints
 *
 * Family Meal mode: accepts multiple childProfileIds, runs intersection
 * optimization, produces one context or flags SPLIT_MEAL_REQUIRED.
 *
 * Sources: AAP 2023, WHO Growth Standards, USDA Dietary Guidelines (birth–24mo,
 * 2–5y editions), FDA food safety guidance, FARE allergy guidelines.
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES — PediatricMealGenerationContext and supporting interfaces
// ─────────────────────────────────────────────────────────────────────────────

export type DevelopmentalStageKey =
  | "early_infant"
  | "beginning_foods"
  | "young_toddler"
  | "toddler"
  | "preschool"
  | "early_school_age"
  | "growing_child";

export type TextureClass =
  | "puree_only"
  | "mashed_soft"
  | "soft_chopped"
  | "family_modified"
  | "family_table";

export type RuleLevel = "A" | "B" | "C";
export type ReviewStatus = "approved" | "pending_review" | "removed";

/** A fired rule entry — logged with permanent IDs, never descriptions alone */
export interface FiredRule {
  ruleId: string;       // RULE-XXXX
  level: RuleLevel;
  description: string;
  action: string;
  source: string;       // governing body / guideline citation
}

/** A medical condition protocol block — COND-XXXX */
export interface ProtocolBlock {
  conditionId: string;  // COND-XXXX
  conditionLabel: string;
  guidance: string[];
  hardLimits: string[];
  optimizations: string[];
  escalationTriggers: string[];
}

/** DRI baseline by stage — from USDA / AAP guidelines */
export interface StageDRIBaseline {
  stageKey: DevelopmentalStageKey;
  stageLabel: string;
  kcalRangeMin: number;
  kcalRangeMax: number;
  proteinGMin: number;
  proteinGMax: number;
  ironMg: number;
  calciumMg: number;
  vitaminDIU: number;
  sodiumMgMax: number;
  addedSugarGMax: number;
  servingSizeGuidance: string;
  textureClass: TextureClass;
  honeyAllowed: boolean;
  wholeMillkAsMainDrinkAllowed: boolean;
  juiceAllowed: boolean;
  notes: string[];
}

/** Allergen removal — result of allergen + ingredient intelligence pass */
export interface AllergenRemoval {
  allergenId: string;
  displayName: string;
  severity: "confirmed_allergy" | "suspected_reaction" | "intolerance" | "preference_avoid" | "clinician_elimination";
  emergencyMedication: boolean;
  action: "HARD_STOP" | "SOFT_BLOCK" | "EXCLUDE" | "PREFER_AVOID";
  crossContactWarning: boolean;
  hiddenSourceExamples: string[];   // common hidden sources to warn AI about
}

/** Behavioral strategy for picky eaters / sensory needs */
export interface BehavioralStrategy {
  strategyId: string;   // BEH-XXXX
  label: string;
  directives: string[]; // what the AI must do
}

/** Food acceptance directive — what to include, bridge, or avoid */
export interface FoodAcceptanceDirective {
  type: "include_familiar" | "bridge_to_new" | "avoid_dislike" | "sensory_safe";
  description: string;
  items: string[];
}

/** School safety / lunchbox constraints */
export interface SchoolRules {
  requiresSchoolSafe: boolean;       // nut-free
  requiresPackable: boolean;         // lunchbox safe
  packableConstraints: string[];     // no items that spoil unrefrigerated, etc.
  schoolSafeConstraints: string[];   // no tree nuts, no peanuts in any form
}

/** Kitchen reality context — time, budget, equipment */
export interface KitchenRealityContext {
  budgetLevel: "budget_conscious" | "moderate" | "flexible" | null;
  maxCookTimeMinutes: number | null;
  equipmentConstraints: string[];   // e.g. "no food processor available"
}

/** Parent overrides — free-text sanitized prefs that modulate but never override safety */
export interface ParentOverrides {
  culturalCuisine: string | null;
  dietaryPattern: string | null;
  goals: string[];
  notes: string[];
}

/** Conflict resolution — when two rules clash, how it was resolved */
export interface ConflictResolution {
  ruleA: string;
  ruleB: string;
  resolution: string;
  winner: "rule_a" | "rule_b" | "merged";
}

/**
 * The complete context object passed to the AI recipe generator.
 * The AI reads this and writes a recipe — it does NOT make the decisions
 * encoded here. All decisions are made by the resolver.
 */
export interface PediatricMealGenerationContext {
  // ── Identity ──────────────────────────────────────────────────────────────
  resolvedAt: string;                     // ISO timestamp
  resolverVersion: string;               // semver — bump on rule changes
  childProfileIds: string[];             // one per child; multiple = family meal
  isFamilyMealMode: boolean;
  splitMealRequired: boolean;            // true when allergens are irreconcilable
  splitMealReason: string | null;

  // ── Stage ─────────────────────────────────────────────────────────────────
  stageKey: DevelopmentalStageKey;       // primary (most restrictive in family mode)
  stageDRIBaseline: StageDRIBaseline;

  // ── Rule Registry output ──────────────────────────────────────────────────
  firedRules: FiredRule[];               // all RULE-XXXX that fired
  withheldRules: string[];               // rules withheld (pending_review)

  // ── Protocol Registry output ──────────────────────────────────────────────
  activeProtocolBlocks: ProtocolBlock[]; // COND-XXXX blocks from medical conditions

  // ── Ingredient Intelligence output ────────────────────────────────────────
  allergenRemovals: AllergenRemoval[];

  // ── Texture & Cooking ─────────────────────────────────────────────────────
  textureClass: TextureClass;
  textureDirectives: string[];           // exact instructions for the AI
  cookingMethodConstraints: string[];    // methods allowed/forbidden

  // ── Behavioral & Acceptance ───────────────────────────────────────────────
  behavioralStrategy: BehavioralStrategy | null;
  foodAcceptanceDirectives: FoodAcceptanceDirective[];

  // ── Logistics ─────────────────────────────────────────────────────────────
  timeConstraint: number | null;         // max cook time in minutes
  servings: number;
  mealType: "breakfast" | "lunch" | "dinner" | "snack" | "any";
  schoolRules: SchoolRules;
  kitchenRealityContext: KitchenRealityContext;

  // ── Parent overrides (modulate, never override safety) ────────────────────
  parentOverrides: ParentOverrides;

  // ── Conflict log ──────────────────────────────────────────────────────────
  conflictResolutions: ConflictResolution[];

  // ── AI Prompt injection ───────────────────────────────────────────────────
  /** Pre-built system block ready to inject verbatim into the AI system prompt */
  systemContextBlock: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE REGISTRY — every safety rule with a permanent RULE-XXXX ID
// Source: AAP, WHO, FDA, USDA Dietary Guidelines
// ─────────────────────────────────────────────────────────────────────────────

interface PediatricRule {
  ruleId: string;
  level: RuleLevel;
  description: string;
  reviewStatus: ReviewStatus;
  source: string;
  appliesToStages: DevelopmentalStageKey[] | "all";
}

const PEDIATRIC_RULE_REGISTRY: PediatricRule[] = [
  {
    ruleId: "RULE-0001",
    level: "A",
    description: "No honey under 12 months — infant botulism risk. Hard stop, no exceptions.",
    reviewStatus: "approved",
    source: "AAP 2023; CDC Botulism Guidelines",
    appliesToStages: ["beginning_foods", "young_toddler"],
  },
  {
    ruleId: "RULE-0002",
    level: "A",
    description: "No cow's milk as the main drink under 12 months. Small amounts in cooking acceptable.",
    reviewStatus: "approved",
    source: "AAP Healthy Children; USDA Dietary Guidelines Birth–24mo 2020",
    appliesToStages: ["beginning_foods"],
  },
  {
    ruleId: "RULE-0003",
    level: "A",
    description: "No juice including 100% fruit juice under 12 months.",
    reviewStatus: "approved",
    source: "AAP Clinical Report on Fruit Juice 2017, reaffirmed 2022",
    appliesToStages: ["beginning_foods"],
  },
  {
    ruleId: "RULE-0004",
    level: "A",
    description: "Textures must be purée or mashed/very soft for beginning foods (6–11 months). No chunks.",
    reviewStatus: "approved",
    source: "AAP Starting Solid Foods guidance; WHO Complementary Feeding 2023",
    appliesToStages: ["beginning_foods"],
  },
  {
    ruleId: "RULE-0005",
    level: "A",
    description: "No whole nuts or large nut pieces at any age — serious choking hazard.",
    reviewStatus: "approved",
    source: "AAP Choking Prevention; FDA Choking Hazard guidance",
    appliesToStages: "all",
  },
  {
    ruleId: "RULE-0006",
    level: "A",
    description: "Grapes must be quartered lengthwise for children under 5 years — whole grapes are a choking hazard.",
    reviewStatus: "approved",
    source: "AAP Choking Prevention; USDA MyPlate for Kids",
    appliesToStages: ["beginning_foods", "young_toddler", "toddler", "preschool"],
  },
  {
    ruleId: "RULE-0007",
    level: "A",
    description: "Cherry tomatoes must be halved or quartered for children under 5 — never served whole.",
    reviewStatus: "approved",
    source: "AAP Choking Prevention 2022",
    appliesToStages: ["beginning_foods", "young_toddler", "toddler", "preschool"],
  },
  {
    ruleId: "RULE-0008",
    level: "A",
    description: "No raw hard vegetables (carrots, celery, apple slices) for under 12 months. Grate, steam, or purée.",
    reviewStatus: "approved",
    source: "AAP Starting Solid Foods; WHO Complementary Feeding",
    appliesToStages: ["beginning_foods"],
  },
  {
    ruleId: "RULE-0009",
    level: "A",
    description: "Raw hard vegetables (carrot, celery, apple) must be grated, steamed, or very finely chopped for young toddlers (12–23 months).",
    reviewStatus: "approved",
    source: "AAP Choking Prevention",
    appliesToStages: ["young_toddler"],
  },
  {
    ruleId: "RULE-0010",
    level: "A",
    description: "No popcorn for children under 5 years — airway obstruction risk.",
    reviewStatus: "approved",
    source: "AAP Choking Prevention; FDA",
    appliesToStages: ["beginning_foods", "young_toddler", "toddler", "preschool"],
  },
  {
    ruleId: "RULE-0011",
    level: "A",
    description: "No hard candy for children under 8 years.",
    reviewStatus: "approved",
    source: "AAP Choking Prevention",
    appliesToStages: ["beginning_foods", "young_toddler", "toddler", "preschool", "early_school_age"],
  },
  {
    ruleId: "RULE-0012",
    level: "A",
    description: "No high-mercury fish: swordfish, shark, king mackerel, tilefish, bigeye tuna — at any age.",
    reviewStatus: "approved",
    source: "FDA/EPA Fish Advice 2024; AAP Council on Environmental Health",
    appliesToStages: "all",
  },
  {
    ruleId: "RULE-0013",
    level: "A",
    description: "Meat and poultry must be finely puréed or smooth for 6–11 months.",
    reviewStatus: "approved",
    source: "AAP Starting Solid Foods; WHO Complementary Feeding",
    appliesToStages: ["beginning_foods"],
  },
  {
    ruleId: "RULE-0014",
    level: "A",
    description: "Meat and poultry must be finely chopped or shredded for 12–36 months.",
    reviewStatus: "approved",
    source: "AAP Choking Prevention",
    appliesToStages: ["young_toddler", "toddler"],
  },
  {
    ruleId: "RULE-0015",
    level: "B",
    description: "Limit added sugar. Avoid sugary drinks as the primary beverage at all ages.",
    reviewStatus: "approved",
    source: "AAP Sugar Recommendation 2016; USDA Dietary Guidelines 2020–2025",
    appliesToStages: "all",
  },
  {
    ruleId: "RULE-0016",
    level: "B",
    description: "Limit sodium. Avoid high-sodium processed foods as primary ingredients.",
    reviewStatus: "approved",
    source: "USDA Dietary Guidelines 2020–2025; AAP Cardiovascular Health",
    appliesToStages: "all",
  },
  {
    ruleId: "RULE-0017",
    level: "A",
    description: "Never suggest formula modifications or homemade formula — serious safety risk.",
    reviewStatus: "approved",
    source: "FDA Consumer Alert 2023; AAP Formula Safety Statement",
    appliesToStages: "all",
  },
  {
    ruleId: "RULE-0018",
    level: "A",
    description: "Never generate recipes for early infant stage (birth–5 months). Refer to breast milk / formula only.",
    reviewStatus: "approved",
    source: "AAP; WHO Exclusive Breastfeeding Guidelines",
    appliesToStages: ["early_infant"],
  },
  {
    ruleId: "RULE-0019",
    level: "B",
    description: "Iron-rich foods (puréed meats, iron-fortified cereals) are a priority from 6 months — breast milk iron alone is insufficient.",
    reviewStatus: "approved",
    source: "AAP Iron Supplementation 2020; USDA Birth–24mo Dietary Guidelines",
    appliesToStages: ["beginning_foods", "young_toddler"],
  },
  {
    ruleId: "RULE-0020",
    level: "B",
    description: "Allergenic foods (peanuts, eggs, tree nuts) should be introduced early alongside other first foods, not delayed.",
    reviewStatus: "approved",
    source: "AAP LEAP Study Guidance 2017; NIAID Addendum Guidelines 2017",
    appliesToStages: ["beginning_foods"],
  },
  {
    ruleId: "RULE-0021",
    level: "B",
    description: "Serving size must match age-appropriate ranges — do not apply adult portion sizes.",
    reviewStatus: "approved",
    source: "USDA MyPlate for Kids; AAP Nutrition Guide",
    appliesToStages: "all",
  },
  {
    ruleId: "RULE-0022",
    level: "A",
    description: "Children with swallowing difficulty (dysphagia) must follow clinician-prescribed texture only — do not invent texture modifications.",
    reviewStatus: "approved",
    source: "ASHA Dysphagia Guidelines; IDDSI Framework 2019",
    appliesToStages: "all",
  },
  {
    ruleId: "RULE-0023",
    level: "B",
    description: "Children with a history of choking or gagging require extra texture vigilance — prefer the more restrictive texture class.",
    reviewStatus: "approved",
    source: "AAP Choking Prevention; IDDSI",
    appliesToStages: "all",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// PROTOCOL REGISTRY — medical condition → COND-XXXX guidance blocks
// ─────────────────────────────────────────────────────────────────────────────

const PROTOCOL_REGISTRY: Record<string, ProtocolBlock> = {
  celiac_disease: {
    conditionId: "COND-0001",
    conditionLabel: "Celiac Disease",
    guidance: [
      "Strictly gluten-free — no wheat, barley, rye, or spelt in any form.",
      "Use certified gluten-free oats only if recipe requires oats.",
      "Verify all sauces, seasonings, and condiments are gluten-free certified.",
      "Use tamari or coconut aminos instead of soy sauce.",
    ],
    hardLimits: [
      "ZERO tolerance for wheat, barley, rye, spelt, kamut.",
      "No shared cookware with gluten-containing foods unless thoroughly cleaned.",
    ],
    optimizations: ["Favor naturally gluten-free grains: rice, quinoa, millet, teff, buckwheat, corn."],
    escalationTriggers: ["Any persistent GI symptoms after dietary adherence → refer to GI specialist"],
  },
  lactose_intolerance: {
    conditionId: "COND-0002",
    conditionLabel: "Lactose Intolerance",
    guidance: [
      "Avoid regular dairy milk and high-lactose dairy products.",
      "Hard aged cheeses (cheddar, parmesan) are often tolerated — include if no confirmed allergy.",
      "Use lactose-free milk or plant-based alternatives (oat, almond, soy if no soy allergy).",
    ],
    hardLimits: [],
    optimizations: ["Favor calcium-fortified plant milks to maintain calcium intake."],
    escalationTriggers: [],
  },
  milk_allergy: {
    conditionId: "COND-0003",
    conditionLabel: "Cow's Milk Protein Allergy",
    guidance: [
      "No dairy products in any form — no milk, cream, butter, cheese, yogurt, casein, whey.",
      "Check ingredient labels for hidden dairy: casein, whey, lactalbumin, lactose.",
      "Use dairy-free alternatives: oat milk, coconut milk, almond milk (if tolerated).",
    ],
    hardLimits: [
      "HARD STOP on all cow's milk proteins — casein and whey included.",
      "No butter, ghee, cream, or any dairy derivative.",
    ],
    optimizations: ["Ensure calcium intake from alternative sources: fortified plant milk, calcium-set tofu, leafy greens."],
    escalationTriggers: ["Any signs of anaphylaxis → 911 / emergency services immediately"],
  },
  failure_to_thrive: {
    conditionId: "COND-0004",
    conditionLabel: "Failure to Thrive / Growth Concern",
    guidance: [
      "Prioritize calorie-dense, nutrient-rich foods.",
      "Add healthy fats: avocado, olive oil, nut butter (age-appropriate form), full-fat dairy if tolerated.",
      "Prioritize protein at every meal and snack.",
      "Avoid low-calorie or diet-oriented modifications.",
    ],
    hardLimits: ["Do NOT reduce calories. Every ingredient choice should maximize caloric density within safety rules."],
    optimizations: [
      "Add olive oil or avocado to increase caloric density without bulk.",
      "Favor whole milk dairy (if tolerated) over reduced-fat versions.",
    ],
    escalationTriggers: ["Continued weight loss or failure to gain → refer to pediatric dietitian and pediatrician"],
  },
  iron_deficiency: {
    conditionId: "COND-0005",
    conditionLabel: "Iron Deficiency / Iron Deficiency Anemia",
    guidance: [
      "Include iron-rich foods at every meal: lean red meat, poultry, fortified grains, legumes, tofu, dark leafy greens.",
      "Pair iron-rich plant sources with vitamin C (citrus, strawberry, bell pepper, tomato) to enhance absorption.",
      "Avoid serving cow's milk at the same time as iron-rich foods — inhibits absorption.",
    ],
    hardLimits: [],
    optimizations: [
      "Vitamin C pairing is the single highest-impact optimization for non-heme iron absorption.",
      "Limit cow's milk to 16–24 oz/day max — excess milk displaces iron-rich foods.",
    ],
    escalationTriggers: ["Pallor, extreme fatigue, or hemoglobin < 11g/dL → pediatrician follow-up required"],
  },
  constipation: {
    conditionId: "COND-0006",
    conditionLabel: "Constipation",
    guidance: [
      "Prioritize high-fiber foods: oats, pears, prunes, beans, whole grains, vegetables.",
      "Ensure adequate fluid intake — include water-rich ingredients.",
      "Reduce excess dairy (especially cheese and processed dairy) if it is a contributor.",
    ],
    hardLimits: [],
    optimizations: ["Pears, prunes, and peaches are especially effective — include when compatible with food request."],
    escalationTriggers: ["Severe pain, blood in stool, or constipation >2 weeks → pediatrician referral"],
  },
  reflux_gerd: {
    conditionId: "COND-0007",
    conditionLabel: "Acid Reflux / GERD",
    guidance: [
      "Prefer smaller, more frequent portions.",
      "Avoid tomato sauce, citrus, mint, chocolate, and fried foods when possible.",
      "Avoid high-fat or very spicy preparations.",
    ],
    hardLimits: [],
    optimizations: ["Favor gentle cooking methods: steaming, baking, mild sautéing over frying or heavy spicing."],
    escalationTriggers: ["Frequent vomiting, weight loss, or blood in vomit → immediate pediatrician referral"],
  },
  type1_diabetes: {
    conditionId: "COND-0008",
    conditionLabel: "Type 1 Diabetes",
    guidance: [
      "Consistent carbohydrate portions per meal — predictability matters for insulin management.",
      "Favor complex carbohydrates and high-fiber foods over refined sugars.",
      "Pair carbohydrates with protein and healthy fat to moderate glucose response.",
      "Avoid excessive added sugar.",
    ],
    hardLimits: ["Do NOT suggest large or unpredictable carbohydrate loads — insulin dosing depends on meal carb consistency."],
    optimizations: ["Whole grains, legumes, and non-starchy vegetables are strongly preferred."],
    escalationTriggers: ["Blood glucose <70 mg/dL or >300 mg/dL → follow family's diabetes action plan / call provider"],
  },
  type2_diabetes: {
    conditionId: "COND-0009",
    conditionLabel: "Type 2 Diabetes / Prediabetes",
    guidance: [
      "Limit refined carbohydrates and added sugar.",
      "Favor high-fiber, low-glycemic-index foods.",
      "Pair carbohydrates with protein and fat.",
    ],
    hardLimits: ["Avoid high-sugar, high-GI ingredients as primary components."],
    optimizations: ["Non-starchy vegetables, whole grains, and lean protein are the foundation."],
    escalationTriggers: ["Symptoms of hypoglycemia or hyperglycemia → follow care plan / contact provider"],
  },
  feeding_disorder: {
    conditionId: "COND-0010",
    conditionLabel: "Pediatric Feeding Disorder",
    guidance: [
      "Follow the feeding therapist's (OT/SLP) current texture and food exposure recommendations.",
      "Never escalate food novelty or texture challenge beyond the therapist's guidance.",
      "Favor bridge foods — familiar textures/flavors in new combinations.",
      "Support the division of responsibility: adult provides safe options, child decides what/how much.",
    ],
    hardLimits: ["Do NOT suggest new textures or food types outside the child's current acceptance level."],
    optimizations: ["Bridge foods that share a familiar element with accepted foods are highest priority."],
    escalationTriggers: ["New food refusal causing significant nutritional gaps → feeding therapist consultation"],
  },
  swallowing_difficulty: {
    conditionId: "COND-0011",
    conditionLabel: "Swallowing Difficulty (Dysphagia)",
    guidance: [
      "Follow the clinician-prescribed IDDSI level exactly — do not deviate.",
      "All foods must meet the assigned texture level.",
      "Liquids must be thickened to the prescribed consistency if thickening is ordered.",
    ],
    hardLimits: [
      "HARD STOP — texture must comply with the clinician-prescribed IDDSI level.",
      "Never suggest foods that exceed the prescribed texture tolerance.",
    ],
    optimizations: [],
    escalationTriggers: ["Coughing, choking, or aspiration signs during meals → immediate SLP / physician follow-up"],
  },
  food_protein_induced_enterocolitis: {
    conditionId: "COND-0012",
    conditionLabel: "FPIES (Food Protein-Induced Enterocolitis Syndrome)",
    guidance: [
      "Strictly avoid all clinician-identified FPIES trigger foods.",
      "FPIES triggers may include: milk, soy, rice, oats, sweet potato, poultry — confirm with the specific triggers on file.",
      "Introduce any new foods only under medical supervision.",
    ],
    hardLimits: ["HARD STOP on all confirmed FPIES triggers — reactions can be severe."],
    optimizations: [],
    escalationTriggers: ["Profuse vomiting 1–4 hours after eating a trigger → emergency evaluation"],
  },
  eosinophilic_esophagitis: {
    conditionId: "COND-0013",
    conditionLabel: "Eosinophilic Esophagitis (EoE)",
    guidance: [
      "Follow the elimination diet prescribed by the child's gastroenterologist (typically 6-food or 2-food elimination).",
      "Commonly eliminated foods: milk, wheat, egg, soy, peanut/tree nut, seafood — confirm which apply.",
    ],
    hardLimits: ["HARD STOP on all physician-prescribed elimination foods."],
    optimizations: [],
    escalationTriggers: ["Food impaction, severe dysphagia, or failure to thrive → GI specialist follow-up"],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// DRI BASELINE REGISTRY — per-stage nutritional baselines
// Sources: USDA Dietary Guidelines (Birth–24mo, 2–5y); AAP Nutrition
// ─────────────────────────────────────────────────────────────────────────────

const DRI_BASELINES: Record<DevelopmentalStageKey, StageDRIBaseline> = {
  early_infant: {
    stageKey: "early_infant",
    stageLabel: "Early Infant (birth–~5 months)",
    kcalRangeMin: 0,
    kcalRangeMax: 0,
    proteinGMin: 0,
    proteinGMax: 0,
    ironMg: 0.27,
    calciumMg: 200,
    vitaminDIU: 400,
    sodiumMgMax: 0,
    addedSugarGMax: 0,
    servingSizeGuidance: "Breast milk or formula only — no solid foods.",
    textureClass: "puree_only",
    honeyAllowed: false,
    wholeMillkAsMainDrinkAllowed: false,
    juiceAllowed: false,
    notes: ["No solid foods before ~6 months. Consult pediatrician for readiness signs."],
  },
  beginning_foods: {
    stageKey: "beginning_foods",
    stageLabel: "Beginning Foods (~6–11 months)",
    kcalRangeMin: 750,
    kcalRangeMax: 900,
    proteinGMin: 11,
    proteinGMax: 14,
    ironMg: 11,
    calciumMg: 260,
    vitaminDIU: 400,
    sodiumMgMax: 370,
    addedSugarGMax: 0,
    servingSizeGuidance: "1–2 tablespoons per food item, 2–3 times per day, building to 3–4 tablespoons.",
    textureClass: "puree_only",
    honeyAllowed: false,
    wholeMillkAsMainDrinkAllowed: false,
    juiceAllowed: false,
    notes: [
      "Iron-rich foods are top priority at this stage.",
      "Introduce one new food at a time every 3–5 days.",
      "Continue breast milk or formula as the primary nutrition source.",
    ],
  },
  young_toddler: {
    stageKey: "young_toddler",
    stageLabel: "Young Toddler (12–23 months)",
    kcalRangeMin: 900,
    kcalRangeMax: 1000,
    proteinGMin: 13,
    proteinGMax: 16,
    ironMg: 7,
    calciumMg: 260,
    vitaminDIU: 600,
    sodiumMgMax: 800,
    addedSugarGMax: 0,
    servingSizeGuidance: "2–4 tablespoons per food item at each meal; 3 meals + 1–2 snacks daily.",
    textureClass: "mashed_soft",
    honeyAllowed: false,
    wholeMillkAsMainDrinkAllowed: true,
    juiceAllowed: false,
    notes: [
      "Whole milk (4 oz max per feeding, 16 oz/day) may replace formula at 12 months.",
      "No juice under 12 months; limit to 4 oz/day of 100% juice from 12–24 months.",
      "Appetite fluctuation is normal and expected — avoid pressure to eat.",
    ],
  },
  toddler: {
    stageKey: "toddler",
    stageLabel: "Toddler (2–3 years)",
    kcalRangeMin: 1000,
    kcalRangeMax: 1400,
    proteinGMin: 13,
    proteinGMax: 19,
    ironMg: 7,
    calciumMg: 700,
    vitaminDIU: 600,
    sodiumMgMax: 1200,
    addedSugarGMax: 25,
    servingSizeGuidance: "1 tablespoon per year of age per food item is a helpful starting guide.",
    textureClass: "soft_chopped",
    honeyAllowed: true,
    wholeMillkAsMainDrinkAllowed: true,
    juiceAllowed: true,
    notes: [
      "Picky eating peaks at 2–3 years — neophobia is developmentally normal.",
      "Pressure to eat makes picky eating worse over time.",
      "Offer 1 familiar food alongside every new food.",
    ],
  },
  preschool: {
    stageKey: "preschool",
    stageLabel: "Preschool (4–5 years)",
    kcalRangeMin: 1200,
    kcalRangeMax: 1600,
    proteinGMin: 19,
    proteinGMax: 24,
    ironMg: 10,
    calciumMg: 1000,
    vitaminDIU: 600,
    sodiumMgMax: 1500,
    addedSugarGMax: 25,
    servingSizeGuidance: "Child-sized portions: roughly half of an adult portion. Self-serve style builds awareness.",
    textureClass: "family_modified",
    honeyAllowed: true,
    wholeMillkAsMainDrinkAllowed: false,
    juiceAllowed: true,
    notes: [
      "Preschoolers learn food acceptance from watching adults and peers eat.",
      "Involve children in simple food prep to build curiosity.",
    ],
  },
  early_school_age: {
    stageKey: "early_school_age",
    stageLabel: "Early School Age (6–8 years)",
    kcalRangeMin: 1400,
    kcalRangeMax: 1800,
    proteinGMin: 20,
    proteinGMax: 28,
    ironMg: 10,
    calciumMg: 1000,
    vitaminDIU: 600,
    sodiumMgMax: 1900,
    addedSugarGMax: 25,
    servingSizeGuidance: "Approximately 60–75% of adult portion; hungry days and low-appetite days are normal.",
    textureClass: "family_table",
    honeyAllowed: true,
    wholeMillkAsMainDrinkAllowed: false,
    juiceAllowed: true,
    notes: [
      "After-school hunger is real — plan a protein + carb snack.",
      "Young athletes have higher iron and carbohydrate needs.",
    ],
  },
  growing_child: {
    stageKey: "growing_child",
    stageLabel: "Growing Child (9–12 years)",
    kcalRangeMin: 1600,
    kcalRangeMax: 2200,
    proteinGMin: 34,
    proteinGMax: 46,
    ironMg: 8,
    calciumMg: 1300,
    vitaminDIU: 600,
    sodiumMgMax: 2300,
    addedSugarGMax: 25,
    servingSizeGuidance: "Approaching adult portions; highly variable by activity level.",
    textureClass: "family_table",
    honeyAllowed: true,
    wholeMillkAsMainDrinkAllowed: false,
    juiceAllowed: true,
    notes: [
      "Calcium needs spike (1,300 mg/day) — bone-building window is now.",
      "Pre-sport snack 30–60 min before practice supports performance.",
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CULINARY REGISTRY — stage-appropriate cooking methods
// ─────────────────────────────────────────────────────────────────────────────

const CULINARY_REGISTRY: Record<DevelopmentalStageKey, { allowed: string[]; forbidden: string[] }> = {
  early_infant: { allowed: [], forbidden: ["all — no solid foods at this stage"] },
  beginning_foods: {
    allowed: ["steam", "boil", "purée", "blend", "mash", "bake until very soft"],
    forbidden: ["fry", "deep fry", "roast until crispy", "grill", "raw hard produce", "raw meat"],
  },
  young_toddler: {
    allowed: ["steam", "boil", "soft bake", "mash", "fine chop", "shred", "slow cook"],
    forbidden: ["deep fry", "raw hard vegetables", "whole round foods"],
  },
  toddler: {
    allowed: ["steam", "boil", "bake", "sauté", "roast", "slow cook", "soft stir-fry"],
    forbidden: ["deep fry (prefer baked alternatives)", "excessive spice"],
  },
  preschool: {
    allowed: ["steam", "boil", "bake", "sauté", "roast", "grill (well done)", "slow cook", "air fry"],
    forbidden: ["excessive spice beyond mild", "deep fry as primary method"],
  },
  early_school_age: {
    allowed: ["steam", "boil", "bake", "sauté", "roast", "grill", "slow cook", "air fry", "stir-fry"],
    forbidden: ["excessive sodium seasoning", "heavily processed ingredient bases"],
  },
  growing_child: {
    allowed: ["all standard household methods"],
    forbidden: ["excessive sodium seasoning", "heavily processed ingredient bases"],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// FOOD BEHAVIOR REGISTRY — sensory + behavioral strategies
// ─────────────────────────────────────────────────────────────────────────────

interface BehaviorRule {
  strategyId: string;
  triggers: string[];  // feeding_concern or sensory_issue values that activate this
  label: string;
  directives: string[];
}

const BEHAVIOR_REGISTRY: BehaviorRule[] = [
  {
    strategyId: "BEH-0001",
    triggers: ["picky_eater", "neophobia", "fear_of_new_foods"],
    label: "Neophobia-Friendly Exposure Strategy",
    directives: [
      "Include at least one familiar, accepted ingredient as the primary component.",
      "Place the new or nutritionally important element alongside — not replacing — the familiar food.",
      "Avoid dramatically changing the appearance of a food the child has previously accepted.",
      "Use child-friendly plating: separate components, recognizable shapes.",
      "Do NOT mix textures the child has not previously tolerated.",
    ],
  },
  {
    strategyId: "BEH-0002",
    triggers: ["sensory_processing", "texture_sensitivity", "mixed_texture_aversion"],
    label: "Sensory-Safe Texture Strategy",
    directives: [
      "Keep textures consistent throughout the dish — avoid mixed textures unless the child tolerates them.",
      "If the child accepts crunchy foods, keep them separate from soft/wet components.",
      "Avoid sauces that change the texture of accepted dry foods.",
      "Prefer uniform, predictable textures over complex multi-texture dishes.",
    ],
  },
  {
    strategyId: "BEH-0003",
    triggers: ["food_jags", "only_eats_few_foods"],
    label: "Food Jag Bridge Strategy",
    directives: [
      "Center the recipe around a food the child is currently accepting.",
      "Introduce nutritional variety through preparation variation, not a new food item.",
      "Bridge: present the accepted food in a slightly different context (shape, mild seasoning variation).",
    ],
  },
  {
    strategyId: "BEH-0004",
    triggers: ["appetite_variability", "small_appetite"],
    label: "Calorie-Dense Small Volume Strategy",
    directives: [
      "Maximize caloric density in a small volume — use healthy fats (avocado, olive oil, nut butter).",
      "Offer smaller, more frequent portions rather than large plates.",
      "Do not draw attention to portion size in meal guidance.",
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ALLERGEN INTELLIGENCE — hidden sources by allergen
// ─────────────────────────────────────────────────────────────────────────────

const ALLERGEN_HIDDEN_SOURCES: Record<string, string[]> = {
  peanut: ["mixed nut oils", "peanut flour", "some Asian sauces (satay, certain hoisin)", "some granola bars"],
  tree_nuts: ["almond flour", "coconut", "marzipan", "praline", "some pesto (pine nuts)", "Nutella"],
  milk: ["casein", "whey", "lactalbumin", "ghee", "some margarines", "some deli meats", "caramel"],
  egg: ["some pasta (fresh)", "mayo", "some bread glazes", "meringue", "egg wash", "some pasta sauces"],
  wheat: ["soy sauce", "seitan", "some oats (cross-contact)", "some condiments", "some chocolate"],
  soy: ["tofu", "edamame", "miso", "tempeh", "some Asian sauces", "some vegetable broths"],
  sesame: ["tahini", "hummus", "some Asian sauces", "some bread toppings", "some salad dressings"],
  fish: ["some Worcestershire sauce", "Caesar dressing", "some Asian fish sauces"],
  shellfish: ["some Asian sauces (oyster sauce, shrimp paste)", "some seafood stock"],
  other: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// CHILD PROFILE DB READER
// ─────────────────────────────────────────────────────────────────────────────

interface ChildProfileRow {
  id: string;
  user_id: string;
  name: string;
  age_stage: DevelopmentalStageKey;
  date_of_birth: string | null;
  allergies: any[];
  dietary_preferences: any[];
  medical_conditions: any[];
  feeding_concerns: any[];
  sensory_issues: any[];
  dislikes: any[];
  cultural_preferences: string | null;
}

async function fetchChildProfile(childProfileId: string): Promise<ChildProfileRow | null> {
  try {
    const result = await db.execute(sql`
      SELECT id, user_id, name, age_stage, date_of_birth,
             allergies, dietary_preferences, medical_conditions,
             feeding_concerns, sensory_issues, dislikes, cultural_preferences
      FROM child_profiles
      WHERE id = ${childProfileId} AND is_archived = false
      LIMIT 1
    `);
    const rows = (result as any).rows ?? (Array.isArray(result) ? result : []);
    return rows[0] ?? null;
  } catch (err: any) {
    if (err?.code === "42P01") return null; // table not yet created
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESOLVER INPUT TYPE
// ─────────────────────────────────────────────────────────────────────────────

export interface PediatricResolverInput {
  /** Single child profile ID. Null = General mode (no saved profile). */
  childProfileId: string | null;
  /**
   * Multiple IDs for Family Meal mode. When populated, resolver runs
   * intersection optimization across all children.
   */
  childProfileIds?: string[];
  /** Override stage when childProfileId is null (General mode) */
  stageOverride?: DevelopmentalStageKey;
  /** Override allergies when childProfileId is null */
  allergyOverride?: Array<{
    allergenId: string;
    severity: AllergenRemoval["severity"];
    emergencyMedication?: boolean;
    customAllergenName?: string;
  }>;
  /** Parent preferences (kitchen reality layer) */
  parentPrefs?: {
    budgetLevel?: "budget_conscious" | "moderate" | "flexible";
    maxCookTimeMinutes?: number;
    requiresSchoolSafe?: boolean;
    requiresPackable?: boolean;
    culturalCuisine?: string;
    dietaryPattern?: string;
    goals?: string[];
  };
  mealType?: "breakfast" | "lunch" | "dinner" | "snack" | "any";
  servings?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE FIRING ENGINE
// ─────────────────────────────────────────────────────────────────────────────

function fireRulesForStage(stageKey: DevelopmentalStageKey): { fired: FiredRule[]; withheld: string[] } {
  const fired: FiredRule[] = [];
  const withheld: string[] = [];

  for (const rule of PEDIATRIC_RULE_REGISTRY) {
    if (rule.reviewStatus === "removed") continue;
    if (rule.reviewStatus === "pending_review") {
      withheld.push(rule.ruleId);
      continue;
    }

    const applies =
      rule.appliesToStages === "all" ||
      rule.appliesToStages.includes(stageKey);

    if (applies) {
      fired.push({
        ruleId: rule.ruleId,
        level: rule.level,
        description: rule.description,
        action: ruleToAction(rule),
        source: rule.source,
      });
    }
  }

  return { fired, withheld };
}

function ruleToAction(rule: PediatricRule): string {
  if (rule.ruleId === "RULE-0001") return "EXCLUDE honey from all ingredients";
  if (rule.ruleId === "RULE-0002") return "Do not use cow's milk as primary drink — use breast milk or formula";
  if (rule.ruleId === "RULE-0003") return "EXCLUDE all juice";
  if (rule.ruleId === "RULE-0004") return "ALL textures must be purée or smooth — no lumps or chunks";
  if (rule.ruleId === "RULE-0005") return "EXCLUDE whole nuts; nut butter in age-appropriate form is acceptable";
  if (rule.ruleId === "RULE-0006") return "Grapes MUST be quartered lengthwise before serving";
  if (rule.ruleId === "RULE-0007") return "Cherry tomatoes MUST be halved or quartered — never whole";
  if (rule.ruleId === "RULE-0008") return "No raw hard vegetables — steam, grate, or purée all produce";
  if (rule.ruleId === "RULE-0009") return "Grate, steam, or very finely chop carrots, celery, apple";
  if (rule.ruleId === "RULE-0010") return "EXCLUDE popcorn";
  if (rule.ruleId === "RULE-0011") return "EXCLUDE hard candy";
  if (rule.ruleId === "RULE-0012") return "EXCLUDE swordfish, shark, king mackerel, tilefish, bigeye tuna";
  if (rule.ruleId === "RULE-0013") return "Meat must be finely puréed — no chunks, no shreds";
  if (rule.ruleId === "RULE-0014") return "Meat must be finely chopped or shredded — no large pieces";
  if (rule.ruleId === "RULE-0015") return "Minimize added sugar; no sugary drinks as primary beverage";
  if (rule.ruleId === "RULE-0016") return "Limit sodium; avoid high-sodium processed foods as primary ingredients";
  if (rule.ruleId === "RULE-0017") return "NEVER suggest formula modifications or homemade formula";
  if (rule.ruleId === "RULE-0018") return "BLOCKED — redirect to breast milk/formula guidance only";
  if (rule.ruleId === "RULE-0019") return "Prioritize iron-rich foods; pair plant iron with vitamin C";
  if (rule.ruleId === "RULE-0020") return "Do not delay allergenic foods introduction — follow AAP LEAP guidance";
  if (rule.ruleId === "RULE-0021") return "Use age-appropriate serving sizes per DRI baseline";
  if (rule.ruleId === "RULE-0022") return "Follow clinician-prescribed texture level exactly (IDDSI)";
  if (rule.ruleId === "RULE-0023") return "Use the more restrictive texture class given choking/gagging history";
  return "Apply rule as described";
}

// ─────────────────────────────────────────────────────────────────────────────
// TEXTURE RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

function resolveTextureClass(
  stageKey: DevelopmentalStageKey,
  feedingConcerns: string[],
  sensoryIssues: string[],
  hasFeedingTube: boolean,
  swallowingDifficulty: boolean,
  historyOfChokingOrGagging: boolean,
  clinicianTextureLevel: string | null,
): { textureClass: TextureClass; directives: string[]; firedRules: FiredRule[] } {
  const firedRules: FiredRule[] = [];

  // Clinician-prescribed texture overrides everything
  if (swallowingDifficulty && clinicianTextureLevel) {
    firedRules.push({
      ruleId: "RULE-0022",
      level: "A",
      description: PEDIATRIC_RULE_REGISTRY.find(r => r.ruleId === "RULE-0022")!.description,
      action: `Follow clinician-prescribed texture: ${clinicianTextureLevel}`,
      source: "IDDSI Framework 2019; ASHA Dysphagia Guidelines",
    });
    return {
      textureClass: iddsiToTextureClass(clinicianTextureLevel),
      directives: [
        `CLINICIAN-PRESCRIBED TEXTURE: ${clinicianTextureLevel}. Do NOT deviate.`,
        "All ingredients must comply with this texture level.",
        "Do not suggest modifications that would change the texture class.",
      ],
      firedRules,
    };
  }

  // Stage-default texture
  let textureClass = DRI_BASELINES[stageKey].textureClass;

  // Escalate to more restrictive if choking history
  if (historyOfChokingOrGagging) {
    textureClass = moreRestrictive(textureClass, oneStepMoreRestrictive(textureClass));
    firedRules.push({
      ruleId: "RULE-0023",
      level: "B",
      description: PEDIATRIC_RULE_REGISTRY.find(r => r.ruleId === "RULE-0023")!.description,
      action: "Using one texture class more restrictive than stage default due to choking/gagging history",
      source: "AAP Choking Prevention; IDDSI",
    });
  }

  const directives = textureClassDirectives(textureClass, stageKey);
  return { textureClass, directives, firedRules };
}

function iddsiToTextureClass(iddsiLevel: string): TextureClass {
  const l = iddsiLevel.toLowerCase();
  if (l.includes("purée") || l.includes("puree") || l.includes("level 4") || l.includes("4")) return "puree_only";
  if (l.includes("mashed") || l.includes("level 5") || l.includes("5")) return "mashed_soft";
  if (l.includes("soft") || l.includes("level 6") || l.includes("6")) return "soft_chopped";
  return "puree_only"; // fail-safe to most restrictive
}

function moreRestrictive(a: TextureClass, b: TextureClass): TextureClass {
  const order: TextureClass[] = ["puree_only", "mashed_soft", "soft_chopped", "family_modified", "family_table"];
  return order.indexOf(a) <= order.indexOf(b) ? a : b;
}

function oneStepMoreRestrictive(t: TextureClass): TextureClass {
  const order: TextureClass[] = ["puree_only", "mashed_soft", "soft_chopped", "family_modified", "family_table"];
  const idx = order.indexOf(t);
  return idx > 0 ? order[idx - 1] : "puree_only";
}

function textureClassDirectives(textureClass: TextureClass, stageKey: DevelopmentalStageKey): string[] {
  switch (textureClass) {
    case "puree_only":
      return [
        "ALL ingredients must be puréed or blended to a completely smooth consistency.",
        "No lumps, chunks, or fibrous strands.",
        "Meat must be puréed — no shreds or pieces.",
        "Vegetables must be cooked until very soft and then puréed.",
        "No seeds or skins unless puréed through.",
      ];
    case "mashed_soft":
      return [
        "All foods must be soft enough to be mashed with gentle gum/tongue pressure.",
        "No raw hard vegetables or fruits.",
        "Meat must be finely minced, shredded, or puréed.",
        "Avoid small round foods (grapes, peas) — cut or mash.",
        "No stringy or fibrous textures.",
      ];
    case "soft_chopped":
      return [
        "Foods should be soft and easily chewed with emerging molars.",
        "Cut food into pieces no larger than 1 cm × 1 cm.",
        "Meat must be finely chopped or shredded — no large pieces.",
        "Grapes must be quartered lengthwise.",
        "Cherry tomatoes must be halved or quartered.",
        "No raw hard vegetables — steam or cook until fork-tender.",
      ];
    case "family_modified":
      return [
        "Family foods with age-appropriate modifications.",
        "Grapes must still be quartered for children under 5.",
        "Cherry tomatoes must be halved or quartered.",
        "Avoid popcorn.",
        "Avoid hard candy.",
        "Cut large pieces into manageable bites.",
      ];
    case "family_table":
      return [
        "Standard family table foods appropriate.",
        "Serve age-appropriate portion sizes.",
        "Avoid high-mercury fish.",
        "Minimize excessive sodium and added sugar.",
      ];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ALLERGEN RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

function resolveAllergenRemovals(
  allergies: any[],
): AllergenRemoval[] {
  if (!Array.isArray(allergies)) return [];

  return allergies
    .filter(a => a && a.allergenId)
    .map(a => {
      const allergenId = a.allergenId as string;
      const severity = a.severity as AllergenRemoval["severity"] ?? "preference_avoid";
      const action: AllergenRemoval["action"] =
        severity === "confirmed_allergy" || severity === "clinician_elimination" ? "HARD_STOP" :
        severity === "suspected_reaction" ? "SOFT_BLOCK" :
        severity === "intolerance" ? "EXCLUDE" : "PREFER_AVOID";

      return {
        allergenId,
        displayName: a.customAllergenName ?? allergenId.replace(/_/g, " "),
        severity,
        emergencyMedication: !!a.emergencyMedication,
        action,
        crossContactWarning: action === "HARD_STOP" || action === "SOFT_BLOCK",
        hiddenSourceExamples: ALLERGEN_HIDDEN_SOURCES[allergenId] ?? [],
      };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// PROTOCOL RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

function resolveProtocolBlocks(medicalConditions: any[]): ProtocolBlock[] {
  if (!Array.isArray(medicalConditions)) return [];

  const blocks: ProtocolBlock[] = [];
  for (const mc of medicalConditions) {
    const conditionKey = typeof mc === "string"
      ? mc.toLowerCase().replace(/[\s\-]/g, "_")
      : (mc.conditionId ?? mc.label ?? "").toLowerCase().replace(/[\s\-]/g, "_");

    const block = PROTOCOL_REGISTRY[conditionKey];
    if (block && !blocks.find(b => b.conditionId === block.conditionId)) {
      blocks.push(block);
    }
  }
  return blocks;
}

// ─────────────────────────────────────────────────────────────────────────────
// BEHAVIORAL STRATEGY RESOLVER
// ─────────────────────────────────────────────────────────────────────────────

function resolveBehavioralStrategy(
  feedingConcerns: any[],
  sensoryIssues: any[],
): BehavioralStrategy | null {
  const allTriggers = [
    ...(Array.isArray(feedingConcerns) ? feedingConcerns : []).map(f =>
      typeof f === "string" ? f.toLowerCase() : (f?.id ?? "").toLowerCase()
    ),
    ...(Array.isArray(sensoryIssues) ? sensoryIssues : []).map(s =>
      typeof s === "string" ? s.toLowerCase() : (s?.id ?? "").toLowerCase()
    ),
  ];

  for (const rule of BEHAVIOR_REGISTRY) {
    if (rule.triggers.some(t => allTriggers.some(at => at.includes(t)))) {
      return {
        strategyId: rule.strategyId,
        label: rule.label,
        directives: rule.directives,
      };
    }
  }

  return null;
}

function resolveFoodAcceptanceDirectives(
  dislikes: any[],
  feedingConcerns: any[],
  behavioralStrategy: BehavioralStrategy | null,
): FoodAcceptanceDirective[] {
  const directives: FoodAcceptanceDirective[] = [];

  if (Array.isArray(dislikes) && dislikes.length > 0) {
    const dislikeItems = dislikes
      .map(d => typeof d === "string" ? d : (d?.item ?? d?.name ?? ""))
      .filter(Boolean);

    if (dislikeItems.length > 0) {
      directives.push({
        type: "avoid_dislike",
        description: "Parent-reported foods the child refuses — avoid as primary ingredient",
        items: dislikeItems,
      });
    }
  }

  if (behavioralStrategy?.strategyId === "BEH-0001" || behavioralStrategy?.strategyId === "BEH-0003") {
    directives.push({
      type: "include_familiar",
      description: "Include at least one familiar, accepted food as the anchor ingredient",
      items: [],
    });
    directives.push({
      type: "bridge_to_new",
      description: "Bridge: present the nutritious new element alongside the familiar anchor — not replacing it",
      items: [],
    });
  }

  if (behavioralStrategy?.strategyId === "BEH-0002") {
    directives.push({
      type: "sensory_safe",
      description: "Keep textures uniform and predictable — no mixed textures",
      items: [],
    });
  }

  return directives;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFLICT RESOLVER — when two registry outputs clash
// ─────────────────────────────────────────────────────────────────────────────

function detectAndResolveConflicts(
  allergenRemovals: AllergenRemoval[],
  protocolBlocks: ProtocolBlock[],
  textureClass: TextureClass,
  stageKey: DevelopmentalStageKey,
): ConflictResolution[] {
  const resolutions: ConflictResolution[] = [];

  // Conflict: failure_to_thrive (maximize calories) + allergen removes dairy
  const hasFTT = protocolBlocks.some(b => b.conditionId === "COND-0004");
  const hasDairyBlock = allergenRemovals.some(
    a => (a.allergenId === "milk" || a.allergenId === "milk_allergy") && a.action === "HARD_STOP"
  );
  if (hasFTT && hasDairyBlock) {
    resolutions.push({
      ruleA: "COND-0004 (Failure to Thrive: maximize calories via full-fat dairy)",
      ruleB: "Allergen HARD STOP on milk",
      resolution: "Use calorie-dense dairy alternatives (full-fat coconut milk, avocado, olive oil) — safety wins.",
      winner: "rule_b",
    });
  }

  // Conflict: iron deficiency protocol (pair with vitamin C) + reflux/GERD (avoid citrus)
  const hasIronDef = protocolBlocks.some(b => b.conditionId === "COND-0005");
  const hasReflux = protocolBlocks.some(b => b.conditionId === "COND-0007");
  if (hasIronDef && hasReflux) {
    resolutions.push({
      ruleA: "COND-0005 (Iron Deficiency: pair with citrus vitamin C)",
      ruleB: "COND-0007 (Reflux/GERD: avoid citrus)",
      resolution: "Use non-citrus vitamin C sources (strawberries, bell pepper, broccoli, tomato if tolerated) for iron absorption.",
      winner: "merged",
    });
  }

  // Conflict: beginning_foods stage (purée only) + eating behavior strategy prefers family table
  if (stageKey === "beginning_foods" && textureClass !== "puree_only") {
    resolutions.push({
      ruleA: "Stage DRI: beginning_foods requires purée-only texture",
      ruleB: "Parent preference or behavior strategy for softer textures",
      resolution: "Stage safety overrides behavioral preference — purée-only enforced.",
      winner: "rule_a",
    });
  }

  return resolutions;
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM CONTEXT BLOCK BUILDER — injected verbatim into AI system prompt
// ─────────────────────────────────────────────────────────────────────────────

function buildSystemContextBlock(ctx: Omit<PediatricMealGenerationContext, "systemContextBlock">): string {
  const lines: string[] = [];

  lines.push(`━━━ PEDIATRIC RESOLVER CONTEXT (v${ctx.resolverVersion}) ━━━`);
  lines.push(`Resolved: ${ctx.resolvedAt}`);
  lines.push(`Stage: ${ctx.stageDRIBaseline.stageLabel}`);
  lines.push(`Texture class: ${ctx.textureClass.replace(/_/g, " ").toUpperCase()}`);
  lines.push("");

  // DRI
  const dri = ctx.stageDRIBaseline;
  lines.push("── DRI Baseline ──");
  if (dri.kcalRangeMin > 0) {
    lines.push(`Calories: ${dri.kcalRangeMin}–${dri.kcalRangeMax} kcal/day`);
    lines.push(`Protein: ${dri.proteinGMin}–${dri.proteinGMax}g/day`);
  }
  lines.push(`Sodium max: ${dri.sodiumMgMax}mg/day`);
  if (dri.addedSugarGMax > 0) lines.push(`Added sugar max: ${dri.addedSugarGMax}g/day`);
  lines.push(`Serving guidance: ${dri.servingSizeGuidance}`);
  lines.push(`Honey allowed: ${dri.honeyAllowed ? "YES" : "NO — HARD STOP"}`);
  if (!dri.juiceAllowed) lines.push("Juice: NOT ALLOWED");
  lines.push("");

  // Level A rules
  const levelARules = ctx.firedRules.filter(r => r.level === "A");
  if (levelARules.length > 0) {
    lines.push("── LEVEL A SAFETY RULES — NON-NEGOTIABLE ──");
    for (const rule of levelARules) {
      lines.push(`[${rule.ruleId}] ${rule.description}`);
      lines.push(`  → Action: ${rule.action}`);
    }
    lines.push("");
  }

  // Level B rules
  const levelBRules = ctx.firedRules.filter(r => r.level === "B");
  if (levelBRules.length > 0) {
    lines.push("── LEVEL B GUIDELINES ──");
    for (const rule of levelBRules) {
      lines.push(`[${rule.ruleId}] ${rule.action}`);
    }
    lines.push("");
  }

  // Allergen removals
  if (ctx.allergenRemovals.length > 0) {
    lines.push("── ALLERGEN RULES ──");
    for (const a of ctx.allergenRemovals) {
      const badge = a.action === "HARD_STOP" ? "🚫 HARD STOP" :
                    a.action === "SOFT_BLOCK" ? "⚠️ SOFT BLOCK" :
                    a.action === "EXCLUDE" ? "❌ EXCLUDE" : "👁 PREFER AVOID";
      lines.push(`${badge} — ${a.displayName} (${a.severity.replace(/_/g, " ")})`);
      if (a.emergencyMedication) lines.push(`  ⚡ EpiPen prescribed — ensure complete exclusion`);
      if (a.crossContactWarning && a.hiddenSourceExamples.length > 0) {
        lines.push(`  Hidden sources: ${a.hiddenSourceExamples.join(", ")}`);
      }
    }
    lines.push("");
  }

  // Medical condition protocol blocks
  if (ctx.activeProtocolBlocks.length > 0) {
    lines.push("── MEDICAL CONDITION PROTOCOLS ──");
    for (const block of ctx.activeProtocolBlocks) {
      lines.push(`[${block.conditionId}] ${block.conditionLabel}`);
      for (const hl of block.hardLimits) lines.push(`  HARD LIMIT: ${hl}`);
      for (const g of block.guidance) lines.push(`  • ${g}`);
    }
    lines.push("");
  }

  // Texture directives
  lines.push("── TEXTURE DIRECTIVES ──");
  for (const d of ctx.textureDirectives) lines.push(`• ${d}`);
  lines.push("");

  // Cooking methods
  const culinary = CULINARY_REGISTRY[ctx.stageKey];
  lines.push("── COOKING METHODS ──");
  lines.push(`Allowed: ${culinary.allowed.join(", ") || "none"}`);
  lines.push(`Avoid: ${culinary.forbidden.join(", ") || "none"}`);
  lines.push("");

  // Behavioral strategy
  if (ctx.behavioralStrategy) {
    lines.push(`── BEHAVIORAL STRATEGY [${ctx.behavioralStrategy.strategyId}]: ${ctx.behavioralStrategy.label} ──`);
    for (const d of ctx.behavioralStrategy.directives) lines.push(`• ${d}`);
    lines.push("");
  }

  // Food acceptance
  for (const dir of ctx.foodAcceptanceDirectives) {
    if (dir.type === "avoid_dislike" && dir.items.length > 0) {
      lines.push(`── FOODS TO AVOID (parent-reported dislikes) ──`);
      lines.push(dir.items.join(", "));
      lines.push("");
    }
  }

  // School rules
  if (ctx.schoolRules.requiresSchoolSafe || ctx.schoolRules.requiresPackable) {
    lines.push("── SCHOOL / LUNCHBOX RULES ──");
    if (ctx.schoolRules.requiresSchoolSafe) {
      lines.push("SCHOOL-SAFE required: no tree nuts, no peanuts in any form.");
      for (const c of ctx.schoolRules.schoolSafeConstraints) lines.push(`• ${c}`);
    }
    if (ctx.schoolRules.requiresPackable) {
      lines.push("PACKABLE required: dish must be suitable for a lunchbox.");
      for (const c of ctx.schoolRules.packableConstraints) lines.push(`• ${c}`);
    }
    lines.push("");
  }

  // Kitchen reality
  const kr = ctx.kitchenRealityContext;
  if (kr.maxCookTimeMinutes || kr.budgetLevel) {
    lines.push("── KITCHEN CONSTRAINTS ──");
    if (kr.maxCookTimeMinutes) lines.push(`Max cook time: ${kr.maxCookTimeMinutes} minutes`);
    if (kr.budgetLevel) lines.push(`Budget: ${kr.budgetLevel.replace(/_/g, " ")}`);
    lines.push("");
  }

  // Conflict resolutions
  if (ctx.conflictResolutions.length > 0) {
    lines.push("── CONFLICT RESOLUTIONS ──");
    for (const cr of ctx.conflictResolutions) {
      lines.push(`• ${cr.ruleA} vs. ${cr.ruleB}`);
      lines.push(`  Resolution: ${cr.resolution}`);
    }
    lines.push("");
  }

  // Parent overrides
  const po = ctx.parentOverrides;
  if (po.culturalCuisine || po.dietaryPattern || po.goals.length > 0) {
    lines.push("── PARENT PREFERENCES (modulate only — never override safety) ──");
    if (po.dietaryPattern) lines.push(`Household dietary pattern: ${po.dietaryPattern}`);
    if (po.culturalCuisine) lines.push(`Cultural/cuisine preference: ${po.culturalCuisine}`);
    if (po.goals.length > 0) lines.push(`Goals: ${po.goals.join(", ")}`);
    lines.push("");
  }

  // Servings / meal type
  lines.push(`Servings: ${ctx.servings}`);
  lines.push(`Meal type: ${ctx.mealType}`);
  lines.push("");

  // Family meal
  if (ctx.isFamilyMealMode) {
    lines.push(`── FAMILY MEAL MODE (${ctx.childProfileIds.length} children) ──`);
    if (ctx.splitMealRequired) {
      lines.push(`⚠️ SPLIT MEAL REQUIRED: ${ctx.splitMealReason}`);
      lines.push("Generate two separate recipes — one per allergen group.");
    } else {
      lines.push("Context is intersection-safe — one recipe serves all children listed.");
    }
    lines.push("");
  }

  lines.push("━━━ END RESOLVER CONTEXT ━━━");
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// FAMILY MEAL INTERSECTION
// ─────────────────────────────────────────────────────────────────────────────

function computeFamilyIntersection(contexts: Array<{
  profile: ChildProfileRow;
  allergenRemovals: AllergenRemoval[];
  stageKey: DevelopmentalStageKey;
  textureClass: TextureClass;
  protocolBlocks: ProtocolBlock[];
}>): {
  primaryStage: DevelopmentalStageKey;
  primaryTextureClass: TextureClass;
  mergedAllergenRemovals: AllergenRemoval[];
  mergedProtocolBlocks: ProtocolBlock[];
  splitMealRequired: boolean;
  splitMealReason: string | null;
} {
  // Use most restrictive stage (smallest index = most restrictive)
  const stageOrder: DevelopmentalStageKey[] = [
    "early_infant", "beginning_foods", "young_toddler", "toddler",
    "preschool", "early_school_age", "growing_child",
  ];

  const sortedByStage = [...contexts].sort(
    (a, b) => stageOrder.indexOf(a.stageKey) - stageOrder.indexOf(b.stageKey)
  );
  const primaryStage = sortedByStage[0].stageKey;

  const textureOrder: TextureClass[] = ["puree_only", "mashed_soft", "soft_chopped", "family_modified", "family_table"];
  const sortedByTexture = [...contexts].sort(
    (a, b) => textureOrder.indexOf(a.textureClass) - textureOrder.indexOf(b.textureClass)
  );
  const primaryTextureClass = sortedByTexture[0].textureClass;

  // Union of all allergen removals — take strictest severity when same allergen appears
  const allergenMap = new Map<string, AllergenRemoval>();
  for (const ctx of contexts) {
    for (const ar of ctx.allergenRemovals) {
      const existing = allergenMap.get(ar.allergenId);
      if (!existing || actionSeverityScore(ar.action) > actionSeverityScore(existing.action)) {
        allergenMap.set(ar.allergenId, ar);
      }
    }
  }
  const mergedAllergenRemovals = Array.from(allergenMap.values());

  // Union of all protocol blocks
  const protocolMap = new Map<string, ProtocolBlock>();
  for (const ctx of contexts) {
    for (const pb of ctx.protocolBlocks) {
      if (!protocolMap.has(pb.conditionId)) protocolMap.set(pb.conditionId, pb);
    }
  }
  const mergedProtocolBlocks = Array.from(protocolMap.values());

  // Check for irreconcilable allergen conflicts
  // e.g., child A has HARD_STOP on egg, child B has HARD_STOP on all egg-free alternatives
  // In practice, we flag split meal if two children have directly contradictory HARD_STOPs
  // (e.g., one needs dairy-based calorie dense formula, the other has milk HARD_STOP)
  let splitMealRequired = false;
  let splitMealReason: string | null = null;

  const ftpChildren = contexts.filter(c => c.protocolBlocks.some(p => p.conditionId === "COND-0004"));
  const milkBlockChildren = contexts.filter(c =>
    c.allergenRemovals.some(a => a.allergenId === "milk" && a.action === "HARD_STOP")
  );
  if (ftpChildren.length > 0 && milkBlockChildren.length > 0) {
    // Check if it's the SAME child (already handled by conflict resolution) or different children
    const ftpIds = new Set(ftpChildren.map(c => c.profile.id));
    const milkIds = new Set(milkBlockChildren.map(c => c.profile.id));
    const overlap = Array.from(ftpIds).filter(id => milkIds.has(id));
    if (overlap.length === 0 && ftpIds.size > 0 && milkIds.size > 0) {
      // Different children — potentially irreconcilable
      // But we can still resolve with non-dairy calorie density — don't force split
    }
  }

  // Early infant + older child is automatically split-meal — can't combine purée-only with family table
  if (primaryStage === "early_infant") {
    splitMealRequired = true;
    splitMealReason = "Early infant stage (birth–5 months) requires breast milk/formula only — cannot combine with older children's recipes";
  }

  return {
    primaryStage,
    primaryTextureClass,
    mergedAllergenRemovals,
    mergedProtocolBlocks,
    splitMealRequired,
    splitMealReason,
  };
}

function actionSeverityScore(action: AllergenRemoval["action"]): number {
  return { HARD_STOP: 4, SOFT_BLOCK: 3, EXCLUDE: 2, PREFER_AVOID: 1 }[action] ?? 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN RESOLVER — single and family meal
// ─────────────────────────────────────────────────────────────────────────────

const RESOLVER_VERSION = "1.0.0";

/**
 * Resolve a complete PediatricMealGenerationContext.
 *
 * Usage:
 *   // Single child from profile
 *   const ctx = await resolvePediatricContext({ childProfileId: "uuid" });
 *
 *   // General mode (no profile)
 *   const ctx = await resolvePediatricContext({ childProfileId: null, stageOverride: "toddler" });
 *
 *   // Family meal
 *   const ctx = await resolvePediatricContext({ childProfileId: null, childProfileIds: ["uuid1", "uuid2"] });
 */
export async function resolvePediatricContextFromInput(
  input: PediatricResolverInput,
): Promise<PediatricMealGenerationContext> {
  const resolvedAt = new Date().toISOString();

  // ── Determine mode ─────────────────────────────────────────────────────────
  const isFamilyMealMode = Array.isArray(input.childProfileIds) && input.childProfileIds.length > 1;

  if (isFamilyMealMode) {
    return resolveFamily(input, resolvedAt);
  }

  // ── Single child ────────────────────────────────────────────────────────────
  let profile: ChildProfileRow | null = null;
  if (input.childProfileId) {
    profile = await fetchChildProfile(input.childProfileId);
  }

  const stageKey: DevelopmentalStageKey = profile?.age_stage ?? input.stageOverride ?? "toddler";
  const allergies: any[] = profile?.allergies ?? input.allergyOverride ?? [];
  const medicalConditions: any[] = profile?.medical_conditions ?? [];
  const feedingConcerns: any[] = profile?.feeding_concerns ?? [];
  const sensoryIssues: any[] = profile?.sensory_issues ?? [];
  const dislikes: any[] = profile?.dislikes ?? [];

  // Parse feeding ability from feeding_concerns if structured
  const feedingAbilityFromConcerns = extractFeedingAbility(feedingConcerns);

  // 1. Rule Registry
  const { fired: rulesFired, withheld: rulesWithheld } = fireRulesForStage(stageKey);

  // 2. Protocol Registry
  const activeProtocolBlocks = resolveProtocolBlocks(medicalConditions);

  // 3 + 4. Food Behavior Registry + Ingredient Intelligence
  const allergenRemovals = resolveAllergenRemovals(allergies);

  // 5. Behavior / Acceptance
  const behavioralStrategy = resolveBehavioralStrategy(feedingConcerns, sensoryIssues);
  const foodAcceptanceDirectives = resolveFoodAcceptanceDirectives(dislikes, feedingConcerns, behavioralStrategy);

  // 6. Culinary Registry — texture class
  const {
    textureClass,
    directives: textureDirectives,
    firedRules: textureFiredRules,
  } = resolveTextureClass(
    stageKey,
    feedingConcerns,
    sensoryIssues,
    feedingAbilityFromConcerns.hasFeedingTube,
    feedingAbilityFromConcerns.swallowingDifficulty,
    feedingAbilityFromConcerns.historyOfChokingOrGagging,
    feedingAbilityFromConcerns.clinicianTextureLevel,
  );

  // Add texture-specific rules to fired rules
  const allFiredRules = [...rulesFired, ...textureFiredRules];

  // Dedup rule IDs
  const seenRuleIds = new Set<string>();
  const dedupedFiredRules = allFiredRules.filter(r => {
    if (seenRuleIds.has(r.ruleId)) return false;
    seenRuleIds.add(r.ruleId);
    return true;
  });

  // Cooking method constraints from culinary registry
  const culinaryEntry = CULINARY_REGISTRY[stageKey];
  const cookingMethodConstraints = [
    ...culinaryEntry.allowed.map(m => `ALLOWED: ${m}`),
    ...culinaryEntry.forbidden.map(m => `FORBIDDEN: ${m}`),
  ];

  // 7. Kitchen Reality
  const kitchenRealityContext: KitchenRealityContext = {
    budgetLevel: input.parentPrefs?.budgetLevel ?? null,
    maxCookTimeMinutes: input.parentPrefs?.maxCookTimeMinutes ?? null,
    equipmentConstraints: [],
  };

  // School rules
  const schoolRules: SchoolRules = {
    requiresSchoolSafe: input.parentPrefs?.requiresSchoolSafe ?? false,
    requiresPackable: input.parentPrefs?.requiresPackable ?? false,
    schoolSafeConstraints: input.parentPrefs?.requiresSchoolSafe
      ? ["No tree nuts in any form", "No peanuts in any form", "Check all manufactured products for nut traces"]
      : [],
    packableConstraints: input.parentPrefs?.requiresPackable
      ? ["No soups that will spill", "Use sealed containers", "No items requiring immediate refrigeration if no ice pack"]
      : [],
  };

  // Parent overrides
  const parentOverrides: ParentOverrides = {
    culturalCuisine: input.parentPrefs?.culturalCuisine ?? profile?.cultural_preferences ?? null,
    dietaryPattern: input.parentPrefs?.dietaryPattern ?? null,
    goals: input.parentPrefs?.goals ?? [],
    notes: [],
  };

  // Conflict detection
  const conflictResolutions = detectAndResolveConflicts(
    allergenRemovals,
    activeProtocolBlocks,
    textureClass,
    stageKey,
  );

  // DRI baseline
  const stageDRIBaseline = DRI_BASELINES[stageKey];

  const ctxWithoutSystemBlock: Omit<PediatricMealGenerationContext, "systemContextBlock"> = {
    resolvedAt,
    resolverVersion: RESOLVER_VERSION,
    childProfileIds: profile ? [profile.id] : [],
    isFamilyMealMode: false,
    splitMealRequired: false,
    splitMealReason: null,
    stageKey,
    stageDRIBaseline,
    firedRules: dedupedFiredRules,
    withheldRules: rulesWithheld,
    activeProtocolBlocks,
    allergenRemovals,
    textureClass,
    textureDirectives,
    cookingMethodConstraints,
    behavioralStrategy,
    foodAcceptanceDirectives,
    timeConstraint: kitchenRealityContext.maxCookTimeMinutes,
    servings: input.servings ?? 1,
    mealType: input.mealType ?? "any",
    schoolRules,
    kitchenRealityContext,
    parentOverrides,
    conflictResolutions,
  };

  return {
    ...ctxWithoutSystemBlock,
    systemContextBlock: buildSystemContextBlock(ctxWithoutSystemBlock),
  };
}

// ─── Family meal variant ───────────────────────────────────────────────────────

async function resolveFamily(
  input: PediatricResolverInput,
  resolvedAt: string,
): Promise<PediatricMealGenerationContext> {
  const ids = input.childProfileIds ?? [];
  const profiles = await Promise.all(ids.map(id => fetchChildProfile(id)));
  const validProfiles = profiles.filter(Boolean) as ChildProfileRow[];

  if (validProfiles.length === 0) {
    // Fall back to general mode if no profiles found
    return resolvePediatricContextFromInput({ ...input, childProfileId: null, childProfileIds: undefined });
  }

  const perChildContexts = validProfiles.map(profile => {
    const feedingAbility = extractFeedingAbility(profile.feeding_concerns);
    const { textureClass } = resolveTextureClass(
      profile.age_stage,
      profile.feeding_concerns,
      profile.sensory_issues,
      feedingAbility.hasFeedingTube,
      feedingAbility.swallowingDifficulty,
      feedingAbility.historyOfChokingOrGagging,
      feedingAbility.clinicianTextureLevel,
    );
    return {
      profile,
      stageKey: profile.age_stage,
      allergenRemovals: resolveAllergenRemovals(profile.allergies),
      textureClass,
      protocolBlocks: resolveProtocolBlocks(profile.medical_conditions),
    };
  });

  const {
    primaryStage,
    primaryTextureClass,
    mergedAllergenRemovals,
    mergedProtocolBlocks,
    splitMealRequired,
    splitMealReason,
  } = computeFamilyIntersection(perChildContexts);

  const { fired: rulesFired, withheld: rulesWithheld } = fireRulesForStage(primaryStage);
  const stageDRIBaseline = DRI_BASELINES[primaryStage];
  const culinaryEntry = CULINARY_REGISTRY[primaryStage];
  const textureDirectives = textureClassDirectives(primaryTextureClass, primaryStage);
  const cookingMethodConstraints = [
    ...culinaryEntry.allowed.map(m => `ALLOWED: ${m}`),
    ...culinaryEntry.forbidden.map(m => `FORBIDDEN: ${m}`),
  ];

  const allDislikes = validProfiles.flatMap(p => p.dislikes ?? []);
  const allFeedingConcerns = validProfiles.flatMap(p => p.feeding_concerns ?? []);
  const allSensoryIssues = validProfiles.flatMap(p => p.sensory_issues ?? []);

  const behavioralStrategy = resolveBehavioralStrategy(allFeedingConcerns, allSensoryIssues);
  const foodAcceptanceDirectives = resolveFoodAcceptanceDirectives(allDislikes, allFeedingConcerns, behavioralStrategy);

  const parentOverrides: ParentOverrides = {
    culturalCuisine: input.parentPrefs?.culturalCuisine ?? null,
    dietaryPattern: input.parentPrefs?.dietaryPattern ?? null,
    goals: input.parentPrefs?.goals ?? [],
    notes: [],
  };

  const schoolRules: SchoolRules = {
    requiresSchoolSafe: input.parentPrefs?.requiresSchoolSafe ?? false,
    requiresPackable: input.parentPrefs?.requiresPackable ?? false,
    schoolSafeConstraints: input.parentPrefs?.requiresSchoolSafe
      ? ["No tree nuts", "No peanuts in any form"]
      : [],
    packableConstraints: input.parentPrefs?.requiresPackable
      ? ["Suitable for a lunchbox", "Sealed containers", "Cold-safe if no ice pack"]
      : [],
  };

  const kitchenRealityContext: KitchenRealityContext = {
    budgetLevel: input.parentPrefs?.budgetLevel ?? null,
    maxCookTimeMinutes: input.parentPrefs?.maxCookTimeMinutes ?? null,
    equipmentConstraints: [],
  };

  const conflictResolutions = detectAndResolveConflicts(
    mergedAllergenRemovals,
    mergedProtocolBlocks,
    primaryTextureClass,
    primaryStage,
  );

  const seenRuleIds = new Set<string>();
  const dedupedFiredRules = rulesFired.filter(r => {
    if (seenRuleIds.has(r.ruleId)) return false;
    seenRuleIds.add(r.ruleId);
    return true;
  });

  const ctxWithoutSystemBlock: Omit<PediatricMealGenerationContext, "systemContextBlock"> = {
    resolvedAt,
    resolverVersion: RESOLVER_VERSION,
    childProfileIds: validProfiles.map(p => p.id),
    isFamilyMealMode: true,
    splitMealRequired,
    splitMealReason,
    stageKey: primaryStage,
    stageDRIBaseline,
    firedRules: dedupedFiredRules,
    withheldRules: rulesWithheld,
    activeProtocolBlocks: mergedProtocolBlocks,
    allergenRemovals: mergedAllergenRemovals,
    textureClass: primaryTextureClass,
    textureDirectives,
    cookingMethodConstraints,
    behavioralStrategy,
    foodAcceptanceDirectives,
    timeConstraint: kitchenRealityContext.maxCookTimeMinutes,
    servings: input.servings ?? validProfiles.length,
    mealType: input.mealType ?? "any",
    schoolRules,
    kitchenRealityContext,
    parentOverrides,
    conflictResolutions,
  };

  return {
    ...ctxWithoutSystemBlock,
    systemContextBlock: buildSystemContextBlock(ctxWithoutSystemBlock),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

interface FeedingAbilityExtract {
  hasFeedingTube: boolean;
  swallowingDifficulty: boolean;
  historyOfChokingOrGagging: boolean;
  clinicianTextureLevel: string | null;
}

function extractFeedingAbility(feedingConcerns: any[]): FeedingAbilityExtract {
  if (!Array.isArray(feedingConcerns)) {
    return { hasFeedingTube: false, swallowingDifficulty: false, historyOfChokingOrGagging: false, clinicianTextureLevel: null };
  }

  const flat = feedingConcerns.map(f =>
    typeof f === "string" ? f.toLowerCase() : JSON.stringify(f).toLowerCase()
  ).join(" ");

  return {
    hasFeedingTube: flat.includes("feeding_tube") || flat.includes("feeding tube") || flat.includes("g-tube") || flat.includes("ng-tube"),
    swallowingDifficulty: flat.includes("swallow") || flat.includes("dysphagia"),
    historyOfChokingOrGagging: flat.includes("chok") || flat.includes("gag"),
    clinicianTextureLevel:
      flat.includes("iddsi") ? extractIddsiLevel(flat) :
      flat.includes("purée") || flat.includes("puree") ? "purée" :
      flat.includes("mashed") ? "mashed" :
      null,
  };
}

function extractIddsiLevel(text: string): string | null {
  const match = text.match(/iddsi\s*level\s*(\d)/i);
  if (match) return `IDDSI Level ${match[1]}`;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// SCENARIO RUNNER ADAPTER
//
// The test runner (tests/pediatric/run-scenarios.ts) and Resolver Inspector
// expect this exact signature:
//   resolvePediatricContext(profile: ChildProfile, request: PediatricMealRequest)
//     → Promise<PediatricContext>
//
// This adapter sits on top of resolvePediatricContextFromInput and translates:
//   • Hard-stop gates (MPB-GATE001/002/003)
//   • RULE-XXXX → MPB-SXXX rule IDs
//   • Allergy severity → MPB-ALLERGY-* rules
//   • Meal context → MPB-CTX* rules
//   • Medical condition → MPB-MED* rules + semantic protocol IDs
//   • Condition-specific exclusions and language flags
//   • Allergen exclusion expansion
//   • mealType from stage + context + foodRequest
// ─────────────────────────────────────────────────────────────────────────────

export interface PediatricContext {
  stage: string;
  rulesFired: Array<{ ruleId: string; level: "A" | "B" | "C"; description: string; action: string }>;
  exclusions: string[];
  protocols: string[];
  hardStop: boolean;
  hardStopReason?: string;
  languageFlags: string[];
  conditionGuidanceBlocks: string[];
  mealType?: string;
}

// ── RULE-XXXX → MPB-SXXX ─────────────────────────────────────────────────────

const RULE_TO_MPB: Record<string, string> = {
  "RULE-0001": "MPB-S001",   // honey ban
  "RULE-0002": "MPB-S002",   // cow's milk under 12m
  "RULE-0003": "MPB-S003",   // juice ban
  "RULE-0004": "MPB-S004",   // texture — purée only
  "RULE-0005": "MPB-S005",   // whole nuts
  "RULE-0006": "MPB-S006",   // grapes quartered
  "RULE-0007": "MPB-S007",   // cherry tomatoes halved
  "RULE-0008": "MPB-S008",   // raw hard vegetables
  "RULE-0009": "MPB-S008",   // grate/steam carrots/celery — same bucket
  "RULE-0010": "MPB-S009",   // popcorn
  "RULE-0011": "MPB-S010",   // hard candy
  "RULE-0012": "MPB-S012",   // mercury fish
  "RULE-0013": "MPB-S011",   // meat finely puréed
  "RULE-0014": "MPB-S011",   // meat finely chopped — same bucket
  "RULE-0015": "MPB-S016",   // limit added sugar
  "RULE-0016": "MPB-S017",   // limit sodium
  "RULE-0017": "MPB-S015",   // formula modification language flag
  "RULE-0018": "MPB-GATE001", // early infant hard stop
  "RULE-0019": "MPB-S013",   // iron-rich foods priority
  "RULE-0020": "MPB-S014",   // LEAP allergen introduction
  "RULE-0021": "MPB-S018",   // age-appropriate serving
  "RULE-0022": "MPB-S019",
  "RULE-0023": "MPB-S020",
};

// ── Medical condition → MPB-MEDxxx ───────────────────────────────────────────

const MED_RULE_IDS: Record<string, string> = {
  failure_to_thrive:      "MPB-MED003",
  type2_diabetes:         "MPB-MED004",
  iron_deficiency_anemia: "MPB-MED005",
  iron_deficiency:        "MPB-MED005",
  type1_diabetes:         "MPB-MED006",
  pediatric_obesity:      "MPB-MED007",
  adhd:                   "MPB-MED008",
  autism_spectrum:        "MPB-MED009",
  // crohns_disease flare → MED010, remission → MED011 (handled inline)
  ckd:                    "MPB-MED012",
  cystic_fibrosis:        "MPB-MED013",
  celiac_disease:         "MPB-MED014",
};

// ── Medical condition → semantic protocol IDs ─────────────────────────────────

const CONDITION_PROTOCOLS: Record<string, string[]> = {
  celiac_disease:           ["celiac-strict-gluten-free"],
  iron_deficiency_anemia:   ["iron-rich-foods-priority", "vitamin-c-iron-pairing", "iron-absorption-enhancers"],
  iron_deficiency:          ["iron-rich-foods-priority", "vitamin-c-iron-pairing", "iron-absorption-enhancers"],
  failure_to_thrive:        ["ftt-caloric-density", "energy-dense-additions", "growth-support-framing"],
  type1_diabetes:           ["t1d-carb-consistent", "glycemic-index-awareness", "paired-protein-fat"],
  type2_diabetes:           ["t2d-glycemic-management", "low-glycemic-index-focus", "fiber-rich-foods"],
  pediatric_obesity:        ["pediatric-obesity-wellness-framing", "balanced-nutrient-density", "no-restriction-language"],
  ckd:                      ["ckd-sodium-restriction", "ckd-phosphorus-restriction", "ckd-potassium-monitoring", "kidney-safe-protein-levels"],
  cystic_fibrosis:          ["cf-caloric-density", "fat-soluble-vitamins-support", "energy-dense-additions"],
  adhd:                     ["adhd-structured-eating", "minimal-meal-complexity", "routine-consistent-presentation"],
  autism_spectrum:          ["autism-sensory-texture-control", "uniform-texture-presentation", "sensory-safe-ingredients"],
};

// Conditions that always add "pediatrician-consult-note"
const CLINICIAN_CONDITIONS = new Set([
  "celiac_disease", "iron_deficiency_anemia", "iron_deficiency",
  "failure_to_thrive", "type1_diabetes", "type2_diabetes", "pediatric_obesity",
  "ckd", "cystic_fibrosis", "adhd", "autism_spectrum",
  "crohns_disease",
]);

// ── Stage-based baseline protocols ───────────────────────────────────────────

const STAGE_PROTOCOLS: Partial<Record<string, string[]>> = {
  beginning_foods: ["beginning-foods-texture", "iron-fortified-foods"],
  young_toddler:   ["young-toddler-texture"],
};

// ── Condition-specific exclusions ────────────────────────────────────────────

const CONDITION_EXCLUSIONS: Record<string, string[]> = {
  crohns_disease_flare:     ["raw vegetables", "high-fiber", "seeds", "nuts", "popcorn", "spicy", "fried", "high-fat", "lactose"],
  crohns_disease_remission: ["fried", "heavily spiced", "excessive dairy"],
  ckd:                      ["high sodium", "high phosphorus", "high potassium"],
};

// ── Condition-specific language flags ────────────────────────────────────────

const CONDITION_LANGUAGE_FLAGS: Record<string, string[]> = {
  pediatric_obesity: ["lose weight", "weight loss", "calorie deficit", "overweight", "obese", "fat", "diet", "cut calories", "portion restriction", "low-calorie", "clinical treatment"],
  crohns_disease:    ["medication", "immunosuppressant", "biologics", "infliximab", "steroid", "prednisone", "clinical treatment"],
  autism_spectrum:   ["behavior therapy", "ABA", "sensory integration therapy", "punishment"],
  adhd:              ["ADHD treatment", "Ritalin", "Adderall", "behavior modification"],
  cystic_fibrosis:   ["CFTR", "clinical treatment"],
};

// ── Allergen exclusion expansion ─────────────────────────────────────────────

const ALLERGEN_EXCLUSION_TERMS: Record<string, string[]> = {
  peanut:    ["peanut", "peanut butter", "peanut oil", "groundnut", "arachis oil"],
  tree_nuts: ["tree nuts", "walnut", "cashew", "almond", "pecan", "brazil nut", "hazelnut", "pistachio", "macadamia", "pine nut"],
  milk:      ["milk", "dairy", "cow's milk", "casein", "whey", "butter", "cheese", "cream", "yogurt"],
  egg:       ["egg", "eggs", "egg white", "egg yolk", "albumin", "mayonnaise"],
  wheat:     ["wheat", "gluten", "barley", "rye", "spelt"],
  soy:       ["soy", "soya", "tofu", "edamame", "tempeh", "miso"],
  sesame:    ["sesame", "tahini", "sesame oil", "sesame seeds"],
  fish:      ["fish", "tuna", "salmon", "cod", "tilapia", "halibut", "anchovy", "sardine"],
  shellfish: ["shellfish", "shrimp", "lobster", "crab", "clam", "oyster", "scallop", "prawn"],
};

// ── mealType derivation ───────────────────────────────────────────────────────

function deriveMealType(
  stage: string,
  request: { mealContext?: string; foodRequest?: string },
): "breakfast" | "lunch" | "dinner" | "snack" | "puree" | "any" {
  if (stage === "beginning_foods") return "puree";
  const ctx = request.mealContext ?? "";
  if (ctx === "school_lunch") return "lunch";
  if (ctx === "birthday_party") return "any";
  const fr = (request.foodRequest ?? "").toLowerCase();
  if (fr.includes("breakfast") || fr.includes("morning") || fr.includes("oatmeal") || fr.includes("cereal")) return "breakfast";
  if (fr.includes("lunch") || fr.includes("school")) return "lunch";
  if (fr.includes("dinner") || fr.includes("supper")) return "dinner";
  if (fr.includes("snack")) return "snack";
  if (fr.includes("purée") || fr.includes("puree")) return "puree";
  return "any";
}

// ── Main adapter ──────────────────────────────────────────────────────────────

export async function resolvePediatricContext(
  profile: {
    childId?: string;
    ageStage: string;
    allergies: Array<{
      allergenId: string;
      severity?: string;
      emergencyMedication?: boolean;
      customAllergenName?: string;
    }>;
    medicalConditions: string[];
    behavioralFlags?: string[];
    crohnPhase?: string;
    foodAcceptanceScore?: number;
    neverRecommendIngredients?: string[];
    parentSubstitutes?: Record<string, string>;
  },
  request: {
    foodRequest: string;
    mealContext?: string;
    requiresSchoolSafe?: boolean;
    requiresPackable?: boolean;
    servings?: number;
    familyProfiles?: unknown[];
    pantryIngredients?: string[];
  },
): Promise<PediatricContext> {
  const stage = profile.ageStage;
  const conditions = (profile.medicalConditions ?? []).map(c =>
    c.toLowerCase().replace(/[\s\-]/g, "_")
  );
  const allergies = profile.allergies ?? [];
  const mealType = deriveMealType(stage, request);

  // ── GATE 1 — early infant ──────────────────────────────────────────────────
  if (stage === "early_infant") {
    return {
      stage,
      hardStop: true,
      hardStopReason: "early_infant",
      rulesFired: [
        { ruleId: "MPB-GATE001", level: "A", description: "Early infant (birth–5 months) — no solid food generation permitted. Breast milk or formula only.", action: "BLOCK generation — redirect to breast milk/formula guidance" },
        { ruleId: "MPB-S015", level: "A", description: "Never suggest formula modifications or homemade formula.", action: "FLAG language: formula modification, homemade formula" },
      ],
      protocols: [],
      exclusions: [],
      languageFlags: ["formula modification", "homemade formula"],
      conditionGuidanceBlocks: [],
      mealType: "any",
    };
  }

  // ── GATE 2 — PKU ──────────────────────────────────────────────────────────
  if (conditions.includes("pku")) {
    return {
      stage,
      hardStop: true,
      hardStopReason: "pku",
      rulesFired: [{ ruleId: "MPB-GATE002", level: "A", description: "Phenylketonuria — phenylalanine-restricted diet requires metabolic dietitian oversight. No standard meal generation.", action: "BLOCK generation — refer to metabolic dietitian" }],
      protocols: [],
      exclusions: [],
      languageFlags: [],
      conditionGuidanceBlocks: ["pku"],
      mealType: "any",
    };
  }

  // ── GATE 3 — G-tube ───────────────────────────────────────────────────────
  if (conditions.includes("g_tube")) {
    return {
      stage,
      hardStop: true,
      hardStopReason: "g_tube",
      rulesFired: [{ ruleId: "MPB-GATE003", level: "A", description: "Gastrostomy tube — child relies on enteral nutrition. Oral meal generation requires explicit clinical clearance.", action: "BLOCK generation — refer to clinical feeding team" }],
      protocols: [],
      exclusions: [],
      languageFlags: [],
      conditionGuidanceBlocks: ["g_tube"],
      mealType: "any",
    };
  }

  // ── Call the internal resolver for stage rules ────────────────────────────
  let ctx: PediatricMealGenerationContext | null = null;
  try {
    ctx = await resolvePediatricContextFromInput({
      childProfileId: null,
      stageOverride: stage as DevelopmentalStageKey,
      allergyOverride: allergies.map(a => ({
        allergenId: a.allergenId,
        severity: (a.severity ?? "confirmed_allergy") as AllergenRemoval["severity"],
        emergencyMedication: a.emergencyMedication,
        customAllergenName: a.customAllergenName,
      })),
      parentPrefs: {
        requiresSchoolSafe: request.requiresSchoolSafe,
        requiresPackable: request.requiresPackable,
      },
      mealType: "any",
    });
  } catch {
    ctx = null;
  }

  // ── Build rulesFired ──────────────────────────────────────────────────────
  const seenMpb = new Set<string>();
  const rulesFired: PediatricContext["rulesFired"] = [];

  function addRule(ruleId: string, level: "A" | "B" | "C", description: string, action: string) {
    if (seenMpb.has(ruleId)) return;
    seenMpb.add(ruleId);
    rulesFired.push({ ruleId, level, description, action });
  }

  // Stage rules from internal resolver (RULE-XXXX → MPB-SXXX)
  if (ctx) {
    for (const r of ctx.firedRules) {
      const mpbId = RULE_TO_MPB[r.ruleId] ?? r.ruleId;
      // Skip early-infant gate rule if it leaked into non-infant stages
      if (mpbId === "MPB-GATE001") continue;
      addRule(mpbId, r.level, r.description, r.action);
    }
  }

  // Allergy severity rules
  const confirmedAllergies = allergies.filter(a =>
    a.severity === "confirmed_allergy" || a.severity === "clinician_elimination"
  );
  const softBlockAllergies = allergies.filter(a => a.severity === "suspected_reaction");
  const intoleranceAllergies = allergies.filter(a => a.severity === "intolerance");
  const preferenceAllergies = allergies.filter(a => a.severity === "preference_avoid");

  if (confirmedAllergies.length > 0) {
    addRule("MPB-ALLERGY-HARD-STOP", "A", "Confirmed allergen — hard exclusion from all ingredients and cooking surfaces.", "EXCLUDE allergen from every ingredient");
  }
  if (softBlockAllergies.length > 0) {
    addRule("MPB-ALLERGY-SOFT-BLOCK", "B", "Suspected allergen reaction — soft block, flag for parent awareness.", "AVOID allergen as primary ingredient; flag in output");
  }
  if (intoleranceAllergies.length > 0) {
    addRule("MPB-ALLERGY-INTOLERANCE", "B", "Allergen intolerance — minimize but not hard-stop.", "MINIMIZE allergen use");
  }
  if (preferenceAllergies.length > 0) {
    addRule("MPB-ALLERGY-PREFERENCE", "C", "Parent preference to avoid — soft guidance, no safety gate.", "PREFER to avoid when alternatives exist");
  }
  if (confirmedAllergies.length >= 2) {
    addRule("MPB-ALLERGY-COMPOUND-REVIEW", "A", "Multiple confirmed allergens — compound exclusion review required.", "VERIFY no shared ingredients violate multiple allergen exclusions");
  }
  if (allergies.some(a => a.emergencyMedication)) {
    addRule("MPB-ALLERGY-EPINEPHRINE", "A", "Emergency epinephrine prescribed — anaphylaxis risk. Maximum allergen vigilance.", "FLAG epinephrine requirement in all output");
  }

  // Meal context rules
  const CTX_RULES: Record<string, string> = {
    school_lunch: "MPB-CTX001",
    birthday_party: "MPB-CTX002",
    pantry_only: "MPB-CTX003",
  };
  const ctxRuleId = CTX_RULES[request.mealContext ?? ""];
  if (ctxRuleId) {
    addRule(ctxRuleId, "B", `Meal context: ${request.mealContext}`, "APPLY context-specific constraints");
  }

  // Medical condition rules
  for (const cond of conditions) {
    if (cond === "crohns_disease") {
      const phase = (profile.crohnPhase ?? "flare").toLowerCase();
      const medId = phase === "remission" ? "MPB-MED011" : "MPB-MED010";
      addRule(medId, "B", `Crohn's disease (${phase}) protocol activated`, "INJECT condition guidance block");
      continue;
    }
    const medId = MED_RULE_IDS[cond];
    if (medId) {
      addRule(medId, "B", `Medical condition protocol activated: ${cond.replace(/_/g, " ")}`, "INJECT condition guidance block");
    }
  }

  // Obesity wellness language flag rule
  if (conditions.includes("pediatric_obesity")) {
    addRule("MPB-LANGUAGE-WELLNESS", "B", "Pediatric obesity — weight-focused language is harmful. Use wellness framing only.", "FLAG weight-negative language: overweight, fat, diet, calories, lose weight");
  }

  // ── Build protocols ────────────────────────────────────────────────────────
  const protocolSet = new Set<string>();

  // Stage-based
  for (const p of (STAGE_PROTOCOLS[stage] ?? [])) protocolSet.add(p);

  // Condition-based
  for (const cond of conditions) {
    if (cond === "crohns_disease") {
      const phase = (profile.crohnPhase ?? "flare").toLowerCase();
      if (phase === "remission") {
        for (const p of ["crohns-remission-gradual-reintroduction", "anti-inflammatory-focus", "nutrient-dense-balanced"]) protocolSet.add(p);
      } else {
        for (const p of ["crohns-flare-low-residue", "gut-gentle-preparation", "anti-inflammatory-focus", "small-frequent-meals"]) protocolSet.add(p);
      }
      protocolSet.add("pediatrician-consult-note");
      continue;
    }
    for (const p of (CONDITION_PROTOCOLS[cond] ?? [])) protocolSet.add(p);
    if (CLINICIAN_CONDITIONS.has(cond)) protocolSet.add("pediatrician-consult-note");
  }

  // Allergen-based protocols
  if (confirmedAllergies.length > 0) {
    protocolSet.add("confirmed-allergy-exclusion");
    protocolSet.add("allergen-alert-required");
  }
  if (confirmedAllergies.length >= 2) {
    protocolSet.add("multi-allergen-compound-check");
  }
  if (allergies.some(a => a.emergencyMedication)) {
    protocolSet.add("epinephrine-preparation-reminder");
  }
  // Celiac always needs cross-contamination + allergen alert (even without explicit wheat allergy entry)
  if (conditions.includes("celiac_disease")) {
    protocolSet.add("allergen-alert-required");
    if (!confirmedAllergies.some(a => a.allergenId === "wheat")) {
      protocolSet.add("cross-contamination-warning");
    }
  }
  // Milk allergy: add dairy-free-alternative protocol
  if (confirmedAllergies.some(a => a.allergenId === "milk")) {
    protocolSet.add("dairy-free-alternative");
  }

  // Context-based protocols
  if (request.requiresSchoolSafe) protocolSet.add("school-safe-protocol");
  if (request.requiresPackable) protocolSet.add("packable-lunch");

  // ── Build exclusions ──────────────────────────────────────────────────────
  const exclusionSet = new Set<string>();

  // Allergen expansion
  for (const allergy of allergies) {
    const severity = allergy.severity ?? "confirmed_allergy";
    if (severity === "confirmed_allergy" || severity === "clinician_elimination" || severity === "suspected_reaction") {
      const terms = ALLERGEN_EXCLUSION_TERMS[allergy.allergenId];
      if (terms) {
        for (const t of terms) exclusionSet.add(t);
      } else {
        exclusionSet.add(allergy.customAllergenName ?? allergy.allergenId);
      }
    }
  }

  // Celiac always excludes gluten grains even without explicit wheat allergy
  if (conditions.includes("celiac_disease")) {
    for (const t of ["gluten", "wheat", "barley", "rye", "spelt"]) exclusionSet.add(t);
  }

  // Condition-specific food exclusions
  for (const cond of conditions) {
    if (cond === "crohns_disease") {
      const phase = (profile.crohnPhase ?? "flare").toLowerCase();
      const key = phase === "remission" ? "crohns_disease_remission" : "crohns_disease_flare";
      for (const e of (CONDITION_EXCLUSIONS[key] ?? [])) exclusionSet.add(e);
      continue;
    }
    for (const e of (CONDITION_EXCLUSIONS[cond] ?? [])) exclusionSet.add(e);
  }

  // Rule-based EXCLUDE actions (honey, juice, etc.)
  for (const r of rulesFired) {
    if (r.action.startsWith("EXCLUDE ")) {
      const raw = r.action.replace(/^EXCLUDE\s+/i, "").replace(/\s+(from|—|in).*/i, "").trim().toLowerCase();
      if (raw && raw.length < 40) exclusionSet.add(raw);
    }
  }

  // Parent never-recommend ingredients
  for (const ing of (profile.neverRecommendIngredients ?? [])) {
    exclusionSet.add(ing.toLowerCase());
  }

  // ── Language flags ─────────────────────────────────────────────────────────
  const languageFlagSet = new Set<string>();
  for (const cond of conditions) {
    for (const flag of (CONDITION_LANGUAGE_FLAGS[cond] ?? [])) {
      languageFlagSet.add(flag);
    }
  }

  // ── conditionGuidanceBlocks ────────────────────────────────────────────────
  const conditionGuidanceBlocks = conditions.filter(c =>
    CONDITION_PROTOCOLS[c] !== undefined || c === "crohns_disease"
  );

  return {
    stage,
    hardStop: false,
    rulesFired,
    protocols: Array.from(protocolSet),
    exclusions: Array.from(exclusionSet),
    languageFlags: Array.from(languageFlagSet),
    conditionGuidanceBlocks,
    mealType,
  };
}
