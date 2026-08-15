/**
 * Dish Adaptation Layer (DAL) — Phase 3.
 * Architecture: docs/dish-adaptation-layer/ARCHITECTURE.md
 *
 * HARD INVARIANT: the system may never silently substitute a different meal.
 * The DAL enriches generation prompts with an identity anchor plus explicit,
 * guardrail-derived adaptation directives so the model adapts the requested
 * dish rather than replacing it. It never relaxes any medical constraint.
 *
 * No hardcoded dish table: dish decomposition comes from one fast gpt-4o-mini
 * structured-reasoning call (temp 0, max_tokens 200, JSON), cached in an LRU
 * (max 500, 24h TTL) keyed by hash(dishName + sorted guardrail IDs).
 * Substitutions come from the guardrail substitution map extracted from the
 * existing prompt builders (Phase 2).
 */

import crypto from "crypto";
import OpenAI from "openai";
import {
  GUARDRAIL_SUBSTITUTION_MAP,
  ALLERGEN_SUBSTITUTES,
  ALLERGEN_STRUCTURAL_RULES,
  type GuardrailId,
} from "../../../shared/dishAdaptation/guardrailSubstitutionMap";
import type {
  ActiveGuardrail,
  CallContext,
  ConflictResolution,
  DishAdaptationDirective,
  GuardrailContext,
} from "./types";
import { LruTtlCache } from "./dishAdaptationCache";

export type { DishAdaptationDirective, GuardrailContext, CallContext } from "./types";

// ── OpenAI (lazy singleton, same pattern as unifiedMealPipeline) ────────────
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

interface DishDecomposition {
  definingComponents: string[];
  adaptableComponents: string[];
  /** Physical structure / presentation format, e.g. "sliceable baked cake with crust". */
  dishForm?: string;
}

// Cache stores the decomposition + resolved conflicts (context-independent core).
// The adaptationBlock is rendered per call because first_pass and fallback differ.
interface CachedCore {
  decomposition: DishDecomposition;
  conflicts: ConflictResolution[];
}

const dalCache = new LruTtlCache<CachedCore>(500, 24 * 60 * 60 * 1000);

/** Exposed for tests/proof scripts only. */
export function _clearDalCache(): void {
  dalCache.clear();
}
/** Exposed for tests/proof scripts only — counts real LLM decomposition calls. */
export let _decompositionLlmCalls = 0;

function normalizeDishName(dish: string): string {
  // Strip any injected bracketed override blocks and collapse whitespace
  return dish
    .replace(/\[[^\]]*\]/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cacheKey(dish: string, guardrails: ActiveGuardrail[]): string {
  const ids = guardrails.map(g => g.id).sort().join(",");
  return crypto.createHash("sha256").update(`${normalizeDishName(dish)}|${ids}`).digest("hex");
}

// ── Dish decomposition (single fast structured-reasoning call) ──────────────
async function decomposeDish(requestedDish: string): Promise<DishDecomposition | null> {
  const prompt = `You are a culinary analyst. For the dish "${requestedDish}", identify:
1. The 3-5 components that define its identity (changing these makes it a different dish)
2. The 3-5 components that can be adapted without losing the dish identity
3. The physical form and presentation format of the dish — the structure that makes it this dish and not another (e.g. "sliceable baked cake with crust", "stew/broth-based", "sandwich on bread", "layered parfait in a glass")

Return JSON only:
{
  "definingComponents": ["..."],
  "adaptableComponents": ["..."],
  "dishForm": "..."
}`;

  try {
    _decompositionLlmCalls++;
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 200,
      response_format: { type: "json_object" },
    });
    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    const defining = Array.isArray(parsed.definingComponents)
      ? parsed.definingComponents.filter((c: unknown) => typeof c === "string").slice(0, 5)
      : [];
    const adaptable = Array.isArray(parsed.adaptableComponents)
      ? parsed.adaptableComponents.filter((c: unknown) => typeof c === "string").slice(0, 5)
      : [];
    if (defining.length === 0) return null;
    const dishForm = typeof parsed.dishForm === "string" && parsed.dishForm.trim().length > 0
      ? parsed.dishForm.trim().slice(0, 200)
      : undefined;
    return { definingComponents: defining, adaptableComponents: adaptable, dishForm };
  } catch (err) {
    console.warn(`[DAL] Dish decomposition failed for "${requestedDish}":`, err);
    return null;
  }
}

