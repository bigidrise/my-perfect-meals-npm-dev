import { weeklyMealPlanningServiceA } from "./weeklyMealPlanningServiceA";
import { enforceWeeklyCaps, meetsVariety } from "./rulesEngine";
import { getUserTimezone } from "./nutritionDayService";
import { resolveHumanFoodContext } from "./humanFoodContext/resolveHumanFoodContext";
import { validateHumanFoodCandidate } from "./humanFoodContext/finalValidation";
import { createHumanFoodRequestExecutionState } from "./humanFoodContext/requestExecutionState";
import { validateMealForDiet } from "./guardrails";

export class WeeklyMealGenerationError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 422) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export interface CanonicalWeeklyGenerationInput {
  userId: string;
  weeks?: number;
  mealsPerDay?: number;
  snacksPerDay?: number;
  targets?: { calories: number; protein: number; carbs?: number; fats?: number };
  dietOverride?: string;
  correlationId?: string;
  startDateISO?: string;
}

export interface CanonicalDayRegenerationInput {
  userId: string;
  existingPlan: any;
  dayIndex: number;
  targets?: CanonicalWeeklyGenerationInput["targets"];
  dietOverride?: string;
  correlationId?: string;
}

export interface CanonicalMealRerollInput extends CanonicalDayRegenerationInput {
  mealIndex: number;
  excludeItemId?: string;
}

const iso = (date: Date) => date.toISOString().slice(0, 10);

