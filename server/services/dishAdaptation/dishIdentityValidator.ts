/**
 * Dish Identity Validator — Phase 4.
 * Architecture: docs/dish-adaptation-layer/ARCHITECTURE.md
 *
 * Given the requested dish and a generated meal, answers: is this still the
 * dish the user asked for? Fast rule-based checks only (no LLM):
 *  1. Name check — is the meal name recognizably the requested dish?
 *  2. Defining-component check — do the meal's ingredients/description include
 *     representatives of the DAL's defining components?
 *  3. Catastrophic-deviation check — no name relation AND essentially no
 *     defining components present = a completely different dish.
 *
 * No hardcoded dish tables: all dish knowledge comes from the requested dish
 * string and the DAL decomposition passed in.
 */

import type { DishAdaptationDirective, DishIdentityResult } from "./types";

export type { DishIdentityResult } from "./types";

export interface GeneratedMealLike {
  name?: string;
  description?: string;
  ingredients?: Array<{ name?: string; item?: string } | string>;
  instructions?: string | string[];
}

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "with", "of", "in", "on", "for", "to", "some",
  "something", "style", "dish", "meal", "please", "like", "craving", "really",
  "want", "i", "me", "my", "delicious", "tasty", "good", "nice", "healthy",
  "friendly", "low", "high", "free", "less", "more", "very",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length >= 3 && !STOPWORDS.has(t));
}

/** Loose stem match: exact, or the haystack contains a word that starts with
 *  the token's 4-char stem AND whose full length is within 1.2× the token's
 *  length. The length guard prevents compound-word false positives such as
 *  "cheese" (stem "chees") matching "cheesecake", or "crust" (stem "crus")
 *  matching "crushed". */
function tokenMatches(token: string, haystackTokens: Set<string>, haystackText: string): boolean {
  if (haystackTokens.has(token)) return true;
  const stem = token.slice(0, Math.max(4, token.length - 2));
  if (stem.length >= 4) {
    const maxMatchLen = Math.ceil(token.length * 1.2);
    const wordPattern = new RegExp(`\\b${stem}[a-z]*`, "gi");
    const matched = haystackText.match(wordPattern) ?? [];
    if (matched.some(w => w.length <= maxMatchLen)) return true;
  }
  return false;
}

// ── Physical-form families ───────────────────────────────────────────────────
// A dish that keeps its name but arrives in a different physical format
// (cheesecake → parfait, stew → soup, sandwich → bowl) is NOT the requested
// dish. Families are mutually exclusive presentation formats; keywords are
// matched on word boundaries.
//
// When adding keywords, keep them tightly scoped: a keyword in this table will
// flag ANY generated meal whose NAME contains it as a foreign format for any
// dish that doesn't also include that keyword in its own name. Prefer multi-word
// keywords over single words that appear in legitimate ingredient names.
const FORM_FAMILIES: Record<string, string[]> = {
  "baked-cake": [
    "cake", "cheesecake", "pie", "tart", "tartlet", "torte", "crust",
    "brownie", "brownies", "galette", "clafoutis",
  ],
  "layered-cup": ["parfait", "parfaits", "trifle", "verrine", "verrines", "shooter", "shooters"],
  "mousse-pudding": [
    "mousse", "pudding", "custard", "flan", "panna cotta",
    "semifreddo", "fool", "syllabub",
  ],
  "frozen": [
    "sorbet", "popsicle", "popsicles", "ice cream", "nice cream",
    "frozen yogurt", "gelato", "granita", "icebox",
  ],
  "drink": ["smoothie", "shake", "milkshake", "juice", "latte", "drinkable"],
  "bites": ["bites", "balls", "truffles", "bars", "poppers"],
  // "deconstructed" is always a form-collapse escape: serving separate components
  // of a dish is not the same as serving the dish, regardless of naming.
  "deconstructed": ["deconstructed"],
  "bowl": ["bowl", "bowls"],
  "soup": ["soup", "broth", "bisque", "chowder", "brothy"],
  "stew": ["stew", "braise", "braised", "gumbo", "goulash", "chili"],
  "sandwich": ["sandwich", "burger", "sub", "hoagie", "panini", "sliders", "bread"],
  "wrap": ["wrap", "wraps", "burrito", "roll-up", "rollup"],
  "salad": ["salad"],
  "casserole": ["casserole", "gratin", "bake"],
};

