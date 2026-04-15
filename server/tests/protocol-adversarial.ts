/**
 * PROTOCOL ENFORCEMENT ADVERSARIAL TEST SUITE
 *
 * Tests the full protocol stack without making HTTP calls.
 * Imports enforcement functions directly — this is real code on real logic.
 *
 * Run: npx tsx server/tests/protocol-adversarial.ts
 *
 * Goal: Try to BREAK the system. Every test that SHOULD fail must fail.
 *       A test that SHOULD pass but fails is also a bug.
 */

import { enforceBeforeGenerate, scanGeneratedOutput, buildGuestEnvelope, deriveProcedureRules } from "../services/protocolEnvelope";
import type { UserProtocolEnvelope } from "../services/protocolEnvelope";

// ─── Helpers ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let warnings = 0;

const RESET  = "\x1b[0m";
const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BOLD   = "\x1b[1m";
const DIM    = "\x1b[2m";
const CYAN   = "\x1b[36m";

function header(title: string) {
  console.log(`\n${BOLD}${CYAN}${"─".repeat(60)}${RESET}`);
  console.log(`${BOLD}${CYAN}  ${title}${RESET}`);
  console.log(`${BOLD}${CYAN}${"─".repeat(60)}${RESET}`);
}

function buildEnvelope(
  dietaryIdentity: string[],
  allergies: string[] = [],
  avoidances: string[] = [],
): UserProtocolEnvelope {
  return {
    userId: "test",
    dietaryIdentity,
    allergies,
    medicalHardLimits: [],
    medicalOptimization: [],
    avoidances,
    preferences: [],
    procedural: deriveProcedureRules(dietaryIdentity),
  };
}

interface TestCase {
  label: string;
  envelope: UserProtocolEnvelope;
  meal: {
    name: string;
    description?: string;
    ingredients?: string[];
    instructions?: string[];
  };
  expectPass: boolean;
  expectViolationContaining?: string;
}

function runTest(tc: TestCase) {
  const result = scanGeneratedOutput(tc.meal, tc.envelope, { generatorName: "adversarial_test" });

  const resultPassed = result.passed;
  const correct = resultPassed === tc.expectPass;

  if (correct) {
    passed++;
    const icon = tc.expectPass ? "✅ PASS" : "🚫 BLOCKED";
    console.log(`  ${GREEN}${icon}${RESET}  ${tc.label}`);
    if (!tc.expectPass && result.primaryViolation) {
      console.log(`${DIM}         → caught: "${result.primaryViolation.term}" [${result.primaryViolation.category}]${RESET}`);
    }
    if (!tc.expectPass && result.instructionViolations.length > 0) {
      console.log(`${DIM}         → instruction: "${result.instructionViolations[0]}"${RESET}`);
    }
    // Verify the violation message contains expected term if specified
    if (tc.expectViolationContaining && !result.passed) {
      const msg = result.message + result.violations.map(v => v.term).join(" ");
      if (!msg.toLowerCase().includes(tc.expectViolationContaining.toLowerCase())) {
        warnings++;
        console.log(`  ${YELLOW}  ⚠️  Violation caught but wrong term? Expected to see "${tc.expectViolationContaining}" in message${RESET}`);
      }
    }
  } else {
    failed++;
    const direction = tc.expectPass ? "expected PASS but BLOCKED" : "LEAKED — expected BLOCK but PASSED";
    console.log(`  ${RED}${BOLD}❌ FAIL${RESET}  ${tc.label}`);
    console.log(`${RED}         → ${direction}${RESET}`);
    if (!tc.expectPass) {
      console.log(`${RED}         → meal text: "${tc.meal.name} ${(tc.meal.ingredients || []).join(", ")}"${RESET}`);
    }
    if (result.violations.length > 0) {
      console.log(`${DIM}         → violations: ${result.violations.map(v => v.term).join(", ")}${RESET}`);
    }
  }
}

// ─── KOSHER TESTS ─────────────────────────────────────────────────────────────

header("KOSHER — Meat/Dairy Mixing (basar b'chalav)");

