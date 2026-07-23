/**
 * Deterministic tests for resolveGLP1MealTargets()
 *
 * These tests exercise the resolver with 10 clinical profiles from the spec
 * and assert the exact resolver outputs that should flow into prompts and validators.
 * No DB, no network — pure function tests.
 *
 * Run: npx tsx server/services/glp1/__tests__/resolveGLP1MealTargets.test.ts
 */

import {
  resolveGLP1MealTargets,
  type GLP1UserContext,
  type GLP1MealContext,
  type ResolvedGLP1Targets,
} from '../resolveGLP1MealTargets';
import { validateGLP1Meal } from '../../guardrails/validators/glp1Validator';

// ─────────────────────────────────────────────────────────────────────────────
// PRESET GUARDRAILS
// ─────────────────────────────────────────────────────────────────────────────
const INTRO_GUARDRAILS = { maxMealVolumeMl: 250, proteinMinG: 25, fatMaxG: 10, mealsPerDay: 5 };
const MAINTENANCE_GUARDRAILS = { maxMealVolumeMl: 300, proteinMinG: 30, fatMaxG: 15, mealsPerDay: 4 };
const MUSCLE_PRESERVE_GUARDRAILS = { maxMealVolumeMl: 350, proteinMinG: 40, fatMaxG: 15, mealsPerDay: 4 };

// ─────────────────────────────────────────────────────────────────────────────
// TEST HARNESS
// ─────────────────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failMessages: string[] = [];

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    const msg = `  ❌ FAIL: ${label}`;
    console.log(msg);
    failMessages.push(msg);
  }
}

function section(title: string) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`▶ ${title}`);
  console.log('─'.repeat(60));
}

