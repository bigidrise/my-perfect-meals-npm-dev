import { randomUUID } from "node:crypto";
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { householdProfiles, users } from "@shared/schema";
import {
  emptyMyPerfectMenuPreferences,
  myPerfectMenuCategorySchema,
  myPerfectMenuConceptSchema,
  myPerfectMenuPreferencesSchema,
  type MyPerfectMenuConcept,
  type MyPerfectMenuPreferences,
} from "@shared/myPerfectMenu";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { createHumanFoodRequestScope } from "../services/humanFoodContext/requestScope";
import { buildCreatorHumanFoodPrompt } from "../services/humanFoodContext/adapters";
import { validateHumanFoodResult } from "../services/humanFoodContext/validateHumanFoodResult";
import {
  validateDietaryRestriction,
  type DietaryMode,
} from "../services/guardrails/validators/dietaryRestrictionValidator";
import {
  loadUserProtocolEnvelope,
  scanGeneratedOutput,
  type UserProtocolEnvelope,
} from "../services/protocolEnvelope";
import {
  buildGLP1RecommendationBlock,
  resolveGLP1GlobalContext,
} from "../services/glp1/resolveGLP1GlobalContext";
import { chatJson } from "../utils/openaiSafe";

const router = Router();
const categorySchema = myPerfectMenuCategorySchema;

const subjectSchema = z.object({
  subjectUserId: z.string().uuid().optional(),
});
const generationRequestSchema = subjectSchema.extend({
  ideaType: categorySchema,
});
const clearRequestSchema = subjectSchema.extend({
  ideaType: categorySchema,
});
const generatedResponseSchema = z.object({
  concepts: z.array(myPerfectMenuConceptSchema.omit({ id: true, ideaType: true })).min(3).max(8),
});

type SubjectTarget =
  | { kind: "user"; id: string; label: string | null }
  | { kind: "household"; id: string; label: string };

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
  if (requiredCuisine && normalize(concept.cuisine) !== normalize(requiredCuisine)) {
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
  const target = await resolveSubject(actorUserId, parsed.data.subjectUserId);
  if (!target) return res.status(404).json({ error: "Food profile not found." });
  const preferences = await readPreferences(target);
  return res.json({ categories: preferences.categories, subject: { id: target.id, label: target.label } });
});

router.delete("/concepts", requireAuth, async (req, res) => {
  const parsed = clearRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Choose a category to clear." });
  const actorUserId = String((req as AuthenticatedRequest).authUser.id);
  const target = await resolveSubject(actorUserId, parsed.data.subjectUserId);
  if (!target) return res.status(404).json({ error: "Food profile not found." });
  const updated = await mutatePreferences(actorUserId, target, (current) => {
    const categories = { ...current.categories };
    delete categories[parsed.data.ideaType];
    return { ...current, categories, updatedAt: new Date().toISOString() };
  });
  return res.json({
    categories: updated.categories,
    subject: { id: target.id, label: target.label },
  });
});

router.post("/concepts", requireAuth, async (req, res) => {
  const parsed = generationRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Choose breakfast, lunch, dinner, or snack ideas." });
  }

  const actorUserId = String((req as AuthenticatedRequest).authUser.id);
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
    let glp1Block = "";
    if (target.kind === "user") {
      const glp1 = await resolveGLP1GlobalContext(actorUserId, new Date().toISOString().slice(0, 10), parsed.data.ideaType);
      glp1Block = buildGLP1RecommendationBlock(glp1);
    }

    const stored = await readPreferences(target);
    const priorSignatures = new Set([
      ...stored.recentSignatures.map(normalize),
      ...(stored.categories[parsed.data.ideaType] ?? []).map((concept) => normalize(concept.signature)),
    ]);
    const requiredCuisine = context.flavor.cuisine.available ? context.flavor.cuisine.value : null;
    const accepted: MyPerfectMenuConcept[] = [];
    const rejectedReasons: string[] = [];

    for (let attempt = 0; attempt < 3 && accepted.length < 3; attempt += 1) {
      const generated = generatedResponseSchema.parse(await chatJson({
        temperature: attempt === 0 ? 0.55 : 0.7,
        system: [
          "You create lightweight, fully personalized menu concepts for My Perfect Meals.",
          "Return JSON only with: {\"concepts\":[{\"title\":\"\",\"description\":\"\",\"primaryIngredients\":[\"\"],\"primaryProtein\":null,\"produceItems\":[],\"cuisine\":\"\",\"dietaryEvidence\":[],\"preparationMethod\":\"\",\"signature\":\"\"}]}",
          "Return 3 to 6 candidates. They are concepts, not recipes: no quantities, instructions, nutrition numbers, medical claims, or images.",
          "primaryIngredients must name every meaningful food needed to validate the concept.",
          "signature must be a compact normalized dish-format + protein + method identity.",
          "Every candidate must obey the supplied authoritative context and protocol guidance.",
          requiredCuisine
            ? `Cuisine requirement: every candidate must be recognizably ${requiredCuisine}; adapt that cuisine to higher-priority requirements rather than changing cuisines.`
            : "Use the resolved cuisine guidance when available.",
          "Foods I Enjoy and learned preferences improve ranking but never override protections.",
        ].join("\n"),
        user: [
          buildCreatorHumanFoodPrompt("my_perfect_menu", context, scope.executionState),
          glp1Block,
          `Create ${parsed.data.ideaType} concepts for ${target.label ?? "the person being fed"}.`,
          `Previously shown signatures to avoid immediately: ${[...priorSignatures].join(", ") || "none"}.`,
          rejectedReasons.length ? `Repair these prior validation failures: ${rejectedReasons.slice(-12).join(", ")}.` : "",
          "Vary dish format, primary protein, preparation method, and flavor profile.",
        ].filter(Boolean).join("\n\n"),
      }));

      for (const candidate of generated.concepts) {
        const signature = normalize(candidate.signature);
        const protein = normalize(candidate.primaryProtein);
        if (priorSignatures.has(signature) || accepted.some((item) => normalize(item.signature) === signature)) continue;
        if (protein && accepted.some((item) => normalize(item.primaryProtein) === protein)) continue;
        const violations = conceptViolations(candidate, context, envelope, requiredCuisine);
        if (violations.length) {
          rejectedReasons.push(...violations);
          continue;
        }
        accepted.push({
          ...candidate,
          id: randomUUID(),
          ideaType: parsed.data.ideaType,
        });
        if (accepted.length === 3) break;
      }
    }

    if (accepted.length !== 3) {
      return res.status(422).json({
        error: "We couldn't create three appropriate choices without changing your food context. Please try again.",
        code: "CONCEPT_GOVERNANCE_FAILED",
      });
    }

    const concepts = accepted.slice(0, 3);
    await mutatePreferences(actorUserId, target, (current) => ({
      version: 1,
      categories: { ...current.categories, [parsed.data.ideaType]: concepts },
      recentSignatures: [
        ...concepts.map((concept) => concept.signature),
        ...current.recentSignatures,
      ].slice(0, 24),
      updatedAt: new Date().toISOString(),
    }));
    await scope.completeAuthorization();
    return res.json({ concepts, subject: { id: target.id, label: target.label } });
  } catch (error) {
    await scope.releaseAuthorization().catch(() => {});
    console.error("[my-perfect-menu] concept generation failed", error);
    return res.status(500).json({
      error: "We couldn't create your menu ideas right now. Please try again.",
    });
  }
});

export default router;