import { randomUUID } from "node:crypto";
import { Router, type NextFunction, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { householdProfiles, users } from "@shared/schema";
import {
  emptyMyPerfectMenuPreferences,
  myPerfectMenuCategorySchema,
  myPerfectMenuMealSlotSchema,
  myPerfectMenuPreferencesSchema,
  type MyPerfectMenuCategory,
  type MyPerfectMenuConcept,
  type MyPerfectMenuMealSlot,
  type MyPerfectMenuPreferences,
} from "@shared/myPerfectMenu";
import {
  buildMyPerfectMenuContextStamp,
  isMyPerfectMenuContextStampFresh,
  type MyPerfectMenuAuthorityMaterial,
} from "../services/myPerfectMenu/contextStamp";
import { resolveUserGlucoseState } from "../services/glucoseStateResolver";
import { foodsIEnjoyDocumentSchema } from "@shared/foodsIEnjoy";
import {
  buildCulinaryFingerprint,
  type CulinaryConceptInput,
} from "@shared/culinaryIdentity";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { createHumanFoodRequestScope } from "../services/humanFoodContext/requestScope";
import { buildCreatorHumanFoodPrompt } from "../services/humanFoodContext/adapters";
import { validateHumanFoodResult } from "../services/humanFoodContext/validateHumanFoodResult";
import {
  validateDietaryRestriction,
  type DietaryMode,
} from "../services/guardrails/validators/dietaryRestrictionValidator";
import {
  enforceBeforeGenerate,
  loadUserProtocolEnvelope,
  scanGeneratedOutput,
  type UserProtocolEnvelope,
} from "../services/protocolEnvelope";
import {
  buildGLP1RecommendationBlock,
  resolveGLP1GlobalContext,
} from "../services/glp1/resolveGLP1GlobalContext";
import { buildDietPromptBlock } from "../services/allergyGuardrails";
import {
  cuisineLabelsCompatible,
} from "../services/myPerfectMenu/generationContract";
import { generateCulinaryConcepts } from "../services/myPerfectMenu/culinaryConceptEngine";
import {
  resolveMyPerfectMenuBuilderForActor,
  MyPerfectMenuBuilderError,
} from "../services/myPerfectMenu/builderResolver";
import { builderContextFor, type MyPerfectMenuBuilderContext } from "@shared/builderNamespaces";
import { resolveMyPerfectMenuPerformanceContext } from "../services/myPerfectMenu/performanceContext";
import { issuePerformanceAuthorityToken } from "../services/myPerfectMenu/performanceAuthorityToken";

const router = Router();
const categorySchema = myPerfectMenuCategorySchema;

/**
 * Restoration requests repopulate empty in-memory page state and therefore
 * require a complete JSON body on every remount. Remove conditional validators
 * narrowly for these routes so Express cannot convert the response to a
 * bodyless 304, including for clients with an older cached representation.
 */
export function requireFullMyPerfectMenuRestorationPayload(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  delete req.headers["if-none-match"];
  delete req.headers["if-modified-since"];
  res.setHeader("Cache-Control", "private, no-store, no-cache, max-age=0, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
}

const subjectSchema = z.object({
  subjectUserId: z.string().uuid().optional(),
  requestedBuilderKey: z.string().optional(),
  requestedNamespace: z.string().optional(),
  builderKey: z.string().optional(),
  builderNamespace: z.string().optional(),
  destinationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mealSlot: myPerfectMenuMealSlotSchema.optional(),
});
const generationRequestSchema = subjectSchema.extend({
  ideaType: categorySchema,
});
const clearRequestSchema = subjectSchema.extend({
  ideaType: categorySchema,
});
type SubjectTarget =
  | { kind: "user"; id: string; label: string | null }
  | { kind: "household"; id: string; label: string };
type GovernedMenuConcept = MyPerfectMenuConcept & CulinaryConceptInput;

function normalize(value: string | null | undefined): string {
  return String(value ?? "").toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();
}

function requirePerformanceDestination(
  builder: MyPerfectMenuBuilderContext,
  value: { destinationDate?: string; mealSlot?: MyPerfectMenuMealSlot },
): string | null {
  if (builder.key !== "performance_competition") return null;
  if (!value.destinationDate || !value.mealSlot) {
    return "Performance menu ideas require the intended date and meal slot.";
  }
  return null;
}

async function resolveSubject(actorUserId: string, requestedSubjectId?: string): Promise<SubjectTarget | null> {
  const [actor] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      nickname: users.nickname,
      activeHouseholdProfileId: users.activeHouseholdProfileId,
    })
    .from(users)
    .where(eq(users.id, actorUserId))
    .limit(1);
  if (!actor) return null;

  const subjectId = requestedSubjectId ?? actorUserId;
  if (subjectId === actorUserId) {
    return { kind: "user", id: actorUserId, label: actor.nickname ?? actor.firstName };
  }
  if (actor.activeHouseholdProfileId !== subjectId) return null;

  const [profile] = await db
    .select({ id: householdProfiles.id, displayName: householdProfiles.displayName })
    .from(householdProfiles)
    .where(and(
      eq(householdProfiles.id, subjectId),
      eq(householdProfiles.ownerUserId, actorUserId),
    ))
    .limit(1);
  return profile ? { kind: "household", id: profile.id, label: profile.displayName } : null;
}

