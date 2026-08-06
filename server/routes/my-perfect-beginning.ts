import { Router } from "express";
import OpenAI from "openai";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { computeParentEducationLayer } from "../services/pediatric/pediatricConfidenceScorer";
import {

const router = Router();

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// ── Type-safe enums ────────────────────────────────────────────────────────────

const VALID_STAGES = [
  "early_infant",
  "beginning_foods",
  "young_toddler",
  "toddler",
  "preschool",
  "early_school_age",
  "growing_child",
] as const;
type DevelopmentalStage = (typeof VALID_STAGES)[number];

const VALID_ALLERGENS = [
  "peanut",
  "tree_nuts",
  "milk",
  "egg",
  "wheat",
  "soy",
  "sesame",
  "fish",
  "shellfish",
  "other",
] as const;
type AllergenId = (typeof VALID_ALLERGENS)[number];

const VALID_SEVERITIES = [
  "confirmed_allergy",
  "suspected_reaction",
  "intolerance",
  "preference_avoid",
  "clinician_elimination",
] as const;
type AllergySeverity = (typeof VALID_SEVERITIES)[number];

const VALID_DIETARY_PATTERNS = [
  "omnivore",
  "vegetarian",
  "vegan",
  "kosher",
  "halal",
  "dairy_free",
  "gluten_free_diagnosed",
  "other",
] as const;

const VALID_BUDGET_LEVELS = ["budget_conscious", "moderate", "flexible"] as const;

const VALID_COOK_TIMES = [15, 30, 45, 60] as const;

interface AllergyEntry {
  allergenId: AllergenId;
  customAllergenName?: string;
  severity: AllergySeverity;
  emergencyMedication?: boolean;
}

interface ParentPrefs {
  dietaryPattern?: string;
  budgetLevel?: string;
  maxCookTimeMinutes?: number;
  requiresSchoolSafe?: boolean;
  requiresPackable?: boolean;
  culturalCuisine?: string;
  goals?: string[];
}

// ── Request validator ──────────────────────────────────────────────────────────

function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  // Strip control chars (including newlines that could inject prompt sections)
  return value.replace(/[\x00-\x1F\x7F]/g, " ").slice(0, maxLength).trim();
}

function validateRequest(body: any): {
  valid: boolean;
  error?: string;
  ageStage?: DevelopmentalStage;
  allergies?: AllergyEntry[];
  foodRequest?: string;
  parentPrefs?: ParentPrefs;
  childName?: string;
} {
  // ── ageStage ──────────────────────────────────────────────────────────────
  if (!body.ageStage || typeof body.ageStage !== "string") {
    return { valid: false, error: "ageStage is required" };
  }
  if (!(VALID_STAGES as readonly string[]).includes(body.ageStage)) {
    return { valid: false, error: `Invalid ageStage: ${body.ageStage}` };
  }
  const ageStage = body.ageStage as DevelopmentalStage;

  // ── foodRequest ───────────────────────────────────────────────────────────
  // Not required for early_infant (gate fires before generation)
  const foodRequest = sanitizeText(body.foodRequest, 300);

  // ── allergies ─────────────────────────────────────────────────────────────
  const rawAllergies = Array.isArray(body.allergies) ? body.allergies : [];
  const allergies: AllergyEntry[] = [];

  for (const entry of rawAllergies) {
    if (!entry || typeof entry !== "object") continue;

    if (!(VALID_ALLERGENS as readonly string[]).includes(entry.allergenId)) continue;
    if (!(VALID_SEVERITIES as readonly string[]).includes(entry.severity)) continue;

    const allergyEntry: AllergyEntry = {
      allergenId: entry.allergenId as AllergenId,
      severity: entry.severity as AllergySeverity,
      emergencyMedication: !!entry.emergencyMedication,
    };

    if (entry.allergenId === "other" && typeof entry.customAllergenName === "string") {
      allergyEntry.customAllergenName = sanitizeText(entry.customAllergenName, 80);
    }

    allergies.push(allergyEntry);
  }

  // ── parentPrefs ───────────────────────────────────────────────────────────
  const rawPrefs = body.parentPrefs && typeof body.parentPrefs === "object" ? body.parentPrefs : {};
  const parentPrefs: ParentPrefs = {};

  if ((VALID_DIETARY_PATTERNS as readonly string[]).includes(rawPrefs.dietaryPattern)) {
    parentPrefs.dietaryPattern = rawPrefs.dietaryPattern;
  }
  if ((VALID_BUDGET_LEVELS as readonly string[]).includes(rawPrefs.budgetLevel)) {
    parentPrefs.budgetLevel = rawPrefs.budgetLevel;
  }
  if ((VALID_COOK_TIMES as readonly number[]).includes(Number(rawPrefs.maxCookTimeMinutes))) {
    parentPrefs.maxCookTimeMinutes = Number(rawPrefs.maxCookTimeMinutes);
  }
  if (typeof rawPrefs.requiresSchoolSafe === "boolean") {
    parentPrefs.requiresSchoolSafe = rawPrefs.requiresSchoolSafe;
  }
  if (typeof rawPrefs.requiresPackable === "boolean") {
    parentPrefs.requiresPackable = rawPrefs.requiresPackable;
  }
  // culturalCuisine and goals are user text — sanitized and kept in user message only
  // (not injected into the system prompt — see buildUserMessage below)

  // ── childName ─────────────────────────────────────────────────────────────
  const childName = typeof body.childName === "string"
    ? sanitizeText(body.childName, 60)
    : undefined;

  return { valid: true, ageStage, allergies, foodRequest, parentPrefs, childName };
}

