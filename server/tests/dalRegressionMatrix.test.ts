/**
 * DAL broad regression matrix — Task #1210
 *
 * Validates the Dish Adaptation Layer identity validator against a diverse set
 * of dishes whose identity depends on very different cooking chemistry and
 * structural components. All fixtures are synthetic — no live LLM. Each dish
 * gets a realistic mocked DAL directive and is run against:
 *   1. a correctly adapted version        → passed, no catastrophic deviation
 *   2. a form-collapse escape             → catastrophicDeviation = true
 *   3. a completely wrong dish            → catastrophicDeviation = true
 *
 * Plus dedicated stacked-constraint scenarios for mac and cheese, fried
 * chicken, pizza, lasagna, jambalaya, and brownies.
 */

import { validateDishIdentity, type GeneratedMealLike } from "../services/dishAdaptation/dishIdentityValidator";
import type { DishAdaptationDirective } from "../services/dishAdaptation/types";

function directive(partial: Partial<DishAdaptationDirective>): DishAdaptationDirective {
  return {
    identityAnchor: "This IS the requested dish. Do not change the dish.",
    definingComponents: [],
    adaptableComponents: [],
    conflicts: [],
    adaptationBlock: "",
    ...partial,
  };
}

interface DishCase {
  label: string;
  request: string;
  directive: DishAdaptationDirective;
  adapted: GeneratedMealLike;
  collapse: GeneratedMealLike;
  wrong: GeneratedMealLike;
}

