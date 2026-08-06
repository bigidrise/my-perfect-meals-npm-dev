/**
 * Pediatric Rule Registry
 *
 * Every enforceable pediatric safety rule is a versioned object here.
 * This is the single authoritative source — not prompt text, not comments.
 *
 * Level A — hard stop: block generation or strip the output; must never appear.
 * Level B — soft advisory: flag in rulesFireLog, include in educationNote,
 *            do not block generation.
 *
 * Fields:
 *   ruleId          — stable machine ID (never reuse a retired ID)
 *   description     — human-readable rule statement
 *   evidenceSource  — reference standard behind the rule
 *   version         — semver; bump when logic changes
 *   effectiveDate   — when this version became active (ISO date)
 *   reviewDate      — when this rule should be reviewed for currency (ISO date)
 *   level           — "A" (hard stop) | "B" (soft advisory)
 *   action          — what the guardrail does when this rule fires
 *   stagesApplicable — which stages the rule applies to (empty = all stages)
 */

import type { DevelopmentalStage } from "./foodBehaviorRegistry";

export type RuleLevel = "A" | "B";

export interface PediatricRule {
  ruleId: string;
  description: string;
  evidenceSource: string;
  version: string;
  effectiveDate: string;   // ISO date string
  reviewDate: string;      // ISO date string — when to re-verify evidence
  level: RuleLevel;
  action: string;          // what happens when this rule fires
  stagesApplicable: DevelopmentalStage[]; // empty array means all stages
}

export interface RuleFireLog {
  ruleId: string;
  level: RuleLevel;
  description: string;
  action: string;
  firedFor?: string;  // optional: the specific text/ingredient that triggered it
}

// ─── Registry ────────────────────────────────────────────────────────────────