// ── Response validator ─────────────────────────────────────────────────────────

function validateRecipeResponse(raw: any): { valid: boolean; error?: string } {
  if (!raw || typeof raw !== "object") return { valid: false, error: "Response is not an object" };
  if (typeof raw.recipeName !== "string" || !raw.recipeName.trim()) return { valid: false, error: "Missing recipeName" };
  if (typeof raw.ageStageSuitability !== "string") return { valid: false, error: "Missing ageStageSuitability" };
  if (!Array.isArray(raw.ingredients) || raw.ingredients.length === 0) return { valid: false, error: "Missing ingredients" };
  if (!Array.isArray(raw.instructions) || raw.instructions.length === 0) return { valid: false, error: "Missing instructions" };
  if (typeof raw.servingGuidance !== "string") return { valid: false, error: "Missing servingGuidance" };
  if (typeof raw.textureAndChokingPreparation !== "string") return { valid: false, error: "Missing textureAndChokingPreparation" };
  if (!Array.isArray(raw.allergenAlerts)) return { valid: false, error: "Missing allergenAlerts" };
  if (typeof raw.whyThisVersionIsBetter !== "string") return { valid: false, error: "Missing whyThisVersionIsBetter" };
  if (typeof raw.serveSuggestion !== "string") return { valid: false, error: "Missing serveSuggestion" };
  if (typeof raw.funPresentationIdea !== "string") return { valid: false, error: "Missing funPresentationIdea" };
  if (!Array.isArray(raw.rulesFireLog)) raw.rulesFireLog = [];
  if (typeof raw.whyThisMealWasChosen !== "string") raw.whyThisMealWasChosen = "";
  if (!Array.isArray(raw.reasoningTrace)) raw.reasoningTrace = [];

  // Validate ingredient shapes
  for (let i = 0; i < raw.ingredients.length; i++) {
    const ing = raw.ingredients[i];
    if (!ing || typeof ing.name !== "string" || typeof ing.quantity !== "string") {
      return { valid: false, error: `Ingredient at index ${i} is malformed` };
    }
  }

  return { valid: true };
}

// ── Stage Safety Rules (Level A) — system-prompt only, no user text ───────────

const STAGE_LABELS: Record<DevelopmentalStage, string> = {
  early_infant:      "Early Infant (birth–~5 months)",
  beginning_foods:   "Beginning Foods (~6–11 months)",
  young_toddler:     "Young Toddler (12–23 months)",
  toddler:           "Toddler (2–3 years)",
  preschool:         "Preschool (4–5 years)",
  early_school_age:  "Early School Age (6–8 years)",
  growing_child:     "Growing Child (9–12 years)",
};

