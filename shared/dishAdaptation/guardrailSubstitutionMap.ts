/**
 * Guardrail Substitution Map — Phase 2 of the Dish Adaptation Layer.
 *
 * Structured substitution data EXTRACTED from the existing guardrail prompt
 * builders and safety modules. This file does not invent substitutions — every
 * rule cites the source file it was extracted from. The prompt builders remain
 * the authority on what is blocked; this map exposes the same knowledge as
 * typed data so the Dish Adaptation Layer can cross-reference dish components
 * against it without parsing prompt text.
 *
 * Sources:
 *  - server/services/guardrails/prompt/diabeticPromptBuilder.ts (MANDATORY SUBSTITUTIONS blocks)
 *  - server/services/guardrails/prompt/glp1PromptBuilder.ts + rules/glp1Rules.ts
 *  - server/services/guardrails/prompt/kidneyDiseasePromptBuilder.ts (BANNED/USE groups)
 *  - server/services/guardrails/prompt/oncologySupportPromptBuilder.ts (upgrade/fresh-over-preserved rules)
 *  - server/services/guardrails/prompt/antiInflammatoryPromptBuilder.ts (red-meat default rule)
 *  - server/services/allergyGuardrails.ts (getSafeSubstitute + per-diet substitution maps)
 *  - server/services/protocolEnvelope.ts (gluten-free pairing guidance: tamari/coconut aminos)
 *  - server/services/unifiedMealPipeline.ts (kosher-meat dairy guard)
 */

export type GuardrailId =
  | "diabetic"
  | "lower-sugar"
  | "glp1"
  | "gluten-free"
  | "kidney-disease"
  | "oncology-support"
  | "anti-inflammatory"
  | "vegan"
  | "vegetarian"
  | "pescatarian"
  | "kosher-meat";

/**
 * Structural function an ingredient performs in the dish. Only set for
 * structurally critical ingredients where a naive swap can break the dish
 * (a filling that doesn't set, a crust that crumbles). When a role-tagged
 * rule matches a component, the DAL prefers it over generic rules for the
 * same component and injects the roleRequirement into the directive.
 */
export type FunctionalRole =
  | "binder"
  | "setter"
  | "binder/setter"
  | "structure"
  | "sweetener"
  | "fat/richness"
  | "fat/flakiness"
  | "leavening";

export interface SubstitutionRule {
  /** The blocked component/ingredient concept, e.g. "white rice". */
  blocked: string;
  /**
   * Lowercase trigger terms matched against a dish's adaptable/defining
   * components (substring match, both directions).
   */
  triggers: string[];
  /** The compliant substitute, phrased for direct prompt injection. */
  substitute: string;
  /** Optional preparation note. */
  note?: string;
  /**
   * Structural function this ingredient performs (binder, setter, etc.).
   * Only for structurally critical ingredients.
   */
  functionalRole?: FunctionalRole;
  /**
   * The functional outcome the substitute must achieve, phrased for direct
   * prompt injection — e.g. "the filling must set firm enough to slice".
   * Required whenever functionalRole is set.
   */
  roleRequirement?: string;
  /**
   * When set, this rule only fires if the combined dish name + dishForm
   * string matches this pattern (case-insensitive). Use to scope rules to
   * a specific dish category (e.g. baked goods) so generic triggers such as
   * "egg" do not fire for unrelated dishes (omelets, quiches, eggplant).
   */
  dishContextPattern?: RegExp;
}

export interface GuardrailSubstitutionProfile {
  id: GuardrailId;
  /** Human-readable label used in ConflictResolution.guardrail strings. */
  label: string;
  /** File(s) this data was extracted from. */
  source: string;
  rules: SubstitutionRule[];
  /**
   * Non-component-specific directives (portion, preparation) that always apply
   * when this guardrail is active. Injected into the adaptation block.
   */
  generalDirectives?: string[];
}