/**
 * Household profiles do not currently own independent clinical or Performance
 * Builder assignments. Never leak the actor's specialized authority into a
 * person-fed Menu context; use the truthful general authority instead.
 */
export function effectiveBuilderForTarget(
  builder: MyPerfectMenuBuilderContext,
  target: SubjectTarget,
): MyPerfectMenuBuilderContext {
  return target.kind === "household"
    ? builderContextFor("general_nutrition", "default")
    : builder;
}

router.get("/effective-builder", requireAuth, requireFullMyPerfectMenuRestorationPayload, async (req, res) => {
  const parsed = subjectSchema.pick({
    subjectUserId: true,
    requestedBuilderKey: true,
    requestedNamespace: true,
    builderKey: true,
    builderNamespace: true,
  }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid food profile." });
  const actorUserId = String((req as AuthenticatedRequest).authUser.id);
  const target = await resolveSubject(actorUserId, parsed.data.subjectUserId);
  if (!target) return res.status(404).json({ error: "Food profile not found." });
  try {
    const assigned = await resolveMyPerfectMenuBuilderForActor(actorUserId, parsed.data);
    const builder = effectiveBuilderForTarget(assigned, target);
    return res.json({
      subject: { id: target.id, kind: target.kind, label: target.label },
      builder,
    });
  } catch (error) {
    if (error instanceof MyPerfectMenuBuilderError) {
      return res.status(error.code === "INVALID_BUILDER" ? 400 : 403).json({
        error: error.message,
        code: error.code,
      });
    }
    throw error;
  }
});

async function readPreferences(target: SubjectTarget): Promise<MyPerfectMenuPreferences> {
  const rows = target.kind === "user"
    ? await db.select({ value: users.myPerfectMenuPreferences }).from(users).where(eq(users.id, target.id)).limit(1)
    : await db
        .select({ value: householdProfiles.myPerfectMenuPreferences })
        .from(householdProfiles)
        .where(eq(householdProfiles.id, target.id))
        .limit(1);
  const parsed = myPerfectMenuPreferencesSchema.safeParse(rows[0]?.value);
  return parsed.success ? parsed.data : emptyMyPerfectMenuPreferences();
}

async function mutatePreferences(
  actorUserId: string,
  target: SubjectTarget,
  mutate: (current: MyPerfectMenuPreferences) => MyPerfectMenuPreferences,
): Promise<MyPerfectMenuPreferences> {
  return db.transaction(async (transaction) => {
    const rows = target.kind === "user"
      ? await transaction
          .select({ value: users.myPerfectMenuPreferences })
          .from(users)
          .where(eq(users.id, target.id))
          .limit(1)
          .for("update")
      : await transaction
          .select({ value: householdProfiles.myPerfectMenuPreferences })
          .from(householdProfiles)
          .where(and(
            eq(householdProfiles.id, target.id),
            eq(householdProfiles.ownerUserId, actorUserId),
          ))
          .limit(1)
          .for("update");
    if (!rows[0]) throw new Error("My Perfect Menu subject disappeared during update.");
    const parsed = myPerfectMenuPreferencesSchema.safeParse(rows[0].value);
    const updated = mutate(parsed.success ? parsed.data : emptyMyPerfectMenuPreferences());
    if (target.kind === "user") {
      await transaction.update(users).set({ myPerfectMenuPreferences: updated }).where(eq(users.id, target.id));
    } else {
      await transaction
        .update(householdProfiles)
        .set({ myPerfectMenuPreferences: updated, updatedAt: new Date() })
        .where(and(
          eq(householdProfiles.id, target.id),
          eq(householdProfiles.ownerUserId, actorUserId),
        ));
    }
    return updated;
  });
}

async function currentStamp(
  actorUserId: string,
  target: SubjectTarget,
  category: MyPerfectMenuCategory,
  context: any,
  envelope: UserProtocolEnvelope | null,
  glp1: any = null,
  builder: MyPerfectMenuBuilderContext,
  destinationDate?: string,
  mealSlot?: MyPerfectMenuMealSlot,
) {
  const performance = builder.key === "performance_competition"
    ? target.kind === "user"
      ? await resolveMyPerfectMenuPerformanceContext(
        target.id,
        destinationDate ?? new Date().toISOString().slice(0, 10),
        mealSlot ?? (category === "snack" ? "snacks" : category),
      )
      : null
    : null;
  const diabetes = target.kind === "user"
    ? await resolveUserGlucoseState(target.id)
    : { state: "NONE", activePreferences: [], preferencesConfigured: false };
  const foods = target.kind === "user"
    ? (await db.select({ value: users.foodsIEnjoy }).from(users).where(eq(users.id, target.id)).limit(1))[0]?.value
    : (await db.select({ value: householdProfiles.foodsIEnjoy }).from(householdProfiles).where(eq(householdProfiles.id, target.id)).limit(1))[0]?.value;
  const parsedFoods = foodsIEnjoyDocumentSchema.safeParse(foods);
  const diabetesApplicable = Boolean(envelope?.hasDiabetes);
  const glp1Tolerance = envelope?.glp1DailyTolerance;
  const glp1AdaptationState = glp1Tolerance
    ? JSON.stringify({
        appetiteLevel: glp1Tolerance.appetiteLevel,
        nauseaLevel: glp1Tolerance.nauseaLevel,
        hasVomiting: glp1Tolerance.hasVomiting,
        hydrationRisk: glp1Tolerance.hydrationRisk,
        hasReflux: glp1Tolerance.hasReflux,
        hasDiarrhea: glp1Tolerance.hasDiarrhea,
        hasConstipation: glp1Tolerance.hasConstipation,
        shouldEscalate: glp1Tolerance.shouldEscalate,
        nutritionAdaptations: glp1Tolerance.nutritionAdaptations,
      })
    : "none";
  const material: MyPerfectMenuAuthorityMaterial = {
    subject: { kind: target.kind, id: target.id },
    effectiveDiet: context?.diet?.effective ?? envelope?.dietaryIdentity ?? [],
    allergies: context?.allergies?.items ?? envelope?.allergies ?? [],
    avoidances: context?.avoidances?.items ?? envelope?.avoidances ?? [],
    dislikes: context?.preferences?.items ?? envelope?.preferences ?? [],
    cuisine: context?.flavor?.cuisine?.value ?? envelope?.cuisinePreference ?? null,
    foodsIEnjoy: parsedFoods.success
      ? parsedFoods.data.items.filter((item) => !item.revokedAt).map((item) => item.conceptId ?? item.displayLabel)
      : [],
    nutritionPriorities: context?.nutritionPriorities?.selectedPriorityIds ?? [],
    diabetes: {
      applicable: diabetesApplicable,
      state: diabetesApplicable ? diabetes.state : "NONE",
      activePreferences: diabetesApplicable ? diabetes.activePreferences : [],
      producePreferences: diabetesApplicable ? (context?.diabetesFoodPreferences?.produce ?? []) : [],
    },
    protocol: {
      classification: envelope?.dietaryIdentity ?? [],
      active: Boolean(envelope),
      conditionKeys: envelope?.medicalHardLimits ?? [],
    },
    glp1: {
      active: Boolean(glp1?.isActive || envelope?.medicalHardLimits?.some((x: string) => /glp.?1/i.test(x))),
      escalation: Boolean(glp1Tolerance?.shouldEscalate),
      adaptationState: glp1AdaptationState,
    },
    targetPresence: {
      protocol: Boolean(envelope),
      diabetes: Boolean(envelope?.hasDiabetes),
      glp1: Boolean(glp1?.isActive),
      foodsIEnjoy: parsedFoods.success && parsedFoods.data.items.some((item) => !item.revokedAt),
    },
    builder: { key: builder.key, namespace: builder.namespace },
    performance: performance ? {
      dateISO: performance.dateISO,
      slot: performance.slot,
      sessionType: performance.sessionType,
      track: performance.performanceTrack,
      competition: performance.competition,
      demand: performance.demand,
      nutrition: performance.nutrition,
    } : undefined,
  };
  return buildMyPerfectMenuContextStamp(material, category);
}

function dietaryMode(effectiveDiet: string[]): DietaryMode | null {
  for (const diet of effectiveDiet.map(normalize)) {
    if (diet === "vegan" || diet === "vegetarian" || diet === "pescatarian" || diet === "carnivore") {
      return diet;
    }
  }
  return null;
}

function conceptMeal(concept: Omit<MyPerfectMenuConcept, "id" | "ideaType">) {
  return {
    name: concept.title,
    description: concept.description,
    ingredients: concept.primaryIngredients.map((name) => ({ name })),
    instructions: [`Prepare using ${concept.preparationMethod}.`],
    preparationEvidence: "unknown" as const,
  };
}

function conceptViolations(
  concept: Omit<MyPerfectMenuConcept, "id" | "ideaType">,
  context: Awaited<ReturnType<ReturnType<typeof createHumanFoodRequestScope>["resolve"]>>,
  envelope: UserProtocolEnvelope | null,
  requiredCuisine: string | null,
): string[] {
  const violations = validateHumanFoodResult(
    { ingredients: concept.primaryIngredients },
    context,
    { requireNutrition: false },
  ).violations;
  const diet = dietaryMode(context.diet.effective);
  if (diet) {
    const validation = validateDietaryRestriction(conceptMeal(concept), diet);
    if (!validation.isValid) violations.push(...(validation.blockedIngredients ?? []).map((item) => `dietary:${item}`));
  }
  if (requiredCuisine && !cuisineLabelsCompatible(concept.cuisine, requiredCuisine)) {
    violations.push(`cuisine_mismatch:${concept.cuisine}`);
  }
  if (envelope) {
    const protocol = scanGeneratedOutput(conceptMeal(concept), envelope, {
      generatorName: "my-perfect-menu-concepts",
    });
    if (!protocol.passed) violations.push(...protocol.violations.map((item: any) => `protocol:${item.code ?? item.message ?? "violation"}`));
  }
  return violations;
}

router.get("/concepts", requireAuth, requireFullMyPerfectMenuRestorationPayload, async (req, res) => {
  const parsed = subjectSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid food profile." });
  const actorUserId = String((req as AuthenticatedRequest).authUser.id);
  let builder: MyPerfectMenuBuilderContext;
  try {
    builder = await resolveMyPerfectMenuBuilderForActor(actorUserId, parsed.data);
  } catch (error) {
    if (error instanceof MyPerfectMenuBuilderError) return res.status(error.code === "INVALID_BUILDER" ? 400 : 403).json({ error: error.message, code: error.code });
    throw error;
  }
  const target = await resolveSubject(actorUserId, parsed.data.subjectUserId);
  if (!target) return res.status(404).json({ error: "Food profile not found." });
  builder = effectiveBuilderForTarget(builder, target);
  const destinationError = requirePerformanceDestination(builder, parsed.data);
  if (destinationError) return res.status(400).json({ error: destinationError, code: "PERFORMANCE_DESTINATION_REQUIRED" });
  const preferences = await readPreferences(target);
  const scope = createHumanFoodRequestScope({
    actorUserId, subjectUserId: target.id, creator: "my_perfect_menu",
    actionRequest: "read menu concepts", authorizationAction: "my_perfect_menu",
  });
  let context: any = await scope.resolve();
  if (target.kind === "household") context = { ...context, nutrition: null, diabetesFoodPreferences: null, behavior: null };
  const envelope = target.kind === "user"
    ? await loadUserProtocolEnvelope(actorUserId)
    : await loadUserProtocolEnvelope(actorUserId, target.id);
  const glp1 = target.kind === "user"
    ? await resolveGLP1GlobalContext(actorUserId, new Date().toISOString().slice(0, 10), "lunch")
    : null;
  const categories: Partial<Record<MyPerfectMenuCategory, MyPerfectMenuConcept[]>> = {};
  const staleCategories: MyPerfectMenuCategory[] = [];
  for (const category of ["breakfast", "lunch", "dinner", "snack"] as MyPerfectMenuCategory[]) {
    if (!preferences.categories[category]) continue;
    const stamp = await currentStamp(actorUserId, target, category, context, envelope, glp1, builder, parsed.data.destinationDate, parsed.data.mealSlot ?? (category === "snack" ? "snacks" : category));
    if (isMyPerfectMenuContextStampFresh(preferences.contextStamps[category], stamp)) {
      categories[category] = preferences.categories[category];
    } else staleCategories.push(category);
  }
  return res.json({ categories, staleCategories, subject: { id: target.id, label: target.label }, builder });
});

router.get("/context-status", requireAuth, async (req, res) => {
  const parsed = subjectSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: "Invalid food profile." });
  const actorUserId = String((req as AuthenticatedRequest).authUser.id);
  let builder: MyPerfectMenuBuilderContext;
  try {
    builder = await resolveMyPerfectMenuBuilderForActor(actorUserId, parsed.data);
  } catch (error) {
    if (error instanceof MyPerfectMenuBuilderError) return res.status(error.code === "INVALID_BUILDER" ? 400 : 403).json({ error: error.message, code: error.code });
    throw error;
  }
  const target = await resolveSubject(actorUserId, parsed.data.subjectUserId);
  if (!target) return res.status(404).json({ error: "Food profile not found." });
  builder = effectiveBuilderForTarget(builder, target);
  const destinationError = requirePerformanceDestination(builder, parsed.data);
  if (destinationError) return res.status(400).json({ error: destinationError, code: "PERFORMANCE_DESTINATION_REQUIRED" });
  const glucose = target.kind === "user" ? await resolveUserGlucoseState(target.id) : null;
  const glp1 = target.kind === "user"
    ? await resolveGLP1GlobalContext(target.id, new Date().toISOString().slice(0, 10), "lunch")
    : { isActive: false };
  const scope = createHumanFoodRequestScope({
    actorUserId, subjectUserId: target.id, creator: "my_perfect_menu",
    actionRequest: "read context status", authorizationAction: "my_perfect_menu",
  });
  let context: any = await scope.resolve();
  if (target.kind === "household") context = { ...context, nutrition: null, diabetesFoodPreferences: null, behavior: null };
  const envelope = target.kind === "user"
    ? await loadUserProtocolEnvelope(actorUserId)
    : await loadUserProtocolEnvelope(actorUserId, target.id);
  const stamp = await currentStamp(actorUserId, target, "lunch", context, envelope, glp1, builder, parsed.data.destinationDate, parsed.data.mealSlot ?? "lunch");
  return res.json({
    subject: { id: target.id, kind: target.kind, label: target.label },
    diabetes: target.kind === "user" ? {
      applicable: Boolean(envelope?.hasDiabetes),
      state: glucose?.state ?? "NONE",
      needsRefresh: glucose?.state === "STALE" || glucose?.state === "NONE",
      ageMinutes: glucose?.ageMinutes ?? null,
      criticalLow: Boolean(glucose?.criticalLow),
      criticalHigh: Boolean(glucose?.criticalHigh),
    } : { applicable: false, state: "NONE", needsRefresh: false, ageMinutes: null, criticalLow: false, criticalHigh: false },
    glp1: { active: Boolean(glp1.isActive), shouldEscalate: Boolean(envelope?.glp1DailyTolerance?.shouldEscalate), hasCurrentAdaptations: Boolean(envelope?.glp1DailyTolerance) },
    contextFingerprint: stamp.digest,
    builder,
  });
});