// ── Conflict resolution (cross-reference components × substitution map) ─────
function componentMatchesTriggers(component: string, triggers: string[]): boolean {
  const c = component.toLowerCase();
  return triggers.some(t => {
    // Word-boundary match with optional trailing 's' for plurals.
    // e.g. trigger "egg" matches "eggs" and "large eggs" but NOT "eggplant"
    // (no word boundary between "egg" and "plant" inside the compound word).
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}s?\\b`, "i").test(c)) return true;
    // Reverse direction: trigger phrase contains the component as a substring
    // (handles cases where the component name is more generic than the trigger).
    if (t.length >= 4 && t.includes(c)) return true;
    return false;
  });
}

export function resolveConflicts(
  dishName: string,
  decomposition: DishDecomposition,
  ctx: GuardrailContext,
): ConflictResolution[] {
  const conflicts: ConflictResolution[] = [];
  const seen = new Set<string>();
  // Adaptable components are the primary substitution surface; defining
  // components are also checked because a dish's format base (e.g. the
  // "rice-format base" of fried rice) can require substrate adaptation
  // while the format itself is preserved.
  const allComponents = [
    ...decomposition.adaptableComponents.map(c => ({ c, defining: false })),
    ...decomposition.definingComponents.map(c => ({ c, defining: true })),
  ];

  for (const g of ctx.guardrails) {
    const profile = GUARDRAIL_SUBSTITUTION_MAP[g.id];
    if (!profile) continue;
    for (const { c, defining } of allComponents) {
      // Collect every rule this component triggers, then bias toward
      // role-aware rules: if any matching rule knows the ingredient's
      // structural function (binder, setter, …), it wins over generic
      // substitutions for the same component — a functional substitute
      // preserves how the dish holds together, not just its compliance.
      // Build the dish context string once per component for dishContextPattern checks.
      const dishContext = `${dishName} ${decomposition.dishForm ?? ""}`.toLowerCase();
      const matching = profile.rules.filter(rule =>
        componentMatchesTriggers(c, rule.triggers) &&
        (rule.dishContextPattern == null || rule.dishContextPattern.test(dishContext)),
      );
      const roleAware = matching.filter(rule => rule.functionalRole);
      const selected = roleAware.length > 0 ? roleAware : matching;
      for (const rule of selected) {
        const dedupeKey = `${g.id}|${rule.blocked}|${c}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        const preserve = defining
          ? ` Preserve the format and role of this component — adapt only its substrate.`
          : "";
        const roleReq = rule.functionalRole && rule.roleRequirement
          ? ` FUNCTIONAL REQUIREMENT (${rule.functionalRole}): ${rule.roleRequirement}.`
          : "";
        conflicts.push({
          component: c,
          guardrail: `${profile.label}: no ${rule.blocked}`,
          directive: `Use ${rule.substitute}.${rule.note ? ` (${rule.note})` : ""}${roleReq}${preserve} The dish is still ${dishName}.`,
          functionalRole: rule.functionalRole,
          roleRequirement: rule.roleRequirement,
        });
      }
    }
  }

  // Active (non-overridden) allergens with known substitutes that collide
  // with dish components. Overridden allergens are deliberately NOT added —
  // the user has authenticated permission to include them.
  const overridden = (ctx.overriddenAllergens ?? []).map(a => a.toLowerCase());
  for (const allergen of ctx.activeAllergens ?? []) {
    const a = allergen.toLowerCase();
    if (overridden.some(o => o.includes(a) || a.includes(o))) continue;
    const substitute = ALLERGEN_SUBSTITUTES[a];
    const structuralRules = ALLERGEN_STRUCTURAL_RULES[a] ?? [];
    if (!substitute && structuralRules.length === 0) continue;
    for (const { c } of allComponents) {
      // Role-aware structural rules win over the generic allergen substitute —
      // an allergy that removes a binder/setter needs a functional substitute,
      // not just a compliant one (same bias as the guardrail path above).
      const matchingStructural = structuralRules.filter(rule =>
        componentMatchesTriggers(c, rule.triggers),
      );
      if (matchingStructural.length > 0) {
        for (const rule of matchingStructural) {
          const dedupeKey = `allergy|${a}|${rule.blocked}|${c}`;
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);
          const roleReq = rule.functionalRole && rule.roleRequirement
            ? ` FUNCTIONAL REQUIREMENT (${rule.functionalRole}): ${rule.roleRequirement}.`
            : "";
          conflicts.push({
            component: c,
            guardrail: `allergy: no ${allergen}`,
            directive: `Use ${rule.substitute}.${rule.note ? ` (${rule.note})` : ""}${roleReq} The dish is still ${dishName}.`,
            functionalRole: rule.functionalRole,
            roleRequirement: rule.roleRequirement,
          });
        }
        continue;
      }
      if (!substitute) continue;
      if (!c.toLowerCase().includes(a)) continue;
      const dedupeKey = `allergy|${a}|${c}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      conflicts.push({
        component: c,
        guardrail: `allergy: no ${allergen}`,
        directive: `Use ${substitute}. The dish is still ${dishName}.`,
      });
    }
  }

  return conflicts;
}

// ── Adaptation block rendering ───────────────────────────────────────────────
export function renderAdaptationBlock(
  dishName: string,
  decomposition: DishDecomposition,
  conflicts: ConflictResolution[],
  ctx: GuardrailContext,
  callContext: CallContext,
): string {
  const upperDish = dishName.toUpperCase();
  const lines: string[] = [
    `DISH IDENTITY — DO NOT CHANGE THE DISH:`,
    `The user has asked for: ${upperDish}`,
    `Defining components (must be preserved): ${decomposition.definingComponents.join("; ")}.`,
  ];
  if (decomposition.dishForm) {
    lines.push(
      `Physical form (must be preserved): ${decomposition.dishForm}. ` +
      `Do NOT convert the dish into a different format (e.g. parfait, bowl, mousse, smoothie, soup, bites) — keep this exact form.`,
    );
  }
  lines.push(`You are adapting ${dishName} — not replacing it.`);

  if (conflicts.length > 0) {
    lines.push(``, `REQUIRED ADAPTATIONS for this user's profile:`);
    for (const c of conflicts) {
      lines.push(`- ${c.component} → ${c.directive} [${c.guardrail}]`);
    }
  }

  // Structural integrity — when a substitution touches an ingredient with a
  // known structural function, the substitute must perform the same function,
  // not just satisfy the restriction.
  const roleConflicts = conflicts.filter(c => c.functionalRole && c.roleRequirement);
  if (roleConflicts.length > 0) {
    lines.push(``, `STRUCTURAL INTEGRITY — the substitutes must perform the same function as what they replace:`);
    for (const c of roleConflicts) {
      lines.push(`- ${c.component} (${c.functionalRole}): ${c.roleRequirement}.`);
    }
    lines.push(
      `Every structural substitute must ALSO comply with every other restriction and allergy listed above — never use an ingredient blocked by another rule to satisfy a structural role.`,
      `A substitution that satisfies the restriction but breaks the dish's structure (a filling that doesn't set, a crust that crumbles) is a FAILED adaptation.`,
    );
  }

  const generals = ctx.guardrails
    .flatMap(g => GUARDRAIL_SUBSTITUTION_MAP[g.id]?.generalDirectives ?? []);
  if (generals.length > 0) {
    lines.push(``, `ADDITIONAL PROTOCOL RULES (do not relax):`);
    for (const d of generals) lines.push(`- ${d}`);
  }

  lines.push(
    ``,
    `WHAT MAKES THIS STILL ${upperDish}:`,
    `${decomposition.definingComponents.join(", ")} — with the adaptations above applied.`,
  );

  if (callContext === "fallback") {
    lines.push(
      ``,
      `DO NOT return a generic protein plate. DO NOT return a different dish that merely satisfies the constraints. ` +
      `Every adaptation needed to make ${dishName} compliant is listed above — apply them and return ${dishName}.`,
    );
  }

  return lines.join("\n");
}