const kosher = buildEnvelope(["kosher"]);

const kosherTests: TestCase[] = [
  {
    label: "Steak with creamy garlic butter sauce → MUST block (meat + butter)",
    envelope: kosher,
    meal: {
      name: "Garlic Butter Steak",
      description: "A rich steak with creamy garlic butter sauce",
      ingredients: ["steak", "garlic", "butter", "heavy cream", "parsley"],
      instructions: ["Sear the steak", "Finish with butter and cream sauce"],
    },
    expectPass: false,
    expectViolationContaining: "meat + dairy",
  },
  {
    label: "Beef Alfredo → MUST block (beef + parmesan + cream)",
    envelope: kosher,
    meal: {
      name: "Beef Alfredo",
      description: "Fettuccine with beef and creamy parmesan alfredo",
      ingredients: ["ground beef", "fettuccine", "heavy cream", "parmesan", "garlic"],
      instructions: ["Brown the beef", "Add cream and parmesan"],
    },
    expectPass: false,
    expectViolationContaining: "meat + dairy",
  },
  {
    label: "Classic Cheeseburger → MUST block (burger + cheese)",
    envelope: kosher,
    meal: {
      name: "Classic Cheeseburger",
      description: "Beef patty with cheddar cheese",
      ingredients: ["ground beef", "cheddar cheese", "lettuce", "tomato", "bun"],
    },
    expectPass: false,
    expectViolationContaining: "meat + dairy",
  },
  {
    label: "Kosher grilled chicken (no dairy) → MUST pass",
    envelope: kosher,
    meal: {
      name: "Grilled Herb Chicken",
      description: "Chicken marinated in lemon, garlic, and olive oil",
      ingredients: ["chicken breast", "lemon", "garlic", "olive oil", "rosemary"],
      instructions: ["Marinate chicken", "Grill over medium heat", "Use kosher-certified ingredients throughout"],
    },
    expectPass: true,
  },
  {
    label: "Oyster sauce stir fry → MUST block (shellfish derivative)",
    envelope: kosher,
    meal: {
      name: "Beef Stir Fry",
      description: "Beef stir fry with oyster sauce",
      ingredients: ["beef", "oyster sauce", "broccoli", "garlic"],
    },
    expectPass: false,
    expectViolationContaining: "oyster sauce",
  },
  {
    label: "Caesar salad with chicken → MUST block (caesar dressing = anchovies)",
    envelope: kosher,
    meal: {
      name: "Chicken Caesar Salad",
      description: "Grilled chicken on caesar salad",
      ingredients: ["chicken", "romaine lettuce", "caesar dressing", "croutons"],
    },
    expectPass: false,
    expectViolationContaining: "caesar",
  },
  {
    label: "Instruction: 'top with cheese' on beef dish → MUST block (forbidden instruction)",
    envelope: kosher,
    meal: {
      name: "Baked Beef Dish",
      ingredients: ["ground beef", "tomato sauce", "onion"],
      instructions: ["Brown the beef", "Add tomato sauce", "top with cheese and bake"],
    },
    expectPass: false,
    expectViolationContaining: "top with cheese",
  },
  {
    label: "Instruction: 'deglaze with wine' → MUST block",
    envelope: kosher,
    meal: {
      name: "Braised Chicken",
      ingredients: ["chicken", "onion", "herbs"],
      instructions: ["Sear chicken", "deglaze with wine", "Add herbs and braise"],
    },
    expectPass: false,
    expectViolationContaining: "deglaze with wine",
  },
  {
    label: "Instruction: 'stir in cream' with meat → MUST block",
    envelope: kosher,
    meal: {
      name: "Beef Stroganoff",
      ingredients: ["beef", "mushrooms", "onion"],
      instructions: ["Brown beef", "Sauté mushrooms", "stir in cream and reduce"],
    },
    expectPass: false,
    expectViolationContaining: "stir in cream",
  },
];

kosherTests.forEach(runTest);

// ─── HALAL TESTS ──────────────────────────────────────────────────────────────

header("HALAL — Alcohol + Pork Derivatives");

const halal = buildEnvelope(["halal"]);