// Shared trigger vocabularies (matching only — not dish tables)
const RICE_TRIGGERS = ["rice"];
const PASTA_TRIGGERS = ["pasta", "noodle", "spaghetti", "macaroni", "penne", "fettuccine", "linguine", "lasagna sheet", "lasagne sheet", "pasta sheet"];
const TORTILLA_TRIGGERS = ["tortilla", "wrap", "taco shell"];
const POTATO_TRIGGERS = ["potato", "mash", "fries", "hash brown"];
const SUGAR_TRIGGERS = ["sugar", "sweetener", "sweet", "syrup", "honey", "glaze", "caramel", "frosting", "icing"];
const FLOUR_TRIGGERS = ["flour", "roux", "breading", "batter", "crust", "dough", "bread", "bun", "biscuit", "pastry"];
const CREAM_TRIGGERS = ["cream", "creamy", "butter sauce", "cheese sauce", "alfredo", "full-fat", "heavy dairy"];
const FRIED_TRIGGERS = ["fried", "deep-fry", "deep fried", "frying", "breaded", "battered"];
const SODIUM_TRIGGERS = ["sodium", "salt", "soy sauce", "brine", "cured", "seasoning level"];

export const GUARDRAIL_SUBSTITUTION_MAP: Record<GuardrailId, GuardrailSubstitutionProfile> = {
  // ── Extracted from diabeticPromptBuilder.ts lines 70–74 (elevated) and
  //    102–107 (in-range) MANDATORY SUBSTITUTIONS, plus snack builder 155–169.
  diabetic: {
    id: "diabetic",
    label: "diabetic",
    source: "server/services/guardrails/prompt/diabeticPromptBuilder.ts",
    rules: [
      { blocked: "white rice / any rice", triggers: RICE_TRIGGERS, substitute: "cauliflower rice" },
      { blocked: "regular pasta", triggers: PASTA_TRIGGERS, substitute: "zucchini noodles or chickpea pasta", note: "for layered pasta dishes use zucchini or eggplant sheets" },
      { blocked: "flour tortillas", triggers: TORTILLA_TRIGGERS, substitute: "low-carb tortillas (or lettuce wraps)" },
      { blocked: "potatoes", triggers: POTATO_TRIGGERS, substitute: "cauliflower mash" },
      { blocked: "sugar / sweet sauces", triggers: SUGAR_TRIGGERS, substitute: "sugar-free sauces and sweeteners", functionalRole: "sweetener", roleRequirement: "in baked or set desserts sugar also carries moisture and structure — pair the sugar-free sweetener with the recipe's existing binder so texture is preserved, don't just cut sweetness" },
      { blocked: "white flour products", triggers: FLOUR_TRIGGERS, substitute: "almond flour or other low-GI flour base", functionalRole: "structure", roleRequirement: "the crust/dough must still bind and hold its shape — almond flour has no gluten, so add a binder compatible with this user's other restrictions (ground flax, psyllium, or xanthan gum; egg only where eggs are permitted) so it slices without crumbling" },
    ],
    generalDirectives: [
      "Controlled carbohydrates (20–35g, low-GI sources only). High fiber, moderate lean protein.",
    ],
  },

  // ── Sugar-reduction subset of the diabetic builder (same source: the
  //    "Sugar-free sauces and sweeteners" mandate + snack craving translations).
  "lower-sugar": {
    id: "lower-sugar",
    label: "lower-sugar",
    source: "server/services/guardrails/prompt/diabeticPromptBuilder.ts (sugar rules subset)",
    rules: [
      { blocked: "sugar / honey / maple syrup", triggers: SUGAR_TRIGGERS, substitute: "sugar-free sweeteners; reduce total sweetener quantity", functionalRole: "sweetener", roleRequirement: "in baked or set desserts sugar also carries moisture and structure — compensate with the recipe's binder or a small amount of fruit puree so texture is preserved" },
      { blocked: "sweetened yogurt", triggers: ["sweetened yogurt", "flavored yogurt"], substitute: "plain Greek yogurt with fresh berries" },
      { blocked: "milk chocolate", triggers: ["chocolate"], substitute: "dark chocolate (70%+ cacao, small portion)" },
    ],
  },

  // ── Extracted from glp1PromptBuilder.ts (meal-type guidelines, constraint
  //    overlay), glp1Rules.ts cooking methods, and the GLP-1 hard-constraint
  //    block in unifiedMealPipeline.ts (portion + starch rules).
  glp1: {
    id: "glp1",
    label: "GLP-1",
    source: "server/services/guardrails/prompt/glp1PromptBuilder.ts + rules/glp1Rules.ts + unifiedMealPipeline.ts GLP-1 overlay",
    rules: [
      { blocked: "large starch base (rice, pasta, bread, potato)", triggers: [...RICE_TRIGGERS, ...PASTA_TRIGGERS, ...POTATO_TRIGGERS, "bread", "starch"], substitute: "a small controlled portion (≤ ¼ cup / 2 oz) of the starch, or a cauliflower/high-protein alternative base; non-starchy vegetables as volume" },
      { blocked: "cream / butter / heavy cheese sauces", triggers: CREAM_TRIGGERS, substitute: "a reduced-fat version of the same sauce (light cheese, Greek yogurt base, minimal oil)" },
      { blocked: "fried or breaded preparation", triggers: FRIED_TRIGGERS, substitute: "baked, grilled, steamed, poached, or sautéed with minimal oil" },
    ],
    generalDirectives: [
      "Portions SMALL to MODERATE (1–1.5 cups total plate volume). Lean protein must anchor the meal.",
      "Fat is the primary nausea trigger — keep preparation low-fat throughout.",
    ],
  },

  // ── Extracted from allergyGuardrails.ts getSafeSubstitute (gluten/wheat
  //    entries), diabeticPromptBuilder chickpea-pasta substitution, and
  //    protocolEnvelope.ts gluten-free pairing guidance (tamari/coconut aminos).
  "gluten-free": {
    id: "gluten-free",
    label: "gluten allergy",
    source: "server/services/allergyGuardrails.ts + server/services/protocolEnvelope.ts gluten-free guidance",
    rules: [
      { blocked: "wheat pasta", triggers: PASTA_TRIGGERS, substitute: "certified gluten-free pasta (rice, chickpea, or lentil pasta)" },
      { blocked: "wheat flour / bread / breading", triggers: FLOUR_TRIGGERS, substitute: "rice flour or almond flour (gluten-free bread/breading)", functionalRole: "structure", roleRequirement: "wheat gluten was the structural network — gluten-free flours need a binder compatible with this user's other restrictions (xanthan gum, psyllium, or ground flax; egg only where eggs are permitted) so the dough/crust holds together instead of crumbling" },
      { blocked: "soy sauce (contains wheat)", triggers: ["soy sauce", "soy"], substitute: "tamari or coconut aminos" },
      { blocked: "flour tortillas", triggers: TORTILLA_TRIGGERS, substitute: "corn or certified gluten-free tortillas" },
      { blocked: "wheat grain base", triggers: ["wheat", "couscous", "barley", "farro", "bulgur"], substitute: "rice or quinoa" },
    ],
    generalDirectives: [
      "Every paired item must be certified gluten-free; no shared gluten cooking surfaces.",
    ],
  },

  // ── Extracted verbatim from kidneyDiseasePromptBuilder.ts BANNED/USE
  //    groups (lines 41–51) and snack replacement groups (80–84).
  "kidney-disease": {
    id: "kidney-disease",
    label: "kidney disease (CKD)",
    source: "server/services/guardrails/prompt/kidneyDiseasePromptBuilder.ts",
    rules: [
      { blocked: "high-potassium produce (bananas, oranges, avocados, potatoes, dried fruit)", triggers: [...POTATO_TRIGGERS, "banana", "orange", "avocado", "dried fruit", "tomato sauce"], substitute: "apples, berries, grapes, peaches, cauliflower, cabbage, green beans, bell peppers, cucumber" },
      { blocked: "beans / lentils / nuts / seeds", triggers: ["bean", "lentil", "nut", "seed", "legume"], substitute: "egg whites or a small portion of white fish or chicken" },
      { blocked: "dairy products", triggers: ["dairy", "milk", "cheese", "yogurt"], substitute: "low-phosphorus alternatives (per CKD protocol — egg whites, fresh produce)" },
      { blocked: "whole grain bread / bran", triggers: ["whole grain", "bran", "whole wheat"], substitute: "white rice, white bread, regular pasta, or cream of wheat" },
      { blocked: "added salt / salt substitutes", triggers: SODIUM_TRIGGERS, substitute: "fresh herbs, garlic, lemon, or vinegar" },
    ],
  },

  // ── Extracted from oncologySupportPromptBuilder.ts lines 152–157 and
  //    216–220, plus the oncology transformation rule in unifiedMealPipeline.ts.
  "oncology-support": {
    id: "oncology-support",
    label: "cancer support protocol",
    source: "server/services/guardrails/prompt/oncologySupportPromptBuilder.ts + unifiedMealPipeline.ts oncology overlay",
    rules: [
      { blocked: "heavily processed fats (lard, margarine, shortening)", triggers: ["lard", "margarine", "shortening", "hydrogenated"], substitute: "olive oil, avocado oil, or small amounts of butter" },
      { blocked: "refined white carbs as primary starch", triggers: ["white bread", "white pasta", "white rice", "bread", "pasta"], substitute: "whole grain, sprouted grain, sweet potato, or legume-based pasta" },
      { blocked: "preserved / smoked / cured proteins", triggers: ["smoked", "cured", "deli", "bacon", "sausage", "ham", "processed meat"], substitute: "the fresh version of the same protein" },
      { blocked: "added sugars (maple, honey, agave, glazes)", triggers: SUGAR_TRIGGERS, substitute: "citrus, herb, or spice-based rubs and marinades (no sugar glazes)" },
    ],
    generalDirectives: [
      "Every plate must include a fiber anchor and a vegetable, plus a therapeutic booster (garlic, turmeric, ginger, lemon, or fresh herbs).",
    ],
  },

  // ── Extracted from antiInflammatoryPromptBuilder.ts lines 24–26.
  "anti-inflammatory": {
    id: "anti-inflammatory",
    label: "anti-inflammatory",
    source: "server/services/guardrails/prompt/antiInflammatoryPromptBuilder.ts",
    rules: [
      { blocked: "unspecified fatty red-meat cut", triggers: ["beef", "steak", "lamb", "pork", "red meat"], substitute: "a lean cut (sirloin, tenderloin, eye of round, flank, or filet mignon), 4–6 oz", note: "if the user explicitly named a cut, keep it — optimize preparation instead" },
    ],
    generalDirectives: [
      "If a requested ingredient conflicts with this protocol, include it — but optimize preparation, portion, and pairing to reduce inflammatory impact.",
    ],
  },

  // ── Extracted from allergyGuardrails.ts VEGAN_SUBSTITUTION_MAP /
  //    getSafeSubstitute entries.
  vegan: {
    id: "vegan",
    label: "vegan",
    source: "server/services/allergyGuardrails.ts VEGAN_SUBSTITUTION_MAP",
    rules: [
      { blocked: "cream cheese / dairy in a set filling or custard", triggers: ["cream cheese", "cheesecake", "cheese filling", "custard", "mousse", "panna cotta", "flan"], substitute: "a cashew-cream-cheese base (soaked cashews blended with coconut cream and lemon)", functionalRole: "binder/setter", roleRequirement: "the filling must set firm enough to slice — use agar or arrowroot as the setter, since removing the dairy also removes the protein network that made it set" },
      { blocked: "dairy (milk, cheese, butter, cream, yogurt)", triggers: ["milk", "cheese", "butter", "cream", "yogurt", "dairy"], substitute: "oat/almond milk, vegan cheese or nutritional yeast, vegan butter or coconut oil, coconut cream, coconut yogurt" },
      // Generic egg substitute. Directive mentions both binding AND leavening compensation
      // so a generator adapting a vegan cake knows flax eggs alone won't provide lift.
      { blocked: "eggs", triggers: ["egg"], substitute: "flax eggs (1 tbsp ground flax + 3 tbsp water per egg, rested 5 min) for binding; for baked cakes, muffins, and quick breads also add ½ tsp baking soda + 1 tsp apple cider vinegar per egg to replace the lost lift so the result rises properly instead of coming out dense and flat" },
      { blocked: "eggs in a baked or set dish (binder/setter role)", triggers: ["egg custard", "egg binder", "egg wash", "meringue", "cheesecake", "custard", "quiche", "frittata"], substitute: "silken tofu or a cashew-cream base", functionalRole: "binder/setter", roleRequirement: "eggs were the setting agent — add agar (for a firm set) or arrowroot/cornstarch (for a soft set) so the dish holds its shape when portioned; do NOT use egg as the setter if eggs are also restricted" },
      { blocked: "meat / poultry / seafood", triggers: ["beef", "pork", "chicken", "fish", "shrimp", "seafood", "meat", "protein/seafood"], substitute: "tofu, tempeh, seitan, jackfruit, or portobello mushrooms" },
      { blocked: "gelatin", triggers: ["gelatin"], substitute: "agar-agar", functionalRole: "setter", roleRequirement: "agar sets firmer and less elastic than gelatin — use roughly 1 tsp agar powder per cup of liquid and boil to activate, so the dessert still sets and slices cleanly" },
      { blocked: "animal stock", triggers: ["stock", "broth"], substitute: "vegetable broth" },
      { blocked: "mayonnaise / worcestershire", triggers: ["mayonnaise", "mayo", "worcestershire"], substitute: "vegan mayonnaise / vegan worcestershire sauce" },
      // ── Fat-in-pastry: butter creates flakiness through cold solid fat pockets.
      // Vegan butter works if handled cold; coconut oil is a lower-flakiness fallback.
      {
        blocked: "butter in a pastry, pie crust, or flaky dough",
        triggers: ["pastry crust", "pie crust", "flaky", "shortcrust", "puff pastry", "croissant", "laminated dough"],
        substitute: "cold vegan butter (e.g. Miyoko's or Earth Balance), kept solid throughout mixing",
        functionalRole: "fat/flakiness",
        roleRequirement: "butter creates flakiness by forming cold solid fat pockets that steam apart in the oven — the vegan substitute must remain solid during mixing; work it in quickly and keep everything cold so distinct fat layers survive into the oven and produce flaky layers, not a greasy crumb",
      },
      // ── Leavening: eggs in a baked cake/muffin/quick bread trap air and expand
      // during baking; a plain flax egg replicates binding but not lift.
      // Triggers include "egg" so this rule fires for common LLM component names
      // ("eggs", "whole eggs", "2 eggs", "large eggs").  dishContextPattern
      // gates the rule to baked-good dishes so it never fires for omelets,
      // scrambles, quiches, frittatas, or dishes whose components include
      // "eggplant".  The role-aware selector in dishAdaptationLayer still
      // prefers this role-tagged rule over the generic egg rule when both
      // trigger — but only after the dish-context guard passes.
      {
        blocked: "eggs as leavening in a baked cake, muffin, or quick bread",
        triggers: ["leavening", "egg lift", "whipped egg", "beaten egg", "egg"],
        substitute: "aquafaba (3 tbsp per egg, whipped to soft peaks for aeration) OR baking soda + apple cider vinegar (½ tsp soda + 1 tsp vinegar per egg for CO₂ lift) — use alongside a flax egg for binding so the bake has both structure and lift",
        functionalRole: "leavening",
        roleRequirement: "eggs were trapping air and providing CO₂ expansion during baking — aquafaba whipped to soft peaks replicates the air-trapping role; baking soda + vinegar supplies CO₂; a flax egg handles binding; a dense, flat result means the leavening substitute was insufficient — combine aquafaba + baking soda/vinegar for tall, airy bakes",
        // \b prevents "cheesecake" from matching "cake" (no word boundary before
        // the "c" inside "cheesecake"). Plurals handled via s? suffix.
        // "batter" and "loaf" are intentionally excluded: "batter" also appears
        // in savory battered/fried dishes; "loaf" also appears in meatloaf.
        dishContextPattern: /\b(cakes?|muffins?|quick bread|brownies?|cupcakes?|coffee cake|pound cake|banana bread|zucchini bread|carrot cake|sponge cake|genoise)\b/i,
      },
    ],
  },

  // ── Extracted from allergyGuardrails.ts VEGETARIAN_SUBSTITUTION_MAP.
  vegetarian: {
    id: "vegetarian",
    label: "vegetarian",
    source: "server/services/allergyGuardrails.ts VEGETARIAN_SUBSTITUTION_MAP",
    rules: [
      { blocked: "meat / poultry / seafood", triggers: ["beef", "pork", "chicken", "fish", "shrimp", "seafood", "meat", "protein/seafood"], substitute: "tofu, tempeh, eggs, legumes, or dairy-based protein" },
      { blocked: "animal stock / bone broth", triggers: ["stock", "broth"], substitute: "vegetable broth" },
      { blocked: "gelatin", triggers: ["gelatin"], substitute: "agar-agar", functionalRole: "setter", roleRequirement: "agar must be boiled to activate and sets firmer than gelatin — dose ~1 tsp powder per cup of liquid so the dish still sets and slices cleanly" },
      {
        // Triggers are ingredient names only — "pastry", "pie crust", and
        // "shortcrust" are removed so a compliant vegetarian pastry component
        // that contains no lard/tallow/suet does not produce a false directive.
        blocked: "lard / tallow / suet in a pastry or crust",
        triggers: ["lard", "tallow", "suet"],
        substitute: "plant-based shortening (Crisco or similar) or cold coconut oil",
        functionalRole: "fat/flakiness",
        roleRequirement: "lard's low melting point creates flakiness by staying solid during mixing and melting rapidly in the oven — substitute with solid plant-based shortening, kept cold, worked in quickly so fat pockets survive into the oven and produce distinct flaky layers rather than a dense crumb",
      },
      { blocked: "fish sauce / anchovies", triggers: ["fish sauce", "anchov"], substitute: "soy sauce / capers" },
    ],
  },

  // ── Extracted from allergyGuardrails.ts PESCATARIAN_SUBSTITUTION_MAP.
  pescatarian: {
    id: "pescatarian",
    label: "pescatarian",
    source: "server/services/allergyGuardrails.ts PESCATARIAN_SUBSTITUTION_MAP",
    rules: [
      { blocked: "meat / poultry", triggers: ["beef", "pork", "chicken", "meat"], substitute: "seafood or plant-based protein" },
      { blocked: "meat stock / bone broth", triggers: ["chicken stock", "beef stock", "bone broth", "chicken broth", "beef broth"], substitute: "vegetable broth" },
      { blocked: "lard / tallow / suet", triggers: ["lard", "tallow", "suet"], substitute: "olive oil / coconut oil / plant-based shortening" },
    ],
  },

  // ── Extracted from the kosher meat guard in unifiedMealPipeline.ts
  //    (generateSingleCompliantFallback meatDairyGuard).
  "kosher-meat": {
    id: "kosher-meat",
    label: "kosher (meat meal)",
    source: "server/services/unifiedMealPipeline.ts meatDairyGuard",
    rules: [
      { blocked: "dairy in a meat meal (butter, cream, cheese, milk, yogurt)", triggers: ["butter", "cream", "cheese", "milk", "yogurt", "dairy", "ghee"], substitute: "olive oil or avocado oil for fat; reduced meat stock, pureed vegetables, or tahini for creaminess" },
      { blocked: "dairy in a set filling or custard (meat meal)", triggers: ["cream cheese", "cheesecake", "cheese filling", "custard", "mousse"], substitute: "a cashew-cream base (soaked cashews blended with coconut cream and lemon)", functionalRole: "binder/setter", roleRequirement: "the filling must set firm enough to slice — use agar or arrowroot as the setter to replace the dairy protein network" },
    ],
    generalDirectives: [
      "Every single ingredient must be dairy-free. No exceptions.",
    ],
  },
};

