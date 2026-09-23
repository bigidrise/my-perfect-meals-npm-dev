import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireAuth } from "../middleware/requireAuth";
import { oneTouchRequestSchema, type OneTouchRequest, type OneTouchConcept } from "@shared/oneTouch";
import { generateOneTouchDirections } from "../services/oneTouch/directions";
import { appendOneTouchHistory, readOneTouchHistory, saveOneTouchConceptSet } from "../services/oneTouch/history";
import { completeMenuRecipe, type MenuRecipeCard } from "../services/oneTouch/menuRecipeCompletion";
import { createHumanFoodRequestScope } from "../services/humanFoodContext/requestScope";
import { buildCreatorHumanFoodPrompt } from "../services/humanFoodContext/adapters";
import { enforceBeforeGenerate, loadUserProtocolEnvelope } from "../services/protocolEnvelope";
import { withOneTouchDiet } from "../services/oneTouch/dietAuthority";
import { buildDietPromptBlock } from "../services/allergyGuardrails";
import { buildGLP1RecommendationBlock, resolveGLP1GlobalContext } from "../services/glp1/resolveGLP1GlobalContext";
import { oneTouchContextFingerprint, oneTouchChangedAuthorityBranches } from "../services/oneTouch/contextFingerprint";
import { directionToFingerprint } from "@shared/oneTouch";

// Server authority for both experimental Creator Menus. Production stays off
// unless explicitly enabled; a client build flag alone cannot open this route.
export function isCreatorMenuEnabled(
  environment: { NODE_ENV?: string; CREATOR_MENU_ENABLED?: string } = {
    NODE_ENV: process.env.NODE_ENV,
    CREATOR_MENU_ENABLED: process.env.CREATOR_MENU_ENABLED,
  },
): boolean {
  return environment.NODE_ENV === "development" ||
    (environment.NODE_ENV === "production" && environment.CREATOR_MENU_ENABLED === "true");
}

export const ONE_TOUCH_CREATE_ENABLED = isCreatorMenuEnabled();

const allowedDiets = new Set(["vegan", "vegetarian", "pescatarian", "keto", "paleo", "gluten-free", "kosher", "halal", "carnivore"]);
const allowedCuisines = new Set(["american", "soul food", "mexican", "italian", "indian", "chinese", "japanese", "mediterranean", "thai", "korean", "middle eastern", "greek", "french", "caribbean", "vietnamese", "ethiopian"]);

function explicitValue(value: { mode: string; value?: string }): string | undefined {
  return value.mode === "explicit" ? value.value : undefined;
}

function toCreatorCard(card: MenuRecipeCard) {
  return {
    ...card,
    id: `menu-${randomUUID()}`,
    calories: card.nutrition.calories,
    protein: card.nutrition.protein,
    carbs: card.nutrition.carbs,
    fat: card.nutrition.fat,
    starchyCarbs: card.nutrition.starchyCarbs,
    reasoning: "",
    medicalBadges: [],
  };
}

function stop(status: number, code: string, error: string): never {
  throw Object.assign(new Error(error), { oneTouchStop: true, status, code });
}

function requestOverrides(request: OneTouchRequest) {
  const cuisineOverride = explicitValue({ ...request.cuisine, mode: request.cuisine.mode })?.trim().toLowerCase();
  const dietOverride = explicitValue({ ...request.eatingStyle, mode: request.eatingStyle.mode })?.trim().toLowerCase();
  if ((cuisineOverride && !allowedCuisines.has(cuisineOverride)) ||
      (dietOverride && !allowedDiets.has(dietOverride))) return null;
  return { cuisineOverride, dietOverride };
}