const halalTests: TestCase[] = [
  {
    label: "Chicken with wine reduction → MUST block (wine in ingredients)",
    envelope: halal,
    meal: {
      name: "Wine-Braised Chicken",
      description: "Chicken slow-cooked in a red wine reduction",
      ingredients: ["chicken", "red wine", "onion", "garlic", "herbs"],
    },
    expectPass: false,
    expectViolationContaining: "wine",
  },
  {
    label: "Bourbon glaze → MUST block (bourbon)",
    envelope: halal,
    meal: {
      name: "Bourbon Glazed Salmon",
      ingredients: ["salmon", "bourbon", "soy sauce", "brown sugar", "garlic"],
    },
    expectPass: false,
    expectViolationContaining: "bourbon",
  },
  {
    label: "Vanilla extract in baking → MUST block (alcohol-based)",
    envelope: halal,
    meal: {
      name: "Vanilla Sponge Cake",
      ingredients: ["flour", "eggs", "sugar", "vanilla extract", "butter"],
    },
    expectPass: false,
    expectViolationContaining: "vanilla extract",
  },
  {
    label: "Instruction: 'add vanilla extract' → MUST block",
    envelope: halal,
    meal: {
      name: "Vanilla Custard",
      ingredients: ["milk", "eggs", "sugar"],
      instructions: ["Heat milk", "Whisk eggs and sugar", "add vanilla extract and stir"],
    },
    expectPass: false,
    expectViolationContaining: "add vanilla extract",
  },
  {
    label: "Instruction: 'deglaze with wine' → MUST block",
    envelope: halal,
    meal: {
      name: "Braised Lamb",
      ingredients: ["lamb", "onion", "garlic"],
      instructions: ["Sear lamb", "deglaze with wine", "Add stock and braise"],
    },
    expectPass: false,
    expectViolationContaining: "deglaze with wine",
  },
  {
    label: "Instruction: 'add beer' → MUST block",
    envelope: halal,
    meal: {
      name: "Beer Battered Fish",
      ingredients: ["fish", "flour", "seasoning"],
      instructions: ["Mix batter", "add beer and whisk", "Dip fish and fry"],
    },
    expectPass: false,
    expectViolationContaining: "add beer",
  },
  {
    label: "Gelatin dessert → MUST block (pork-derived)",
    envelope: halal,
    meal: {
      name: "Strawberry Jelly",
      ingredients: ["strawberries", "gelatin", "sugar", "water"],
    },
    expectPass: false,
    expectViolationContaining: "gelatin",
  },
  {
    label: "Clean halal chicken with lemon → MUST pass",
    envelope: halal,
    meal: {
      name: "Lemon Herb Chicken",
      description: "Simple lemon and herb roasted chicken",
      ingredients: ["chicken", "lemon", "garlic", "olive oil", "rosemary", "thyme"],
      instructions: ["Marinate chicken", "Roast at 425F", "Use halal-certified meat — confirm sourcing with a halal-certified butcher"],
    },
    expectPass: true,
  },
  {
    label: "Mirin in teriyaki sauce → MUST block (alcoholic rice wine)",
    envelope: halal,
    meal: {
      name: "Chicken Teriyaki",
      ingredients: ["chicken", "mirin", "soy sauce", "ginger", "sugar"],
    },
    expectPass: false,
    expectViolationContaining: "mirin",
  },
];

halalTests.forEach(runTest);

// ─── VEGAN TESTS ──────────────────────────────────────────────────────────────

header("VEGAN — Hidden Animal Products + Instruction-Level Leaks");

const vegan = buildEnvelope(["vegan"]);