const CASES: DishCase[] = [
  // ── Savory ────────────────────────────────────────────────────────────────
  {
    label: "pizza (vegan + gluten-free)",
    request: "pizza",
    directive: directive({
      identityAnchor: "This IS pizza.",
      definingComponents: ["gluten-free crust", "tomato sauce", "melted vegan cheese toppings"],
      adaptableComponents: ["flour in crust", "cheese type"],
      dishForm: "flat baked crust with sauce and toppings",
      conflicts: [
        { component: "wheat crust", guardrail: "gluten-free: no wheat flour", directive: "Use a gluten-free flour crust. The dish is still pizza." },
        { component: "mozzarella", guardrail: "vegan: no dairy", directive: "Use melted vegan cheese. The dish is still pizza." },
      ],
    }),
    adapted: {
      name: "Vegan Gluten-Free Pizza",
      description: "A crisp gluten-free crust topped with tomato sauce and melted vegan cheese.",
      ingredients: [{ name: "gluten-free flour crust" }, { name: "tomato sauce" }, { name: "vegan mozzarella" }, { name: "basil" }],
    },
    collapse: {
      name: "Deconstructed Pizza Bowl",
      description: "Pizza components layered in a bowl with toppings and sauce.",
      ingredients: [{ name: "tomato sauce" }, { name: "vegan cheese" }, { name: "croutons" }],
    },
    wrong: {
      name: "Beef Stir Fry",
      description: "Sliced beef with broccoli, ginger, and sesame over greens.",
      ingredients: [{ name: "beef strips" }, { name: "broccoli" }, { name: "ginger" }],
    },
  },
  {
    label: "lasagna (vegan + gluten-free)",
    request: "lasagna",
    directive: directive({
      identityAnchor: "This IS lasagna.",
      definingComponents: ["lasagna pasta sheets", "ricotta-style layer", "tomato sauce"],
      adaptableComponents: ["pasta flour", "cheese layers"],
      dishForm: "layered pasta bake with stacked sheets",
      conflicts: [
        { component: "wheat pasta sheets", guardrail: "gluten-free: no wheat", directive: "Use gluten-free lasagna sheets. The dish is still lasagna." },
        { component: "ricotta", guardrail: "vegan: no dairy", directive: "Use cashew ricotta. The dish is still lasagna." },
      ],
    }),
    adapted: {
      name: "Vegan Gluten-Free Lasagna",
      description: "Layered gluten-free pasta sheets with cashew ricotta and tomato sauce, baked and stacked.",
      ingredients: [{ name: "gluten-free lasagna sheets" }, { name: "cashew ricotta" }, { name: "tomato sauce" }],
    },
    collapse: {
      name: "Lasagna Soup",
      description: "All the lasagna flavors simmered together and ladled up.",
      ingredients: [{ name: "pasta pieces" }, { name: "tomato sauce" }, { name: "cashew ricotta" }],
    },
    wrong: {
      name: "Grilled Fish Tacos",
      description: "Grilled white fish with cabbage and lime crema in tortillas.",
      ingredients: [{ name: "white fish" }, { name: "corn tortillas" }, { name: "cabbage" }],
    },
  },
  {
    label: "fried chicken (GLP-1 + anti-inflammatory)",
    request: "fried chicken",
    directive: directive({
      identityAnchor: "This IS fried chicken.",
      definingComponents: ["chicken pieces", "crispy coating", "seasoned crust"],
      adaptableComponents: ["cooking method", "coating flour"],
      dishForm: "crispy crust coated chicken pieces",
      conflicts: [
        { component: "deep frying", guardrail: "GLP-1: no heavy fried fats", directive: "Oven-bake or air-fry the coated chicken. The dish is still fried chicken." },
        { component: "wheat flour coating", guardrail: "anti-inflammatory: limit refined wheat", directive: "Use almond-flour coating. The dish is still fried chicken." },
      ],
    }),
    adapted: {
      name: "Oven-Baked Crispy Fried Chicken",
      description: "Chicken pieces in a crispy almond-flour crust, oven-baked until golden and juicy.",
      ingredients: [{ name: "chicken thighs" }, { name: "almond flour coating" }, { name: "paprika seasoning" }],
    },
    collapse: {
      name: "Crispy Chicken Salad",
      description: "Chopped chicken over greens with a light dressing.",
      ingredients: [{ name: "chicken breast" }, { name: "mixed greens" }, { name: "vinaigrette" }],
    },
    wrong: {
      name: "Poached Salmon with Dill",
      description: "Gently poached salmon with dill and lemon.",
      ingredients: [{ name: "salmon fillet" }, { name: "dill" }, { name: "lemon" }],
    },
  },
  {
    label: "mac and cheese (gluten-free + dairy-free + diabetic)",
    request: "mac and cheese",
    directive: directive({
      identityAnchor: "This IS mac and cheese.",
      definingComponents: ["elbow macaroni pasta", "creamy cheese-style sauce", "tender coated noodles"],
      adaptableComponents: ["pasta flour", "cheese sauce base", "carb load"],
      dishForm: "casserole-style baked pasta coated in sauce",
      conflicts: [
        { component: "wheat macaroni", guardrail: "gluten-free: no wheat", directive: "Use gluten-free elbow pasta. The dish is still mac and cheese." },
        { component: "dairy cheese sauce", guardrail: "dairy-free: no dairy", directive: "Use cashew cheese sauce. The dish is still mac and cheese." },
        { component: "refined pasta portion", guardrail: "diabetic: control carbs", directive: "Use a smaller portion of low-carb pasta. The dish is still mac and cheese." },
      ],
    }),
    adapted: {
      name: "Gluten-Free Dairy-Free Mac and Cheese",
      description: "Creamy cashew cheese sauce coating gluten-free elbow macaroni, finished until golden.",
      ingredients: [{ name: "gluten-free elbow macaroni" }, { name: "cashew cheese sauce" }, { name: "nutritional yeast" }],
    },
    collapse: {
      name: "Mac and Cheese Soup",
      description: "Cheesy pasta simmered thin and ladled into cups.",
      ingredients: [{ name: "elbow pasta" }, { name: "cashew cheese sauce" }],
    },
    wrong: {
      name: "Grilled Salmon and Asparagus",
      description: "Grilled salmon fillet with roasted asparagus and lemon.",
      ingredients: [{ name: "salmon" }, { name: "asparagus" }, { name: "lemon" }],
    },
  },
  {
    label: "enchiladas",
    request: "chicken enchiladas",
    directive: directive({
      identityAnchor: "This IS chicken enchiladas.",
      definingComponents: ["corn tortillas", "shredded chicken filling", "red chili sauce"],
      adaptableComponents: ["cheese topping", "sauce sodium"],
      dishForm: "rolled corn tortillas baked in sauce, casserole dish",
      conflicts: [],
    }),
    adapted: {
      name: "Dairy-Free Chicken Enchiladas",
      description: "Corn tortillas rolled around shredded chicken, covered in red enchilada sauce.",
      ingredients: [{ name: "corn tortillas" }, { name: "shredded chicken" }, { name: "red chili sauce" }],
    },
    collapse: {
      name: "Chicken Enchilada Bowl",
      description: "Enchilada flavors served over a base in a bowl.",
      ingredients: [{ name: "shredded chicken" }, { name: "red chili sauce" }, { name: "corn" }],
    },
    wrong: {
      name: "Pesto Zucchini Noodles",
      description: "Spiralized zucchini tossed with basil pesto and pine nuts.",
      ingredients: [{ name: "zucchini" }, { name: "basil pesto" }, { name: "pine nuts" }],
    },
  },
  {
    label: "jambalaya (diabetic + kidney disease)",
    request: "jambalaya",
    directive: directive({
      identityAnchor: "This IS jambalaya.",
      definingComponents: ["andouille sausage", "shrimp", "trinity vegetables (onion, celery, bell pepper)", "rice base"],
      adaptableComponents: ["rice type", "sodium level"],
      dishForm: "hearty one-pot rice stew",
      conflicts: [
        { component: "white rice base", guardrail: "diabetic: no white rice / any rice", directive: "Use cauliflower rice. The dish is still jambalaya." },
        { component: "andouille sodium", guardrail: "kidney disease: limit sodium and phosphorus", directive: "Use low-sodium andouille-style sausage. The dish is still jambalaya." },
      ],
    }),
    adapted: {
      name: "Diabetic-Friendly Cauliflower Rice Jambalaya",
      description: "A hearty one-pot jambalaya stew with cauliflower rice, shrimp, low-sodium andouille, and the trinity of onion, celery, and bell pepper.",
      ingredients: [{ name: "cauliflower rice" }, { name: "shrimp" }, { name: "low-sodium andouille sausage" }, { name: "onion" }, { name: "celery" }, { name: "bell pepper" }],
    },
    collapse: {
      name: "Jambalaya Soup",
      description: "Jambalaya flavors thinned out and ladled up.",
      ingredients: [{ name: "shrimp" }, { name: "andouille" }, { name: "cauliflower rice" }],
    },
    wrong: {
      name: "Beef Stroganoff",
      description: "Sliced beef and mushrooms over egg noodles.",
      ingredients: [{ name: "beef" }, { name: "mushrooms" }, { name: "egg noodles" }],
    },
  },
  // ── Baked ────────────────────────────────────────────────────────────────
  {
    label: "pancakes",
    request: "pancakes",
    directive: directive({
      identityAnchor: "This IS pancakes.",
      definingComponents: ["flour batter", "griddle-cooked rounds", "fluffy interior"],
      adaptableComponents: ["flour type", "sweetener"],
      dishForm: "griddle cake stack, round and fluffy",
      conflicts: [],
    }),
    adapted: {
      name: "Fluffy Gluten-Free Pancakes",
      description: "Round griddle-cooked rounds made from oat flour batter, stacked and fluffy.",
      ingredients: [{ name: "oat flour batter" }, { name: "eggs" }, { name: "maple syrup" }],
    },
    collapse: {
      name: "Pancake Smoothie Bowl",
      description: "Pancake-flavored blend served thick in a bowl.",
      ingredients: [{ name: "oats" }, { name: "banana" }, { name: "almond milk" }],
    },
    wrong: {
      name: "Beef Tacos",
      description: "Seasoned beef in corn shells with lettuce and salsa.",
      ingredients: [{ name: "ground beef" }, { name: "corn shells" }, { name: "salsa" }],
    },
  },
  {
    label: "biscuits",
    request: "biscuits",
    directive: directive({
      identityAnchor: "This IS biscuits.",
      definingComponents: ["flour dough", "fat layers", "flaky crumb"],
      adaptableComponents: ["flour type", "fat type"],
      dishForm: "individual baked rounds with golden crust",
      conflicts: [],
    }),
    adapted: {
      name: "Flaky Almond Flour Biscuits",
      description: "Tender rounds made from almond flour dough with layered fat for a flaky crumb.",
      ingredients: [{ name: "almond flour dough" }, { name: "cold vegan butter fat" }, { name: "baking powder" }],
    },
    collapse: {
      name: "Biscuit Dough Energy Bites",
      description: "No-bake rolled rounds of dough.",
      ingredients: [{ name: "almond flour" }, { name: "coconut oil" }],
    },
    wrong: {
      name: "Minestrone Soup",
      description: "Vegetable soup with beans and pasta shells.",
      ingredients: [{ name: "beans" }, { name: "carrot" }, { name: "pasta shells" }],
    },
  },
  {
    label: "brownies (vegan + gluten-free)",
    request: "brownies",
    directive: directive({
      identityAnchor: "This IS brownies.",
      definingComponents: ["chocolate cocoa base", "fudgy dense crumb", "flour binder"],
      adaptableComponents: ["flour type", "egg replacer", "sweetener"],
      dishForm: "dense fudgy sliceable baked squares",
      conflicts: [
        { component: "wheat flour", guardrail: "gluten-free: no wheat", directive: "Use almond flour. The dish is still brownies." },
        { component: "eggs and butter", guardrail: "vegan: no animal products", directive: "Use flax eggs and coconut oil. The dish is still brownies." },
      ],
    }),
    adapted: {
      name: "Vegan Gluten-Free Brownies",
      description: "Dense, fudgy chocolate cocoa squares made with almond flour binder and flax eggs.",
      ingredients: [{ name: "cocoa powder" }, { name: "almond flour" }, { name: "flax eggs" }, { name: "coconut oil" }],
    },
    collapse: {
      name: "Brownie Energy Balls",
      description: "Rolled no-bake chocolate rounds.",
      ingredients: [{ name: "cocoa powder" }, { name: "dates" }, { name: "almond flour" }],
    },
    wrong: {
      name: "Mango Sorbet",
      description: "Frozen blended mango with lime.",
      ingredients: [{ name: "mango" }, { name: "lime" }],
    },
  },
  {
    label: "bread",
    request: "bread",
    directive: directive({
      identityAnchor: "This IS bread.",
      definingComponents: ["flour dough", "yeast rise", "sliceable crumb"],
      adaptableComponents: ["flour type"],
      dishForm: "baked sliceable loaf of bread",
      conflicts: [],
    }),
    adapted: {
      name: "Gluten-Free Sandwich Bread",
      description: "A sliceable loaf from gluten-free flour dough with a yeast rise and tender crumb.",
      ingredients: [{ name: "gluten-free flour dough" }, { name: "yeast" }, { name: "olive oil" }],
    },
    collapse: {
      name: "Bread Pudding",
      description: "Cubed bread soaked and set into a soft spoonable dessert.",
      ingredients: [{ name: "bread cubes" }, { name: "custard base" }],
    },
    wrong: {
      name: "Vegetable Omelette",
      description: "Eggs folded around spinach and peppers.",
      ingredients: [{ name: "eggs" }, { name: "spinach" }, { name: "peppers" }],
    },
  },
  // ── Other ────────────────────────────────────────────────────────────────
  {
    label: "curry",
    request: "chicken curry",
    directive: directive({
      identityAnchor: "This IS chicken curry.",
      definingComponents: ["chicken pieces", "spiced curry sauce", "aromatic base"],
      adaptableComponents: ["cream base", "rice accompaniment"],
      dishForm: "saucy stew-like curry served over rice",
      conflicts: [],
    }),
    adapted: {
      name: "Coconut Chicken Curry",
      description: "Tender chicken pieces simmered in a spiced coconut curry sauce over an aromatic base.",
      ingredients: [{ name: "chicken thighs" }, { name: "coconut milk curry sauce" }, { name: "ginger garlic aromatic base" }],
    },
    collapse: {
      name: "Chicken Curry Salad Wrap",
      description: "Curried chicken folded into a cold tortilla with greens.",
      ingredients: [{ name: "chicken" }, { name: "curry mayo" }, { name: "tortilla" }],
    },
    wrong: {
      name: "Caprese Plate",
      description: "Fresh mozzarella with sliced heirloom fruit, basil, and balsamic.",
      ingredients: [{ name: "mozzarella" }, { name: "basil" }, { name: "balsamic glaze" }],
    },
  },
  {
    label: "ice cream",
    request: "ice cream",
    directive: directive({
      identityAnchor: "This IS ice cream.",
      definingComponents: ["churned cream base", "sweetener", "vanilla flavor"],
      adaptableComponents: ["dairy base", "sweetener type"],
      dishForm: "churned scoopable ice cream",
      conflicts: [],
    }),
    adapted: {
      name: "Dairy-Free Vanilla Ice Cream",
      description: "Churned coconut cream base with vanilla and a low-glycemic sweetener, scoopable and smooth.",
      ingredients: [{ name: "coconut cream base" }, { name: "monk fruit sweetener" }, { name: "vanilla bean" }],
    },
    collapse: {
      name: "Vanilla Ice Cream Milkshake",
      description: "Blended thin and served with a straw.",
      ingredients: [{ name: "coconut cream" }, { name: "vanilla" }, { name: "almond milk" }],
    },
    wrong: {
      name: "Grilled Ribeye Steak",
      description: "Char-grilled ribeye with rosemary and sea salt.",
      ingredients: [{ name: "ribeye steak" }, { name: "rosemary" }],
    },
  },
];

