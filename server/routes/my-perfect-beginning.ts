import { Router } from "express";
import OpenAI from "openai";
import { requireAuth } from "../middleware/requireAuth";
import type { AuthenticatedRequest } from "../middleware/requireAuth";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { computeParentEducationLayer } from "../services/pediatric/pediatricConfidenceScorer";
import { enforceBeforeGenerate, scanGeneratedOutput } from "../services/pediatric/pediatricGuardrails";
import {
  buildPediatricGuidanceBlocks,
  type ChildProfileInput,
  type AllergyDetailEntry,
  type ProtocolConflict,
} from "../services/pediatric/buildPediatricGuidanceBlocks";
import {
  resolvePediatricContextFromInput,
  type PediatricMealGenerationContext,
  type DevelopmentalStageKey,
} from "../services/pediatric/pediatricResolver";

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
  if (!body.ageStage || typeof body.ageStage !== "string") {
    return { valid: false, error: "ageStage is required" };
  }
  if (!(VALID_STAGES as readonly string[]).includes(body.ageStage)) {
    return { valid: false, error: `Invalid ageStage: ${body.ageStage}` };
  }
  const ageStage = body.ageStage as DevelopmentalStage;

  const foodRequest = sanitizeText(body.foodRequest, 300);

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

// ── Resolver-backed system prompt (preferred path) ────────────────────────────
// Injects the pre-assembled resolver context block. The resolver already encoded
// all safety rules, medical protocols, texture rules, and allergen removals.

function buildSystemPromptWithResolver(
  stage: DevelopmentalStage,
  ctx: PediatricMealGenerationContext,
): string {
  const stageLabel = STAGE_LABELS[stage];

  return `You are a pediatric nutrition AI assistant that creates age-safe, kid-friendly recipes.

CORE MANDATE:
Create a version of the requested food that stays recognizable and enjoyable for children while improving nutritional quality where appropriate. Preserve the identity of the food. Never replace it with something unrecognizable. Improve the recipe, do not reinvent it.

PROTOCOL PRIORITY ORDER (apply in this order — lower number wins conflicts):
1. Life-threatening safety (allergens, choking hazards, early_infant block)
2. Developmental stage hard stops (texture, food forms)
3. Medical condition hard limits (see MEDICAL CONDITION PROTOCOLS below)
4. Growth context (caloric density needs)
5. Sensory and feeding development
6. Medical optimization
7. Family goals and preferences
8. Kitchen reality (cook time, budget, packability)

CHILD DEVELOPMENTAL STAGE: ${stageLabel}

${ctx.systemContextBlock}

ABSOLUTE PROHIBITIONS:
- Never generate a recipe for Early Infant stage (birth–5 months)
- Never inherit adult macros, GLP-1, or diabetes settings from adult users
- Never diagnose weight status or label a child's body
- Never suggest formula modifications or homemade formula
- Never give medication, dosing, or clinical treatment instructions
- Never use adult body-type labels (ectomorph, endomorph, etc.)
- Never override medical condition protocol guidance with "kid-friendly" substitutions

RESOLVER RULE: Every decision in the PEDIATRIC RESOLVER CONTEXT above was made before you were called.
Your only job is to write the recipe. You do not make safety decisions — the resolver already did.
All fired rules (RULE-XXXX) and condition protocols (COND-XXXX) listed above MUST be reflected in the recipe.
Include the ruleId of every rule that influenced your recipe in the rulesFireLog.

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
  "estimatedCarbsPerServing": "string|omit — include when T1D/T2D protocol is active (e.g. '22–28g')",
  "rulesFireLog": [{ "ruleId": "string", "level": "A|B|C", "description": "string", "action": "string" }],
  "whyThisMealWasChosen": "string — plain English explanation for a parent with no nutrition background. Cover which profile elements shaped this output (stage, allergies, medical conditions, dietary pattern, goals). End with: 'Always follow your pediatrician\\'s guidance for your child\\'s specific nutritional needs.'",
  "reasoningTrace": ["string — one rule or protocol applied, e.g. 'Preschool Stage — calcium and iron DRI baseline applied'"]
}`;
}