// ── Guardrail context builder (helper for routes/pipelines) ─────────────────
export function buildGuardrailContext(opts: {
  /** protocolEnvelope.dietaryIdentity or merged diet restrictions */
  dietaryIdentity?: string[];
  glp1Active?: boolean;
  allergies?: string[];
  overriddenAllergens?: string[];
  /** kosher category intent when known ("meat" activates kosher-meat rules) */
  kosherCategory?: string | null;
}): GuardrailContext {
  const identity = (opts.dietaryIdentity ?? []).map(d => d.toLowerCase());
  const guardrails: ActiveGuardrail[] = [];
  const add = (id: GuardrailId) => {
    if (!guardrails.some(g => g.id === id)) {
      guardrails.push({ id, label: GUARDRAIL_SUBSTITUTION_MAP[id].label });
    }
  };

  for (const d of identity) {
    if (d.includes("diabet")) add("diabetic");
    if (d === "glp1" || d.includes("glp-1")) add("glp1");
    if (d.includes("gluten")) add("gluten-free");
    if (d.includes("kidney") || d.includes("renal") || d.includes("ckd")) add("kidney-disease");
    if (d.includes("oncology") || d.includes("cancer")) add("oncology-support");
    if (d.includes("anti-inflammatory") || d.includes("antiinflammatory")) add("anti-inflammatory");
    if (d === "vegan") add("vegan");
    if (d === "vegetarian") add("vegetarian");
    if (d === "pescatarian") add("pescatarian");
    if (d.includes("lower-sugar") || d.includes("low-sugar") || d.includes("low sugar")) add("lower-sugar");
  }
  if (opts.glp1Active) add("glp1");
  if (opts.kosherCategory === "meat" && identity.some(d => d.includes("kosher"))) add("kosher-meat");

  const overridden = (opts.overriddenAllergens ?? []).map(a => a.toLowerCase());
  const activeAllergens = (opts.allergies ?? []).filter(
    a => !overridden.some(o => o.includes(a.toLowerCase()) || a.toLowerCase().includes(o)),
  );
  // Gluten/wheat allergy activates the gluten-free substitution profile.
  if (activeAllergens.some(a => /gluten|wheat/i.test(a))) add("gluten-free");

  return {
    guardrails,
    activeAllergens,
    overriddenAllergens: opts.overriddenAllergens,
  };
}