// ── Core 3-scenario matrix over every dish ──────────────────────────────────

describe.each(CASES)("DAL regression matrix — $label", (c) => {
  it("passes a correctly adapted version", () => {
    const r = validateDishIdentity(c.request, c.adapted, c.directive);
    expect(r.catastrophicDeviation).toBe(false);
    expect(r.formMismatch).toBe(false);
    expect(r.passed).toBe(true);
  });

  it("flags a form-collapse escape as catastrophic", () => {
    const r = validateDishIdentity(c.request, c.collapse, c.directive);
    expect(r.formMismatch).toBe(true);
    expect(r.catastrophicDeviation).toBe(true);
    expect(r.passed).toBe(false);
  });

  it("flags a completely wrong dish as catastrophic", () => {
    const r = validateDishIdentity(c.request, c.wrong, c.directive);
    expect(r.catastrophicDeviation).toBe(true);
    expect(r.passed).toBe(false);
  });
});

// ── Stacked-constraint specifics ─────────────────────────────────────────────

const byLabel = (prefix: string) => CASES.find(c => c.label.startsWith(prefix))!;

describe("stacked constraints — mac and cheese (GF + DF + diabetic)", () => {
  const c = byLabel("mac and cheese");

  it("must not escape into a salad", () => {
    const r = validateDishIdentity(c.request, {
      name: "Mac and Cheese Pasta Salad",
      description: "Cold pasta with a cheese-style dressing over greens.",
      ingredients: [{ name: "elbow pasta" }, { name: "cashew dressing" }],
    }, c.directive);
    expect(r.formMismatch).toBe(true);
    expect(r.catastrophicDeviation).toBe(true);
  });

  it("triple-constraint adapted version keeps full identity (no component failures)", () => {
    const r = validateDishIdentity(c.request, c.adapted, c.directive);
    expect(r.passed).toBe(true);
    expect(r.failures).toHaveLength(0);
    expect(r.score).toBeGreaterThanOrEqual(0.5);
  });
});