// ── Legacy system prompt (fallback when resolver is unavailable) ──────────────

function buildSystemPrompt(
  stage: DevelopmentalStage,
  allergies: AllergyEntry[],
  parentPrefs: ParentPrefs,
  conditionGuidanceBlocks: string[],
  stageDRIBlock: string,
): string {
  const stageLabel = STAGE_LABELS[stage];
  const safetyRules = buildSafetyRulesBlock(stage);
  const allergyBlock = buildAllergySystemBlock(allergies);

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

  const medicalBlock = conditionGuidanceBlocks.length > 0
    ? `\n\nMEDICAL CONDITION PROTOCOLS — MANDATORY (server-verified, clinically sourced):\n` +
      `These override default recipe choices. Apply ALL of the following blocks exactly.\n\n` +
      conditionGuidanceBlocks.join("\n\n---\n\n")
    : "";

  const driBlock = stageDRIBlock ? `\n\n${stageDRIBlock}` : "";

  return `You are a pediatric nutrition AI assistant that creates age-safe, kid-friendly recipes.

CORE MANDATE:
Create a version of the requested food that stays recognizable and enjoyable for children while improving nutritional quality where appropriate. Preserve the identity of the food. Never replace it with something unrecognizable. Improve the recipe, do not reinvent it.

PROTOCOL PRIORITY ORDER (apply in this order — lower number wins conflicts):
1. Life-threatening safety (allergens, choking hazards, early_infant block)
2. Developmental stage hard stops (texture, food forms)
3. Medical condition hard limits (see MEDICAL CONDITION PROTOCOLS below)
4. Growth context (caloric density needs)
5. Sensory and feeding development
6. Medical optimization
7. Family goals and preferences
8. Kitchen reality (cook time, budget, packability)

CHILD DEVELOPMENTAL STAGE: ${stageLabel}

LEVEL A SAFETY RULES — NON-NEGOTIABLE HARD STOPS:
${safetyRules}

ALLERGY / INTOLERANCE RULES:
${allergyBlock}
${constraintsBlock}
${medicalBlock}
${driBlock}

ABSOLUTE PROHIBITIONS:
- Never generate a recipe for Early Infant stage (birth–5 months)
- Never inherit adult macros, GLP-1, or diabetes settings from adult users
- Never diagnose weight status or label a child's body
- Never suggest formula modifications or homemade formula
- Never give medication, dosing, or clinical treatment instructions
- Never use adult body-type labels (ectomorph, endomorph, etc.)
- Never override medical condition protocol guidance with "kid-friendly" substitutions

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
  "estimatedCarbsPerServing": "string|omit — include when T1D/T2D protocol is active (e.g. '22–28g')",
  "rulesFireLog": [{ "ruleId": "string", "level": "A|B|C", "description": "string", "action": "string" }],
  "whyThisMealWasChosen": "string — plain English explanation for a parent with no nutrition background. Cover which profile elements shaped this output (stage, allergies, medical conditions, dietary pattern, goals). End with: 'Always follow your pediatrician\\'s guidance for your child\\'s specific nutritional needs.'",
  "reasoningTrace": ["string — one rule or protocol applied, e.g. 'Preschool Stage — calcium and iron DRI baseline applied', 'Confirmed peanut allergy — peanuts excluded in all forms', 'T1D protocol active — carb count estimated'"]
}`;
}

// ── Build user message (user text kept here, never in system prompt) ───────────