function localToday(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

/** Sunday is day 0 in the persisted meal-board convention. */
function sundayFor(dateISO: string): string {
  const date = new Date(`${dateISO}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return iso(date);
}

function addDays(dateISO: string, days: number): string {
  const date = new Date(`${dateISO}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
}

function candidateFrom(meal: any, context?: any) {
  const candidate: any = {
    name: meal.name,
    description: meal.description,
    category: meal.type ?? meal.mealType,
    ingredients: meal.ingredients,
    instructions: meal.steps ?? meal.instructions,
    nutrition: {
      calories: Number(meal.calories ?? meal.nutrition?.calories),
      protein: Number(meal.protein ?? meal.nutrition?.protein_g ?? meal.nutrition?.protein),
      carbs: Number(meal.carbs ?? meal.nutrition?.carbs_g ?? meal.nutrition?.carbs),
      fat: Number(meal.fat ?? meal.nutrition?.fat_g ?? meal.nutrition?.fat),
      starchyCarbs: Number(meal.starchyCarbs ?? 0),
    },
    // This describes the generated recipe's supplied structure; it does not
    // assert clinical or dietary compliance, which the validator must decide.
    evidence: {
      sourceType: "generated_recipe" as const,
      ingredientEvidence: "structured_generation" as const,
      preparationEvidence: "structured_generation" as const,
      nutritionEvidence: "structured_generation" as const,
      cuisine: meal.cuisine,
    },
  };
  const conditions = (context?.safety?.healthConditions ?? []).map((v: any) => String(v).toLowerCase());
  const guardrailMeal = {
    name: String(meal.name ?? ""),
    ingredients: (meal.ingredients ?? []).map((i: any) => ({
      name: String(typeof i === "string" ? i : i.name ?? i.item ?? ""),
      quantity: String(i.quantity ?? i.amount ?? ""), unit: i.unit,
    })),
    instructions: meal.steps ?? meal.instructions,
    macros: candidate.nutrition,
  };
  try {
    if (conditions.some((v: string) => v.includes("diabet"))) {
      candidate.evidence.diabetesCompliant = validateMealForDiet(guardrailMeal, "diabetic", undefined, meal.type === "snack").isValid;
    }
    if (conditions.some((v: string) => v.includes("glp 1") || v.includes("semaglutide") || v.includes("tirzepatide"))) {
      candidate.evidence.glp1Compliant = validateMealForDiet(guardrailMeal, "glp1", undefined, meal.type === "snack").isValid;
    }
  } catch {
    // A validator failure is deliberately represented as non-compliance.
    if (conditions.some((v: string) => v.includes("diabet"))) candidate.evidence.diabetesCompliant = false;
    if (conditions.some((v: string) => v.includes("glp 1") || v.includes("semaglutide") || v.includes("tirzepatide"))) candidate.evidence.glp1Compliant = false;
  }
  return candidate;
}

async function generateCanonicalDay(input: {
  userId: string; dateISO: string; dayIndex: number; mealsPerDay?: number;
  snacksPerDay?: number; targets?: CanonicalWeeklyGenerationInput["targets"];
  dietOverride?: string; correlationId?: string; excludeItemId?: string;
  context?: Awaited<ReturnType<typeof resolveHumanFoodContext>>;
  executionState?: ReturnType<typeof createHumanFoodRequestExecutionState>;
}) {
  const context = input.context ?? await resolveHumanFoodContext({
    actorUserId: input.userId, subjectUserId: input.userId, creator: "weekly_meal_plan",
    dateISO: input.dateISO, excludeItemId: input.excludeItemId,
    dietOverride: input.dietOverride, correlationId: input.correlationId,
  });
  if (context.status === "blocked" || context.status === "review_required") {
    throw new WeeklyMealGenerationError("HUMAN_FOOD_CONTEXT_UNRESOLVED", `Food context for ${input.dateISO} is ${context.status}.`);
  }
  const source = await weeklyMealPlanningServiceA.generate({
    weeks: 1, mealsPerDay: input.mealsPerDay ?? 3, snacksPerDay: input.snacksPerDay ?? 0,
    targets: input.targets ?? { calories: 2000, protein: 140 },
    diet: context.diet.effective[0] ?? "balanced",
    medicalFlags: context.safety.healthConditions, userAllergens: context.safety.allergies,
  } as any);
  const meals = source.plan?.[0]?.days?.[input.dayIndex]?.meals;
  if (!Array.isArray(meals) || !meals.length) throw new WeeklyMealGenerationError("CANDIDATE_DAY_INCOMPLETE", `No meals generated for ${input.dateISO}.`);
  const execution = input.executionState ?? createHumanFoodRequestExecutionState();
  const validated = meals.map((meal: any) => {
    const validation = validateHumanFoodCandidate(candidateFrom(meal, context), context, { executionState: execution });
    if (validation.outcome !== "pass") {
      throw new WeeklyMealGenerationError(validation.outcome === "repairable" ? "CANDIDATE_REPAIR_REQUIRED" : "CANDIDATE_REJECTED",
        `Candidate for ${input.dateISO} failed final validation: ${validation.findings.map(f => f.code).join(", ")}.`);
    }
    return { ...meal, humanFoodValidation: validation };
  });
  return { day: { day: input.dayIndex, date: input.dateISO, meals: validated }, context, source };
}

/**
 * The sole weekly generator boundary. Candidate sources are deliberately kept
 * candidate-only: no source output is returned or persisted before this
 * service resolves a date-specific context and attaches final validation.
 */
export async function generateCanonicalWeeklyMealPlan(input: CanonicalWeeklyGenerationInput) {
  const weeks = Math.max(1, Math.min(4, input.weeks ?? 1));
  const mealsPerDay = Math.max(1, Math.min(3, input.mealsPerDay ?? 3));
  const snacksPerDay = Math.max(0, Math.min(3, input.snacksPerDay ?? 0));
  const targets = input.targets ?? { calories: 2000, protein: 140 };
  const timezone = await getUserTimezone(input.userId);
  const startDate = input.startDateISO ? sundayFor(input.startDateISO) : sundayFor(localToday(timezone));
  const dates = Array.from({ length: weeks * 7 }, (_, index) => addDays(startDate, index));

  const contexts = await Promise.all(dates.map(async (dateISO) => {
    const context = await resolveHumanFoodContext({
      actorUserId: input.userId,
      subjectUserId: input.userId,
      creator: "weekly_meal_plan",
      dateISO,
      correlationId: input.correlationId,
      dietOverride: input.dietOverride,
    });
    if (context.status === "blocked" || context.status === "review_required") {
      throw new WeeklyMealGenerationError(
        "HUMAN_FOOD_CONTEXT_UNRESOLVED",
        `Food context for ${dateISO} is ${context.status}; no plan was generated.`,
      );
    }
    return context;
  }));

  const source = await weeklyMealPlanningServiceA.generate({
    weeks, mealsPerDay, snacksPerDay, targets,
    diet: contexts[0].diet.effective[0] ?? "balanced",
    medicalFlags: contexts[0].safety.healthConditions,
    userAllergens: contexts[0].safety.allergies,
  } as any);
  const sourceWeeks = Array.isArray(source.plan) ? source.plan : (source.plan as any)?.weeks;
  if (!Array.isArray(sourceWeeks) || sourceWeeks.length !== weeks) {
    throw new WeeklyMealGenerationError("CANDIDATE_WEEK_INCOMPLETE", "Candidate source did not produce every requested week.");
  }

  const execution = createHumanFoodRequestExecutionState();
  const normalizedWeeks = sourceWeeks.map((week: any, weekIndex: number) => {
    if (!Array.isArray(week.days) || week.days.length !== 7) {
      throw new WeeklyMealGenerationError("CANDIDATE_WEEK_INCOMPLETE", "Candidate source did not produce seven days.");
    }
    const days = week.days.map((day: any, dayIndex: number) => {
      const context = contexts[weekIndex * 7 + dayIndex];
      if (!Array.isArray(day.meals) || !day.meals.length) {
        throw new WeeklyMealGenerationError("CANDIDATE_DAY_INCOMPLETE", `No meals generated for ${dates[weekIndex * 7 + dayIndex]}.`);
      }
      const meals = day.meals.map((meal: any) => {
        const validation = validateHumanFoodCandidate(candidateFrom(meal, context), context, { executionState: execution });
        if (validation.outcome !== "pass") {
          // A repair needs a materially different candidate source. Legacy
          // sources cannot safely transform/relabel this candidate, so fail
          // closed rather than persisting a purported repair.
          throw new WeeklyMealGenerationError(
            validation.outcome === "repairable" ? "CANDIDATE_REPAIR_REQUIRED" : "CANDIDATE_REJECTED",
            `Candidate for ${dates[weekIndex * 7 + dayIndex]} failed final validation: ${validation.findings.map(f => f.code).join(", ")}.`,
          );
        }
        return { ...meal, humanFoodValidation: validation };
      });
      return { ...day, day: dayIndex, date: dates[weekIndex * 7 + dayIndex], meals };
    });
    const mealGroups = days.map((day: any) => day.meals);
    const caps = enforceWeeklyCaps(mealGroups);
    const variety = meetsVariety(mealGroups);
    if (!caps.withinCaps || !variety.ok) {
      throw new WeeklyMealGenerationError("WEEK_VARIETY_OR_CAPS_FAILED", "Candidate week failed final variety or cap validation.");
    }
    return { ...week, week: weekIndex + 1, days };
  });

  return {
    plan: { weeks: normalizedWeeks, weekStartDate: startDate, timezone },
    meta: {
      ...source.meta,
      canonicalGenerator: "weekly-human-food.v2f",
      validationStatus: "pass",
      contextFingerprints: contexts.map(context => context.internalFingerprint),
      dates,
    },
  };
}

function canonicalDays(plan: any): any[] {
  const days = plan?.weeks?.[0]?.days ?? plan?.days;
  if (!Array.isArray(days) || days.length !== 7) {
    throw new WeeklyMealGenerationError("EXISTING_WEEK_INVALID", "The existing week cannot be safely regenerated.");
  }
  return days;
}

/** Replaces one day only; all other day objects retain their original identity. */
export async function regenerateCanonicalWeeklyDay(input: CanonicalDayRegenerationInput) {
  const oldDays = canonicalDays(input.existingPlan);
  if (!Number.isInteger(input.dayIndex) || input.dayIndex < 0 || input.dayIndex > 6) {
    throw new WeeklyMealGenerationError("DAY_INDEX_INVALID", "dayIndex must identify Sunday through Saturday.", 400);
  }
  const dateISO = oldDays[input.dayIndex]?.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO ?? "")) throw new WeeklyMealGenerationError("MEAL_DATE_UNRESOLVED", "The requested day has no user-local date.");
  const generated = await generateCanonicalDay({
    userId: input.userId, dateISO, dayIndex: input.dayIndex,
    mealsPerDay: oldDays[input.dayIndex].meals?.length, targets: input.targets,
    dietOverride: input.dietOverride, correlationId: input.correlationId,
  });
  const days = oldDays.slice();
  days[input.dayIndex] = generated.day;
  const plan = input.existingPlan?.weeks
    ? { ...input.existingPlan, weeks: [{ ...input.existingPlan.weeks[0], days }, ...input.existingPlan.weeks.slice(1)] }
    : { ...input.existingPlan, days };
  return { plan, meta: { operation: "day_regeneration", dayIndex: input.dayIndex, contextFingerprint: generated.context.internalFingerprint } };
}