describe("stacked constraints — fried chicken (GLP-1 + anti-inflammatory)", () => {
  const c = byLabel("fried chicken");

  it("must not escape into a wrap", () => {
    const r = validateDishIdentity(c.request, {
      name: "Crispy Chicken Wrap",
      description: "Chicken and greens rolled in a tortilla.",
      ingredients: [{ name: "chicken" }, { name: "tortilla" }, { name: "greens" }],
    }, c.directive);
    expect(r.formMismatch).toBe(true);
    expect(r.catastrophicDeviation).toBe(true);
  });

  it("baked/air-fried adaptation stays fried chicken", () => {
    const r = validateDishIdentity(c.request, c.adapted, c.directive);
    expect(r.passed).toBe(true);
    expect(r.failures).toHaveLength(0);
  });
});

describe("stacked constraints — pizza (vegan + gluten-free)", () => {
  const c = byLabel("pizza");

  it("flatbread with sauce on the side is not pizza", () => {
    const r = validateDishIdentity(c.request, {
      name: "Gluten-Free Flatbread with Marinara Dip",
      description: "A plain flatbread served with a marinara dipping cup and vegetables on the side.",
      ingredients: [{ name: "flatbread" }, { name: "marinara dip" }, { name: "raw vegetables" }],
    }, c.directive);
    expect(r.catastrophicDeviation).toBe(true);
    expect(r.passed).toBe(false);
  });

  it("adapted pizza keeps crust + toppings identity", () => {
    const r = validateDishIdentity(c.request, c.adapted, c.directive);
    expect(r.passed).toBe(true);
    expect(r.failures).toHaveLength(0);
  });
});