function normalizeFormText(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
}

function detectFormFamilies(text: string): Set<string> {
  const t = normalizeFormText(text);
  const found = new Set<string>();
  for (const [family, keywords] of Object.entries(FORM_FAMILIES)) {
    if (keywords.some(k => t.includes(` ${k} `))) found.add(family);
  }
  return found;
}

/**
 * Primary form family of a free-form description: the family whose keyword
 * appears EARLIEST in the text. Free-form dishForm strings often mention
 * structural descriptors of other families ("stew/broth-based" mentions
 * "broth"; "sandwich on bread" mentions "bread") — those must not become
 * independently allowed presentation formats, or a stew could legally arrive
 * as a soup. The leading word names the actual format.
 */
function detectPrimaryFormFamily(text: string): string | null {
  const t = normalizeFormText(text);
  let best: { family: string; index: number } | null = null;
  for (const [family, keywords] of Object.entries(FORM_FAMILIES)) {
    for (const k of keywords) {
      const idx = t.indexOf(` ${k} `);
      if (idx >= 0 && (!best || idx < best.index)) best = { family, index: idx };
    }
  }
  return best?.family ?? null;
}

function mealFullText(meal: GeneratedMealLike): string {
  const ingredients = (meal.ingredients ?? [])
    .map(i => (typeof i === "string" ? i : `${i?.name ?? ""} ${i?.item ?? ""}`))
    .join(" ");
  const instructions = Array.isArray(meal.instructions)
    ? meal.instructions.join(" ")
    : (meal.instructions ?? "");
  return `${meal.name ?? ""} ${meal.description ?? ""} ${ingredients} ${instructions}`.toLowerCase();
}

/**
 * Validate that a generated meal is still the requested dish.
 *
 * @param requestedDish  the user's dish request (craving input)
 * @param meal           the generated meal
 * @param directive      DAL directive when available — enables the
 *                       defining-component check. Without it, only the name
 *                       check runs (score is name-based).
 */