function buildUserMessage(
  foodRequest: string,
  stage: DevelopmentalStage,
  allergies: AllergyEntry[],
  rawCulturalCuisine: string | undefined,
  rawGoals: string[] | undefined,
  allergyDetails?: AllergyDetailEntry[],
  medicationAffectsAppetite?: boolean,
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

  // Extended allergy details from child profile
  if (allergyDetails && allergyDetails.length > 0) {
    const detailLines = allergyDetails
      .filter(d => d.allergen)
      .map(d => {
        const parts = [d.allergen];
        if (d.severity)              parts.push(`severity: ${d.severity}`);
        if (d.epiPen)                parts.push("EpiPen prescribed");
        if (d.crossContact)          parts.push("cross-contact concern");
        if (d.clinicianInstructions) parts.push(`clinician note: ${d.clinicianInstructions}`);
        return parts.join(", ");
      });
    if (detailLines.length > 0) {
      msg += `\n\nAllergy detail from child profile: ${detailLines.join("; ")}`;
    }
  }

  // Medication affects appetite
  if (medicationAffectsAppetite) {
    msg += "\n\nParent note: This child's medication affects appetite. Keep portions small and nutritionally dense.";
  }

  if (rawCulturalCuisine) {
    msg += `\n\nCultural/cuisine preference (parent note): ${rawCulturalCuisine}`;
  }
  if (rawGoals && rawGoals.length > 0) {
    msg += `\n\nNutrition goals (parent note): ${rawGoals.join(", ")}`;
  }

  return msg;
}

// ── Child profile DB loader ────────────────────────────────────────────────────
// Fetches the active child profile and returns it as a ChildProfileInput for
// the protocol engine. Validates ownership. Returns null on any failure.