describe("stacked constraints — lasagna (vegan + gluten-free)", () => {
  const c = byLabel("lasagna");

  it("a deconstructed crumble is not lasagna", () => {
    const r = validateDishIdentity(c.request, {
      name: "Deconstructed Lasagna Crumble",
      description: "Lasagna components crumbled and scattered on a plate.",
      ingredients: [{ name: "pasta shards" }, { name: "tomato sauce" }, { name: "cashew ricotta" }],
    }, c.directive);
    expect(r.formMismatch).toBe(true);
    expect(r.catastrophicDeviation).toBe(true);
  });

  it("adapted lasagna keeps the layered pasta format", () => {
    const r = validateDishIdentity(c.request, c.adapted, c.directive);
    expect(r.passed).toBe(true);
    expect(r.failures).toHaveLength(0);
  });
});

describe("stacked constraints — jambalaya (diabetic + kidney disease)", () => {
  const c = byLabel("jambalaya");

  it("directive resolves the rice conflict by stating cauliflower rice while preserving the dish", () => {
    const riceConflict = c.directive.conflicts.find(k => k.component.includes("rice"));
    expect(riceConflict).toBeDefined();
    expect(riceConflict!.directive.toLowerCase()).toContain("cauliflower rice");
    expect(riceConflict!.directive.toLowerCase()).toContain("still jambalaya");
  });

  it("cauliflower-rice adaptation still validates as jambalaya (stew/rice format)", () => {
    const r = validateDishIdentity(c.request, c.adapted, c.directive);
    expect(r.passed).toBe(true);
    expect(r.failures).toHaveLength(0);
    expect(r.formMismatch).toBe(false);
  });
});