/**
 * Role-aware structural rules for allergens. When an allergy (not a dietary
 * identity) removes a structurally critical ingredient — dairy in a set
 * filling, eggs as the binder/setter — the substitute must perform the same
 * structural function, exactly as the vegan-profile rules require. These
 * mirror the vegan binder/setter rules so a dairy or egg ALLERGY gets the same
 * functional-role reasoning that a vegan dietary identity gets.
 *
 * Cross-contamination invariant: no roleRequirement here may recommend an
 * ingredient blocked by another common rule — in particular the egg-setter
 * rule must never suggest egg, and the dairy rule must never suggest dairy.
 */
export const ALLERGEN_STRUCTURAL_RULES: Record<string, SubstitutionRule[]> = {
  dairy: [
    {
      blocked: "dairy in a set filling or custard (binder/setter role)",
      triggers: ["cream cheese", "cheesecake", "cheese filling", "custard", "mousse", "panna cotta", "flan", "cream filling"],
      substitute: "a cashew-cream-cheese base (soaked cashews blended with coconut cream and lemon)",
      functionalRole: "binder/setter",
      roleRequirement: "the filling must set firm enough to slice — use agar or arrowroot as the setter, since removing the dairy also removes the protein network that made it set",
    },
  ],
  egg: [
    {
      blocked: "eggs as the binder/setter in a baked or set dish",
      triggers: ["egg", "custard", "meringue", "cheesecake", "quiche", "frittata"],
      substitute: "silken tofu blended smooth, or a flax binder (ground flaxseed + water)",
      functionalRole: "binder/setter",
      roleRequirement: "eggs were the setting agent — add agar (for a firm set) or arrowroot/cornstarch (for a soft set) so the dish holds its shape when portioned",
    },
  ],
};
/** Allergen → substitution rule, extracted from allergyGuardrails.ts getSafeSubstitute. */
export const ALLERGEN_SUBSTITUTES: Record<string, string> = {
  shrimp: "chicken or tofu",
  shellfish: "chicken, mushrooms, or hearts of palm",
  crab: "jackfruit or hearts of palm",
  lobster: "mushrooms or cauliflower",
  scallop: "king oyster mushrooms",
  fish: "chicken or tempeh",
  egg: "flax egg or silken tofu",
  eggs: "flax eggs or silken tofu",
  milk: "oat milk or almond milk",
  dairy: "oat milk, coconut cream, or vegan cheese",
  cheese: "nutritional yeast or vegan cheese",
  butter: "coconut oil or vegan butter",
  peanut: "sunflower seed butter",
  peanuts: "sunflower seeds",
  "tree nut": "pumpkin or sunflower seeds",
  almond: "pumpkin seeds",
  walnut: "sunflower seeds",
  gluten: "rice flour or almond flour",
  wheat: "rice or quinoa",
  soy: "coconut aminos or hemp seeds",
  sesame: "sunflower seeds",
};

export function getGuardrailProfile(id: GuardrailId): GuardrailSubstitutionProfile {
  return GUARDRAIL_SUBSTITUTION_MAP[id];
}
