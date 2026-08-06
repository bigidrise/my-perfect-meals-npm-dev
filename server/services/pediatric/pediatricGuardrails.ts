/**
 * Pediatric Guardrails Engine
 *
 * Two enforcement points:
 *
 * 1. enforceBeforeGenerate()
 *    Called before the OpenAI request. Returns a hard block if the request
 *    itself violates a Level A rule (e.g. early_infant stage, honey for under-2).
 *    Pre-generation checks run on the structured request — they do not need to
 *    parse AI text.
 *
 * 2. scanGeneratedOutput()
 *    Called after the AI response is parsed. Scans the text of ingredients,
 *    instructions, and narrative fields against the rule registry and food
 *    behavior registry. Every fired rule produces a RuleFireLog entry.
 *    Level A violations patch the output (strip the ingredient, add a note).
 *    Level B violations are appended to rulesFireLog only.
 *
 * Both functions return a GuardrailResult:
 *   { blocked, blockReason, educationMessage, patchedRecipe, ruleFireLog }
 */

import {
  FOOD_BEHAVIOR_REGISTRY,
  findFoodsByText,
  getStageBehavior,
  type DevelopmentalStage,
  type FoodBehaviorEntry,
} from "./foodBehaviorRegistry";

import {
  PEDIATRIC_RULE_REGISTRY,
  buildFireLog,
  getRule,
  type PediatricRule,
  type RuleFireLog,
} from "./pediatricRuleRegistry";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GuardrailRequest {
  ageStage: DevelopmentalStage;
  foodRequest?: string;
  ingredientNames?: string[]; // from parsed recipe
  fullRecipeText?: string;    // entire serialized recipe for text scanning
}

export interface GuardrailResult {
  /** True if the request / output must be blocked entirely. */
  blocked: boolean;
  /** Machine-readable block reason (only set when blocked = true). */
  blockReason?: string;
  /** Human-readable message to surface to the parent when blocked. */
  educationMessage?: string;
  /** Patched recipe text (only for scanGeneratedOutput, may be undefined). */
  patchedRecipe?: any;
  /** All rules that fired during this enforcement pass. */
  ruleFireLog: RuleFireLog[];
}

// ─── Text patterns ────────────────────────────────────────────────────────────

/** Patterns for language-rule scans (no-adult-macro-language, no-body-weight-labels, etc.) */
const ADULT_MACRO_PATTERNS = [
  /\b(macro|macros|macronutrient)\b.*\b(target|goal|ratio|split|track)\b/i,
  /\bfat.?burning\b/i,
  /\bcalorie.?deficit\b/i,
  /\blean.?gains?\b/i,
  /\bcutting.?macros?\b/i,
  /\bbulking\b/i,
  /\bcutting.?phase\b/i,
  /\bprotein.?synthesis\b/i,
  /\bmaintenance.?calories?\b/i,
  /\btdee\b/i,
  /\bbmr\b.*\brecipe\b/i,
];

const BODY_WEIGHT_LABEL_PATTERNS = [
  /\boverweight\b/i,
  /\bobese\b/i,
  /\bchubby\b/i,
  /\btoo\s+thin\b/i,
  /\bslim\s+down\b/i,
  /\blose\s+weight\b/i,
  /\bweight\s+loss\b/i,
  /\bbmi\b/i,
  /\bhealthy\s+weight\s+for\s+(your|the)\s+child\b/i,
  /\bweight\s+problem\b/i,
];

const GLP1_PATTERNS = [
  /\bglp.?1\b/i,
  /\bsemaglutide\b/i,
  /\bozempic\b/i,
  /\bwegovy\b/i,
  /\bliraglutide\b/i,
  /\btirzepatide\b/i,
  /\bmounjaro\b/i,
  /\bappetite.?suppress/i,
  /\bweight.?loss.?medication/i,
  /\bglucagon.?like/i,
];