// ── Main entry point ─────────────────────────────────────────────────────────
/**
 * Build (or fetch from cache) the DishAdaptationDirective for a requested dish
 * under the user's active guardrails.
 *
 * Returns null only when dish decomposition fails entirely — callers proceed
 * without enrichment in that case (generation is not blocked; the identity
 * validator still runs downstream, so a silently-substituted dish is still
 * caught and rejected).
 */
export async function getDishAdaptationDirective(
  requestedDish: string,
  activeGuardrails: GuardrailContext,
  callContext: CallContext,
): Promise<DishAdaptationDirective | null> {
  const dishName = normalizeDishName(requestedDish);
  if (!dishName) return null;

  const key = cacheKey(requestedDish, activeGuardrails.guardrails);
  let core = dalCache.get(key);

  if (!core) {
    const decomposition = await decomposeDish(dishName);
    if (!decomposition) return null;
    const conflicts = resolveConflicts(dishName, decomposition, activeGuardrails);
    core = { decomposition, conflicts };
    dalCache.set(key, core);
    console.log(
      `🍽️ [DAL] "${dishName}" decomposed — defining: [${decomposition.definingComponents.join(" | ")}], ` +
      `adaptable: [${decomposition.adaptableComponents.join(" | ")}], ` +
      `${core.conflicts.length} guardrail conflict(s) resolved (guardrails: ${activeGuardrails.guardrails.map(g => g.id).join(",") || "none"})`,
    );
  } else {
    console.log(`🍽️ [DAL] Cache hit for "${dishName}" (${callContext})`);
  }

  return {
    identityAnchor: `This IS ${dishName}. Do not change the dish.`,
    definingComponents: core.decomposition.definingComponents,
    adaptableComponents: core.decomposition.adaptableComponents,
    dishForm: core.decomposition.dishForm,
    conflicts: core.conflicts,
    adaptationBlock: renderAdaptationBlock(
      dishName,
      core.decomposition,
      core.conflicts,
      activeGuardrails,
      callContext,
    ),
  };
}