describe("stacked constraints — brownies (vegan + gluten-free)", () => {
  const c = byLabel("brownies");

  it("must not escape into a mousse", () => {
    const r = validateDishIdentity(c.request, {
      name: "Brownie Batter Mousse",
      description: "Whipped chocolate mousse with brownie flavors.",
      ingredients: [{ name: "cocoa" }, { name: "aquafaba" }],
    }, c.directive);
    expect(r.formMismatch).toBe(true);
    expect(r.catastrophicDeviation).toBe(true);
  });

  it("must not escape into a bar", () => {
    const r = validateDishIdentity(c.request, {
      name: "Chocolate Brownie Bars",
      description: "Chewy pressed bars with cocoa.",
      ingredients: [{ name: "cocoa" }, { name: "oats" }, { name: "dates" }],
    }, c.directive);
    expect(r.formMismatch).toBe(true);
    expect(r.catastrophicDeviation).toBe(true);
  });

  it("adapted brownies stay brownie-format", () => {
    const r = validateDishIdentity(c.request, c.adapted, c.directive);
    expect(r.passed).toBe(true);
    expect(r.failures).toHaveLength(0);
  });
});

// ── Naturalistic dishForm protection ─────────────────────────────────────────
// The form gate must fire even when dishForm contains NO recognized FORM_FAMILIES
// keyword (e.g. "crispy coated chicken pieces" has no "crust", "bake", "stew",
// etc.). Previously the allowed-forms set would stay empty and the check would be
// silently skipped, letting salad/wrap escapes through as mere score failures
// rather than catastrophic deviations. These tests use naturalistic dishForm
// strings that a real LLM decomposition would plausibly produce.

describe("naturalistic dishForm — fried chicken (no FORM_FAMILIES keyword in dishForm)", () => {
  // "crispy coated chicken pieces" contains no recognized form keyword,
  // so the old code would leave allowedForms empty and skip the form check.
  const naturalisticDirective = directive({
    identityAnchor: "This IS fried chicken.",
    definingComponents: ["chicken pieces", "crispy coating", "seasoned crust"],
    adaptableComponents: ["cooking method", "coating flour"],
    dishForm: "crispy coated chicken pieces",  // deliberately no "crust"/"bake"/etc.
    conflicts: [
      { component: "deep frying", guardrail: "GLP-1: no heavy fried fats", directive: "Air-fry or oven-bake the coated chicken. The dish is still fried chicken." },
      { component: "wheat flour coating", guardrail: "anti-inflammatory: limit refined wheat", directive: "Use almond-flour coating. The dish is still fried chicken." },
    ],
  });

  it("salad escape is flagged as form mismatch and catastrophic", () => {
    const r = validateDishIdentity("fried chicken", {
      name: "Crispy Chicken Salad",
      description: "Chopped chicken over greens with a light dressing.",
      ingredients: [{ name: "chicken breast" }, { name: "mixed greens" }, { name: "vinaigrette" }],
    }, naturalisticDirective);
    expect(r.formMismatch).toBe(true);
    expect(r.catastrophicDeviation).toBe(true);
    expect(r.passed).toBe(false);
  });

  it("wrap escape is flagged as form mismatch and catastrophic", () => {
    const r = validateDishIdentity("fried chicken", {
      name: "Crispy Chicken Wrap",
      description: "Chicken and greens rolled in a tortilla.",
      ingredients: [{ name: "chicken" }, { name: "tortilla" }, { name: "greens" }],
    }, naturalisticDirective);
    expect(r.formMismatch).toBe(true);
    expect(r.catastrophicDeviation).toBe(true);
    expect(r.passed).toBe(false);
  });

  it("bowl escape is flagged as form mismatch and catastrophic", () => {
    const r = validateDishIdentity("fried chicken", {
      name: "Fried Chicken Rice Bowl",
      description: "Fried chicken components served over rice in a bowl.",
      ingredients: [{ name: "chicken" }, { name: "rice" }, { name: "sauce" }],
    }, naturalisticDirective);
    expect(r.formMismatch).toBe(true);
    expect(r.catastrophicDeviation).toBe(true);
    expect(r.passed).toBe(false);
  });

  it("correctly adapted oven-baked version still passes", () => {
    const r = validateDishIdentity("fried chicken", {
      name: "Oven-Baked Crispy Fried Chicken",
      description: "Chicken pieces in a crispy almond-flour coating, air-fried until golden.",
      ingredients: [{ name: "chicken thighs" }, { name: "almond flour coating" }, { name: "paprika" }],
    }, naturalisticDirective);
    expect(r.formMismatch).toBe(false);
    expect(r.catastrophicDeviation).toBe(false);
    expect(r.passed).toBe(true);
  });
});