async function resolveOneTouchAuthority(userId: string, request: OneTouchRequest, correlationId?: string) {
  const overrides = requestOverrides(request);
  if (!overrides) stop(400, "ONE_TOUCH_INVALID_REQUEST", "Choose a listed cuisine and dietary preference.");
  const scope = createHumanFoodRequestScope({
    actorUserId: userId,
    subjectUserId: userId,
    creator: request.creator,
    correlationId,
    dietOverride: overrides.dietOverride ?? null,
    cuisine: overrides.cuisineOverride ?? null,
  });
  const context = await scope.resolve();
  if (context.status === "review_required" || context.status === "blocked") {
    stop(409, "ONE_TOUCH_CONTEXT_UNRESOLVED", context.notices[0] || "Your food context needs review.");
  }
  const profileEnvelope = await loadUserProtocolEnvelope(userId);
  if (!profileEnvelope) stop(409, "ONE_TOUCH_CONTEXT_UNRESOLVED", "Your food protections could not be resolved.");
  const envelope = withOneTouchDiet(profileEnvelope, overrides.dietOverride);
  const glp1 = await resolveGLP1GlobalContext(userId, new Date().toISOString().slice(0, 10), "lunch");
  if (glp1.isActive && !glp1.resolvedTargets) stop(503, "ONE_TOUCH_CONTEXT_UNRESOLVED", "Your current GLP-1 targets could not be verified.");
  if (profileEnvelope.glp1DailyTolerance?.shouldEscalate) stop(409, "ONE_TOUCH_CONTEXT_UNRESOLVED", "Your current GLP-1 symptoms need a safety check-in first.");
  const contextFingerprint = oneTouchContextFingerprint(request, context, envelope, glp1);
  return { scope, context, envelope, glp1, contextFingerprint, ...overrides };
}