export const PEDIATRIC_RULE_REGISTRY: PediatricRule[] = [
  // ── Food Safety — Toxicological ──────────────────────────────────────────

  {
    ruleId: "honey-ban-under-24m",
    description:
      "Honey is prohibited in any form for children under 24 months. " +
      "Clostridium botulinum spores in honey can cause infant botulism, " +
      "which is life-threatening for immature immune systems.",
    evidenceSource: "AAP Committee on Nutrition; WHO infant feeding guidelines; FDA honey advisory",
    version: "1.0.0",
    effectiveDate: "2024-01-01",
    reviewDate: "2026-01-01",
    level: "A",
    action:
      "Block recipe generation if honey appears in any ingredient for early_infant, " +
      "beginning_foods, or young_toddler stages. Remove from output and add ruleFireLog entry.",
    stagesApplicable: ["early_infant", "beginning_foods", "young_toddler"],
  },

  {
    ruleId: "high-mercury-fish-ban",
    description:
      "Swordfish, shark, king mackerel, tilefish, bigeye tuna, orange roughy, and marlin " +
      "are prohibited at all pediatric stages due to methylmercury neurotoxicity risk.",
    evidenceSource: "FDA/EPA 2024 fish consumption advisory for children",
    version: "1.0.0",
    effectiveDate: "2024-01-01",
    reviewDate: "2026-01-01",
    level: "A",
    action:
      "Remove high-mercury fish from any recipe at all stages. " +
      "Flag in rulesFireLog and note safer lower-mercury alternatives (salmon, tilapia, cod).",
    stagesApplicable: [],
  },

  // ── Food Safety — Choking Hazards ────────────────────────────────────────

  {
    ruleId: "whole-grape-choking",
    description:
      "Whole grapes must never be served to children under preschool age. " +
      "Their spherical shape perfectly matches the pediatric airway diameter. " +
      "Grapes must be quartered lengthwise (not just halved) for beginning_foods through toddler.",
    evidenceSource:
      "AAP Choking Prevention; CPSC pediatric choking data; BMJ 2016 grape airway obstruction study",
    version: "1.0.0",
    effectiveDate: "2024-01-01",
    reviewDate: "2026-01-01",
    level: "A",
    action:
      "For beginning_foods/young_toddler/toddler: add mandatory preparation note 'quartered lengthwise'. " +
      "For preschool: add preparation note 'halved or quartered'. " +
      "Never allow whole grapes under early_school_age.",
    stagesApplicable: ["beginning_foods", "young_toddler", "toddler", "preschool"],
  },

  {
    ruleId: "whole-nut-choking",
    description:
      "Whole nuts and large nut pieces are a serious choking hazard at all pediatric stages. " +
      "Hard round shape can fully occlude the pediatric airway. " +
      "Smooth nut butters are allowed from beginning_foods for early allergen introduction.",
    evidenceSource: "AAP; CPSC; ACAAI pediatric allergy introduction guidelines (LEAP, EAT trials)",
    version: "1.0.0",
    effectiveDate: "2024-01-01",
    reviewDate: "2026-01-01",
    level: "A",
    action:
      "Block whole nuts for early_infant through toddler. " +
      "Require 'finely chopped' preparation for preschool and early_school_age. " +
      "Smooth nut butter always requires a 'thin spread' note for under-5.",
    stagesApplicable: ["early_infant", "beginning_foods", "young_toddler", "toddler"],
  },

  {
    ruleId: "popcorn-choking-under-4y",
    description:
      "Popcorn is prohibited for children under 4 years. " +
      "Irregular shape, hard kernel base, and light weight make it easy to aspirate " +
      "and difficult to dislodge. AAP specifically names popcorn as a hard-stop food.",
    evidenceSource: "AAP; CPSC pediatric choking incident reports",
    version: "1.0.0",
    effectiveDate: "2024-01-01",
    reviewDate: "2026-01-01",
    level: "A",
    action:
      "Block any recipe containing popcorn for early_infant, beginning_foods, " +
      "young_toddler, toddler, and preschool stages. Remove from output entirely.",
    stagesApplicable: ["early_infant", "beginning_foods", "young_toddler", "toddler", "preschool"],
  },

  {
    ruleId: "raw-carrot-choking",
    description:
      "Raw carrots, celery, and raw apple pieces are choking hazards for young children. " +
      "Hard cylindrical or irregular shapes do not compress easily in the airway. " +
      "Must be steamed, grated, or cut into very small pieces for under-3s.",
    evidenceSource: "AAP Choking Prevention guidelines; CPSC",
    version: "1.0.0",
    effectiveDate: "2024-01-01",
    reviewDate: "2026-01-01",
    level: "A",
    action:
      "For beginning_foods/young_toddler: require steamed-and-puréed or finely-grated preparation. " +
      "For toddler/preschool: require thin strips or small coins with supervision note. " +
      "Add to rulesFireLog with preparation instructions.",
    stagesApplicable: ["beginning_foods", "young_toddler", "toddler"],
  },

  {
    ruleId: "cherry-tomato-choking",
    description:
      "Cherry tomatoes and grape tomatoes must be halved or quartered for children under preschool age. " +
      "Whole cherry tomatoes pose the same airway obstruction risk as whole grapes.",
    evidenceSource: "AAP Choking Prevention; CPSC",
    version: "1.0.0",
    effectiveDate: "2024-01-01",
    reviewDate: "2026-01-01",
    level: "A",
    action:
      "For beginning_foods: require quartered/mashed. " +
      "For young_toddler/toddler: require halved or quartered. " +
      "Never serve whole for under-4s.",
    stagesApplicable: ["beginning_foods", "young_toddler", "toddler"],
  },

  {
    ruleId: "hard-candy-choking",
    description:
      "Hard candy is a choking hazard for children through early school age " +
      "and provides no nutritional value. Prohibited under age 6, flagged through age 8.",
    evidenceSource: "AAP; CPSC",
    version: "1.0.0",
    effectiveDate: "2024-01-01",
    reviewDate: "2026-01-01",
    level: "A",
    action:
      "Block hard candy for early_infant through preschool. " +
      "Flag as advisory for early_school_age.",
    stagesApplicable: ["early_infant", "beginning_foods", "young_toddler", "toddler", "preschool"],
  },

  // ── Dietary — Developmental Stage Rules ──────────────────────────────────

  {
    ruleId: "added-sugar-ban-under-24m",
    description:
      "No added sugars for children under 24 months. " +
      "Added sugars disrupt palate development and displace nutrient-dense foods. " +
      "This includes honey (covered separately), syrups, and any sugar added during cooking.",
    evidenceSource:
      "AAP Clinical Report on Added Sugars 2016; WHO free sugars guidance; AHA pediatric sugar guidelines",
    version: "1.0.0",
    effectiveDate: "2024-01-01",
    reviewDate: "2026-06-01",
    level: "A",
    action:
      "Block recipes that list added sugar, corn syrup, agave, or sweetened ingredients " +
      "as primary components for early_infant, beginning_foods, or young_toddler. " +
      "Flag in rulesFireLog with evidence note.",
    stagesApplicable: ["early_infant", "beginning_foods", "young_toddler"],
  },

  {
    ruleId: "added-salt-flag-under-24m",
    description:
      "Added salt is contraindicated for infants and must be minimized through young toddler stage. " +
      "Infant kidneys cannot excrete excess sodium efficiently. " +
      "High sodium during this period may set patterns for lifelong hypertension risk.",
    evidenceSource: "NHS infant feeding guidelines; AAP; WHO sodium recommendations for infants",
    version: "1.0.0",
    effectiveDate: "2024-01-01",
    reviewDate: "2026-01-01",
    level: "A",
    action:
      "Block added salt as an ingredient for early_infant and beginning_foods. " +
      "Flag as advisory for young_toddler with guidance to minimize. " +
      "Always omit salt from recipes for these stages.",
    stagesApplicable: ["early_infant", "beginning_foods", "young_toddler"],
  },

  {
    ruleId: "no-cows-milk-under-12m-as-main",
    description:
      "Cow's milk must not replace breast milk or formula as the primary drink before 12 months. " +
      "Cow's milk lacks adequate iron, has excess protein and sodium for infant kidneys, " +
      "and can cause GI bleeding in some infants when given as main drink.",
    evidenceSource:
      "AAP; WHO; ESPGHAN (European Society for Paediatric Gastroenterology) infant feeding policy",
    version: "1.0.0",
    effectiveDate: "2024-01-01",
    reviewDate: "2026-01-01",
    level: "A",
    action:
      "Block any recipe that suggests cow's milk as the main drink for early_infant or beginning_foods. " +
      "Cow's milk as a cooking ingredient in small quantities is permitted from beginning_foods. " +
      "Flag and recommend breast milk / formula as primary.",
    stagesApplicable: ["early_infant", "beginning_foods"],
  },

  {
    ruleId: "no-juice-under-12m",
    description:
      "Fruit juice — including 100% juice — must not be offered to infants under 12 months. " +
      "Juice provides sugar without the fiber and nutrients of whole fruit, " +
      "displaces breast milk/formula, and contributes to dental caries.",
    evidenceSource: "AAP Policy Statement on Fruit Juice (2017)",
    version: "1.0.0",
    effectiveDate: "2024-01-01",
    reviewDate: "2026-01-01",
    level: "A",
    action:
      "Block fruit juice as an ingredient or suggested drink for early_infant and beginning_foods. " +
      "Flag for young_toddler with serving size note (max 4 oz/day).",
    stagesApplicable: ["early_infant", "beginning_foods"],
  },

  {
    ruleId: "early-infant-generation-block",
    description:
      "No recipe generation for early_infant stage (birth to ~5 months). " +
      "All nutrition at this stage comes from breast milk or formula only. " +
      "Generating a food recipe for this stage is medically inappropriate.",
    evidenceSource: "AAP; WHO exclusive breastfeeding / formula feeding guidance for 0–6 months",
    version: "1.0.0",
    effectiveDate: "2024-01-01",
    reviewDate: "2027-01-01",
    level: "A",
    action:
      "Return a blocked response before calling OpenAI. " +
      "Include an education message directing parents to their pediatrician.",
    stagesApplicable: ["early_infant"],
  },

  // ── Language / Framing Rules ─────────────────────────────────────────────

  {
    ruleId: "no-adult-macro-language",
    description:
      "Pediatric recipes must never use adult macro-nutrient optimization language. " +
      "Terms like 'high-protein macro', 'fat-burning', 'calorie-deficit', " +
      "'lean gains', or 'cutting macros' are inappropriate for children " +
      "and can contribute to disordered eating patterns.",
    evidenceSource:
      "AAP; NEDA (National Eating Disorders Association) prevention guidelines; " +
      "JAMA Pediatrics research on weight talk and eating disorders",
    version: "1.0.0",
    effectiveDate: "2024-01-01",
    reviewDate: "2026-06-01",
    level: "A",
    action:
      "Scan generated text for macro-optimization language. " +
      "If detected, flag in rulesFireLog and regenerate or strip affected text. " +
      "Use child-appropriate language: 'energy', 'building blocks', 'growing strong'.",
    stagesApplicable: [],
  },

  {
    ruleId: "no-body-weight-labels",
    description:
      "No recipe may diagnose, label, or comment on a child's body weight, size, or BMI. " +
      "Language like 'overweight', 'obese', 'chubby', 'too thin', 'slim down', " +
      "or 'healthy weight' applied to the child is prohibited. " +
      "Weight concerns must be directed to the child's pediatrician.",
    evidenceSource:
      "AAP Clinical Report on Weight Stigma; " +
      "NEDA prevention guidelines; " +
      "Fardouly & Vartanian body image research",
    version: "1.0.0",
    effectiveDate: "2024-01-01",
    reviewDate: "2026-06-01",
    level: "A",
    action:
      "Scan generated text for body-weight judgment language applied to the child. " +
      "Strip and replace with neutral language. Flag in rulesFireLog.",
    stagesApplicable: [],
  },

  {
    ruleId: "no-glp1-language",
    description:
      "GLP-1, semaglutide, appetite suppression, weight-loss medication language, " +
      "and adult metabolic intervention terminology must never appear in pediatric recipes. " +
      "These are adult clinical interventions with no place in pediatric meal generation.",
    evidenceSource:
      "FDA pediatric prescribing guidance; AAP obesity treatment guidelines (2023 update)",
    version: "1.0.0",
    effectiveDate: "2024-01-01",
    reviewDate: "2026-01-01",
    level: "A",
    action:
      "Block any output containing GLP-1, semaglutide, Ozempic, Wegovy, liraglutide, " +
      "tirzepatide, or appetite-suppression framing. Flag in rulesFireLog.",
    stagesApplicable: [],
  },

  // ── Language / Framing — Advisory ────────────────────────────────────────

  {
    ruleId: "no-formula-modification",
    description:
      "Recipes must never suggest modifying formula concentration, adding supplements to formula, " +
      "or making homemade formula. These practices are dangerous and have caused infant deaths.",
    evidenceSource: "FDA; AAP; CDC homemade formula warnings",
    version: "1.0.0",
    effectiveDate: "2024-01-01",
    reviewDate: "2027-01-01",
    level: "A",
    action:
      "Block any output that mentions formula modification, dilution, concentration change, " +
      "or homemade formula recipes. Direct to pediatrician.",
    stagesApplicable: ["early_infant", "beginning_foods"],
  },

  {
    ruleId: "no-clinical-dosing-language",
    description:
      "Pediatric recipes must never include medication dosing, supplement dosing, " +
      "or specific clinical treatment instructions. This is outside the scope of meal generation.",
    evidenceSource: "Standard of care; FDA labeling regulations",
    version: "1.0.0",
    effectiveDate: "2024-01-01",
    reviewDate: "2027-01-01",
    level: "B",
    action:
      "Flag in rulesFireLog if dosing or clinical treatment language is detected. " +
      "Add an 'askPediatricianNote' in response. Do not strip — let parent see the flag.",
    stagesApplicable: [],
  },

  {
    ruleId: "allergen-reintroduction-advisory",
    description:
      "When a recipe involves early allergen introduction (for suspected — not confirmed — allergens), " +
      "a soft advisory should flag the context and recommend pediatrician or allergist guidance.",
    evidenceSource: "LEAP trial; EAT trial; AAP/ACAAI early allergen introduction guidelines",
    version: "1.0.0",
    effectiveDate: "2024-01-01",
    reviewDate: "2026-06-01",
    level: "B",
    action:
      "Add advisory note in allergenAlerts for suspected-reaction allergens. " +
      "Recommend 'first introduction at home with pediatrician on call' guidance.",
    stagesApplicable: [],
  },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/** Get a rule by its ruleId. Returns undefined if not found. */
export function getRule(ruleId: string): PediatricRule | undefined {
  return PEDIATRIC_RULE_REGISTRY.find(r => r.ruleId === ruleId);
}

/**
 * Get all rules that apply to a given developmental stage.
 * Rules with an empty stagesApplicable array apply to all stages.
 */
export function getRulesForStage(stage: DevelopmentalStage): PediatricRule[] {
  return PEDIATRIC_RULE_REGISTRY.filter(
    r => r.stagesApplicable.length === 0 || r.stagesApplicable.includes(stage),
  );
}

/** Get all Level A (hard stop) rules for a stage. */
export function getHardStopRulesForStage(stage: DevelopmentalStage): PediatricRule[] {
  return getRulesForStage(stage).filter(r => r.level === "A");
}

/** Get all Level B (advisory) rules for a stage. */
export function getAdvisoryRulesForStage(stage: DevelopmentalStage): PediatricRule[] {
  return getRulesForStage(stage).filter(r => r.level === "B");
}

/** Build a RuleFireLog entry from a rule, with an optional trigger note. */
export function buildFireLog(rule: PediatricRule, firedFor?: string): RuleFireLog {
  return {
    ruleId: rule.ruleId,
    level: rule.level,
    description: rule.description,
    action: rule.action,
    ...(firedFor ? { firedFor } : {}),
  };
}