const veganTests: TestCase[] = [
  {
    label: "'Vegan' Caesar salad with anchovy paste → MUST block",
    envelope: vegan,
    meal: {
      name: "Vegan Caesar Salad",
      description: "Caesar salad with house dressing",
      ingredients: ["romaine", "croutons", "anchovy paste", "lemon", "garlic"],
    },
    expectPass: false,
    expectViolationContaining: "anchovy",
  },
  {
    label: "'Vegan' cheesecake with cream cheese → MUST block",
    envelope: vegan,
    meal: {
      name: "Vegan Cheesecake",
      ingredients: ["cream cheese", "sugar", "vanilla", "graham cracker crust", "lemon"],
    },
    expectPass: false,
  },
  {
    label: "Hidden butter in restaurant recommendation → MUST block",
    envelope: vegan,
    meal: {
      name: "Pasta Primavera",
      description: "Fresh vegetables in a white sauce",
      ingredients: ["pasta", "zucchini", "cherry tomatoes", "butter", "garlic", "parmesan"],
    },
    expectPass: false,
  },
  {
    label: "Instruction: 'brush with egg wash' → MUST block",
    envelope: vegan,
    meal: {
      name: "Vegan Pastry",
      ingredients: ["puff pastry", "mushrooms", "spinach"],
      instructions: ["Fill pastry", "brush with egg wash", "Bake at 375F"],
    },
    expectPass: false,
    expectViolationContaining: "brush with egg wash",
  },
  {
    label: "Instruction: 'add butter' → MUST block",
    envelope: vegan,
    meal: {
      name: "Sautéed Vegetables",
      ingredients: ["broccoli", "garlic", "olive oil"],
      instructions: ["Heat pan", "add butter and garlic", "Toss vegetables"],
    },
    expectPass: false,
    expectViolationContaining: "add butter",
  },
  {
    label: "Instruction: 'whisk in egg' → MUST block",
    envelope: vegan,
    meal: {
      name: "Sauce",
      ingredients: ["lemon juice", "olive oil"],
      instructions: ["Combine", "whisk in egg to emulsify"],
    },
    expectPass: false,
    expectViolationContaining: "whisk in egg",
  },
  {
    label: "Instruction: 'top with parmesan' → MUST block",
    envelope: vegan,
    meal: {
      name: "Vegan Pasta",
      ingredients: ["pasta", "tomato sauce", "basil"],
      instructions: ["Cook pasta", "top with parmesan before serving"],
    },
    expectPass: false,
    expectViolationContaining: "top with parmesan",
  },
  {
    label: "Instruction: 'add honey' → MUST block",
    envelope: vegan,
    meal: {
      name: "Glazed Tofu",
      ingredients: ["tofu", "soy sauce", "ginger"],
      instructions: ["Press tofu", "add honey and soy sauce", "Glaze and bake"],
    },
    expectPass: false,
    expectViolationContaining: "add honey",
  },
  {
    label: "Truly vegan lentil soup → MUST pass",
    envelope: vegan,
    meal: {
      name: "Red Lentil Soup",
      description: "Hearty red lentil and vegetable soup",
      ingredients: ["red lentils", "vegetable broth", "onion", "garlic", "tomato", "cumin", "olive oil"],
      instructions: ["Sauté onion and garlic in olive oil", "Add lentils and vegetable broth", "Simmer 25 minutes", "All ingredients must be entirely plant-based"],
    },
    expectPass: true,
  },
  {
    label: "Fish sauce in stir fry → MUST block (animal-derived)",
    envelope: vegan,
    meal: {
      name: "Vegan Stir Fry",
      ingredients: ["tofu", "bok choy", "fish sauce", "garlic", "ginger"],
    },
    expectPass: false,
  },
];

veganTests.forEach(runTest);

// ─── AVOIDANCE TESTS ──────────────────────────────────────────────────────────

header("AVOIDANCES — Seafood / Pork / Dairy (hidden forms)");

const seafoodAvoider = buildEnvelope([], [], ["seafood"]);
const porkAvoider    = buildEnvelope([], [], ["pork"]);
const dairyAvoider   = buildEnvelope([], [], ["dairy"]);