function printResolved(r: ResolvedGLP1Targets) {
  console.log(`   Phase: ${r.treatmentPhase} | Meals remaining: ${r.plannedMealsRemaining}`);
  console.log(`   Calories: baseline ${r.baselineMealCalories} → resolved ${r.resolvedMealCalories}`);
  console.log(`   Snack cal: baseline ${r.baselineSnackCalories} → resolved ${r.resolvedSnackCalories}`);
  console.log(`   Protein: ${r.targetProteinGrams}g target / ${r.minimumProteinFloor}g floor`);
  console.log(`   Fat: ${r.targetFatGrams}g target / ${r.maximumToleratedFatGrams}g ceiling`);
  console.log(`   Used baseline: ${r.usedBaseline}`);
  console.log(`   Reasons: ${r.resolutionReasons.join(' | ')}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1 — Sedentary smaller patient, strong appetite suppression
// ─────────────────────────────────────────────────────────────────────────────
section('Test 1: Sedentary smaller patient — strong appetite suppression');
{
  const user: GLP1UserContext = {
    dailyCalorieTarget: 1400,
    dailyProteinTarget: 90,
    dailyFatTarget: 47,
    dailyCarbsTarget: 150,
    macroMealsPerDay: 5,
    glp1Guardrails: INTRO_GUARDRAILS,
    appetiteLevel: 'suppressed',
    trainingDemand: 'none',
    musclePreservationPriority: false,
  };
  const meal: GLP1MealContext = {
    mealType: 'lunch',
    remainingMacros: { calories: 980, protein: 63, fat: 33, carbs: 105 },
  };
  const r = resolveGLP1MealTargets(user, meal);
  printResolved(r);

  assert(r.treatmentPhase === 'intro', 'Phase detected as intro (fatMaxG=10)');
  assert(!r.usedBaseline, 'Did not fall back to baseline (has daily targets)');
  // suppressed + intro → meal calories < 400 baseline
  assert(r.resolvedMealCalories < 400, `Resolved calories (${r.resolvedMealCalories}) below 400-cal baseline`);
  assert(r.resolvedMealCalories >= 200, `Resolved calories (${r.resolvedMealCalories}) ≥ 200 kcal minimum`);
  assert(r.maximumToleratedFatGrams <= 10, `Fat ceiling (${r.maximumToleratedFatGrams}g) ≤ 10g (intro phase)`);
  assert(r.minimumProteinFloor === 25, `Protein floor = 25g (intro guardrail)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2 — Average moderately active weight-loss patient
// ─────────────────────────────────────────────────────────────────────────────
section('Test 2: Average moderately active weight-loss patient');
{
  const user: GLP1UserContext = {
    dailyCalorieTarget: 1800,
    dailyProteinTarget: 130,
    dailyFatTarget: 60,
    dailyCarbsTarget: 180,
    macroMealsPerDay: 4,
    glp1Guardrails: MAINTENANCE_GUARDRAILS,
    appetiteLevel: 'reduced',
    trainingDemand: 'light',
    musclePreservationPriority: false,
  };
  const meal: GLP1MealContext = {
    mealType: 'dinner',
    remainingMacros: { calories: 650, protein: 47, fat: 22, carbs: 65 },
  };
  const r = resolveGLP1MealTargets(user, meal);
  printResolved(r);

  assert(r.treatmentPhase === 'maintenance', 'Phase detected as maintenance');
  assert(!r.usedBaseline, 'Did not use baseline');
  // dinner with 2 meals remaining, reduced appetite + light training
  assert(r.resolvedMealCalories > 300, `Resolved calories (${r.resolvedMealCalories}) > 300`);
  assert(r.resolvedMealCalories <= 700, `Resolved calories (${r.resolvedMealCalories}) ≤ 700`);
  assert(r.maximumToleratedFatGrams <= 15, `Fat ceiling ≤ 15g (maintenance guardrail)`);
  assert(r.minimumProteinFloor === 30, `Protein floor = 30g (maintenance guardrail)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3 — Larger resistance-training patient
// ─────────────────────────────────────────────────────────────────────────────
section('Test 3: Larger resistance-training patient (Muscle Preserve)');
{
  const user: GLP1UserContext = {
    dailyCalorieTarget: 2400,
    dailyProteinTarget: 200,
    dailyFatTarget: 80,
    dailyCarbsTarget: 240,
    macroMealsPerDay: 4,
    glp1Guardrails: MUSCLE_PRESERVE_GUARDRAILS,
    appetiteLevel: 'normal',
    trainingDemand: 'heavy',
    musclePreservationPriority: true,
  };
  const meal: GLP1MealContext = {
    mealType: 'lunch',
    remainingMacros: { calories: 1800, protein: 150, fat: 60, carbs: 180 },
  };
  const r = resolveGLP1MealTargets(user, meal);
  printResolved(r);

  assert(r.treatmentPhase === 'muscle_preserve', 'Phase detected as muscle_preserve');
  assert(!r.usedBaseline, 'Did not use baseline');
  // This patient needs more than 400 kcal — resolver should produce > 400
  assert(r.resolvedMealCalories > 400, `Resolved calories (${r.resolvedMealCalories}) ABOVE static 400-cal baseline`);
  assert(r.resolvedMealCalories <= 900, `Resolved calories (${r.resolvedMealCalories}) ≤ 900 kcal clamp`);
  assert(r.targetProteinGrams >= 40, `Protein target (${r.targetProteinGrams}g) ≥ 40g muscle-preserve floor`);
  // Heavy training adds calorie multiplier — verify training demand is modeled
  assert(r.trainingDemand === 'heavy', 'Training demand recorded as heavy');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4 — Endurance cyclist
// ─────────────────────────────────────────────────────────────────────────────
section('Test 4: Endurance cyclist');
{
  const user: GLP1UserContext = {
    dailyCalorieTarget: 2800,
    dailyProteinTarget: 160,
    dailyFatTarget: 80,
    dailyCarbsTarget: 380,
    macroMealsPerDay: 4,
    glp1Guardrails: MAINTENANCE_GUARDRAILS,
    appetiteLevel: 'normal',
    trainingDemand: 'elite',
    musclePreservationPriority: false,
  };
  const meal: GLP1MealContext = {
    mealType: 'breakfast',
    remainingMacros: { calories: 2800, protein: 160, fat: 80, carbs: 380 },
  };
  const r = resolveGLP1MealTargets(user, meal);
  printResolved(r);

  assert(!r.usedBaseline, 'Did not use baseline');
  // Elite training multiplier → large allocation
  assert(r.resolvedMealCalories > 500, `Resolved calories (${r.resolvedMealCalories}) > 500 for elite athlete`);
  assert(r.resolvedMealCalories <= 900, `Resolved calories (${r.resolvedMealCalories}) within 900 kcal clamp`);
  assert(r.resolutionReasons.some(r => r.includes('elite')), 'Elite training demand noted in reasons');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 5 — GLP-1 + Type 2 Diabetes
// ─────────────────────────────────────────────────────────────────────────────
section('Test 5: GLP-1 + Type 2 Diabetes');
{
  const user: GLP1UserContext = {
    dailyCalorieTarget: 1600,
    dailyProteinTarget: 110,
    dailyFatTarget: 53,
    dailyCarbsTarget: 130,
    macroMealsPerDay: 4,
    glp1Guardrails: MAINTENANCE_GUARDRAILS,
    appetiteLevel: 'reduced',
    trainingDemand: 'light',
    activeConstraints: ['diabetic', 'glp1'],
    musclePreservationPriority: false,
  };
  const meal: GLP1MealContext = {
    mealType: 'lunch',
    remainingMacros: { calories: 1100, protein: 76, fat: 37, carbs: 90 },
  };
  const r = resolveGLP1MealTargets(user, meal);
  printResolved(r);

  assert(!r.usedBaseline, 'Did not use baseline');
  assert(r.activeConstraints.includes('diabetic'), 'Diabetes constraint recorded');
  assert(r.resolutionReasons.some(r => r.toLowerCase().includes('diabet')), 'Diabetes stacking noted in reasons');
  assert(r.resolvedMealCalories >= 200, 'Calories ≥ 200 kcal minimum');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 6 — GLP-1 + Renal constraints
// ─────────────────────────────────────────────────────────────────────────────
section('Test 6: GLP-1 + Renal constraints');
{
  const user: GLP1UserContext = {
    dailyCalorieTarget: 1600,
    dailyProteinTarget: 64,  // renal patients often protein-restricted (~0.8g/kg)
    dailyFatTarget: 53,
    dailyCarbsTarget: 220,
    macroMealsPerDay: 4,
    glp1Guardrails: MAINTENANCE_GUARDRAILS,
    appetiteLevel: 'normal',
    trainingDemand: 'none',
    activeConstraints: ['glp1', 'renal', 'kidney-disease'],
    musclePreservationPriority: false,
  };
  const meal: GLP1MealContext = {
    mealType: 'dinner',
    remainingMacros: { calories: 580, protein: 23, fat: 19, carbs: 80 },
  };
  const r = resolveGLP1MealTargets(user, meal);
  printResolved(r);

  assert(!r.usedBaseline, 'Did not use baseline');
  assert(r.activeConstraints.some(c => c.includes('renal')), 'Renal constraint recorded');
  assert(r.resolutionReasons.some(r => r.toLowerCase().includes('renal')), 'Renal constraint flagged in reasons');
  // Protein target should reflect the low daily protein budget (64g total, ~23g remaining)
  assert(r.targetProteinGrams <= 35, `Protein target (${r.targetProteinGrams}g) reflects renal-restricted daily budget`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 7 — GLP-1 + Food allergy
// ─────────────────────────────────────────────────────────────────────────────
section('Test 7: GLP-1 + Food allergy (handled at resolver level as constraint pass-through)');
{
  const user: GLP1UserContext = {
    dailyCalorieTarget: 1800,
    dailyProteinTarget: 130,
    dailyFatTarget: 60,
    dailyCarbsTarget: 180,
    macroMealsPerDay: 4,
    glp1Guardrails: MAINTENANCE_GUARDRAILS,
    appetiteLevel: 'normal',
    trainingDemand: 'none',
    activeConstraints: ['glp1', 'dairy-allergy', 'tree-nut-allergy'],
    musclePreservationPriority: false,
  };
  const meal: GLP1MealContext = {
    mealType: 'breakfast',
    remainingMacros: { calories: 1800, protein: 130, fat: 60, carbs: 180 },
  };
  const r = resolveGLP1MealTargets(user, meal);
  printResolved(r);

  assert(!r.usedBaseline, 'Did not use baseline');
  assert(r.activeConstraints.includes('dairy-allergy'), 'Dairy allergy constraint passed through');
  assert(r.activeConstraints.includes('tree-nut-allergy'), 'Tree-nut allergy constraint passed through');
  // Allergy does not change calorie math — resolver still produces a number
  assert(r.resolvedMealCalories > 0, 'Resolver produced calorie target despite allergy constraints');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 8 — GLP-1 + Hormone therapy context
// ─────────────────────────────────────────────────────────────────────────────
section('Test 8: GLP-1 + Hormone therapy (estrogen/menopause context)');
{
  const user: GLP1UserContext = {
    dailyCalorieTarget: 1500,
    dailyProteinTarget: 110,
    dailyFatTarget: 55,
    dailyCarbsTarget: 140,
    macroMealsPerDay: 4,
    glp1Guardrails: MAINTENANCE_GUARDRAILS,
    appetiteLevel: 'normal',
    trainingDemand: 'light',
    activeConstraints: ['glp1', 'hormone-therapy', 'estrogen'],
    musclePreservationPriority: true,   // menopause → muscle preservation is prioritized
  };
  const meal: GLP1MealContext = {
    mealType: 'lunch',
    remainingMacros: { calories: 1050, protein: 77, fat: 38, carbs: 98 },
  };
  const r = resolveGLP1MealTargets(user, meal);
  printResolved(r);

  assert(!r.usedBaseline, 'Did not use baseline');
  assert(r.musclePreservationPriority, 'Muscle preservation priority active');
  assert(r.resolutionReasons.some(r => r.toLowerCase().includes('muscle')), 'Muscle preservation noted in reasons');
  // Muscle preservation bumps protein
  const baseProtein = r.targetProteinGrams;
  assert(baseProtein >= 30, `Protein target (${baseProtein}g) reflects muscle preservation bump`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 9 — Provider-overridden targets (custom guardrails in glp1_profile)
// ─────────────────────────────────────────────────────────────────────────────
section('Test 9: Provider-overridden targets (custom guardrails)');
{
  const providerOverrideGuardrails = {
    maxMealVolumeMl: 400,
    proteinMinG: 45,   // provider bumped protein for this patient
    fatMaxG: 20,       // provider raised fat ceiling (active/tolerant patient)
    mealsPerDay: 3,
  };
  const user: GLP1UserContext = {
    dailyCalorieTarget: 2200,
    dailyProteinTarget: 180,
    dailyFatTarget: 80,
    dailyCarbsTarget: 200,
    macroMealsPerDay: 3,
    glp1Guardrails: providerOverrideGuardrails,
    appetiteLevel: 'normal',
    trainingDemand: 'moderate',
    musclePreservationPriority: true,
    activeConstraints: ['glp1'],
  };
  const meal: GLP1MealContext = {
    mealType: 'dinner',
    remainingMacros: { calories: 800, protein: 65, fat: 29, carbs: 73 },
  };
  const r = resolveGLP1MealTargets(user, meal);
  printResolved(r);

  assert(!r.usedBaseline, 'Did not use baseline');
  // Provider set fatMaxG=20 — resolver must honor it, not cap to static 12/15g
  assert(r.maximumToleratedFatGrams > 15, `Provider fat ceiling (${r.maximumToleratedFatGrams}g) exceeds static 15g baseline`);
  assert(r.maximumToleratedFatGrams <= 20, `Fat ceiling (${r.maximumToleratedFatGrams}g) ≤ provider-set 20g`);
  // Provider set proteinMinG=45
  assert(r.minimumProteinFloor === 45, `Protein floor (${r.minimumProteinFloor}g) = provider override of 45g`);
  assert(r.mealsPerDay === 3, `Meals per day = 3 (provider-set frequency)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 10 — Patient transitioning OFF GLP-1 therapy
// ─────────────────────────────────────────────────────────────────────────────
section('Test 10: Patient transitioning off GLP-1 (isActive=false)');
{
  const user: GLP1UserContext = {
    dailyCalorieTarget: 2000,
    dailyProteinTarget: 140,
    dailyFatTarget: 67,
    dailyCarbsTarget: 210,
    macroMealsPerDay: 4,
    glp1Guardrails: MAINTENANCE_GUARDRAILS,
    appetiteLevel: 'normal',
    trainingDemand: 'light',
    activeConstraints: [],   // GLP-1 removed from active constraints on discontinuation
    musclePreservationPriority: false,
    isActive: false,         // treatment discontinued
  };
  const meal: GLP1MealContext = {
    mealType: 'lunch',
    remainingMacros: { calories: 1400, protein: 98, fat: 47, carbs: 147 },
  };
  const r = resolveGLP1MealTargets(user, meal);
  printResolved(r);

  // The resolver still runs (it is called only when dietType='glp1', which the
  // route layer would NOT set if treatment is inactive). We verify that:
  // 1. All numeric calculations still produce valid numbers
  // 2. No active constraints remain
  // 3. The daily budget correctly allocates without GLP-1 appetite suppression
  assert(!r.usedBaseline, 'Did not use baseline (daily targets are set)');
  assert(r.activeConstraints.length === 0, 'No active constraints (GLP-1 removed on discontinuation)');
  assert(r.appetiteLevel === 'normal', 'Appetite modeled as normal (no appetite suppression)');
  assert(r.resolvedMealCalories > 400, `Resolved calories (${r.resolvedMealCalories}) > 400 baseline (no suppression)`);

  // Daily targets preserved
  assert(r.dailyCalorieTarget === 2000, 'Daily calorie target preserved');
  assert(r.dailyProteinTarget === 140, 'Daily protein target preserved');
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATOR INTEGRATION — Test that personalized targets change validator behavior
// ─────────────────────────────────────────────────────────────────────────────
section('Validator integration: 13g fat passes for large active patient, fails for intro patient');
{
  const testMeal = {
    name: 'Grilled Salmon with Vegetables',
    ingredients: [
      { name: 'salmon fillet', quantity: '4', unit: 'oz' },
      { name: 'broccoli', quantity: '1', unit: 'cup' },
      { name: 'olive oil', quantity: '1', unit: 'tsp' },
    ],
    macros: { calories: 480, protein: 42, fat: 13, carbs: 18 },
  };

  // Large active patient — fat ceiling 18g → 13g should PASS
  const largeUser: GLP1UserContext = {
    dailyCalorieTarget: 2400, dailyProteinTarget: 200, dailyFatTarget: 80,
    macroMealsPerDay: 4, glp1Guardrails: { ...MUSCLE_PRESERVE_GUARDRAILS, fatMaxG: 22 },
    trainingDemand: 'heavy',
  };
  const largeMeal: GLP1MealContext = {
    mealType: 'lunch', remainingMacros: { calories: 1800, protein: 150, fat: 60 },
  };
  const largeTargets = resolveGLP1MealTargets(largeUser, largeMeal);
  const largeResult = validateGLP1Meal(testMeal, false, largeTargets);

  assert(largeTargets.maximumToleratedFatGrams > 13, `Large patient fat ceiling (${largeTargets.maximumToleratedFatGrams}g) > 13g`);
  const largeFatViolation = largeResult.violations.some(v => v.toLowerCase().includes('fat'));
  assert(!largeFatViolation, `13g fat does NOT violate large active patient (ceiling: ${largeTargets.maximumToleratedFatGrams}g)`);

  // Intro patient — fat ceiling 10g → 13g should FAIL
  const introUser: GLP1UserContext = {
    dailyCalorieTarget: 1400, dailyProteinTarget: 90, dailyFatTarget: 47,
    macroMealsPerDay: 5, glp1Guardrails: INTRO_GUARDRAILS,
    appetiteLevel: 'suppressed',
  };
  const introMealCtx: GLP1MealContext = {
    mealType: 'lunch', remainingMacros: { calories: 980, protein: 63, fat: 33 },
  };
  const introTargets = resolveGLP1MealTargets(introUser, introMealCtx);
  const introResult = validateGLP1Meal(testMeal, false, introTargets);

  assert(introTargets.maximumToleratedFatGrams <= 10, `Intro patient fat ceiling (${introTargets.maximumToleratedFatGrams}g) ≤ 10g`);
  const introFatViolation = introResult.violations.some(v => v.toLowerCase().includes('fat'));
  assert(introFatViolation, `13g fat DOES violate intro patient (ceiling: ${introTargets.maximumToleratedFatGrams}g)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// BASELINE FALLBACK — no targets set
// ─────────────────────────────────────────────────────────────────────────────
section('Baseline fallback: no daily targets → 400/150/15/25 static values');
{
  const user: GLP1UserContext = {
    glp1Guardrails: { proteinMinG: 25, fatMaxG: 15, mealsPerDay: 4 },
  };
  const meal: GLP1MealContext = { mealType: 'dinner' };
  const r = resolveGLP1MealTargets(user, meal);
  printResolved(r);

  assert(r.usedBaseline, 'usedBaseline = true when no daily targets set');
  assert(r.resolvedMealCalories === 400, `Fallback meal calories = 400 (got ${r.resolvedMealCalories})`);
  assert(r.resolvedSnackCalories === 150, `Fallback snack calories = 150 (got ${r.resolvedSnackCalories})`);
  assert(r.resolutionReasons.some(r => r.includes('baseline')), 'Baseline reason stated');
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log(`GLP-1 Resolver Tests: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailed assertions:');
  failMessages.forEach(m => console.log(m));
  process.exit(1);
} else {
  console.log('All tests passed ✅');
}