describe("naturalistic dishForm — chicken curry (no FORM_FAMILIES keyword in dishForm)", () => {
  // "spiced sauce with chicken over rice" contains no "stew"/"broth" keyword,
  // so previously the form check would be skipped entirely.
  const naturalisticDirective = directive({
    identityAnchor: "This IS chicken curry.",
    definingComponents: ["chicken pieces", "spiced curry sauce", "aromatic base"],
    adaptableComponents: ["cream base", "rice accompaniment"],
    dishForm: "spiced sauce with chicken over rice",  // no "stew"/"broth" keyword
    conflicts: [],
  });

  it("salad wrap escape is flagged as form mismatch and catastrophic", () => {
    const r = validateDishIdentity("chicken curry", {
      name: "Chicken Curry Salad Wrap",
      description: "Curried chicken folded into a cold tortilla with greens.",
      ingredients: [{ name: "chicken" }, { name: "curry mayo" }, { name: "tortilla" }],
    }, naturalisticDirective);
    expect(r.formMismatch).toBe(true);
    expect(r.catastrophicDeviation).toBe(true);
    expect(r.passed).toBe(false);
  });

  it("soup escape is flagged as form mismatch and catastrophic", () => {
    const r = validateDishIdentity("chicken curry", {
      name: "Chicken Curry Soup",
      description: "A thin brothy curry ladled as soup.",
      ingredients: [{ name: "chicken" }, { name: "curry broth" }, { name: "vegetables" }],
    }, naturalisticDirective);
    expect(r.formMismatch).toBe(true);
    expect(r.catastrophicDeviation).toBe(true);
    expect(r.passed).toBe(false);
  });

  it("correctly adapted coconut curry still passes", () => {
    const r = validateDishIdentity("chicken curry", {
      name: "Coconut Chicken Curry",
      description: "Tender chicken pieces simmered in a spiced coconut curry sauce over an aromatic base.",
      ingredients: [{ name: "chicken thighs" }, { name: "coconut milk curry sauce" }, { name: "aromatic base" }],
    }, naturalisticDirective);
    expect(r.formMismatch).toBe(false);
    expect(r.catastrophicDeviation).toBe(false);
    expect(r.passed).toBe(true);
  });
});

describe("naturalistic dishForm — adobo (no FORM_FAMILIES keyword in dishForm)", () => {
  const naturalisticDirective = directive({
    identityAnchor: "This IS chicken adobo.",
    definingComponents: ["chicken pieces", "vinegar-soy braising liquid", "garlic", "bay leaves"],
    adaptableComponents: ["sodium level", "fat content"],
    dishForm: "braised chicken pieces in tangy sauce",  // "braised" is in FORM_FAMILIES["stew"]
    conflicts: [],
  });

  // "braised" maps to the "stew" family, so this tests the explicit-form path,
  // confirming adobo-as-salad is still caught.
  it("salad escape is flagged as form mismatch and catastrophic", () => {
    const r = validateDishIdentity("chicken adobo", {
      name: "Chicken Adobo Salad",
      description: "Adobo-flavored chicken served cold over greens.",
      ingredients: [{ name: "chicken" }, { name: "vinegar dressing" }, { name: "mixed greens" }],
    }, naturalisticDirective);
    expect(r.formMismatch).toBe(true);
    expect(r.catastrophicDeviation).toBe(true);
    expect(r.passed).toBe(false);
  });
});

describe("naturalistic dishForm — no directive (no dishForm at all)", () => {
  // When no directive is provided the form check is inactive (no dishForm to
  // anchor against). This preserves backward-compatible behaviour for callers
  // that don't yet have a DAL directive.
  it("no form check fires when directive is absent — name score drives result", () => {
    const r = validateDishIdentity("fried chicken", {
      name: "Crispy Chicken Salad",
      description: "Chicken over greens.",
      ingredients: [{ name: "chicken" }, { name: "greens" }],
    });  // no directive
    // formMismatch cannot fire without a directive, but the name score may still fail
    expect(r.formMismatch).toBe(false);
  });

  it("no form check fires when directive has no dishForm", () => {
    const r = validateDishIdentity("fried chicken", {
      name: "Crispy Chicken Salad",
      description: "Chicken over greens.",
      ingredients: [{ name: "chicken" }, { name: "greens" }],
    }, directive({
      definingComponents: ["chicken pieces", "crispy coating"],
      adaptableComponents: ["cooking method"],
      // dishForm intentionally omitted
    }));
    expect(r.formMismatch).toBe(false);
  });
});