async function fetchChildProfileInput(
  userId: string,
  childProfileId: string | null | undefined,
): Promise<ChildProfileInput | null> {
  if (!childProfileId || typeof childProfileId !== "string") return null;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(childProfileId)) {
    return null;
  }

  try {
    const rows = await db.execute(sql`
      SELECT
        id,
        age_stage,
        medical_conditions,
        sensory_issues,
        feeding_concerns,
        feeding_ability,
        growth_context,
        g_tube,
        pediatrician_oversight,
        sex,
        height_cm,
        weight_kg,
        allergy_details,
        feeding_development,
        family_goals,
        kitchen_equipment,
        kitchen_budget,
        kitchen_time_minutes,
        kitchen_skill,
        cultural_preferences,
        school_safe_required,
        medication_affects_appetite,
        birth_history
      FROM child_profiles
      WHERE id = ${childProfileId}
        AND user_id = ${userId}
        AND is_archived = false
      LIMIT 1
    `);

    if (!rows.rows || rows.rows.length === 0) return null;
    const row = rows.rows[0] as any;

    const parseJsonbArray = (val: any): string[] => {
      if (Array.isArray(val)) return val.filter(Boolean).map(String);
      if (typeof val === "string") {
        try { return JSON.parse(val); } catch { return []; }
      }
      return [];
    };

    const parseJsonbObject = (val: any): Record<string, any> => {
      if (val && typeof val === "object" && !Array.isArray(val)) return val;
      if (typeof val === "string") {
        try { return JSON.parse(val); } catch { return {}; }
      }
      return {};
    };

    const feedingAbilityRaw = parseJsonbObject(row.feeding_ability);

    // Canonical G-tube source: feeding_ability.hasFeedingTube.
    // The g_tube boolean column is a backward-compat mirror; we read it here
    // as a fallback only. feeding_ability.hasFeedingTube is the single source
    // of truth going forward (the UI no longer presents a separate g_tube toggle).
    const hasFeedingTube =
      !!feedingAbilityRaw.hasFeedingTube || !!row.g_tube;
    const baseConditions = parseJsonbArray(row.medical_conditions);
    const normalizedConditions =
      hasFeedingTube &&
      !baseConditions.some(
        (c: string) => c.toLowerCase().replace(/[\s\-]/g, "_") === "g_tube",
      )
        ? [...baseConditions, "g_tube"]
        : baseConditions;

    // pediatricianConcern comes from the dedicated boolean column.
    // growth_context is a plain TEXT status string ("typical", "concern_underweight",
    // etc.) — NOT a JSON object — so parseJsonbObject must never be called on it.
    // ── Parse all extended JSONB columns ─────────────────────────────────────
    const allergyDetailsRaw = parseJsonbArray(row.allergy_details);
    // allergy_details is an array of objects stored as JSONB; each element is
    // an object, not a string — re-parse if pg returns them as serialized strings.
    const allergyDetails = allergyDetailsRaw
      .map((item: any) => {
        if (typeof item === "string") {
          try { return JSON.parse(item); } catch { return null; }
        }
        return item;
      })
      .filter(Boolean);

    const feedingDevelopmentRaw = parseJsonbObject(row.feeding_development);
    const birthHistoryRaw       = parseJsonbObject(row.birth_history);
    const familyGoalsRaw        = parseJsonbArray(row.family_goals);
    const kitchenEquipmentRaw   = parseJsonbArray(row.kitchen_equipment);

    // Budget mapping: DB stores "budget" but resolver expects "budget_conscious"
    const kitchenBudgetRaw = typeof row.kitchen_budget === "string" ? row.kitchen_budget : "moderate";
    const resolverBudgetLevel =
      kitchenBudgetRaw === "budget"   ? "budget_conscious" as const :
      kitchenBudgetRaw === "flexible" ? "flexible" as const :
                                        "moderate" as const;

    const profileInput: ChildProfileInput = {
      // ── Core fields (original) ──────────────────────────────────────────────
      developmentalStage: (row.age_stage as DevelopmentalStage) || "toddler",
      medicalConditions: normalizedConditions,
      sensoryIssues: parseJsonbArray(row.sensory_issues),
      feedingConcerns: parseJsonbArray(row.feeding_concerns),
      feedingAbility: {
        textureLevel: feedingAbilityRaw.textureLevel,
        swallowingDifficulty: !!feedingAbilityRaw.swallowingDifficulty,
        hasFeedingTube,
        historyOfChokingOrGagging: !!feedingAbilityRaw.historyOfChokingOrGagging,
      },
      growth: {
        // growth_context is plain TEXT (e.g. "typical", "concern_underweight").
        // Map to the typed string the resolver expects; fall back to
        // pediatrician_oversight boolean for a generic "has concern" signal.
        pediatricianConcern: (() => {
          const gc = typeof row.growth_context === "string" ? row.growth_context : "typical";
          if (gc === "concern_underweight") return "underweight";
          if (gc === "concern_overweight") return "overweight";
          if (gc === "failure_to_thrive") return "failure_to_thrive";
          return row.pediatrician_oversight ? "concern" : undefined;
        })(),
      },
      // ── Group 1: Growth and Nutrition Context ───────────────────────────────
      sex:                       typeof row.sex === "string" ? row.sex : undefined,
      heightCm:                  row.height_cm ? Number(row.height_cm) : undefined,
      weightKg:                  row.weight_kg ? Number(row.weight_kg) : undefined,
      medicationAffectsAppetite: !!row.medication_affects_appetite,
      birthHistory:              Object.keys(birthHistoryRaw).length > 0 ? birthHistoryRaw : undefined,
      familyGoals:               familyGoalsRaw.length > 0 ? familyGoalsRaw : undefined,
      // ── Group 2: Allergy Detail and Feeding Safety ──────────────────────────
      allergyDetails:            allergyDetails.length > 0 ? allergyDetails : undefined,
      feedingDevelopment:        Object.keys(feedingDevelopmentRaw).length > 0 ? feedingDevelopmentRaw : undefined,
      // ── Group 3: School and Kitchen Context ─────────────────────────────────
      schoolSafeRequired:  !!row.school_safe_required,
      kitchenEquipment:    kitchenEquipmentRaw.length > 0 ? kitchenEquipmentRaw : undefined,
      kitchenBudget:       kitchenBudgetRaw,
      kitchenTimeMinutes:  row.kitchen_time_minutes ? Number(row.kitchen_time_minutes) : undefined,
      kitchenSkill:        typeof row.kitchen_skill === "string" ? row.kitchen_skill : undefined,
      culturalPreferences: typeof row.cultural_preferences === "string" && row.cultural_preferences
                           ? row.cultural_preferences : undefined,
      // Expose the resolver-ready budget level so /create-dish can pass it directly
      _resolverBudgetLevel: resolverBudgetLevel,
    } as ChildProfileInput & { _resolverBudgetLevel: "budget_conscious" | "moderate" | "flexible" };

    return profileInput;
  } catch (err: any) {
    if (err?.code === "42P01") return null;
    console.error("[MyPerfectBeginning/create-dish] child profile lookup error:", err.message);
    return null;
  }
}