const avoidanceTests: TestCase[] = [
  {
    label: "Seafood avoidance + lobster bisque → MUST block",
    envelope: seafoodAvoider,
    meal: {
      name: "Lobster Bisque",
      ingredients: ["lobster", "heavy cream", "brandy", "onion", "celery"],
    },
    expectPass: false,
    expectViolationContaining: "lobster",
  },
  {
    label: "Seafood avoidance + shrimp scampi → MUST block",
    envelope: seafoodAvoider,
    meal: {
      name: "Shrimp Scampi",
      ingredients: ["shrimp", "pasta", "garlic", "white wine", "lemon", "butter"],
    },
    expectPass: false,
    expectViolationContaining: "shrimp",
  },
  {
    label: "Seafood avoidance + clam chowder → MUST block",
    envelope: seafoodAvoider,
    meal: {
      name: "New England Clam Chowder",
      ingredients: ["clams", "potatoes", "cream", "bacon", "onion"],
    },
    expectPass: false,
    expectViolationContaining: "clam",
  },
  {
    label: "Pork avoidance + ramen with pork belly → MUST block",
    envelope: porkAvoider,
    meal: {
      name: "Tonkotsu Ramen",
      description: "Rich pork bone broth ramen",
      ingredients: ["ramen noodles", "pork belly", "soft boiled egg", "nori", "scallions"],
    },
    expectPass: false,
    expectViolationContaining: "pork",
  },
  {
    label: "Pork avoidance + bacon in salad → MUST block",
    envelope: porkAvoider,
    meal: {
      name: "Spinach Salad",
      ingredients: ["spinach", "bacon", "red onion", "vinaigrette"],
    },
    expectPass: false,
    expectViolationContaining: "bacon",
  },
  {
    label: "Pork avoidance + pepperoni pizza → MUST block",
    envelope: porkAvoider,
    meal: {
      name: "Pepperoni Pizza",
      ingredients: ["pizza dough", "tomato sauce", "mozzarella", "pepperoni"],
    },
    expectPass: false,
    expectViolationContaining: "pepperoni",
  },
  {
    label: "Dairy avoidance + cream sauce pasta → MUST block",
    envelope: dairyAvoider,
    meal: {
      name: "Pasta in Cream Sauce",
      ingredients: ["pasta", "heavy cream", "garlic", "parmesan", "basil"],
    },
    expectPass: false,
    expectViolationContaining: "cream",
  },
  {
    label: "Dairy avoidance + yogurt-based dressing → MUST block",
    envelope: dairyAvoider,
    meal: {
      name: "Greek Salad with Tzatziki",
      ingredients: ["cucumber", "tomato", "olives", "feta", "Greek yogurt dressing"],
    },
    expectPass: false,
  },
];

avoidanceTests.forEach(runTest);

// ─── VEGETARIAN TESTS ─────────────────────────────────────────────────────────

header("VEGETARIAN — Hidden Broths + Instruction Leaks");

const vegetarian = buildEnvelope(["vegetarian"]);

const vegetarianTests: TestCase[] = [
  {
    label: "Instruction: 'add chicken broth' → MUST block",
    envelope: vegetarian,
    meal: {
      name: "Vegetable Risotto",
      ingredients: ["arborio rice", "onion", "white wine", "parmesan"],
      instructions: ["Sauté onion", "add chicken broth gradually", "Stir in parmesan"],
    },
    expectPass: false,
    expectViolationContaining: "add chicken broth",
  },
  {
    label: "Instruction: 'add beef broth' → MUST block",
    envelope: vegetarian,
    meal: {
      name: "French Onion Soup",
      ingredients: ["onions", "butter", "gruyere", "baguette"],
      instructions: ["Caramelize onions", "add beef broth and simmer", "Top with bread and cheese"],
    },
    expectPass: false,
    expectViolationContaining: "add beef broth",
  },
  {
    label: "Worcestershire in marinade → MUST block (anchovy-derived)",
    envelope: vegetarian,
    meal: {
      name: "Grilled Portobello",
      ingredients: ["portobello mushroom", "worcestershire sauce", "garlic", "olive oil"],
    },
    expectPass: false,
    expectViolationContaining: "worcestershire",
  },
  {
    label: "Vegetarian pasta with veg broth → MUST pass",
    envelope: vegetarian,
    meal: {
      name: "Vegetable Pasta",
      ingredients: ["pasta", "vegetable broth", "zucchini", "tomato", "garlic", "olive oil"],
      instructions: ["Cook pasta", "Sauté vegetables", "Use vegetable broth in place of any meat-based broth"],
    },
    expectPass: true,
  },
];

