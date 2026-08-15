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
  type SubstitutionRule,
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

// ── Allergen key normalizer ───────────────────────────────────────────────────
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
      // substitutions for the SAME blocked ingredient — a functional substitute
      // preserves how the dish holds together, not just its compliance.
      //
      // Grouping rule: preference is per blocked-ingredient category, not
      // global.  Two rules that address different concerns (e.g. wheat flour
      // structure AND oat cross-contamination) must BOTH fire even when one is
      // role-aware and the other is not — suppressing the non-role-aware rule
      // would silently drop a safety directive.
      // Build the dish context string once per component for dishContextPattern checks.
      const dishContext = `${dishName} ${decomposition.dishForm ?? ""}`.toLowerCase();
      const matching = profile.rules.filter(rule =>
        componentMatchesTriggers(c, rule.triggers) &&
        (rule.dishContextPattern == null || rule.dishContextPattern.test(dishContext)),
      );
      // Group by blocked category; within each group prefer role-aware rules.
      const blockedGroups = new Map<string, SubstitutionRule[]>();
      for (const rule of matching) {
        if (!blockedGroups.has(rule.blocked)) blockedGroups.set(rule.blocked, []);
        blockedGroups.get(rule.blocked)!.push(rule);
      }
      const selected: SubstitutionRule[] = [];
      for (const group of blockedGroups.values()) {
        const roleAware = group.filter(r => r.functionalRole);
        selected.push(...(roleAware.length > 0 ? roleAware : group));
      }
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
    // Normalize the raw allergen string (e.g. "dairy (milk)", "cow's milk",
    // "egg whites") to the canonical key used in the lookup tables.  Falls back
    // to the raw form so already-canonical keys ("dairy", "egg") still work.
    const canonicalKey = normalizeAllergenKey(a) ?? a;
    const substitute = ALLERGEN_SUBSTITUTES[canonicalKey];
    const structuralRules = ALLERGEN_STRUCTURAL_RULES[canonicalKey] ?? [];
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
          const dedupeKey = `allergy|${canonicalKey}|${rule.blocked}|${c}`;
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
      // Component-match check uses the canonical key so that a component
      // containing "dairy" is matched when the raw allergen was "dairy (milk)".
      if (!c.toLowerCase().includes(canonicalKey)) continue;
      const dedupeKey = `allergy|${canonicalKey}|${c}`;
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
  // Gluten/wheat/celiac allergy activates the gluten-free substitution profile.
  // "celiac" always implies strict gluten-free requirements.
  // NOTE: do NOT match "oat" alone here — a pure oat allergy must avoid oats
  // entirely, not substitute them with certified gluten-free oats.  Phrasings
  // that imply celiac/gluten context (e.g. "celiac — oat sensitivity",
  // "gluten (oats)") are already caught by the "celiac" / "gluten" branches.
  if (activeAllergens.some(a => /gluten|wheat|celiac/i.test(a))) add("gluten-free");

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

/**
 * Map a free-text allergen string (e.g. "dairy (milk)", "cow's milk",
 * "egg whites") to the canonical key used in ALLERGEN_SUBSTITUTES and
 * ALLERGEN_STRUCTURAL_RULES via bidirectional substring matching.
 *
 * The approach mirrors the overridden-allergen comparison already used in
 * resolveConflicts (line ~185): `o.includes(a) || a.includes(o)`.  We
 * apply that same logic against every known canonical key and return the
 * longest (most specific) match so "dairy" beats "milk" when both appear
 * in a phrase like "dairy (milk)".
 *
 * Returns undefined when no canonical key matches (treated the same as an
 * unknown allergen — ALLERGEN_SUBSTITUTES lookup returns undefined and
 * ALLERGEN_STRUCTURAL_RULES lookup returns []).
 */
/**
 * Structural-equivalence aliases: when a substring match resolves to a key
 * that has NO structural rules, check this map first — the phrase may still
 * carry structural significance under a different canonical key.
 *
 * Example: "milk" has a generic substitute but no binder/setter rules;
 * "dairy" does.  A user who writes "cow's milk" means the same allergy, so
 * we promote the match to "dairy" so the cheesecake filling gets the correct
 * structural guidance.
 *
 * Add entries here only when the two keys share the same structural context
 * (i.e. removing one ingredient removes the same functional role as the other).
 */
const STRUCTURAL_EQUIVALENTS: Record<string, string> = {
  milk: "dairy", // milk allergy ≡ dairy allergy from a binder/setter perspective
};

export function normalizeAllergenKey(allergen: string): string | undefined {
  // Collapse punctuation/parens/apostrophes to spaces so "dairy (milk)"
  // and "cow's milk" become plain token sequences.
  const a = allergen.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  // Gather every canonical key defined across both lookup tables.
  const canonicalKeys = Array.from(
    new Set([
      ...Object.keys(ALLERGEN_STRUCTURAL_RULES),
      ...Object.keys(ALLERGEN_SUBSTITUTES),
    ]),
  );
  // Exact match (fast path — catches already-canonical inputs like "dairy").
  if (canonicalKeys.includes(a)) return a;
  // Bidirectional substring match.
  const matches = canonicalKeys.filter(k => a.includes(k) || k.includes(a));
  if (matches.length === 0) return undefined;
  // Prefer keys that have structural rules (binder/setter guidance) — a
  // phrase like "dairy (milk)" matches both "dairy" and "milk" but only
  // "dairy" carries functional role guidance.  Similarly, "whole eggs"
  // matches both "egg" and "eggs" but only "egg" has structural rules.
  const structuralMatches = matches.filter(
    k => (ALLERGEN_STRUCTURAL_RULES[k]?.length ?? 0) > 0,
  );
  if (structuralMatches.length > 0) {
    // Among structural candidates, return the longest (most specific).
    return structuralMatches.sort((x, y) => y.length - x.length)[0];
  }
  // No structural match found — return the longest plain match, but first
  // check whether a structural-equivalence alias can promote it (e.g. "milk"
  // → "dairy" so that "cow's milk" still gets the cheesecake setter guidance).
  const longestMatch = matches.sort((x, y) => y.length - x.length)[0];
  return STRUCTURAL_EQUIVALENTS[longestMatch] ?? longestMatch;
}