// ── POST /resolve-context ──────────────────────────────────────────────────────
// QA / clinical review endpoint — returns the full resolver context without
// calling OpenAI. Useful for inspecting what the AI will receive before generation.

router.post("/resolve-context", requireAuth, async (req, res) => {
  try {
    const {
      childProfileId = null,
      childProfileIds,
      ageStage,
      allergies: allergyOverride,
      parentPrefs: rawPrefs = {},
      mealType,
      servings,
    } = req.body;

    const allergyOverrideNorm = Array.isArray(allergyOverride)
      ? allergyOverride
          .filter((a: any) => a && typeof a.allergenId === "string")
          .map((a: any) => ({
            allergenId: a.allergenId,
            severity: a.severity ?? "preference_avoid",
            emergencyMedication: !!a.emergencyMedication,
            customAllergenName: a.customAllergenName,
          }))
      : undefined;

    const stageOverride = (VALID_STAGES as readonly string[]).includes(ageStage)
      ? (ageStage as DevelopmentalStageKey)
      : undefined;

    const parentPrefs = {
      budgetLevel: (["budget_conscious", "moderate", "flexible"] as const).includes(rawPrefs.budgetLevel)
        ? rawPrefs.budgetLevel : undefined,
      maxCookTimeMinutes: ([15, 30, 45, 60] as const).includes(Number(rawPrefs.maxCookTimeMinutes) as 15 | 30 | 45 | 60)
        ? Number(rawPrefs.maxCookTimeMinutes) : undefined,
      requiresSchoolSafe: typeof rawPrefs.requiresSchoolSafe === "boolean" ? rawPrefs.requiresSchoolSafe : undefined,
      requiresPackable: typeof rawPrefs.requiresPackable === "boolean" ? rawPrefs.requiresPackable : undefined,
      culturalCuisine: typeof rawPrefs.culturalCuisine === "string"
        ? sanitizeText(rawPrefs.culturalCuisine, 80) : undefined,
      dietaryPattern: typeof rawPrefs.dietaryPattern === "string" ? rawPrefs.dietaryPattern : undefined,
      goals: Array.isArray(rawPrefs.goals)
        ? rawPrefs.goals.filter((g: unknown) => typeof g === "string").map((g: string) => sanitizeText(g, 60)).filter(Boolean)
        : undefined,
    };

    const context = await resolvePediatricContextFromInput({
      childProfileId: typeof childProfileId === "string" ? childProfileId : null,
      childProfileIds: Array.isArray(childProfileIds) ? childProfileIds : undefined,
      stageOverride,
      allergyOverride: allergyOverrideNorm,
      parentPrefs,
      mealType: mealType ?? "any",
      servings: typeof servings === "number" ? servings : 1,
    });

    return res.json({ context });
  } catch (err: any) {
    console.error("[MyPerfectBeginning] resolve-context error:", err);
    return res.status(500).json({ error: "Failed to resolve context" });
  }
});

// ── POST /create-dish ──────────────────────────────────────────────────────────

