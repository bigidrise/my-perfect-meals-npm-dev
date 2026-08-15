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

// Cache stores ONLY the dish decomposition — the context-independent result of
// the LLM structured-reasoning call.  Conflict resolution depends on the full
// GuardrailContext (guardrail IDs + activeAllergens + overriddenAllergens) which
// varies per user and per request, so it is intentionally NOT cached here.
// Caching conflicts alongside the decomposition would mean a dish warmed by one
// user's context could silently serve (or omit) allergen directives to another.
interface CachedCore {
  decomposition: DishDecomposition;
}

const dalCache = new LruTtlCache<CachedCore>(500, 24 * 60 * 60 * 1000);

/** Exposed for tests/proof scripts only. */
export function _clearDalCache(): void {
  dalCache.clear();
}
/** Exposed for tests/proof scripts only — counts real LLM decomposition calls. */
export let _decompositionLlmCalls = 0;

/**
 * Exposed for tests only — pre-populates the decomposition cache so end-to-end
 * `getDishAdaptationDirective` tests can run without a live LLM call.
 */
export function _setDecompositionForTest(
  dishName: string,
  decomposition: DishDecomposition,
): void {
  const key = decompositionCacheKey(normalizeDishName(dishName));
  dalCache.set(key, { decomposition });
}
function normalizeDishName(dish: string): string {
  // Strip any injected bracketed override blocks and collapse whitespace
  return dish
    .replace(/\[[^\]]*\]/g, " ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Cache key for decomposition — dish-name only (guardrails/allergens not included). */
function decompositionCacheKey(normalizedDish: string): string {
  return crypto.createHash("sha256").update(normalizedDish).digest("hex");
}
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

// ── Allergen-safe directive sanitization ──────────────────────────────────────
/**
 * Guardrail-path substitutes can name ingredients that are unsafe when the
 * user has an active allergen that overlaps with the recommended substitute.
 * For example, the gluten-free profile recommends "tamari or coconut aminos"
 * for soy sauce, but tamari is a soy-derived product — unsafe for soy-allergic
 * users.  Similarly, "certified gluten-free oats" is still oat-containing —
 * unsafe for oat-allergic users.
 *
 * Rules are tested against raw (lowercase) active allergen strings so they
 * work even for allergens without a canonical key in the lookup tables (e.g.
 * "oat allergy" — "oat" is not in ALLERGEN_SUBSTITUTES, but the /\boat\b/i
 * test still catches it).
 *
 * Rules are applied in order; earlier rules should remove the longest/most
 * specific phrase first so later fallback rules don't double-replace.
 */
const DIRECTIVE_SANITIZE_RULES: Array<{
  /**
   * Predicate tested against each active allergen string (lowercase). Fires
   * when ANY allergen in the list satisfies it. Uses a function (not a plain
   * RegExp) so complex conditions — like "contains soy but NOT gluten" — can
   * be expressed without a second pass.
   */
  allergenTest: (lowerAllergen: string) => boolean;
  /** Unsafe phrase pattern to replace within the directive string. */
  directivePattern: RegExp;
  /** Replacement text (empty string to delete the phrase). */
  safeReplacement: string;
}> = [
  // Tamari is soy-derived — unsafe when a soy restriction is active.
  //
  // The allergenTest intentionally excludes strings that also contain "gluten"
  // or "celiac" (e.g. "soy sauce (gluten)").  A user who enters that phrasing
  // is worried about gluten in soy sauce, not soy protein — tamari is
  // gluten-free and safe for them.  Only a standalone soy restriction (e.g.
  // "soy allergy", "soy sauce allergy", "celiac" as a separate allergen entry
  // + "soy" as another entry) triggers the tamari removal.
  //
  // Remove "tamari or " first (leaves the safe option), then handle lone tamari.
  { allergenTest: a => /\bsoy\b/i.test(a) && !/gluten|celiac/i.test(a), directivePattern: /tamari\s+or\s+/gi,   safeReplacement: "" },
  { allergenTest: a => /\bsoy\b/i.test(a) && !/gluten|celiac/i.test(a), directivePattern: /\s+or\s+tamari\b/gi, safeReplacement: "" },
  { allergenTest: a => /\bsoy\b/i.test(a) && !/gluten|celiac/i.test(a), directivePattern: /\btamari\b/gi,        safeReplacement: "coconut aminos" },
  // Certified GF oats still contain oats — unsafe when a genuine oat allergy
  // or oat sensitivity is active (e.g. "oat allergy", "oat sensitivity").
  //
  // The allergenTest excludes strings that also contain "celiac" or "gluten"
  // (e.g. "celiac — oat sensitivity", "gluten (oats)") because those phrasings
  // mean the user is worried about gluten contamination IN oats, not about oats
  // as an allergen themselves — certified GF oats remain the correct substitute
  // for celiac/gluten-focused users.  A standalone oat allergy (separate
  // allergen entry like "oat allergy" alongside "celiac") is still caught
  // because each entry is evaluated independently.
  {
    allergenTest: a => /\boat\b/i.test(a) && !/celiac|gluten/i.test(a),
    directivePattern: /\bcertified gluten-free oats\b/gi,
    safeReplacement: "quinoa flakes or rice flakes (oat-free)",
  },
  // The oat cross-contamination rule appends an explanatory note stating that
  // "only oats explicitly labelled certified gluten-free are safe" — for an
  // oat-allergic user, even certified GF oats are unsafe.  Strip the note
  // entirely so no positive oat-safety claim reaches the LLM.
  {
    allergenTest: a => /\boat\b/i.test(a) && !/celiac|gluten/i.test(a),
    directivePattern: /\s*\(standard oats are frequently cross-contaminated[^)]*\)/gi,
    safeReplacement: "",
  },
  // The gluten-free generalDirective "Oats must be explicitly certified
  // gluten-free…" is also unsafe for oat-allergic users (certified GF oats
  // still contain oats).  Replace it with an oat-free directive so the full
  // adaptation block — including generalDirectives — is safe.
  {
    allergenTest: a => /\boat\b/i.test(a) && !/celiac|gluten/i.test(a),
    directivePattern: /\bOats must be explicitly certified gluten-free[^.]*\./gi,
    safeReplacement: "Avoid all oats entirely — use quinoa flakes or rice flakes as an oat-free alternative.",
  },
];