const FORMULA_MODIFICATION_PATTERNS = [
  /\bhomemade\s+formula\b/i,
  /\bdilut\w+\s+formula\b/i,
  /\bconcentrat\w+\s+formula\b/i,
  /\badd\w*\s+\w+\s+to\s+(the\s+)?formula\b/i,
  /\bformula\s+recipe\b/i,
];

const CLINICAL_DOSING_PATTERNS = [
  /\b\d+\s*(mg|mcg|iu|ml)\s*(per|\/)\s*(kg|lb|pound|kilo)\b/i,
  /\bdose\s+of\b/i,
  /\bprescrib\w+\b/i,
  /\bmedication\b.*\b(for|to)\s+(your\s+)?child\b/i,
];

/** Foods that are hard-blocked regardless of stage (covered by food registry + rules). */
const HONEY_TOKENS = ["honey", "raw honey", "manuka", "honeycomb", "clover honey"];
const HIGH_MERCURY_TOKENS = [
  "swordfish", "shark", "king mackerel", "tilefish", "bigeye tuna",
  "orange roughy", "marlin",
];
const POPCORN_TOKENS = ["popcorn", "air-popped popcorn", "kettle corn", "microwave popcorn"];
const HARD_CANDY_TOKENS = [
  "hard candy", "lollipop", "jawbreaker", "lozenge", "boiled sweets",
  "rock candy", "candy cane",
];
const WHOLE_GRAPE_TOKENS = [
  "whole grape", "grapes", "grape", "seedless grape", "red grape", "green grape",
];
const WHOLE_NUT_TOKENS = [
  "whole nut", "whole peanut", "whole almond", "whole cashew", "whole walnut",
  "whole pecan", "whole pistachio", "whole macadamia", "peanuts", "almonds",
  "cashews", "walnuts", "pecans", "pistachios", "macadamia nuts", "hazelnuts",
  "pine nuts", "mixed nuts",
];
const RAW_CARROT_TOKENS = ["raw carrot", "baby carrot", "carrot stick", "raw carrots", "baby carrots"];
const RAW_CELERY_TOKENS = ["raw celery", "celery stick", "celery sticks"];
const CHERRY_TOMATO_TOKENS = ["cherry tomato", "cherry tomatoes", "grape tomato", "grape tomatoes"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function textContainsAny(text: string, tokens: string[]): string | undefined {
  const lower = text.toLowerCase();
  return tokens.find(t => lower.includes(t.toLowerCase()));
}

function matchesAnyPattern(text: string, patterns: RegExp[]): RegExp | undefined {
  return patterns.find(p => p.test(text));
}

function stageIndex(stage: DevelopmentalStage): number {
  const ORDER: DevelopmentalStage[] = [
    "early_infant", "beginning_foods", "young_toddler", "toddler",
    "preschool", "early_school_age", "growing_child",
  ];
  return ORDER.indexOf(stage);
}

function stageIsAtMost(stage: DevelopmentalStage, max: DevelopmentalStage): boolean {
  return stageIndex(stage) <= stageIndex(max);
}

// ─── 1. Pre-generation enforcement ───────────────────────────────────────────

/**
 * Run before calling OpenAI.
 * Fires on the structured request (stage + food request text).
 * Returns blocked=true with an educationMessage if a hard stop fires.
 */
export function enforceBeforeGenerate(req: GuardrailRequest): GuardrailResult {
  const { ageStage, foodRequest = "" } = req;
  const fireLog: RuleFireLog[] = [];

  // ── Rule: early_infant generation block ────────────────────────────────
  if (ageStage === "early_infant") {
    const rule = getRule("early-infant-generation-block")!;
    fireLog.push(buildFireLog(rule));
    return {
      blocked: true,
      blockReason: "early_infant",
      educationMessage:
        "Babies under 6 months receive all their nutrition from breast milk or formula. " +
        "We can't generate recipes for this stage. Please speak with your child's pediatrician " +
        "before introducing any solid foods.",
      ruleFireLog: fireLog,
    };
  }

  // ── Rule: honey-ban-under-24m ──────────────────────────────────────────
  if (stageIsAtMost(ageStage, "young_toddler")) {
    const matchedToken = textContainsAny(foodRequest, HONEY_TOKENS);
    if (matchedToken) {
      const rule = getRule("honey-ban-under-24m")!;
      fireLog.push(buildFireLog(rule, matchedToken));
      return {
        blocked: true,
        blockReason: "honey-ban-under-24m",
        educationMessage:
          "Honey cannot be given to children under 24 months due to the risk of infant botulism. " +
          "This includes raw honey, cooked honey, and products containing honey. " +
          "Please speak with your child's pediatrician for alternatives.",
        ruleFireLog: fireLog,
      };
    }
  }

  // ── Rule: popcorn-choking-under-4y (pre-gen guard on food request) ─────
  if (stageIsAtMost(ageStage, "preschool")) {
    const matchedToken = textContainsAny(foodRequest, POPCORN_TOKENS);
    if (matchedToken) {
      const rule = getRule("popcorn-choking-under-4y")!;
      fireLog.push(buildFireLog(rule, matchedToken));
      return {
        blocked: true,
        blockReason: "popcorn-choking-under-4y",
        educationMessage:
          "Popcorn is not recommended for children under 4 years old due to the risk of choking. " +
          "The irregular shape and hard kernel base make it easy to aspirate. " +
          "We can suggest a popcorn-inspired snack that is safe for your child's age!",
        ruleFireLog: fireLog,
      };
    }
  }

  // ── Rule: high-mercury-fish-ban (pre-gen guard) ────────────────────────
  {
    const matchedToken = textContainsAny(foodRequest, HIGH_MERCURY_TOKENS);
    if (matchedToken) {
      const rule = getRule("high-mercury-fish-ban")!;
      fireLog.push(buildFireLog(rule, matchedToken));
      return {
        blocked: true,
        blockReason: "high-mercury-fish-ban",
        educationMessage:
          `${matchedToken} is a high-mercury fish that is not recommended for children at any age. ` +
          "High mercury exposure can affect a child's developing nervous system. " +
          "Safer alternatives include salmon, cod, tilapia, and light canned tuna (in moderation).",
        ruleFireLog: fireLog,
      };
    }
  }

  // ── No pre-generation block ────────────────────────────────────────────
  return { blocked: false, ruleFireLog: fireLog };
}

// ─── 2. Post-generation scan ──────────────────────────────────────────────────

/**
 * Run after the AI response is parsed and schema-validated.
 * Scans all text fields of the recipe for safety violations.
 * Returns patchedRecipe with any Level A violations corrected,
 * and a complete ruleFireLog of everything that fired.
 */
export function scanGeneratedOutput(
  recipe: any,
  ageStage: DevelopmentalStage,
): GuardrailResult {
  const fireLog: RuleFireLog[] = [];

  // Work on a shallow clone so we don't mutate the original before deciding
  const patched = { ...recipe };

  // Gather all text we can scan
  const ingredientNames: string[] = (patched.ingredients || []).map(
    (i: any) => `${i.name || ""} ${i.prepNote || ""} ${i.substitutionNote || ""}`,
  );
  const allText = [
    patched.recipeName || "",
    patched.ageStageSuitability || "",
    ...ingredientNames,
    ...(patched.instructions || []),
    patched.servingGuidance || "",
    patched.textureAndChokingPreparation || "",
    patched.whyThisVersionIsBetter || "",
    patched.serveSuggestion || "",
    patched.funPresentationIdea || "",
    patched.storageAndLunchboxGuidance || "",
    patched.askPediatricianNote || "",
  ].join(" ");

  // Ensure rulesFireLog array exists on patched recipe
  if (!Array.isArray(patched.rulesFireLog)) patched.rulesFireLog = [];

  // ── Scan: honey ──────────────────────────────────────────────────────────
  if (stageIsAtMost(ageStage, "young_toddler")) {
    const matchedToken = textContainsAny(allText, HONEY_TOKENS);
    if (matchedToken) {
      const rule = getRule("honey-ban-under-24m")!;
      const log = buildFireLog(rule, matchedToken);
      fireLog.push(log);
      patched.rulesFireLog.push(log);
      // Strip honey from ingredients
      patched.ingredients = (patched.ingredients || []).filter(
        (ing: any) => !textContainsAny(`${ing.name} ${ing.prepNote || ""}`, HONEY_TOKENS),
      );
      // Append a warning to textureAndChokingPreparation
      patched.textureAndChokingPreparation =
        (patched.textureAndChokingPreparation || "") +
        " [Safety note: Honey has been removed — it is unsafe for children under 24 months.]";
    }
  }

  // ── Scan: high-mercury fish ──────────────────────────────────────────────
  {
    const matchedToken = textContainsAny(allText, HIGH_MERCURY_TOKENS);
    if (matchedToken) {
      const rule = getRule("high-mercury-fish-ban")!;
      const log = buildFireLog(rule, matchedToken);
      fireLog.push(log);
      patched.rulesFireLog.push(log);
      patched.ingredients = (patched.ingredients || []).filter(
        (ing: any) => !textContainsAny(ing.name || "", HIGH_MERCURY_TOKENS),
      );
      patched.allergenAlerts = [
        ...(patched.allergenAlerts || []),
        {
          allergenId: "fish",
          message: `${matchedToken} is a high-mercury fish and has been removed. Choose salmon, cod, or tilapia instead.`,
          severity: "confirmed_removed",
        },
      ];
    }
  }

  // ── Scan: popcorn ────────────────────────────────────────────────────────
  if (stageIsAtMost(ageStage, "preschool")) {
    const matchedToken = textContainsAny(allText, POPCORN_TOKENS);
    if (matchedToken) {
      const rule = getRule("popcorn-choking-under-4y")!;
      const log = buildFireLog(rule, matchedToken);
      fireLog.push(log);
      patched.rulesFireLog.push(log);
      patched.ingredients = (patched.ingredients || []).filter(
        (ing: any) => !textContainsAny(ing.name || "", POPCORN_TOKENS),
      );
      patched.textureAndChokingPreparation =
        (patched.textureAndChokingPreparation || "") +
        " [Safety note: Popcorn has been removed — it is a choking hazard for children under 4 years.]";
    }
  }

  // ── Scan: hard candy ────────────────────────────────────────────────────
  if (stageIsAtMost(ageStage, "early_school_age")) {
    const matchedToken = textContainsAny(allText, HARD_CANDY_TOKENS);
    if (matchedToken) {
      const rule = getRule("hard-candy-choking")!;
      const log = buildFireLog(rule, matchedToken);
      fireLog.push(log);
      patched.rulesFireLog.push(log);
      if (stageIsAtMost(ageStage, "preschool")) {
        // Level A for under-6: strip the ingredient
        patched.ingredients = (patched.ingredients || []).filter(
          (ing: any) => !textContainsAny(ing.name || "", HARD_CANDY_TOKENS),
        );
        patched.textureAndChokingPreparation =
          (patched.textureAndChokingPreparation || "") +
          " [Safety note: Hard candy has been removed — it is a choking hazard for this age group.]";
      }
      // For early_school_age: log-only (Level B advisory)
    }
  }

  // ── Scan: whole grapes — require quartering note ────────────────────────
  if (stageIsAtMost(ageStage, "preschool")) {
    const matchedToken = textContainsAny(ingredientNames.join(" "), WHOLE_GRAPE_TOKENS);
    if (matchedToken) {
      const rule = getRule("whole-grape-choking")!;
      const behavior = getStageBehavior("whole_grapes", ageStage);
      const log = buildFireLog(rule, matchedToken);
      fireLog.push(log);
      patched.rulesFireLog.push(log);
      // Enforce preparation note on grape ingredients
      patched.ingredients = (patched.ingredients || []).map((ing: any) => {
        if (!textContainsAny(ing.name || "", WHOLE_GRAPE_TOKENS)) return ing;
        const prepNote =
          stageIsAtMost(ageStage, "toddler")
            ? "Quarter lengthwise — never serve whole or halved."
            : "Halve or quarter before serving.";
        return { ...ing, prepNote: ing.prepNote ? `${ing.prepNote} ${prepNote}` : prepNote };
      });
      // Ensure textureAndChokingPreparation mentions grape quartering
      if (!patched.textureAndChokingPreparation?.toLowerCase().includes("quarter")) {
        patched.textureAndChokingPreparation =
          (patched.textureAndChokingPreparation || "") +
          ` [Grape safety: ${behavior?.preparationRequired || "Quarter grapes lengthwise before serving."}]`;
      }
    }
  }

  // ── Scan: whole nuts ────────────────────────────────────────────────────
  if (stageIsAtMost(ageStage, "toddler")) {
    const matchedToken = textContainsAny(ingredientNames.join(" "), WHOLE_NUT_TOKENS);
    if (matchedToken) {
      // Only fire if it looks like whole nuts (not nut butter)
      const hasNutButter =
        allText.toLowerCase().includes("nut butter") ||
        allText.toLowerCase().includes("peanut butter") ||
        allText.toLowerCase().includes("almond butter");
      if (!hasNutButter) {
        const rule = getRule("whole-nut-choking")!;
        const log = buildFireLog(rule, matchedToken);
        fireLog.push(log);
        patched.rulesFireLog.push(log);
        // For under-4: strip whole nuts; add a note
        patched.ingredients = (patched.ingredients || []).filter(
          (ing: any) => !textContainsAny(ing.name || "", WHOLE_NUT_TOKENS),
        );
        patched.textureAndChokingPreparation =
          (patched.textureAndChokingPreparation || "") +
          " [Safety note: Whole nuts have been removed — they are a serious choking hazard for this age group. Smooth nut butter is safe if there is no nut allergy.]";
      }
    }
  }

  // ── Scan: raw carrots / celery ───────────────────────────────────────────
  if (stageIsAtMost(ageStage, "toddler")) {
    const carrotToken = textContainsAny(ingredientNames.join(" "), RAW_CARROT_TOKENS);
    const celeryToken = textContainsAny(ingredientNames.join(" "), RAW_CELERY_TOKENS);
    if (carrotToken || celeryToken) {
      const token = carrotToken || celeryToken!;
      const rule = getRule("raw-carrot-choking")!;
      const log = buildFireLog(rule, token);
      fireLog.push(log);
      patched.rulesFireLog.push(log);
      // Add mandatory preparation note to those ingredients
      const rawTokens = [...RAW_CARROT_TOKENS, ...RAW_CELERY_TOKENS];
      patched.ingredients = (patched.ingredients || []).map((ing: any) => {
        if (!textContainsAny(ing.name || "", rawTokens)) return ing;
        const stagePrep =
          stageIsAtMost(ageStage, "young_toddler")
            ? "Steam until soft, then grate or cut into very small pieces."
            : "Cut into very thin matchsticks or small coins. Steam preferred.";
        return { ...ing, prepNote: ing.prepNote ? `${ing.prepNote} ${stagePrep}` : stagePrep };
      });
    }
  }

  // ── Scan: cherry tomatoes ────────────────────────────────────────────────
  if (stageIsAtMost(ageStage, "toddler")) {
    const matchedToken = textContainsAny(ingredientNames.join(" "), CHERRY_TOMATO_TOKENS);
    if (matchedToken) {
      const rule = getRule("cherry-tomato-choking")!;
      const log = buildFireLog(rule, matchedToken);
      fireLog.push(log);
      patched.rulesFireLog.push(log);
      patched.ingredients = (patched.ingredients || []).map((ing: any) => {
        if (!textContainsAny(ing.name || "", CHERRY_TOMATO_TOKENS)) return ing;
        const prepNote =
          stageIsAtMost(ageStage, "beginning_foods")
            ? "Quarter or mash completely. Never serve whole."
            : "Halve or quarter before serving.";
        return { ...ing, prepNote: ing.prepNote ? `${ing.prepNote} ${prepNote}` : prepNote };
      });
    }
  }

  // ── Scan: cow's milk as main drink ─────────────────────────────────────
  if (stageIsAtMost(ageStage, "beginning_foods")) {
    const milkInServing =
      (patched.servingGuidance || "").toLowerCase().includes("cow") &&
      (patched.servingGuidance || "").toLowerCase().includes("milk");
    if (milkInServing) {
      const rule = getRule("no-cows-milk-under-12m-as-main")!;
      const log = buildFireLog(rule, "cow's milk in serving guidance");
      fireLog.push(log);
      patched.rulesFireLog.push(log);
      patched.servingGuidance =
        patched.servingGuidance +
        " [Note: Breast milk or formula remains the primary drink at this stage — not cow's milk.]";
    }
  }

  // ── Scan: added sugar (under 24m) ───────────────────────────────────────
  if (stageIsAtMost(ageStage, "young_toddler")) {
    const sugarTokens = ["added sugar", "cane sugar", "table sugar", "corn syrup", "agave", "maple syrup"];
    const matchedToken = textContainsAny(ingredientNames.join(" "), sugarTokens);
    if (matchedToken) {
      const rule = getRule("added-sugar-ban-under-24m")!;
      const log = buildFireLog(rule, matchedToken);
      fireLog.push(log);
      patched.rulesFireLog.push(log);
      patched.ingredients = (patched.ingredients || []).map((ing: any) => {
        if (!textContainsAny(ing.name || "", sugarTokens)) return ing;
        return {
          ...ing,
          substitutionNote: "Added sugar is not recommended for children under 24 months. Use ripe banana or unsweetened applesauce for natural sweetness.",
        };
      });
    }
  }

  // ── Scan: adult macro language ───────────────────────────────────────────
  {
    const matchedPattern = matchesAnyPattern(allText, ADULT_MACRO_PATTERNS);
    if (matchedPattern) {
      const rule = getRule("no-adult-macro-language")!;
      const log = buildFireLog(rule, matchedPattern.toString());
      fireLog.push(log);
      patched.rulesFireLog.push(log);
      // Add advisory note
      if (!patched.askPediatricianNote) {
        patched.askPediatricianNote =
          "This recipe focuses on age-appropriate nutrition. For questions about your child's specific dietary goals, please speak with your pediatrician or a registered pediatric dietitian.";
      }
    }
  }

  // ── Scan: body weight labels ─────────────────────────────────────────────
  {
    const matchedPattern = matchesAnyPattern(allText, BODY_WEIGHT_LABEL_PATTERNS);
    if (matchedPattern) {
      const rule = getRule("no-body-weight-labels")!;
      const log = buildFireLog(rule, matchedPattern.toString());
      fireLog.push(log);
      patched.rulesFireLog.push(log);
      if (!patched.askPediatricianNote) {
        patched.askPediatricianNote =
          "If you have concerns about your child's weight or growth, please speak with your pediatrician — they can assess your child in the context of their full growth history.";
      }
    }
  }

  // ── Scan: GLP-1 / weight-loss medication language ────────────────────────
  {
    const matchedPattern = matchesAnyPattern(allText, GLP1_PATTERNS);
    if (matchedPattern) {
      const rule = getRule("no-glp1-language")!;
      const log = buildFireLog(rule, matchedPattern.toString());
      fireLog.push(log);
      patched.rulesFireLog.push(log);
    }
  }

  // ── Scan: formula modification language ──────────────────────────────────
  {
    const matchedPattern = matchesAnyPattern(allText, FORMULA_MODIFICATION_PATTERNS);
    if (matchedPattern) {
      const rule = getRule("no-formula-modification")!;
      const log = buildFireLog(rule, matchedPattern.toString());
      fireLog.push(log);
      patched.rulesFireLog.push(log);
    }
  }

  // ── Scan: clinical dosing language (Level B advisory) ────────────────────
  {
    const matchedPattern = matchesAnyPattern(allText, CLINICAL_DOSING_PATTERNS);
    if (matchedPattern) {
      const rule = getRule("no-clinical-dosing-language")!;
      const log = buildFireLog(rule, matchedPattern.toString());
      fireLog.push(log);
      patched.rulesFireLog.push(log);
      // Level B — just flag, don't block
      if (!patched.askPediatricianNote) {
        patched.askPediatricianNote =
          "This recipe provides nutritional guidance only — not medical or clinical dosing instructions. Please consult your pediatrician for all medication and supplement decisions.";
      }
    }
  }

  // ── Scan: food behavior registry — catch anything the above didn't cover ─
  const registryFindings = scanAgainstFoodRegistry(ingredientNames.join(" "), ageStage);
  for (const finding of registryFindings) {
    // Avoid duplicating a rule that already fired above
    const alreadyFired = fireLog.some(f => f.ruleId === finding.ruleFireLog.ruleId);
    if (!alreadyFired) {
      fireLog.push(finding.ruleFireLog);
      patched.rulesFireLog.push(finding.ruleFireLog);
      if (finding.preparationNote && finding.ingredientName) {
        patched.ingredients = (patched.ingredients || []).map((ing: any) => {
          if (!ing.name?.toLowerCase().includes(finding.ingredientName!.toLowerCase())) return ing;
          return {
            ...ing,
            prepNote: ing.prepNote
              ? `${ing.prepNote} ${finding.preparationNote}`
              : finding.preparationNote,
          };
        });
      }
    }
  }

  return {
    blocked: false,
    patchedRecipe: patched,
    ruleFireLog: fireLog,
  };
}

// ─── Food registry scanner ────────────────────────────────────────────────────

interface RegistryFinding {
  ruleFireLog: RuleFireLog;
  ingredientName?: string;
  preparationNote?: string;
}

/**
 * Walk the food behavior registry looking for foods mentioned in ingredientText
 * that have a non-true allowed status at the given stage.
 */
function scanAgainstFoodRegistry(
  ingredientText: string,
  stage: DevelopmentalStage,
): RegistryFinding[] {
  const findings: RegistryFinding[] = [];

  for (const entry of FOOD_BEHAVIOR_REGISTRY) {
    const stageBehavior = entry.stages[stage];
    if (!stageBehavior) continue; // no entry for this stage — no restriction
    if (stageBehavior.allowed === true) continue; // fully allowed

    // Check if this food appears in the ingredient text
    const allNames = [entry.displayName, ...(entry.aliases || [])];
    const matched = allNames.find(n => ingredientText.toLowerCase().includes(n.toLowerCase()));
    if (!matched) continue;

    const ruleId = `registry:${entry.foodId}:${stage}`;
    const log: RuleFireLog = {
      ruleId,
      level: stageBehavior.allowed === "blocked" ? "A" : "B",
      description:
        stageBehavior.evidenceNote ||
        `${entry.displayName} has restricted status (${stageBehavior.allowed}) at stage ${stage}.`,
      action:
        stageBehavior.allowed === "blocked"
          ? `Remove ${entry.displayName} — not permitted at ${stage} stage.`
          : stageBehavior.allowed === "with_preparation"
          ? `${entry.displayName} requires preparation: ${stageBehavior.preparationRequired || "see guidance"}`
          : `${entry.displayName} requires clinician clearance at ${stage} stage.`,
      firedFor: matched,
    };

    findings.push({
      ruleFireLog: log,
      ingredientName: matched,
      preparationNote:
        stageBehavior.allowed === "with_preparation"
          ? stageBehavior.preparationRequired
          : undefined,
    });
  }

  return findings;
}