router.post("/create-dish", requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.authUser.id;

    // ── Fetch child profile from DB (if childProfileId provided) ────────────
    const childProfileId = typeof req.body.childProfileId === "string"
      ? req.body.childProfileId
      : null;

    const childProfileInput = await fetchChildProfileInput(userId, childProfileId);

    // ── Validate request ─────────────────────────────────────────────────────
    const validation = validateRequest(req.body);
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

    // ── Gate: PKU ────────────────────────────────────────────────────────────
    // Phenylketonuria requires metabolic dietitian oversight — block generation.
    const loadedMedConditions = (childProfileInput?.medicalConditions ?? []).map(
      (c: string) => c.toLowerCase().replace(/[\s\-]/g, "_"),
    );
    if (loadedMedConditions.includes("pku")) {
      return res.status(200).json({
        blocked: true,
        blockReason: "pku",
        educationMessage:
          "Phenylketonuria (PKU) requires strict phenylalanine management under the direct supervision of a " +
          "metabolic dietitian. We can't generate meal suggestions for a child with PKU. " +
          "Please work with your child's metabolic nutrition team for safe meal planning.",
      });
    }

    // ── Gate: G-tube ─────────────────────────────────────────────────────────
    // Enteral feeding — oral meal generation is not appropriate.
    if (loadedMedConditions.includes("g_tube")) {
      return res.status(200).json({
        blocked: true,
        blockReason: "g_tube",
        educationMessage:
          "Children receiving G-tube (enteral) nutrition have specialized feeding requirements managed by " +
          "their care team. We can't generate oral meal recipes for this profile. " +
          "Please follow your child's enteral nutrition plan from their dietitian.",
      });
    }

    // ── Gate: foodRequest required for generation ────────────────────────────
    if (!foodRequest) {
      return res.status(400).json({ error: "foodRequest is required" });
    }

    // ── Pre-generation guardrail check ───────────────────────────────────────
    const preCheck = enforceBeforeGenerate({ ageStage, foodRequest });
    if (preCheck.blocked) {
      return res.status(200).json({
        blocked: true,
        blockReason: preCheck.blockReason,
        educationMessage: preCheck.educationMessage,
      });
    }

    // ── Build protocol guidance blocks from child profile ────────────────────
    const profileForEngine: ChildProfileInput = childProfileInput ?? {
      developmentalStage: ageStage as DevelopmentalStage,
      medicalConditions: [],
      sensoryIssues: [],
      feedingConcerns: [],
    };

    const guidanceOutput = buildPediatricGuidanceBlocks(profileForEngine);
    const conditionGuidanceBlocks = guidanceOutput.conditionGuidanceBlocks;
    const stageDRIBlock           = guidanceOutput.stageDRIBlock;
    const conflictLog: ProtocolConflict[] = guidanceOutput.conflictLog;
    const activeProtocolIds       = guidanceOutput.activeProtocolIds;
    const activeProtocolEvidence  = guidanceOutput.activeProtocolEvidence;

    if (activeProtocolIds.length > 0) {
      console.log(
        `[MyPerfectBeginning/create-dish] Active protocols for user=${userId} child=${childProfileId ?? "no-profile"}:`,
        activeProtocolIds.join(", ")
      );
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
    const educationLayer = computeParentEducationLayer({ ageStage, allergies, parentPrefs, foodRequest });

    // ── Phase 1: Run Resolver — all decisions made here, BEFORE AI ───────────
    let resolverCtx: PediatricMealGenerationContext | null = null;
    try {
      resolverCtx = await resolvePediatricContextFromInput({
        childProfileId,
        stageOverride: ageStage as DevelopmentalStageKey,
        allergyOverride: allergies.map(a => ({
          allergenId: a.allergenId,
          severity: a.severity,
          emergencyMedication: a.emergencyMedication,
          customAllergenName: a.customAllergenName,
        })),
        parentPrefs: {
          // Child profile values serve as defaults; request-supplied values override.
          // Budget: request wins if set, else child profile kitchen_budget
          budgetLevel: (parentPrefs.budgetLevel as any)
            ?? (childProfileInput as any)?._resolverBudgetLevel,
          // Cook time: request wins if set, else child profile kitchen_time_minutes
          maxCookTimeMinutes: parentPrefs.maxCookTimeMinutes
            ?? childProfileInput?.kitchenTimeMinutes,
          // School-safe: either source can set this — child profile is authoritative,
          // but a request-level flag (e.g. from UI toggle) also activates it.
          requiresSchoolSafe: parentPrefs.requiresSchoolSafe
            || childProfileInput?.schoolSafeRequired
            || false,
          requiresPackable: parentPrefs.requiresPackable,
          // Cultural cuisine: request (parent note on this meal) wins;
          // fall back to child profile cultural_preferences.
          culturalCuisine: rawCulturalCuisine
            ?? childProfileInput?.culturalPreferences,
          dietaryPattern: parentPrefs.dietaryPattern,
          // Goals: request wins if supplied; fall back to child profile family_goals.
          goals: rawGoals
            ?? childProfileInput?.familyGoals,
        },
        mealType: "any",
        servings: 1,
      });
    } catch (resolverErr: any) {
      console.warn("[MyPerfectBeginning] Resolver failed — falling back to legacy prompt:", resolverErr?.message);
    }

    // ── Phase 2: Build prompts ────────────────────────────────────────────────
    // Resolver path (preferred): uses pre-assembled context block
    // Fallback path: uses conditionGuidanceBlocks from buildPediatricGuidanceBlocks
    const systemPrompt = resolverCtx
      ? buildSystemPromptWithResolver(ageStage, resolverCtx)
      : buildSystemPrompt(ageStage, allergies, parentPrefs, conditionGuidanceBlocks, stageDRIBlock);

    const userMessage = buildUserMessage(
      foodRequest,
      ageStage,
      allergies,
      rawCulturalCuisine,
      rawGoals,
      childProfileInput?.allergyDetails,
      childProfileInput?.medicationAffectsAppetite,
    );

    // ── Inject resolver mealType into user message ────────────────────────────
    // When the resolver derives a specific meal type from the profile or request,
    // seed it into the prompt so the AI targets the right meal occasion.
    const resolvedMealType = resolverCtx?.mealType;
    const finalUserMessage = (resolvedMealType && resolvedMealType !== "any")
      ? userMessage + `\n\nMeal type context (resolver-derived): ${resolvedMealType}`
      : userMessage;

    // ── Phase 3: Call OpenAI ─────────────────────────────────────────────────
    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: finalUserMessage },
      ],
      temperature: 0.7,
      max_tokens: 2500,
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
    if (!schemaCheck.valid) {
      console.error("[MyPerfectBeginning] AI response schema invalid:", schemaCheck.error, JSON.stringify(recipe).slice(0, 300));
      return res.status(500).json({ error: "AI returned an incomplete recipe. Please try again." });
    }

    // ── Post-generation scan ──────────────────────────────────────────────────
    const postScan = scanGeneratedOutput(recipe, ageStage);
    const finalRecipe = postScan.patchedRecipe ?? recipe;

    // ── Mandatory pediatrician disclaimer ─────────────────────────────────────
    const disclaimerSuffix = childName
      ? `Always follow your pediatrician's guidance for ${childName}'s specific nutritional needs.`
      : "Always follow your pediatrician's guidance for your child's specific nutritional needs.";
    if (typeof finalRecipe.whyThisMealWasChosen === "string" && finalRecipe.whyThisMealWasChosen.trim()) {
      const trimmed = finalRecipe.whyThisMealWasChosen.trim();
      if (!trimmed.endsWith(disclaimerSuffix)) {
        finalRecipe.whyThisMealWasChosen = trimmed + " " + disclaimerSuffix;
      }
    } else {
      finalRecipe.whyThisMealWasChosen = disclaimerSuffix;
    }

    // ── Resolver metadata (audit trail + parent-education layer) ─────────────
    const resolverMeta = resolverCtx
      ? {
          resolverVersion: resolverCtx.resolverVersion,
          resolvedAt: resolverCtx.resolvedAt,
          stageKey: resolverCtx.stageKey,
          textureClass: resolverCtx.textureClass,
          // Legacy IDs kept for backward compat
          firedRuleIds: resolverCtx.firedRules.map(r => r.ruleId),
          activeConditionIds: resolverCtx.activeProtocolBlocks.map(b => b.conditionId),
          // Full rule details for parent-education panel
          firedRules: resolverCtx.firedRules.map(r => ({
            ruleId: r.ruleId,
            level: r.level,
            description: r.description,
            action: r.action,
          })),
          activeProtocolBlocks: resolverCtx.activeProtocolBlocks.map(b => ({
            conditionId: b.conditionId,
            conditionLabel: b.conditionLabel,
            optimizations: b.optimizations,
          })),
          allergenRemovals: resolverCtx.allergenRemovals.map(a => ({
            allergenId: a.allergenId,
            displayName: a.displayName,
            action: a.action,
            severity: a.severity,
            emergencyMedication: a.emergencyMedication,
          })),
          foodAcceptanceDirectives: resolverCtx.foodAcceptanceDirectives,
          preferencesUsed: {
            culturalCuisine: resolverCtx.parentOverrides.culturalCuisine,
            dietaryPattern: resolverCtx.parentOverrides.dietaryPattern,
            goals: resolverCtx.parentOverrides.goals,
          },
          stageDRIBaseline: {
            stageLabel: resolverCtx.stageDRIBaseline.stageLabel,
            ironMg: resolverCtx.stageDRIBaseline.ironMg,
            calciumMg: resolverCtx.stageDRIBaseline.calciumMg,
            vitaminDIU: resolverCtx.stageDRIBaseline.vitaminDIU,
            honeyAllowed: resolverCtx.stageDRIBaseline.honeyAllowed,
          },
          conflictResolutions: resolverCtx.conflictResolutions,
          splitMealRequired: resolverCtx.splitMealRequired,
        }
      : null;

    // ── Resolver image context — drives meal photo texture + presentation ──────
    // Derived from the resolver's textureClass and stageKey so the generated
    // image matches what the parent will actually plate.
    const TEXTURE_STRATEGY_MAP: Record<string, string> = {
      puree_only:       "purée/smooth — no visible chunks, lumps, or whole pieces. The food must look completely smooth.",
      mashed_soft:      "mashed or very soft — no hard pieces, easily gummed. No crunchy or whole elements visible.",
      soft_chopped:     "soft and chopped into small pieces — no hard or crunchy elements. Everything must look very soft.",
      family_modified:  "family-table textures modified for a child — cut into age-appropriate bite-sized pieces.",
      family_table:     "standard child-sized pieces — normal family table textures, not an adult restaurant portion.",
    };
    const PRESENTATION_STRATEGY_MAP: Record<string, string> = {
      early_infant:     "no solid food — breast milk or formula only, no plate",
      beginning_foods:  "tiny portion in a small infant bowl — completely smooth purée, no finger foods visible",
      young_toddler:    "small toddler plate with very soft bite-sized pieces, colorful and simply presented",
      toddler:          "small toddler plate with soft small pieces, fun and simple — not an adult portion",
      preschool:        "small child's plate, simply presented and colorful, cut into manageable pieces",
      early_school_age: "child's plate with age-appropriate portions, familiar and approachable presentation",
      growing_child:    "standard child's plate with normal portions — not a full adult restaurant serving",
    };
    const resolverContext = resolverCtx
      ? {
          textureStrategy: TEXTURE_STRATEGY_MAP[resolverCtx.textureClass] ?? "soft, age-appropriate texture",
          presentationStrategy: PRESENTATION_STRATEGY_MAP[resolverCtx.stageKey] ?? "small child's plate, simply presented",
        }
      : null;

    return res.json({
      recipe: finalRecipe,
      blocked: false,
      mealConfidence: educationLayer.mealConfidence,
      clinicalReviewStatus: educationLayer.clinicalReviewStatus,
      personalizationLevel: educationLayer.personalizationLevel,
      conflictResolutions: educationLayer.conflictResolutions,
      // Protocol engine metadata — for client transparency and debugging
      protocolEngine: {
        activeProtocolIds,
        activeProtocolEvidence,
        conflictLog,
        childProfileId: childProfileId ?? null,
        profileLoaded: childProfileInput !== null,
      },
      resolverMeta,
      // Image generation context — resolver-derived, drives photo texture + presentation
      resolverContext,
    });
  } catch (err: any) {
    console.error("[MyPerfectBeginning] create-dish error:", err);
    return res.status(500).json({ error: "Failed to generate recipe" });
  }
});

export default router;