function buildSafetyRulesBlock(stage: DevelopmentalStage): string {
  const rules: string[] = [];

  // Universal (all stages)
  rules.push("MPB-S005: No whole nuts or large nut pieces — serious choking hazard at all ages.");
  rules.push("MPB-S012: No high-mercury fish: swordfish, shark, king mackerel, tilefish, bigeye tuna.");
  rules.push("MPB-S016: Limit added sugar; avoid sugary drinks as primary beverage.");
  rules.push("MPB-S017: Limit sodium; avoid high-sodium processed foods as primary ingredients.");
  rules.push("MPB-S018: Serving size must match age-appropriate ranges.");

  if (stage === "beginning_foods" || stage === "young_toddler") {
    rules.push("MPB-S001: NEVER include honey — infant botulism risk. Hard stop, no exceptions.");
  }
  if (stage === "beginning_foods") {
    rules.push("MPB-S002: No cow's milk as main drink.");
    rules.push("MPB-S003: No juice — including 100% fruit juice.");
    rules.push("MPB-S004: Texture must be purée or mashed/soft only.");
    rules.push("MPB-S008: No raw hard vegetables or fruits — purée or steam until very soft.");
    rules.push("MPB-S011: Meat must be finely puréed or very smooth only.");
  }
  if (stage === "young_toddler") {
    rules.push("MPB-S008: No large pieces of raw carrot, celery, or apple — grate, steam, or chop very finely.");
    rules.push("MPB-S011: Meat must be finely chopped or shredded.");
  }
  if (["beginning_foods", "young_toddler", "toddler"].includes(stage)) {
    rules.push("MPB-S011: Meat and poultry must be finely chopped, ground, or shredded.");
  }
  if (["beginning_foods", "young_toddler", "toddler", "preschool"].includes(stage)) {
    rules.push("MPB-S006: Grapes must be quartered lengthwise — whole grapes are a choking hazard.");
    rules.push("MPB-S007: Cherry tomatoes must be halved or quartered — never whole.");
    rules.push("MPB-S009: No popcorn.");
  }
  if (["beginning_foods", "young_toddler", "toddler", "preschool", "early_school_age"].includes(stage)) {
    rules.push("MPB-S010: No hard candy.");
  }

  return rules.map(r => `- ${r}`).join("\n");
}

function buildAllergySystemBlock(allergies: AllergyEntry[]): string {
  if (allergies.length === 0) return "No allergies on file.";
  const lines: string[] = [];
  for (const a of allergies) {
    const name = a.allergenId === "other" && a.customAllergenName
      ? a.customAllergenName
      : a.allergenId;
    if (a.severity === "confirmed_allergy" || a.severity === "clinician_elimination") {
      lines.push(`HARD STOP — ${name}: confirmed allergen. Do NOT include in any form.`);
    } else if (a.severity === "suspected_reaction") {
      lines.push(`SOFT BLOCK — ${name}: suspected reaction. Remove and note in allergenAlerts.`);
    } else if (a.severity === "intolerance") {
      lines.push(`INTOLERANCE — ${name}: exclude.`);
    } else if (a.severity === "preference_avoid") {
      lines.push(`PREFERENCE — ${name}: parent prefers to avoid.`);
    }
  }
  return lines.join("\n");
}

// ── Build system prompt (static, no user text) ────────────────────────────────