router.delete("/concepts", requireAuth, async (req, res) => {
  const parsed = clearRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Choose a category to clear." });
  const actorUserId = String((req as AuthenticatedRequest).authUser.id);
  let builder: MyPerfectMenuBuilderContext;
  try {
    builder = await resolveMyPerfectMenuBuilderForActor(actorUserId, parsed.data);
  } catch (error) {
    if (error instanceof MyPerfectMenuBuilderError) return res.status(error.code === "INVALID_BUILDER" ? 400 : 403).json({ error: error.message, code: error.code });
    throw error;
  }
  const target = await resolveSubject(actorUserId, parsed.data.subjectUserId);
  if (!target) return res.status(404).json({ error: "Food profile not found." });
  builder = effectiveBuilderForTarget(builder, target);
  const updated = await mutatePreferences(actorUserId, target, (current) => {
    const categories = { ...current.categories };
    delete categories[parsed.data.ideaType];
    const contextStamps = { ...current.contextStamps };
    delete contextStamps[parsed.data.ideaType];
    return { ...current, categories, contextStamps, updatedAt: new Date().toISOString() };
  });
  return res.json({
    categories: updated.categories,
    subject: { id: target.id, label: target.label },
    builder,
  });
});

router.post("/validate-selection", requireAuth, async (req, res) => {
  const parsed = subjectSchema.extend({
    ideaType: categorySchema,
    conceptId: z.string().min(1).max(100),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Choose a valid menu concept." });
  const actorUserId = String((req as AuthenticatedRequest).authUser.id);
  let builder: MyPerfectMenuBuilderContext;
  try {
    builder = await resolveMyPerfectMenuBuilderForActor(actorUserId, parsed.data);
  } catch (error) {
    if (error instanceof MyPerfectMenuBuilderError) return res.status(error.code === "INVALID_BUILDER" ? 400 : 403).json({ error: error.message, code: error.code });
    throw error;
  }
  const target = await resolveSubject(actorUserId, parsed.data.subjectUserId);
  if (!target) return res.status(404).json({ error: "Food profile not found." });
  builder = effectiveBuilderForTarget(builder, target);
  const destinationError = requirePerformanceDestination(builder, parsed.data);
  if (destinationError) return res.status(400).json({ error: destinationError, code: "PERFORMANCE_DESTINATION_REQUIRED" });
  const preferences = await readPreferences(target);
  const concept = (preferences.categories[parsed.data.ideaType] ?? []).find((item) => item.id === parsed.data.conceptId);
  if (!concept) return res.status(404).json({ error: "Menu concept not found." });
  const scope = createHumanFoodRequestScope({
    actorUserId, subjectUserId: target.id, creator: "my_perfect_menu",
    actionRequest: "validate menu selection", authorizationAction: "my_perfect_menu",
  });
  let context: any = await scope.resolve();
  if (target.kind === "household") context = { ...context, nutrition: null, diabetesFoodPreferences: null, behavior: null };
  const envelope = target.kind === "user"
    ? await loadUserProtocolEnvelope(actorUserId)
    : await loadUserProtocolEnvelope(actorUserId, target.id);
  const glp1 = target.kind === "user"
    ? await resolveGLP1GlobalContext(actorUserId, new Date().toISOString().slice(0, 10), parsed.data.ideaType)
    : null;
  const stamp = await currentStamp(actorUserId, target, parsed.data.ideaType, context, envelope, glp1, builder, parsed.data.destinationDate, parsed.data.mealSlot);
  if (!isMyPerfectMenuContextStampFresh(preferences.contextStamps[parsed.data.ideaType], stamp)) {
    return res.status(409).json({ error: "These menu ideas are based on an older food context. Please refresh them.", code: "MY_PERFECT_MENU_CONTEXT_STALE" });
  }
  const performance = builder.key === "performance_competition"
    ? await resolveMyPerfectMenuPerformanceContext(target.id, parsed.data.destinationDate!, parsed.data.mealSlot!)
    : null;
  const performanceAuthorityToken = performance
    ? issuePerformanceAuthorityToken({
        actorUserId,
        subjectUserId: target.id,
        conceptId: concept.id,
        destinationDate: parsed.data.destinationDate!,
        mealSlot: parsed.data.mealSlot!,
        builderKey: "performance_competition",
        concept: {
          id: concept.id,
          ideaType: concept.ideaType,
          title: concept.title,
          description: concept.description,
          signature: concept.signature,
          primaryIngredients: concept.primaryIngredients,
        },
        authority: performance,
      })
    : null;
  return res.json({ valid: true, concept, builder, performance, performanceAuthorityToken });
});

router.post("/concepts", requireAuth, async (req, res) => {
  const parsed = generationRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Choose breakfast, lunch, dinner, or snack ideas." });
  }

  const actorUserId = String((req as AuthenticatedRequest).authUser.id);
  let builder: MyPerfectMenuBuilderContext;
  try {
    builder = await resolveMyPerfectMenuBuilderForActor(actorUserId, parsed.data);
  } catch (error) {
    if (error instanceof MyPerfectMenuBuilderError) return res.status(error.code === "INVALID_BUILDER" ? 400 : 403).json({ error: error.message, code: error.code });
    throw error;
  }
  const target = await resolveSubject(actorUserId, parsed.data.subjectUserId);
  if (!target) return res.status(404).json({ error: "Food profile not found." });
  builder = effectiveBuilderForTarget(builder, target);
  const destinationError = requirePerformanceDestination(builder, parsed.data);
  if (destinationError) return res.status(400).json({ error: destinationError, code: "PERFORMANCE_DESTINATION_REQUIRED" });

  const scope = createHumanFoodRequestScope({
    actorUserId,
    subjectUserId: target.id,
    creator: "my_perfect_menu",
    correlationId: (req as any).id,
    actionRequest: `${parsed.data.ideaType} ideas`,
    authorizationAction: "my_perfect_menu",
  });

  try {
    let context = await scope.resolve();
    if (context.status === "review_required" || context.status === "blocked") {
      return res.status(409).json({
        error: context.notices[0] || "We couldn't safely resolve the food profile for these ideas.",
        code: "HUMAN_FOOD_CONTEXT_UNRESOLVED",
      });
    }

    // Protocol and medication overlays are user-account scoped. Never silently
    // substitute the owner's clinical state for a household-only profile.
    if (target.kind === "household") {
      context = Object.freeze({
        ...context,
        nutrition: null,
        diabetesFoodPreferences: null,
        behavior: null,
      });
    }
    const envelope = target.kind === "user"
      ? await loadUserProtocolEnvelope(actorUserId)
      : await loadUserProtocolEnvelope(actorUserId, target.id);
    if (!envelope) {
      return res.status(409).json({
        error: "We couldn't safely resolve the food profile for these ideas.",
        code: "PROTOCOL_CONTEXT_UNRESOLVED",
      });
    }
    const protocolBlock = enforceBeforeGenerate(envelope, {
      generatorName: "my-perfect-menu-concepts",
    }).combined;
    const performance = builder.key === "performance_competition"
      ? target.kind === "user"
        ? await resolveMyPerfectMenuPerformanceContext(target.id, parsed.data.destinationDate!, parsed.data.mealSlot!)
        : null
      : null;
    if (builder.key === "performance_competition" && !performance) {
      return res.status(409).json({
        error: "Performance setup is not available for this person yet.",
        code: "PERFORMANCE_CONTEXT_UNRESOLVED",
      });
    }
    let glp1Block = "";
    if (target.kind === "user") {
      const glp1 = await resolveGLP1GlobalContext(actorUserId, new Date().toISOString().slice(0, 10), parsed.data.ideaType);
      glp1Block = buildGLP1RecommendationBlock(glp1);
    }
    if (target.kind === "user" && envelope.glp1DailyTolerance?.shouldEscalate) {
      return res.status(409).json({
        error: "Your current GLP-1 symptoms need a safety check-in before generating menu ideas.",
        code: "GLP1_SAFETY_ESCALATION",
        guidance: "Please complete today's check-in or contact your care team if symptoms are severe.",
      });
    }

    const stored = await readPreferences(target);
    const priorSignatures = new Set([
      ...stored.recentSignatures.map(normalize),
      ...(stored.categories[parsed.data.ideaType] ?? []).map((concept) => normalize(concept.signature)),
    ]);
    const requiredCuisine = context.flavor.cuisine.available ? context.flavor.cuisine.value : null;
    const dietBlock = buildDietPromptBlock(context.diet.effective);
    const occasion = parsed.data.ideaType as MyPerfectMenuCategory;
    const recentCulinaryHistory = stored.recentCulinaryFingerprints.filter(
      (item) => item.occasion === occasion,
    );
    const generated = await generateCulinaryConcepts({
      occasion,
      subjectLabel: target.label ?? "the person being fed",
      requiredCuisine,
      history: recentCulinaryHistory,
      priorSignatures: [...priorSignatures],
      userContext: [
        buildCreatorHumanFoodPrompt("my_perfect_menu", context, scope.executionState),
        dietBlock,
        protocolBlock,
        glp1Block,
        performance
          ? `PERFORMANCE AUTHORITY (server-resolved): date=${performance.dateISO}; meal slot=${performance.slot}; session=${performance.sessionType ?? "unscheduled"}; track=${performance.performanceTrack ?? "athletic"}; demand=${JSON.stringify(performance.demand)}; nutrition=${JSON.stringify(performance.nutrition)}. Honor this authority. Zero starch means no starchy foods, not zero total carbohydrates.`
          : "",
      ],
      validate: (concept) => conceptViolations(concept, context, envelope, requiredCuisine),
    });
    const concepts: GovernedMenuConcept[] = generated.concepts.map((concept) => ({
      ...concept,
      id: randomUUID(),
      ideaType: parsed.data.ideaType,
    }));
    const stamp = await currentStamp(actorUserId, target, parsed.data.ideaType, context, envelope, target.kind === "user" ? await resolveGLP1GlobalContext(actorUserId, parsed.data.destinationDate ?? new Date().toISOString().slice(0, 10), parsed.data.ideaType) : null, builder, parsed.data.destinationDate, parsed.data.mealSlot);
    await mutatePreferences(actorUserId, target, (current) => ({
      version: 1,
      categories: { ...current.categories, [parsed.data.ideaType]: concepts },
      recentSignatures: [
        ...concepts.map((concept) => concept.signature),
        ...current.recentSignatures,
      ].slice(0, 24),
      recentCulinaryFingerprints: [
        ...concepts.map((concept) => buildCulinaryFingerprint(concept, occasion)),
        ...current.recentCulinaryFingerprints,
      ].slice(0, 96),
      contextStamps: { ...current.contextStamps, [parsed.data.ideaType]: stamp },
      updatedAt: new Date().toISOString(),
    }));
    await scope.completeAuthorization();
    return res.json({ concepts, subject: { id: target.id, label: target.label }, builder });
  } catch (error) {
    await scope.releaseAuthorization().catch(() => {});
    if (error instanceof Error && "code" in error &&
      typeof error.code === "string" && error.code.startsWith("CONCEPT_") &&
      "status" in error && typeof error.status === "number") {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    console.error("[my-perfect-menu] concept generation failed", error);
    return res.status(500).json({
      error: "We couldn't create your menu ideas right now. Please try again.",
    });
  }
});

export default router;