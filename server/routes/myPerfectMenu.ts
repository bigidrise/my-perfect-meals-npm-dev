import { randomUUID } from "node:crypto";
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { householdProfiles, users } from "@shared/schema";
import {
  emptyMyPerfectMenuPreferences,
  myPerfectMenuCategorySchema,
  myPerfectMenuPreferencesSchema,
  type MyPerfectMenuCategory,
  type MyPerfectMenuConcept,
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
  hasMeaningfulCulinaryRepetition,
  selectCulinarilyBroadConcepts,
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
import { chatJson } from "../utils/openaiSafe";
import { buildDietPromptBlock } from "../services/allergyGuardrails";
import {
  cuisineLabelsCompatible,
  parseGeneratedMenuCandidates,
  rejectionCategoryCounts,
} from "../services/myPerfectMenu/generationContract";
import {
  resolveMyPerfectMenuBuilderForActor,
  MyPerfectMenuBuilderError,
} from "../services/myPerfectMenu/builderResolver";
import type { MyPerfectMenuBuilderContext } from "@shared/builderNamespaces";

const router = Router();
const categorySchema = myPerfectMenuCategorySchema;

const subjectSchema = z.object({
  subjectUserId: z.string().uuid().optional(),
  requestedBuilderKey: z.string().optional(),
  requestedNamespace: z.string().optional(),
  builderKey: z.string().optional(),
  builderNamespace: z.string().optional(),
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
) {
  const diabetes = target.kind === "user"
    ? await resolveUserGlucoseState(target.id)
    : { state: "NONE", activePreferences: [], preferencesConfigured: false };
  const foods = target.kind === "user"
    ? (await db.select({ value: users.foodsIEnjoy }).from(users).where(eq(users.id, target.id)).limit(1))[0]?.value
    : (await db.select({ value: householdProfiles.foodsIEnjoy }).from(householdProfiles).where(eq(householdProfiles.id, target.id)).limit(1))[0]?.value;
  const parsedFoods = foodsIEnjoyDocumentSchema.safeParse(foods);
  const diabetesApplicable = Boolean(envelope?.hasDiabetes);
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
      escalation: Boolean(envelope?.glp1DailyTolerance?.shouldEscalate),
      adaptationState: envelope?.glp1DailyTolerance?.appetiteLevel ?? "none",
    },
    targetPresence: {
      protocol: Boolean(envelope),
      diabetes: Boolean(envelope?.hasDiabetes),
      glp1: Boolean(glp1?.isActive),
      foodsIEnjoy: parsedFoods.success && parsedFoods.data.items.some((item) => !item.revokedAt),
    },
    builder: { key: builder.key, namespace: builder.namespace },
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

router.get("/concepts", requireAuth, async (req, res) => {
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
    const stamp = await currentStamp(actorUserId, target, category, context, envelope, glp1, builder);
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
  const stamp = await currentStamp(actorUserId, target, "lunch", context, envelope, glp1, builder);
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
  const stamp = await currentStamp(actorUserId, target, parsed.data.ideaType, context, envelope, glp1, builder);
  if (!isMyPerfectMenuContextStampFresh(preferences.contextStamps[parsed.data.ideaType], stamp)) {
    return res.status(409).json({ error: "These menu ideas are based on an older food context. Please refresh them.", code: "MY_PERFECT_MENU_CONTEXT_STALE" });
  }
  return res.json({ valid: true, concept, builder });
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
    const candidatePool: GovernedMenuConcept[] = [];
    const rejectedReasons: string[] = [];
    let accepted: GovernedMenuConcept[] = [];
    const recentCulinaryHistory = stored.recentCulinaryFingerprints.filter(
      (item) => item.occasion === occasion,
    );
    const recentPatternSummary = recentCulinaryHistory
      .slice(0, 48)
      .map((item) => [
        item.dishForm,
        item.preparationStyle,
        item.majorStarchBase || item.primaryProteinBase || "none",
        item.flavorFamily,
        item.texture || "unspecified",
        item.temperature || "unspecified",
      ].join("|"));

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const generatedRaw = await chatJson({
        temperature: attempt === 0 ? 0.55 : 0.7,
        system: [
          "You create lightweight, fully personalized menu concepts for My Perfect Meals.",
          "Return JSON only with: {\"concepts\":[{\"title\":\"\",\"description\":\"\",\"primaryIngredients\":[\"\"],\"primaryProtein\":null,\"produceItems\":[],\"cuisine\":\"\",\"dietaryEvidence\":[],\"preparationMethod\":\"\",\"signature\":\"\",\"culinaryIdentity\":{\"dishForm\":\"\",\"preparationStyle\":\"\",\"texture\":\"\",\"temperature\":\"hot|warm|room_temperature|chilled|frozen\",\"primaryProteinBase\":null,\"majorStarchBase\":null,\"flavorFamily\":\"\",\"cuisineEvidence\":\"\",\"definingComponents\":[\"\"]},\"foodIdentity\":{\"foodRole\":\"dessert|general_snack\",\"polarity\":\"sweet|savory|neutral\",\"formatFamily\":\"cookie|brownie|cake|cupcake|cheesecake|pudding_custard|frozen_dessert|bar|muffin|pie|no_bake_dessert|pastry|confection|general_sweet|general_snack\",\"preparationStyle\":\"baked|frozen|chilled|no_bake|prepared|raw\",\"texture\":\"creamy|crunchy|chewy|soft|crisp|smooth|mixed\"}}]}",
          "Return 3 to 6 candidates. They are concepts, not recipes: no quantities, instructions, nutrition numbers, medical claims, or images.",
          "primaryIngredients must name every meaningful food needed to validate the concept.",
          "signature must be a compact normalized dish-format + protein + method identity.",
          "Include culinaryIdentity for every candidate. It describes the food and supports recommendation breadth; it is not a health or nutrition rule.",
          "Treat changing only the protein, adjective, or cuisine label on an otherwise identical bowl, salad, wrap, plate, or other structure as substantial similarity.",
          "Explore meaningfully different dish forms, bases, preparations, flavors, textures, and temperatures when they fit the person. Do not use quotas or force every dimension to differ.",
          "Do not default to generic healthy-food templates such as bowls, salads, grilled protein with vegetables, yogurt, oatmeal, or wraps.",
          "Every candidate must obey the supplied authoritative context and protocol guidance.",
          requiredCuisine
            ? `Cuisine requirement: every candidate must be recognizably ${requiredCuisine}; adapt that cuisine to higher-priority requirements rather than changing cuisines.`
            : "Use the resolved cuisine guidance when available.",
          "Foods I Enjoy and learned preferences improve ranking but never override protections.",
          parsed.data.ideaType === "snack"
            ? "SNACK DEFINITION: snack is an eating occasion, not a narrow food category. Dessert is a normal possible snack family alongside savory, fruit-based, baked, chilled/frozen, dairy or dairy-alternative, grain-based, and protein-oriented foods. Rank styles from this person's context and recent variety. Do not force a dessert or any sweet/savory quota."
            : "",
          parsed.data.ideaType === "snack"
            ? "For snack candidates, include foodIdentity. Use it for personalization and diversity only, never as a safety or nutrition rule. Do not define appropriateness by a universal calorie range, protein target, fiber target, or artificially tiny portion."
            : "",
        ].join("\n"),
        user: [
          buildCreatorHumanFoodPrompt("my_perfect_menu", context, scope.executionState),
          dietBlock,
          protocolBlock,
          glp1Block,
          `Create ${parsed.data.ideaType} concepts for ${target.label ?? "the person being fed"}.`,
          `Previously shown signatures to avoid immediately: ${[...priorSignatures].join(", ") || "none"}.`,
          `Recent culinary patterns to move beyond when appropriate: ${recentPatternSummary.join(", ") || "none"}.`,
          rejectedReasons.length
            ? `Repair only the missing ${Math.max(0, 3 - candidatePool.length)} position(s). Prior rejection categories: ${Object.keys(rejectionCategoryCounts(rejectedReasons)).join(", ")}. Keep every authoritative constraint above.`
            : "",
          candidatePool.length
            ? `${candidatePool.length} governed candidate(s) are already retained. Generate replacements for missing positions only; broaden compliant culinary structures without changing the person's context or cuisine.`
            : "",
          "Vary dish format, primary protein, preparation method, flavor profile, and—when relevant—food identity dimensions without overriding the person's preferences.",
        ].filter(Boolean).join("\n\n"),
      });
      const generated = parseGeneratedMenuCandidates(generatedRaw, parsed.data.ideaType);
      rejectedReasons.push(...generated.rejectionCodes);

      for (const candidate of generated.candidates) {
        const signature = normalize(candidate.signature);
        if (
          priorSignatures.has(signature) ||
          candidatePool.some((item) => normalize(item.signature) === signature)
        ) continue;
        const violations = conceptViolations(candidate, context, envelope, requiredCuisine);
        if (violations.length) {
          rejectedReasons.push(...violations);
          continue;
        }
        candidatePool.push({
          ...candidate,
          id: randomUUID(),
          ideaType: parsed.data.ideaType,
        } as GovernedMenuConcept);
      }

      accepted = selectCulinarilyBroadConcepts(
        candidatePool,
        occasion,
        recentCulinaryHistory,
        3,
      );
      if (accepted.length === 3 && !hasMeaningfulCulinaryRepetition(accepted, occasion)) break;
    }

    if (accepted.length !== 3) {
      const rejectionCounts = rejectionCategoryCounts(rejectedReasons);
      console.warn("[my-perfect-menu] governed concept repair exhausted", {
        ideaType: parsed.data.ideaType,
        subjectKind: target.kind,
        acceptedCount: accepted.length,
        missingCount: 3 - accepted.length,
        rejectionCounts,
      });
      return res.status(422).json({
        error: "We couldn't find three choices that fit all of your current food needs. Your settings were kept unchanged. Please try again.",
        code: "CONCEPT_REPAIR_EXHAUSTED",
      });
    }

    const concepts = accepted.slice(0, 3);
    const stamp = await currentStamp(actorUserId, target, parsed.data.ideaType, context, envelope, target.kind === "user" ? await resolveGLP1GlobalContext(actorUserId, new Date().toISOString().slice(0, 10), parsed.data.ideaType) : null, builder);
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
    console.error("[my-perfect-menu] concept generation failed", error);
    return res.status(500).json({
      error: "We couldn't create your menu ideas right now. Please try again.",
    });
  }
});

export default router;