function buildSystemPrompt(stage: DevelopmentalStage, allergies: AllergyEntry[], parentPrefs: ParentPrefs): string {
  const stageLabel = STAGE_LABELS[stage];
  const safetyRules = buildSafetyRulesBlock(stage);
  const allergyBlock = buildAllergySystemBlock(allergies);

  // Household constraints: these come from validated enum/boolean fields only,
  // never raw user strings — safe to include in system prompt.
  const constraintLines: string[] = [];
  if (parentPrefs.dietaryPattern && parentPrefs.dietaryPattern !== "omnivore") {
    constraintLines.push(`Household dietary pattern: ${parentPrefs.dietaryPattern}`);
  }
  if (parentPrefs.budgetLevel) {
    constraintLines.push(`Budget level: ${parentPrefs.budgetLevel.replace(/_/g, " ")}`);
  }
  if (parentPrefs.maxCookTimeMinutes) {
    constraintLines.push(`Maximum cook time: ${parentPrefs.maxCookTimeMinutes} minutes`);
  }
  if (parentPrefs.requiresSchoolSafe) {
    constraintLines.push(`Must be school-safe (nut-free, avoids common school allergens).`);
  }
  if (parentPrefs.requiresPackable) {
    constraintLines.push(`Must be packable in a lunchbox.`);
  }
  const constraintsBlock = constraintLines.length > 0
    ? `\nHOUSEHOLD CONSTRAINTS (validated, enumerated):\n${constraintLines.join("\n")}`
    : "";

  return `You are a pediatric nutrition AI assistant that creates age-safe, kid-friendly recipes.

CORE MANDATE:
Create a version of the requested food that stays recognizable and enjoyable for children while improving nutritional quality where appropriate. Preserve the identity of the food. Never replace it with something unrecognizable. Improve the recipe, do not reinvent it.

CHILD DEVELOPMENTAL STAGE: ${stageLabel}

LEVEL A SAFETY RULES — NON-NEGOTIABLE HARD STOPS:
${safetyRules}

ALLERGY / INTOLERANCE RULES:
${allergyBlock}
${constraintsBlock}

ABSOLUTE PROHIBITIONS:
- Never generate a recipe for Early Infant stage (birth–5 months)
- Never inherit adult macros, GLP-1, or diabetes settings
- Never diagnose weight status or label a child's body
- Never suggest formula modifications or homemade formula
- Never give medication, dosing, or clinical treatment instructions
- Never use adult body-type labels (ectomorph, endomorph, etc.)

RESPONSE FORMAT:
Return valid JSON only. No markdown. No extra text outside JSON.
Required schema:
{
  "recipeName": "string",
  "ageStageSuitability": "string",
  "ingredients": [{ "name": "string", "quantity": "string", "unit": "string|omit", "prepNote": "string|omit", "substitutionNote": "string|omit" }],
  "instructions": ["string"],
  "servingGuidance": "string",
  "textureAndChokingPreparation": "string",
  "allergenAlerts": [{ "allergenId": "string", "message": "string", "severity": "confirmed_removed|suspected_removed|clinician_eliminated|cross_contact_warning" }],
  "whyThisVersionIsBetter": "string",
  "serveSuggestion": "string",
  "funPresentationIdea": "string",
  "storageAndLunchboxGuidance": "string|omit",
  "askPediatricianNote": "string|omit",
  "rulesFireLog": [{ "ruleId": "string", "level": "A", "description": "string", "action": "string" }],
  "whyThisMealWasChosen": "string — plain English explanation for a parent with no nutrition background. Cover which profile elements shaped this output (stage, allergies, dietary pattern, goals). End with: 'Always follow your pediatrician\\'s guidance for your child\\'s specific nutritional needs.'",
  "reasoningTrace": ["string — one rule or protocol applied, e.g. 'Preschool Stage — calcium and iron DRI baseline applied', 'Confirmed peanut allergy — peanuts excluded in all forms'"]
}`;
}

// ── Build user message (user text kept here, never in system prompt) ───────────

function buildUserMessage(
  foodRequest: string,
  stage: DevelopmentalStage,
  allergies: AllergyEntry[],
  rawCulturalCuisine: string | undefined,
  rawGoals: string[] | undefined,
): string {
  const stageLabel = STAGE_LABELS[stage];

  const suspectedAllergens = allergies
    .filter(a => a.severity === "suspected_reaction")
    .map(a => (a.allergenId === "other" && a.customAllergenName ? a.customAllergenName : a.allergenId));

  const epiPenAllergens = allergies
    .filter(a => a.emergencyMedication)
    .map(a => (a.allergenId === "other" && a.customAllergenName ? a.customAllergenName : a.allergenId));

  let msg = `Please create a kid-friendly recipe for: ${foodRequest}\n\nChild's stage: ${stageLabel}`;

  if (suspectedAllergens.length > 0) {
    msg += `\n\nNote: The following were removed due to suspected (not confirmed) reactions: ${suspectedAllergens.join(", ")}. Mention this gently in allergenAlerts.`;
  }
  if (epiPenAllergens.length > 0) {
    msg += `\n\nSEVERE ALLERGY — EpiPen prescribed for: ${epiPenAllergens.join(", ")}. Ensure complete exclusion and include a preparation reminder in allergenAlerts.`;
  }

  // Cultural cuisine and goals are free-form user text — placed in user message only
  if (rawCulturalCuisine) {
    msg += `\n\nCultural/cuisine preference (parent note): ${rawCulturalCuisine}`;
  }
  if (rawGoals && rawGoals.length > 0) {
    msg += `\n\nNutrition goals (parent note): ${rawGoals.join(", ")}`;
  }

  return msg;
}

// ── POST /create-dish ──────────────────────────────────────────────────────────