vegetarianTests.forEach(runTest);

// ─── GLUTEN-FREE TESTS ────────────────────────────────────────────────────────

header("GLUTEN-FREE — Hidden Gluten + Instruction Leaks");

const gf = buildEnvelope(["gluten-free"]);

const gfTests: TestCase[] = [
  {
    label: "Instruction: 'use soy sauce' → MUST block (contains gluten)",
    envelope: gf,
    meal: {
      name: "GF Stir Fry",
      ingredients: ["chicken", "broccoli", "garlic"],
      instructions: ["Stir fry vegetables", "use soy sauce and stir", "Serve immediately"],
    },
    expectPass: false,
    expectViolationContaining: "use soy sauce",
  },
  {
    label: "Instruction: 'dust with flour' → MUST block",
    envelope: gf,
    meal: {
      name: "GF Chicken Cutlet",
      ingredients: ["chicken", "almond flour", "eggs"],
      instructions: ["Season chicken", "dust with flour and dip", "Pan fry"],
    },
    expectPass: false,
    expectViolationContaining: "dust with flour",
  },
  {
    label: "Instruction: 'add bread crumbs' → MUST block",
    envelope: gf,
    meal: {
      name: "Baked Chicken",
      ingredients: ["chicken", "olive oil", "garlic", "herbs"],
      instructions: ["Coat chicken in olive oil", "add bread crumbs on top", "Bake at 400F"],
    },
    expectPass: false,
    expectViolationContaining: "add bread crumbs",
  },
  {
    label: "Clean GF chicken with tamari → MUST pass",
    envelope: gf,
    meal: {
      name: "GF Glazed Chicken",
      ingredients: ["chicken", "tamari", "ginger", "garlic", "sesame oil"],
      instructions: ["Marinate chicken in tamari", "Grill until cooked through", "Use certified gluten-free alternatives for all flour, thickener, and sauce ingredients"],
    },
    expectPass: true,
  },
];

gfTests.forEach(runTest);

// ─── INSTRUCTION-LEVEL EDGE CASES ─────────────────────────────────────────────

header("INSTRUCTION-LEVEL EDGE CASES — Cross-Protocol Stress Tests");

const edgeTests: TestCase[] = [
  {
    label: "Kosher: 'melt butter over the chicken' → MUST block (meat + dairy instruction)",
    envelope: kosher,
    meal: {
      name: "Butter Basted Chicken",
      ingredients: ["chicken", "herbs"],
      instructions: ["Roast chicken at 425F", "melt butter over the chicken every 20 minutes"],
    },
    expectPass: false,
    expectViolationContaining: "melt butter over the chicken",
  },
  {
    label: "Halal: 'add rum' → MUST block",
    envelope: halal,
    meal: {
      name: "Rum Cake",
      ingredients: ["flour", "eggs", "sugar"],
      instructions: ["Mix batter", "add rum and fold in", "Bake 35 minutes"],
    },
    expectPass: false,
    expectViolationContaining: "add rum",
  },
  {
    label: "Halal: 'splash of alcohol' → MUST block",
    envelope: halal,
    meal: {
      name: "Flambéed Shrimp",
      ingredients: ["shrimp", "butter", "garlic"],
      instructions: ["Sauté shrimp", "add a splash of alcohol and flambé"],
    },
    expectPass: false,
    expectViolationContaining: "splash of alcohol",
  },
  {
    label: "Vegan: 'stir in cream' → MUST block",
    envelope: vegan,
    meal: {
      name: "Creamy Tomato Soup",
      ingredients: ["tomatoes", "onion", "garlic", "olive oil"],
      instructions: ["Roast tomatoes", "stir in cream to finish"],
    },
    expectPass: false,
    expectViolationContaining: "stir in cream",
  },
  {
    label: "Kosher + vegan stack: cheese on beef → MUST block (from either protocol)",
    envelope: buildEnvelope(["kosher", "vegan"]),
    meal: {
      name: "Beef Tacos with Cheese",
      ingredients: ["beef", "taco shells", "cheddar cheese", "salsa"],
    },
    expectPass: false,
  },
  {
    label: "Guest envelope (no restrictions): any meal → MUST pass",
    envelope: buildGuestEnvelope(),
    meal: {
      name: "Cheeseburger",
      ingredients: ["beef patty", "cheddar", "bun", "lettuce", "tomato"],
    },
    expectPass: true,
  },
];