/**
 * Rewrite a guardrail-path directive string in-place to remove or replace any
 * ingredient that is unsafe given the user's active allergens.
 * Called once per conflict before it is pushed to the list.
 */
function sanitizeDirectiveForAllergens(directive: string, activeAllergens: string[]): string {
  if (activeAllergens.length === 0) return directive;
  const lowerAllergens = activeAllergens.map(a => a.toLowerCase());
  let result = directive;
  for (const { allergenTest, directivePattern, safeReplacement } of DIRECTIVE_SANITIZE_RULES) {
    if (lowerAllergens.some(allergenTest)) {
      result = result.replace(directivePattern, safeReplacement);
    }
  }
  return result;
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
      // Collect every rule this component triggers, then apply role-aware
      // precedence:
      //
      // 1. Role-aware rules (functionalRole set) win over generic rules — a
      //    functional substitute preserves how the dish holds together, not
      //    just its compliance.  When any role-aware rule matches, generic
      //    rules are suppressed globally for this component.
      //
      // 2. alwaysEmit rules are an explicit exception: they address a concern
      //    orthogonal to structural roles (e.g. the oat cross-contamination
      //    rule addresses labelling, not structure) and must fire even
      //    alongside role-aware rules.  They are never suppressed.
      //
      // Build the dish context string once per component for dishContextPattern checks.
      const dishContext = `${dishName} ${decomposition.dishForm ?? ""}`.toLowerCase();
      const matching = profile.rules.filter(rule =>
        componentMatchesTriggers(c, rule.triggers) &&
        (rule.dishContextPattern == null || rule.dishContextPattern.test(dishContext)),
      );
      const roleAware    = matching.filter(r => r.functionalRole);
      const alwaysEmit   = matching.filter(r => r.alwaysEmit && !r.functionalRole);
      // When role-aware rules are present: emit them + alwaysEmit rules.
      // When not: emit everything (all rules are generic or alwaysEmit).
      const selected = roleAware.length > 0
        ? [...roleAware, ...alwaysEmit]
        : matching;
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
        // Sanitize before push: remove/replace any substitute ingredient that is
        // itself an active allergen (e.g. tamari for soy-allergic, certified GF
        // oats for oat-allergic) so the LLM never receives a contradictory directive.
        const directive = sanitizeDirectiveForAllergens(
          `Use ${rule.substitute}.${rule.note ? ` (${rule.note})` : ""}${roleReq}${preserve} The dish is still ${dishName}.`,
          ctx.activeAllergens ?? [],
        );
        conflicts.push({
          component: c,
          guardrail: `${profile.label}: no ${rule.blocked}`,
          directive,
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

  // Sanitize generalDirectives the same way per-component conflict directives
  // are sanitized: an oat-allergic user must not receive "Oats must be
  // certified gluten-free" in the adaptation block (certified GF oats still
  // contain oats).  Filter out any line that becomes an empty string after
  // sanitization so it doesn't produce a dangling bullet.
  const generals = ctx.guardrails
    .flatMap(g => GUARDRAIL_SUBSTITUTION_MAP[g.id]?.generalDirectives ?? [])
    .map(d => sanitizeDirectiveForAllergens(d, ctx.activeAllergens ?? []))
    .filter(d => d.trim().length > 0);
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
  // NOTE: "soy sauce allergy" phrasings do NOT activate this guardrail — soy
  // sauce is handled via the allergen substitution path (canonical key "soy" →
  // coconut aminos or hemp seeds) which avoids recommending tamari, itself a
  // soy product that is unsafe for soy-allergic users.
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

  // Decomposition is cached by dish name only — it is context-independent.
  // Conflict resolution runs per-request so allergen/guardrail changes are
  // always reflected even when the decomposition is served from cache.
  const key = decompositionCacheKey(dishName);
  let core = dalCache.get(key);

  if (!core) {
    const decomposition = await decomposeDish(dishName);
    if (!decomposition) return null;
    core = { decomposition };
    dalCache.set(key, core);
    console.log(
      `🍽️ [DAL] "${dishName}" decomposed — defining: [${decomposition.definingComponents.join(" | ")}], ` +
      `adaptable: [${decomposition.adaptableComponents.join(" | ")}]`,
    );
  } else {
    console.log(`🍽️ [DAL] Cache hit for "${dishName}" (${callContext})`);
  }

  // Resolve conflicts fresh for every request — allergens and overrides are
  // user-specific and must never be served from a shared decomposition cache.
  const conflicts = resolveConflicts(dishName, core.decomposition, activeGuardrails);

  console.log(
    `🍽️ [DAL] "${dishName}" — ${conflicts.length} conflict(s) resolved (guardrails: ${activeGuardrails.guardrails.map(g => g.id).join(",") || "none"}, allergens: ${activeGuardrails.activeAllergens?.join(",") || "none"})`,
  );

  return {
    identityAnchor: `This IS ${dishName}. Do not change the dish.`,
    definingComponents: core.decomposition.definingComponents,
    adaptableComponents: core.decomposition.adaptableComponents,
    dishForm: core.decomposition.dishForm,
    conflicts,
    adaptationBlock: renderAdaptationBlock(
      dishName,
      core.decomposition,
      conflicts,
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