export default function createOneTouchRouter() {
  const router = Router();
  router.post("/context-fingerprint", requireAuth, async (req, res) => {
    if (!ONE_TOUCH_CREATE_ENABLED) return res.status(503).json({ code: "ONE_TOUCH_NOT_AVAILABLE" });
    const parsed = oneTouchRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ code: "ONE_TOUCH_INVALID_REQUEST" });
    try {
      const authority = await resolveOneTouchAuthority(String((req as any).authUser.id), parsed.data, (req as any).id);
      return res.json({ contextFingerprint: authority.contextFingerprint });
    } catch (error: any) {
      return res.status(error?.oneTouchStop ? error.status : 503).json({
        code: error?.oneTouchStop ? error.code : "ONE_TOUCH_CONTEXT_UNRESOLVED",
        error: error?.oneTouchStop ? error.message : "Your current food protections could not be verified.",
      });
    }
  });
  router.post("/restore", requireAuth, async (req, res) => {
    if (!ONE_TOUCH_CREATE_ENABLED) return res.status(503).json({ code: "ONE_TOUCH_NOT_AVAILABLE" });
    const parsed = oneTouchRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ code: "ONE_TOUCH_INVALID_REQUEST" });
    res.set("Cache-Control", "private, no-store, no-cache, max-age=0, must-revalidate");
    try {
      const userId = String((req as any).authUser.id);
      const authority = await resolveOneTouchAuthority(userId, parsed.data, (req as any).id);
      const stored = (await readOneTouchHistory(userId)).workingSets?.[parsed.data.creator];
      const valid = stored?.contextFingerprint === authority.contextFingerprint &&
        JSON.stringify(stored.request) === JSON.stringify(parsed.data);
      return res.json({ concepts: valid ? stored.concepts : [], contextFingerprint: authority.contextFingerprint });
    } catch (error: any) {
      return res.status(error?.oneTouchStop ? error.status : 503).json({
        code: error?.oneTouchStop ? error.code : "ONE_TOUCH_CONTEXT_UNRESOLVED",
        error: error?.oneTouchStop ? error.message : "Your food protections could not be verified.",
      });
    }
  });
  router.post("/choose", requireAuth, async (req, res) => {
    if (!ONE_TOUCH_CREATE_ENABLED) return res.status(503).json({ code: "ONE_TOUCH_NOT_AVAILABLE" });
    const parsed = z.object({
      request: oneTouchRequestSchema,
      conceptId: z.string().uuid(),
    }).strict().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ code: "ONE_TOUCH_INVALID_REQUEST", error: "Choose a valid Menu idea." });
    const { conceptId, request } = parsed.data;
    const userId = String((req as any).authUser.id);
    try {
      const authority = await resolveOneTouchAuthority(userId, request, (req as any).id);
      const stored = (await readOneTouchHistory(userId)).workingSets?.[request.creator];
      if (!stored || stored.contextFingerprint !== authority.contextFingerprint ||
          JSON.stringify(stored.request) !== JSON.stringify(request)) {
        stop(409, "ONE_TOUCH_CONTEXT_UNRESOLVED", "Your Menu ideas are no longer current. Please generate new ideas.");
      }
      const selected = stored.concepts.find((concept) => concept.id === conceptId);
      if (!selected) stop(404, "ONE_TOUCH_INVALID_SELECTION", "That Menu idea is not in your current choices.");
      const overrides = requestOverrides(request)!;
      const { id: _conceptId, ...approvedConcept } = selected;
      const result = await completeMenuRecipe({
        actorUserId: userId,
        subject: { id: userId, kind: "account" },
        approvedConcept,
        servings: request.servings,
        cuisine: overrides.cuisineOverride ?? (request.cuisine.mode === "surprise" ? selected.cuisine : null),
        dietaryDirection: overrides.dietOverride,
        clinicalMealSlot: "lunch",
        contextCreator: request.creator,
      });
      if (result.ok === false) {
        if (result.code === "requirement_evidence_unsupported" || result.code === "protocol_clinical_rejected") {
          stop(422, "ONE_TOUCH_REQUIREMENT_UNAVAILABLE",
            "We can't safely complete this Menu option with your current nutrition settings yet. Your settings have not been changed.");
        }
        if (result.code === "unresolved_authority" || result.code === "unauthorized_subject") {
          stop(409, "ONE_TOUCH_CONTEXT_UNRESOLVED", "Your current food protections could not be verified.");
        }
        stop(result.retryable ? 502 : 422, "ONE_TOUCH_RECIPE_REJECTED",
          "We couldn't safely complete this selected idea. Please choose another or try again.");
      }
      // A concurrent Try 3 More or preference change cannot authorize an old choice.
      const latest = await resolveOneTouchAuthority(userId, request, (req as any).id);
      const currentSet = (await readOneTouchHistory(userId)).workingSets?.[request.creator];
      if (latest.contextFingerprint !== authority.contextFingerprint ||
          currentSet?.contextFingerprint !== authority.contextFingerprint ||
          !currentSet.concepts.some((concept) => concept.id === conceptId)) {
        stop(409, "ONE_TOUCH_CONTEXT_UNRESOLVED", "Your Menu choices changed while the recipe was being made.");
      }
      await appendOneTouchHistory(userId, request.creator, [{ ...directionToFingerprint(selected), creator: request.creator }]);
      return res.json({ meal: toCreatorCard(result.card) });
    } catch (error: any) {
      console.error("[OneTouch] Selection could not complete:", error?.code ?? error?.message);
      return res.status(error?.oneTouchStop ? error.status : 503).json({
        code: error?.oneTouchStop ? error.code : "ONE_TOUCH_CONTEXT_UNRESOLVED",
        error: error?.oneTouchStop ? error.message : "Your current food protections could not be verified.",
      });
    }
  });
  router.post("/", requireAuth, async (req, res) => {
    if (!ONE_TOUCH_CREATE_ENABLED) {
      return res.status(503).json({
        code: "ONE_TOUCH_NOT_AVAILABLE",
        error: "Creator Menus are not available right now.",
        retryable: true,
      });
    }
    const parsed = oneTouchRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: "ONE_TOUCH_INVALID_REQUEST", error: "Invalid Creator Menu request." });
    }
    const { creator, cuisine } = parsed.data;
    const overrides = requestOverrides(parsed.data);
    if (!overrides) {
      return res.status(400).json({ code: "ONE_TOUCH_INVALID_REQUEST", error: "Choose a listed cuisine and dietary preference." });
    }
    const userId = String((req as any).authUser.id);
    try {
      const { scope, context, envelope, glp1, contextFingerprint } =
        await resolveOneTouchAuthority(userId, parsed.data, (req as any).id);
      const requiredCuisine = cuisine.mode === "surprise"
        ? null
        : context.flavor.cuisine.available ? context.flavor.cuisine.value : null;
      const priorHistory = await readOneTouchHistory(userId);
      const generatedFingerprints = [
        ...priorHistory[creator],
        ...(priorHistory.ideaHistory?.[creator] ?? []),
        ...(priorHistory.workingSets?.[creator]?.concepts ?? []).map(directionToFingerprint),
      ];
      const userContext = [
        buildCreatorHumanFoodPrompt(creator, context, scope.executionState),
        buildDietPromptBlock(context.diet.effective),
        enforceBeforeGenerate(envelope, { generatorName: "one-touch-directions" }).combined,
        buildGLP1RecommendationBlock(glp1),
      ];
      const result = await generateOneTouchDirections({
          // Snack is a broad culinary occasion; clinical GLP-1 authority still
          // uses the existing lunch slot, explicitly supplied at completion.
          occasion: creator === "craving_creator" ? "snack" : "lunch",
          menuShape: creator === "craving_creator" ? "craving" : "dish",
          cravingType: parsed.data.cravingType ?? "surprise",
          cravingFeel: parsed.data.cravingFeel ?? "surprise",
          targetCount: 3,
          history: generatedFingerprints,
          humanFoodContext: context,
          userProtocolEnvelope: envelope,
          requiredCuisine,
          validate: () => [],
          userContext,
        });
      const currentAuthority = await resolveOneTouchAuthority(userId, parsed.data, (req as any).id);
      if (currentAuthority.contextFingerprint !== contextFingerprint) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[CreatorMenu] Authority changed during completion (field names only):",
            oneTouchChangedAuthorityBranches(
              { request: parsed.data, context, envelope, glp1 },
              { request: parsed.data, context: currentAuthority.context, envelope: currentAuthority.envelope, glp1: currentAuthority.glp1 },
            ));
        }
        stop(409, "ONE_TOUCH_CONTEXT_UNRESOLVED", "Your food protections changed while these ideas were being created. Please try again.");
      }
      const concepts: OneTouchConcept[] = result.directions.map((direction) => ({ ...direction, id: randomUUID() }));
      await saveOneTouchConceptSet(userId, creator, {
        request: parsed.data, contextFingerprint, concepts,
      });
      await scope.completeAuthorization();
      console.info("[CreatorMenu] concepts", {
        shape: creator === "craving_creator" ? "craving" : "dish",
        count: concepts.length,
        attempts: result.attemptsCompleted,
      });
      return res.json({
        intentType: "one_touch_delegated",
        concepts,
        contextFingerprint,
      });
    } catch (error: any) {
      console.error("[OneTouch] Request could not complete:", error);
      const technicalFailure = ["CONCEPT_TECHNICAL_COMPLETION_FAILED", "CONCEPT_PROVIDER_INCOMPLETE"].includes(error?.code);
      return res.status(error?.oneTouchStop ? error.status : technicalFailure || error?.status === 502 ? 502 : 422).json({
        code: error?.oneTouchStop ? error.code
          : error?.code === "ONE_TOUCH_AUTHORITY_COMPLETION_FAILED" ? "ONE_TOUCH_DIRECTION_COMPLETION_FAILED"
          : technicalFailure ? "ONE_TOUCH_PROVIDER_INCOMPLETE"
          : error?.code === "ONE_TOUCH_PROVIDER_INCOMPLETE" ? error.code
          : "ONE_TOUCH_DIRECTION_COMPLETION_FAILED",
        error: error?.oneTouchStop ? error.message
          : technicalFailure ? "We couldn't finish creating three ideas this time. Please try again."
          : "We couldn't safely create three ideas. Please try again.",
      });
    }
  });
  return router;
}