router.post("/create-dish", async (req, res) => {
  try {
    // ── Validate request ─────────────────────────────────────────────────────
    const validation = validateRequest(req.body);

    const { ageStage, allergies, foodRequest, parentPrefs, childName } = validation as Required<typeof validation>;
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const { ageStage, allergies, foodRequest, parentPrefs, childName } = validation as Required<typeof validation>;

    // ── Gate: Early Infant ───────────────────────────────────────────────────
    if (ageStage === "early_infant") {
      return res.status(200).json({
        blocked: true,
        blockReason: "early_infant",
        educationMessage:
          "Babies under 6 months receive all their nutrition from breast milk or formula. " +
          "We can't generate recipes for this stage. Please speak with your child's pediatrician " +
          "before introducing any solid foods.",
      });
    }

    // ── Gate: foodRequest required for generation ────────────────────────────
    if (!foodRequest) {
      return res.status(400).json({ error: "foodRequest is required" });
    }

    // ── Extract free-text pref fields (user-controlled, kept out of system prompt) ──
    const rawPrefs = req.body.parentPrefs && typeof req.body.parentPrefs === "object"
      ? req.body.parentPrefs
      : {};
    const rawCulturalCuisine = typeof rawPrefs.culturalCuisine === "string"
      ? sanitizeText(rawPrefs.culturalCuisine, 80)
      : undefined;
    const rawGoals = Array.isArray(rawPrefs.goals)
      ? (rawPrefs.goals as unknown[])
          .filter(g => typeof g === "string")
          .map(g => sanitizeText(g as string, 60))
          .filter(Boolean)
          .slice(0, 10)
      : undefined;

    // ── Compute parent education layer (server-side, deterministic) ──────────
    const educationLayer = computeParentEducationLayer({ ageStage, allergies, parentPrefs, foodRequest });

    // ── Build prompts ────────────────────────────────────────────────────────
    const systemPrompt = buildSystemPrompt(ageStage, allergies, parentPrefs);
    const userMessage = buildUserMessage(foodRequest, ageStage, allergies, rawCulturalCuisine, rawGoals);

    // ── Call OpenAI ──────────────────────────────────────────────────────────
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return res.status(500).json({ error: "No response from AI" });
    }

    // ── Parse ────────────────────────────────────────────────────────────────
    let recipe: any;
    try {
      recipe = JSON.parse(raw);
    } catch {
      console.error("[MyPerfectBeginning] AI returned non-JSON:", raw.slice(0, 200));
      return res.status(500).json({ error: "AI returned an invalid response format" });
    }

    // ── Validate response schema ──────────────────────────────────────────────
    const schemaCheck = validateRecipeResponse(recipe);

    const postScan = scanGeneratedOutput(recipe, ageStage);
    if (!schemaCheck.valid) {
      console.error("[MyPerfectBeginning] AI response schema invalid:", schemaCheck.error, JSON.stringify(recipe).slice(0, 300));
      return res.status(500).json({ error: "AI returned an incomplete recipe. Please try again." });
    }

    // ── Ensure mandatory pediatrician disclaimer in whyThisMealWasChosen ─────
    const disclaimerSuffix = childName
      ? `Always follow your pediatrician's guidance for ${childName}'s specific nutritional needs.`
      : "Always follow your pediatrician's guidance for your child's specific nutritional needs.";
    if (typeof recipe.whyThisMealWasChosen === "string" && recipe.whyThisMealWasChosen.trim()) {
      const trimmed = recipe.whyThisMealWasChosen.trim();
      if (!trimmed.endsWith(disclaimerSuffix)) {
        recipe.whyThisMealWasChosen = trimmed + " " + disclaimerSuffix;
      }
    } else {
      recipe.whyThisMealWasChosen = disclaimerSuffix;
    }

    return res.json({
      recipe,
      blocked: false,
      mealConfidence: educationLayer.mealConfidence,
      clinicalReviewStatus: educationLayer.clinicalReviewStatus,
      personalizationLevel: educationLayer.personalizationLevel,
      conflictResolutions: educationLayer.conflictResolutions,
    });
  } catch (err: any) {
    console.error("[MyPerfectBeginning] create-dish error:", err);
    return res.status(500).json({ error: "Failed to generate recipe" });
  }
});

export default router;

    const finalRecipe = postScan.patchedRecipe ?? recipe;

    const preCheck = enforceBeforeGenerate({ ageStage, foodRequest });