/**
 * Replaces exactly one slot. The old reservation is excluded when resolving
 * the replacement date so planned allocation is not double counted.
 */
export async function rerollCanonicalWeeklyMeal(input: CanonicalMealRerollInput) {
  const oldDays = canonicalDays(input.existingPlan);
  const oldDay = oldDays[input.dayIndex];
  if (!oldDay || !Array.isArray(oldDay.meals) || !oldDay.meals[input.mealIndex]) {
    throw new WeeklyMealGenerationError("MEAL_SLOT_INVALID", "The requested meal slot does not exist.", 400);
  }
  const dateISO = oldDay.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO ?? "")) {
    throw new WeeklyMealGenerationError("MEAL_DATE_UNRESOLVED", "The requested meal has no user-local date.");
  }
  const context = await resolveHumanFoodContext({
    actorUserId: input.userId, subjectUserId: input.userId, creator: "weekly_meal_plan",
    dateISO, excludeItemId: input.excludeItemId ?? oldDay.meals[input.mealIndex].id,
    dietOverride: input.dietOverride, correlationId: input.correlationId,
  });
  if (context.status === "blocked" || context.status === "review_required") {
    throw new WeeklyMealGenerationError("HUMAN_FOOD_CONTEXT_UNRESOLVED", `Food context for ${dateISO} is ${context.status}.`);
  }
  const oldSignature = `${oldDay.meals[input.mealIndex].name}|${JSON.stringify(oldDay.meals[input.mealIndex].ingredients ?? [])}`;
  const executionState = createHumanFoodRequestExecutionState();
  let replacement: any;
  let validation: any;
  // Exactly two source candidates at most. The immutable context and request
  // execution state are intentionally reused for both attempts.
  for (let attempt = 0; attempt < 2; attempt++) {
    const source = await weeklyMealPlanningServiceA.generate({
      weeks: 1, mealsPerDay: Math.max(3, oldDay.meals.length), snacksPerDay: 0,
      targets: input.targets ?? { calories: 2000, protein: 140 },
      diet: context.diet.effective[0] ?? "balanced",
      medicalFlags: context.safety.healthConditions, userAllergens: context.safety.allergies,
    } as any);
    const candidate = source.plan?.[0]?.days?.[input.dayIndex]?.meals?.[input.mealIndex];
    if (!candidate) throw new WeeklyMealGenerationError("REROLL_CANDIDATE_MISSING", "No replacement candidate was generated.");
    const duplicate = oldSignature === `${candidate.name}|${JSON.stringify(candidate.ingredients ?? [])}`;
    const result = duplicate ? null : validateHumanFoodCandidate(candidateFrom(candidate, context), context, { executionState });
    if (!duplicate && result?.outcome === "pass") { replacement = candidate; validation = result; break; }
    // blocked/review-required are terminal; only duplicate/repairable gets one alternate.
    if (!duplicate && result && result.outcome !== "repairable") {
      throw new WeeklyMealGenerationError("CANDIDATE_REJECTED", `Replacement failed final validation: ${result.findings.map(f => f.code).join(", ")}.`);
    }
    if (attempt === 1) {
      throw new WeeklyMealGenerationError(duplicate ? "REROLL_NOT_MATERIALLY_DIFFERENT" : "CANDIDATE_REPAIR_REQUIRED",
        duplicate ? "Candidate source repeated the existing meal." : "Alternate replacement requires repair.");
    }
  }
  const meals = oldDay.meals.slice();
  meals[input.mealIndex] = { ...replacement, humanFoodValidation: validation };
  const days = oldDays.slice();
  days[input.dayIndex] = { ...oldDay, meals };
  const plan = input.existingPlan?.weeks
    ? { ...input.existingPlan, weeks: [{ ...input.existingPlan.weeks[0], days }, ...input.existingPlan.weeks.slice(1)] }
    : { ...input.existingPlan, days };
  return { plan, meta: { operation: "meal_reroll", dayIndex: input.dayIndex, mealIndex: input.mealIndex, contextFingerprint: context.internalFingerprint } };
}