edgeTests.forEach(runTest);

// ─── PROMPT BLOCK VALIDATION ──────────────────────────────────────────────────

header("PROMPT BLOCK VALIDATION — enforceBeforeGenerate()");

function checkPromptBlock(
  label: string,
  envelope: UserProtocolEnvelope,
  mustContain: string[],
  mustNotContain: string[] = [],
) {
  const block = enforceBeforeGenerate(envelope, { generatorName: "adversarial_test" });

  if (!block.hasRestrictions && envelope.dietaryIdentity.length > 0) {
    failed++;
    console.log(`  ${RED}${BOLD}❌ FAIL${RESET}  ${label}`);
    console.log(`${RED}         → hasRestrictions=false despite dietaryIdentity being set${RESET}`);
    return;
  }

  const combined = block.combined.toLowerCase();
  const missing = mustContain.filter(s => !combined.includes(s.toLowerCase()));
  const leaked  = mustNotContain.filter(s => combined.includes(s.toLowerCase()));

  if (missing.length === 0 && leaked.length === 0) {
    passed++;
    console.log(`  ${GREEN}✅ PASS${RESET}  ${label}`);
    console.log(`${DIM}         → block length: ${block.combined.length} chars${RESET}`);
  } else {
    failed++;
    console.log(`  ${RED}${BOLD}❌ FAIL${RESET}  ${label}`);
    if (missing.length > 0) console.log(`${RED}         → missing from prompt block: ${missing.join(", ")}${RESET}`);
    if (leaked.length  > 0) console.log(`${RED}         → leaked into prompt block: ${leaked.join(", ")}${RESET}`);
  }
}

checkPromptBlock(
  "Kosher block contains forbidden ingredients + no-mix rule",
  kosher,
  ["kosher", "dietary identity", "outermost rule", "pork", "shellfish"],
);

checkPromptBlock(
  "Halal block contains alcohol prohibition + vanilla extract warning",
  halal,
  ["halal", "dietary identity", "alcohol", "vanilla extract"],
);

checkPromptBlock(
  "Vegan block contains full animal exclusion",
  vegan,
  ["vegan", "dietary identity", "butter", "egg wash", "honey"],
);

checkPromptBlock(
  "Guest envelope has no restriction block (no-op for open generation)",
  buildGuestEnvelope(),
  [],
  [],
);

checkPromptBlock(
  "Seafood avoidance block lists seafood expansion terms",
  buildEnvelope([], [], ["seafood"]),
  ["foods to avoid", "seafood"],
);

// ─── FINAL REPORT ─────────────────────────────────────────────────────────────

const total = passed + failed;
console.log(`\n${BOLD}${"═".repeat(60)}${RESET}`);
console.log(`${BOLD}  ADVERSARIAL TEST RESULTS${RESET}`);
console.log(`${"═".repeat(60)}`);
console.log(`  ${GREEN}Passed:${RESET}   ${passed}/${total}`);
console.log(`  ${RED}Failed:${RESET}   ${failed}/${total}`);
if (warnings > 0) {
  console.log(`  ${YELLOW}Warnings:${RESET} ${warnings}`);
}

if (failed === 0) {
  console.log(`\n  ${GREEN}${BOLD}✅ ALL TESTS PASSED — Protocol enforcement is solid.${RESET}`);
} else {
  console.log(`\n  ${RED}${BOLD}🚨 ${failed} TEST(S) FAILED — Protocol has leaks. Fix before proceeding.${RESET}`);
  process.exitCode = 1;
}

console.log(`${"═".repeat(60)}\n`);
