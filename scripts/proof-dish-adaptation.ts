/**
 * Proof matrix for the Dish Adaptation Layer (Task: Phases 2–4).
 * Runs the 7 architecture scenarios against the real DAL (live gpt-4o-mini
 * decomposition) + the dish identity validator, plus a mandatory cache proof.
 *
 * Run: npx tsx scripts/proof-dish-adaptation.ts
 */

import {
  getDishAdaptationDirective,
  buildGuardrailContext,
  _clearDalCache,
} from "../server/services/dishAdaptation/dishAdaptationLayer";
import * as dal from "../server/services/dishAdaptation/dishAdaptationLayer";
import { validateDishIdentity } from "../server/services/dishAdaptation/dishIdentityValidator";

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`); }
}
const blockHas = (block: string, ...terms: string[]) =>
  terms.some(t => block.toLowerCase().includes(t.toLowerCase()));

async function main() {
  _clearDalCache();

  // ── 1. Gumbo + diabetic ──────────────────────────────────────────────────
  console.log("\n[1] Gumbo + diabetic");
  const diabeticCtx = buildGuardrailContext({ dietaryIdentity: ["diabetic"] });
  const d1 = await getDishAdaptationDirective("gumbo", diabeticCtx, "first_pass");
  check("directive built", !!d1);
  if (d1) {
    console.log(`     defining: ${d1.definingComponents.join(" | ")}`);
    console.log(`     conflicts: ${d1.conflicts.map(c => `${c.component}→${c.guardrail}`).join("; ") || "(none)"}`);
    check("identity anchor present", d1.identityAnchor.toLowerCase().includes("gumbo"));
    check("adaptationBlock directs cauliflower rice", blockHas(d1.adaptationBlock, "cauliflower rice"), d1.adaptationBlock);
    check("no relaxation of diabetic rules", !blockHas(d1.adaptationBlock, "white rice is allowed", "sugar is allowed"));
    const goodGumbo = {
      name: "Diabetic-Friendly Cajun Gumbo",
      description: "A Cajun stew with shrimp and cauliflower rice in an okra-thickened broth.",
      ingredients: ["shrimp", "cauliflower rice", "okra", "celery", "bell pepper", "onion", "cajun seasoning", "low-sodium chicken stock"],
      instructions: "Simmer the stew until thickened; serve over cauliflower rice.",
    };
    const rGood = validateDishIdentity("gumbo", goodGumbo, d1);
    check(`cauliflower rice gumbo PASSES identity (score ${rGood.score})`, rGood.passed && !rGood.catastrophicDeviation, rGood.failures.join("; "));
    const tilapia = {
      name: "Grilled Tilapia with Green Beans",
      description: "Simply grilled tilapia fillet served with steamed green beans.",
      ingredients: ["tilapia", "green beans", "lemon", "olive oil"],
      instructions: "Grill the tilapia and steam the green beans.",
    };
    const rBad = validateDishIdentity("gumbo", tilapia, d1);
    check(`tilapia/greens flagged CATASTROPHIC (score ${rBad.score})`, rBad.catastrophicDeviation && !rBad.passed, JSON.stringify(rBad));
  }

  // ── Cache proof (mandatory) ──────────────────────────────────────────────
  console.log("\n[cache] Same dish + guardrails → no repeat LLM call");
  const callsBefore = dal._decompositionLlmCalls;
  const d1b = await getDishAdaptationDirective("gumbo", diabeticCtx, "fallback");
  check("cache hit — zero additional LLM calls", dal._decompositionLlmCalls === callsBefore);
  check("fallback rendering carries explicit do-not-substitute language",
    !!d1b && blockHas(d1b.adaptationBlock, "DO NOT return a generic protein plate"));
  check("first_pass block did NOT carry the fallback line",
    !!d1 && !blockHas(d1!.adaptationBlock, "DO NOT return a generic protein plate"));

  // ── 2. Gumbo + diabetic + shellfish override + peanut active ────────────
  console.log("\n[2] Gumbo with shrimp + diabetic + shellfish override, peanut still active");
  const ctx2 = buildGuardrailContext({
    dietaryIdentity: ["diabetic"],
    allergies: ["shellfish", "peanuts"],
    overriddenAllergens: ["shellfish"],
  });
  check("shellfish removed from active allergens", !(ctx2.activeAllergens ?? []).some(a => /shellfish/i.test(a)));
  check("peanuts still active", (ctx2.activeAllergens ?? []).some(a => /peanut/i.test(a)));
  const d2 = await getDishAdaptationDirective("gumbo with shrimp", ctx2, "first_pass");
  check("directive built", !!d2);
  if (d2) {
    check("does NOT direct substituting shrimp away", !d2.conflicts.some(c => /shellfish|shrimp/i.test(c.guardrail)),
      JSON.stringify(d2.conflicts));
    check("still directs cauliflower rice", blockHas(d2.adaptationBlock, "cauliflower rice"));
    const shrimpGumbo = {
      name: "Shrimp and Okra Gumbo",
      description: "Cajun shrimp gumbo over cauliflower rice, okra-thickened.",
      ingredients: ["shrimp", "okra", "cauliflower rice", "onion", "celery", "bell pepper", "cajun seasoning"],
      instructions: "Simmer stew; serve over cauliflower rice.",
    };
    const r2 = validateDishIdentity("gumbo with shrimp", shrimpGumbo, d2);
    check(`shrimp gumbo PASSES identity (score ${r2.score})`, r2.passed, r2.failures.join("; "));
  }

  // ── 3. Lasagna + diabetic ────────────────────────────────────────────────
  console.log("\n[3] Lasagna + diabetic");
  const d3 = await getDishAdaptationDirective("lasagna", diabeticCtx, "first_pass");
  check("directive built", !!d3);
  if (d3) {
    check("directs zucchini/eggplant sheets or chickpea pasta", blockHas(d3.adaptationBlock, "zucchini", "eggplant", "chickpea"), d3.adaptationBlock);
    const zucchiniLasagna = {
      name: "Zucchini Lasagna",
      description: "Layered baked lasagna with zucchini sheets, meat sauce, and ricotta.",
      ingredients: ["zucchini", "ground turkey", "tomato sauce", "ricotta cheese", "mozzarella", "basil"],
      instructions: "Layer zucchini sheets with sauce and cheese; bake.",
    };
    const rGood = validateDishIdentity("lasagna", zucchiniLasagna, d3);
    check(`zucchini lasagna PASSES (score ${rGood.score})`, rGood.passed, rGood.failures.join("; "));
    const proteinBowl = {
      name: "Grilled Chicken Power Bowl",
      description: "Grilled chicken with quinoa and roasted vegetables.",
      ingredients: ["chicken breast", "quinoa", "broccoli", "carrots"],
      instructions: "Grill chicken; assemble bowl.",
    };
    const rBad = validateDishIdentity("lasagna", proteinBowl, d3);
    check(`protein bowl flagged CATASTROPHIC (score ${rBad.score})`, rBad.catastrophicDeviation, JSON.stringify(rBad));
  }

  // ── 4. Mac and cheese + GLP-1 ────────────────────────────────────────────
  console.log("\n[4] Mac and cheese + GLP-1");
  const glp1Ctx = buildGuardrailContext({ dietaryIdentity: [], glp1Active: true });
  const d4 = await getDishAdaptationDirective("mac and cheese", glp1Ctx, "first_pass");
  check("directive built", !!d4);
  if (d4) {
    check("directs reduced-fat sauce / controlled starch portion",
      blockHas(d4.adaptationBlock, "reduced-fat", "small controlled portion", "Greek yogurt"), d4.adaptationBlock);
    check("portion rule injected", blockHas(d4.adaptationBlock, "SMALL to MODERATE", "1–1.5 cups"));
    const glp1Mac = {
      name: "Lightened-Up Mac and Cheese",
      description: "A small portion of chickpea pasta in a reduced-fat cheddar and Greek yogurt sauce — still creamy mac and cheese.",
      ingredients: ["chickpea pasta", "reduced-fat cheddar", "greek yogurt", "milk"],
      instructions: "Cook pasta; stir in light cheese sauce.",
    };
    const r4 = validateDishIdentity("mac and cheese", glp1Mac, d4);
    check(`reduced-carb mac and cheese PASSES (score ${r4.score})`, r4.passed, r4.failures.join("; "));
  }

  // ── 5. Fried rice + diabetic ─────────────────────────────────────────────
  console.log("\n[5] Fried rice + diabetic");
  const d5 = await getDishAdaptationDirective("fried rice", diabeticCtx, "first_pass");
  check("directive built", !!d5);
  if (d5) {
    check("directs cauliflower rice", blockHas(d5.adaptationBlock, "cauliflower rice"), d5.adaptationBlock);
    const cauliFriedRice = {
      name: "Cauliflower Fried Rice",
      description: "Wok-fried cauliflower rice with egg, chicken, and vegetables in umami seasoning.",
      ingredients: ["cauliflower rice", "egg", "chicken", "peas", "carrots", "coconut aminos", "sesame oil"],
      instructions: "Stir-fry everything in the wok.",
    };
    const r5 = validateDishIdentity("fried rice", cauliFriedRice, d5);
    check(`cauliflower fried rice PASSES (score ${r5.score})`, r5.passed, r5.failures.join("; "));
  }

  // ── 6. Pasta + gluten allergy ────────────────────────────────────────────
  console.log("\n[6] Pasta + gluten allergy");
  const glutenCtx = buildGuardrailContext({ dietaryIdentity: [], allergies: ["gluten"] });
  check("gluten allergy activates gluten-free guardrail", glutenCtx.guardrails.some(g => g.id === "gluten-free"));
  const d6 = await getDishAdaptationDirective("pasta with marinara", glutenCtx, "first_pass");
  check("directive built", !!d6);
  if (d6) {
    check("directs gluten-free pasta", blockHas(d6.adaptationBlock, "gluten-free pasta", "chickpea, or lentil"), d6.adaptationBlock);
    const gfPasta = {
      name: "Gluten-Free Pasta Marinara",
      description: "Chickpea pasta tossed in classic marinara sauce.",
      ingredients: ["chickpea pasta", "marinara sauce", "garlic", "basil", "olive oil"],
      instructions: "Boil pasta; toss with sauce.",
    };
    const r6 = validateDishIdentity("pasta with marinara", gfPasta, d6);
    check(`gluten-free pasta PASSES (score ${r6.score})`, r6.passed, r6.failures.join("; "));
    const riceVeg = {
      name: "Rice and Steamed Vegetables",
      description: "Plain rice with steamed seasonal vegetables.",
      ingredients: ["white rice", "zucchini", "carrots"],
      instructions: "Steam and serve.",
    };
    const r6b = validateDishIdentity("pasta with marinara", riceVeg, d6);
    check(`rice-and-vegetables flagged CATASTROPHIC (score ${r6b.score})`, r6b.catastrophicDeviation, JSON.stringify(r6b));
  }

  // ── 7. Bread pudding + lower-sugar ───────────────────────────────────────
  console.log("\n[7] Bread pudding + lower-sugar");
  const lowSugarCtx = buildGuardrailContext({ dietaryIdentity: ["lower-sugar"] });
  const d7 = await getDishAdaptationDirective("bread pudding", lowSugarCtx, "first_pass");
  check("directive built", !!d7);
  if (d7) {
    check("directs sugar-free sweeteners / reduced sugar", blockHas(d7.adaptationBlock, "sugar-free", "reduce total sweetener"), d7.adaptationBlock);
    const lowSugarPudding = {
      name: "Low-Sugar Bread Pudding",
      description: "Warm baked bread pudding with a vanilla-cinnamon custard, sweetened sugar-free.",
      ingredients: ["whole grain bread", "eggs", "milk", "sugar-free sweetener", "vanilla", "cinnamon"],
      instructions: "Soak bread in custard; bake until set.",
    };
    const r7 = validateDishIdentity("bread pudding", lowSugarPudding, d7);
    check(`low-sugar bread pudding PASSES (score ${r7.score})`, r7.passed, r7.failures.join("; "));
    const fruitSalad = {
      name: "Fresh Fruit Salad",
      description: "A bowl of mixed fresh fruit.",
      ingredients: ["strawberries", "melon", "grapes"],
      instructions: "Chop and combine.",
    };
    const r7b = validateDishIdentity("bread pudding", fruitSalad, d7);
    check(`fruit salad flagged CATASTROPHIC (score ${r7b.score})`, r7b.catastrophicDeviation, JSON.stringify(r7b));
  }

  console.log(`\n══════ PROOF MATRIX RESULT: ${passed} passed, ${failed} failed ══════`);
  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