export function validateDishIdentity(
  requestedDish: string,
  meal: GeneratedMealLike,
  directive?: DishAdaptationDirective | null,
): DishIdentityResult {
  const failures: string[] = [];
  const dishTokens = tokenize(requestedDish);
  const mealName = (meal.name ?? "").toLowerCase();
  const mealNameTokens = new Set(tokenize(mealName));
  const fullText = mealFullText(meal);
  const fullTextTokens = new Set(tokenize(fullText));

  // ── 1. Name check ──────────────────────────────────────────────────────
  let nameScore = 1;
  if (dishTokens.length > 0) {
    const matched = dishTokens.filter(t => tokenMatches(t, mealNameTokens, mealName));
    nameScore = matched.length / dishTokens.length;
    if (nameScore === 0) {
      failures.push(
        `meal name "${meal.name ?? "(unnamed)"}" is not recognizably "${requestedDish}"`,
      );
    }
  }

  // ── 2. Defining-component check ────────────────────────────────────────
  let componentScore = 1;
  const defining = directive?.definingComponents ?? [];
  if (defining.length > 0) {
    let matchedComponents = 0;
    for (const component of defining) {
      const keywords = tokenize(component);
      const present = keywords.length === 0 ||
        keywords.some(k => tokenMatches(k, fullTextTokens, fullText));
      if (present) {
        matchedComponents++;
      } else {
        failures.push(`no representative of defining component "${component}" found in the generated meal`);
      }
    }
    componentScore = matchedComponents / defining.length;
  }

  // ── 3. Physical-form check ─────────────────────────────────────────────
  // A model that cannot solve a constraint can escape by converting the dish
  // into a different physical format while keeping the name ("Strawberry
  // Cheesecake Parfait"). Allowed form families come from the requested dish
  // name plus the DAL's dishForm; the generated meal's form is read from its
  // NAME only (descriptions/instructions legitimately mention bowls, breads,
  // etc.). Any name-level form family outside the allowed set is a mismatch.
  // Allowed families: union from the requested dish NAME (legitimate hybrids
  // like "chicken soup bowl" keep both), plus at most ONE primary family from
  // the free-form dishForm — never every family whose descriptor it mentions.
  //
  // NATURALISTIC DISHFORM PROTECTION: When dishForm is provided but contains
  // no recognized FORM_FAMILIES keyword (e.g. "crispy coated chicken pieces"
  // or "spiced sauce with chicken over rice"), the allowed set is empty yet
  // the form directive is still active. In that case the check runs in
  // "open" mode: any form-family keyword found in the generated meal name is
  // treated as a foreign escape, because the dish has no recognized format of
  // its own that could overlap with it.
  const dishForm = directive?.dishForm;
  const allowedForms = detectFormFamilies(requestedDish);
  if (dishForm) {
    const primary = detectPrimaryFormFamily(dishForm);
    if (primary) allowedForms.add(primary);
  }
  // Form check is active when there are explicit allowed forms OR when a
  // dishForm directive is present (even if it maps to no recognized family).
  const hasFormDirective = !!dishForm;
  const formCheckActive = allowedForms.size > 0 || hasFormDirective;
  let formMismatch = false;
  if (formCheckActive) {
    const generatedForms = detectFormFamilies(mealName);
    // In open mode (no recognized allowed family) every generated form is foreign.
    const foreign = allowedForms.size > 0
      ? Array.from(generatedForms).filter(f => !allowedForms.has(f))
      : Array.from(generatedForms);
    if (foreign.length > 0) {
      formMismatch = true;
      failures.push(
        `form mismatch: "${requestedDish}" must be ${dishForm ?? `a ${Array.from(allowedForms).join("/")} format`}, ` +
        `but the generated meal "${meal.name ?? "(unnamed)"}" is a different format (${foreign.join(", ")})`,
      );
    }
  }

  // ── 3b. Description lead-sentence form check ────────────────────────────
  // A model may name the dish correctly ("Strawberry Cheesecake") but reveal
  // the true physical format in the opening description ("A creamy parfait
  // with cheesecake-inspired layers…"). This check scans the first 80 chars
  // of the description for foreign form families.
  //
  // Suppression rule 1 — container/vessel signal: if a foreign form keyword
  // is immediately preceded by "in a bowl", "into a glass", "with a cup", etc.,
  // it is a preparation or serving note — not the food's own format — and is
  // ignored. Prevents false positives like "Serve each slice in a bowl."
  //
  // Suppression rule 2 — ingredient-modifier suffix: if a foreign form keyword
  // is immediately followed by a culinary modifier noun ("sauce", "powder",
  // "paste", …), the keyword is acting as an adjective describing an ingredient
  // (e.g. "chili sauce", "chili powder", "soup dumplings") rather than
  // declaring the dish's format. Prevents false positives from dishes whose
  // defining ingredients carry a form-family word.
  if (!formMismatch && formCheckActive && meal.description) {
    const lead = meal.description.slice(0, 80).toLowerCase();
    const leadFamilies = detectFormFamilies(lead);
    const foreignInLead = Array.from(leadFamilies).filter(f => !allowedForms.has(f));
    if (foreignInLead.length > 0) {
      const CONTAINER_SIGNALS = [
        "in a ", "in an ", "into a ", "into an ",
        "using a ", "with a ", "with an ",
        "inside a ", "inside an ", "from a ",
      ];
      // Words that, when immediately following a form keyword, signal it is
      // modifying an ingredient rather than declaring the dish's own format.
      // Keep this list to unambiguous culinary descriptor/ingredient suffixes;
      // do NOT add food categories or dish names here.
      const INGREDIENT_MODIFIER_SUFFIXES = new Set([
        "sauce", "powder", "paste", "flakes", "seasoning", "marinade",
        "spice", "spices", "rub", "oil", "extract", "base", "stock",
        "broth", "dumpling", "dumplings", "noodle", "noodles", "pepper",
        "peppers",
      ]);
      // Families whose keywords double as common preparation verbs ("bake", "gratin")
      // are skipped in the description check to prevent false positives from
      // instructions like "Bake until set." They remain active for the name check.
      const DESCRIPTION_SKIP_FAMILIES = new Set(["casserole"]);
      // Normalize the lead for index lookup so punctuation boundaries
      // (e.g. "bowl." vs. " bowl ") don't prevent container-signal detection.
      const normLead = ` ${lead.replace(/[^a-z0-9]+/g, " ")} `;
      const genuineForms = foreignInLead.filter(family => {
        if (DESCRIPTION_SKIP_FAMILIES.has(family)) return false;
        // A family is genuine only when at least one keyword occurrence in the
        // lead is not individually suppressed. We iterate ALL occurrences of
        // each keyword so that an earlier suppressed occurrence (e.g. "chili
        // powder") cannot mask a later genuine one (e.g. "hearty chili with").
        return FORM_FAMILIES[family].some(keyword => {
          const normKeyword = keyword.replace(/[^a-z0-9]+/g, " ");
          const searchToken = ` ${normKeyword} `;
          let searchFrom = 0;
          while (true) {
            const idx = normLead.indexOf(searchToken, searchFrom);
            if (idx < 0) break;
            // Suppression rule 1: container/vessel signal before the keyword.
            const before = normLead.slice(Math.max(0, idx - 25), idx + 1);
            const suppressedByContainer = CONTAINER_SIGNALS.some(s => before.includes(s));
            // Suppression rule 2: ingredient-modifier suffix immediately after.
            const afterStart = idx + 1 + normKeyword.length + 1;
            const firstWordAfter = normLead.slice(afterStart).split(" ")[0];
            const suppressedByModifier = !!(firstWordAfter && INGREDIENT_MODIFIER_SUFFIXES.has(firstWordAfter));
            if (!suppressedByContainer && !suppressedByModifier) {
              return true; // genuine occurrence found
            }
            searchFrom = idx + searchToken.length;
          }
          return false; // all occurrences suppressed
        });
      });
      if (genuineForms.length > 0) {
        formMismatch = true;
        failures.push(
          `form mismatch in description: "${requestedDish}" is a ${Array.from(allowedForms).join("/")} format, ` +
          `but the description reveals a different format (${genuineForms.join(", ")})`,
        );
      }
    }
  }

  // ── 4. Catastrophic-deviation check ────────────────────────────────────
  // Completely wrong culinary result: the name bears no relation to the
  // requested dish AND the defining components are essentially absent.
  // With no directive (no decomposition available), require the dish name to
  // also be absent from the full meal text before calling it catastrophic.
  const nameInBody = dishTokens.some(t => tokenMatches(t, fullTextTokens, fullText));
  const catastrophicDeviation = formMismatch || (defining.length > 0
    ? nameScore === 0 && componentScore < 0.34
    : nameScore === 0 && !nameInBody);

  if (catastrophicDeviation) {
    failures.push(
      `catastrophic deviation: generated meal is from a different culinary category than "${requestedDish}"`,
    );
  }

  const score = defining.length > 0
    ? Math.round((0.5 * nameScore + 0.5 * componentScore) * 100) / 100
    : nameScore;

  // Passed = recognizably the dish: either the name carries it, or the name
  // was legitimately transformed (e.g. "Cajun Cauliflower Rice Stew") but the
  // defining components are clearly present.
  const passed = !catastrophicDeviation && (nameScore > 0 ? score >= 0.5 : componentScore >= 0.67);

  return { passed, score, failures, catastrophicDeviation, dishForm, formMismatch };
}