// ── Ingredient-modifier suppression ──────────────────────────────────────────
// Form-family keywords used as ingredient adjectives (e.g. "chili sauce",
// "chili powder", "soup dumplings") must NOT trigger the description
// lead-sentence form check. Real format statements ("A hearty chili with…")
// must still be caught.

describe("ingredient-modifier suppression — chili as sauce/powder adjective", () => {
  const enchiladasCase = byLabel("enchiladas");

  it("description opening with 'red chili sauce' is not flagged as stew format", () => {
    // Historically this caused a false-positive catastrophic rejection because
    // 'chili' is in the stew family and the suppression only covered vessel signals.
    const r = validateDishIdentity(enchiladasCase.request, {
      name: "Dairy-Free Chicken Enchiladas",
      description: "Red chili sauce covers corn tortillas rolled around shredded chicken.",
      ingredients: [{ name: "corn tortillas" }, { name: "shredded chicken" }, { name: "red chili sauce" }],
    }, enchiladasCase.directive);
    expect(r.formMismatch).toBe(false);
    expect(r.catastrophicDeviation).toBe(false);
    expect(r.passed).toBe(true);
  });

  it("description opening with 'chili powder' is not flagged as stew format", () => {
    const r = validateDishIdentity(enchiladasCase.request, {
      name: "Spiced Chicken Enchiladas",
      description: "Chili powder and cumin coat the shredded chicken filling inside corn tortillas.",
      ingredients: [{ name: "corn tortillas" }, { name: "shredded chicken" }, { name: "chili powder" }],
    }, enchiladasCase.directive);
    expect(r.formMismatch).toBe(false);
    expect(r.catastrophicDeviation).toBe(false);
    expect(r.passed).toBe(true);
  });

  it("description opening with a genuine stew format statement is still flagged", () => {
    // "A hearty chili with…" — 'chili' is the dish noun, not a modifier.
    const r = validateDishIdentity(enchiladasCase.request, {
      name: "Chicken Enchiladas",
      description: "A hearty chili with shredded chicken and corn tortillas.",
      ingredients: [{ name: "corn tortillas" }, { name: "shredded chicken" }],
    }, enchiladasCase.directive);
    expect(r.formMismatch).toBe(true);
    expect(r.catastrophicDeviation).toBe(true);
  });

  it("modifier occurrence before a genuine format occurrence does not hide the mismatch", () => {
    // "Chili powder seasons this hearty chili with…" — the first 'chili' is
    // suppressed as a modifier, but the second 'chili' is a real format claim
    // and must still be caught.
    const r = validateDishIdentity(enchiladasCase.request, {
      name: "Chicken Enchiladas",
      description: "Chili powder seasons this hearty chili with chicken inside.",
      ingredients: [{ name: "corn tortillas" }, { name: "shredded chicken" }],
    }, enchiladasCase.directive);
    expect(r.formMismatch).toBe(true);
    expect(r.catastrophicDeviation).toBe(true);
  });
});

describe("ingredient-modifier suppression — soup as compound dish name", () => {
  // 'soup' is in the soup family; 'soup dumplings' should not be rejected as
  // a soup-format meal for a dish like wontons or dumplings.
  const dumplingDirective = directive({
    identityAnchor: "This IS soup dumplings (xiaolongbao).",
    definingComponents: ["thin dough wrapper", "pork filling", "broth inside"],
    adaptableComponents: ["pork fat level"],
    dishForm: "steamed filled dumplings with broth inside",
    conflicts: [],
  });

  it("description of soup dumplings is not flagged as soup format", () => {
    const r = validateDishIdentity("soup dumplings", {
      name: "Pork Soup Dumplings",
      description: "Soup dumplings filled with seasoned pork and rich broth, steamed in bamboo.",
      ingredients: [{ name: "thin dough wrapper" }, { name: "pork filling" }, { name: "broth" }],
    }, dumplingDirective);
    expect(r.formMismatch).toBe(false);
    expect(r.catastrophicDeviation).toBe(false);
    expect(r.passed).toBe(true);
  });
});
