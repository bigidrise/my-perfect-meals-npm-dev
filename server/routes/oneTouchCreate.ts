import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { oneTouchRequestSchema, directionToFingerprint, type OneTouchDirection, type OneTouchRequest } from "@shared/oneTouch";
import { generateOneTouchDirections } from "../services/oneTouch/directions";
import { appendOneTouchHistory, readOneTouchHistory } from "../services/oneTouch/history";
import { expandCreateDishIngredient } from "../services/createDish/ingredientExpansionService";
import { revalidateCreateDishIntent } from "../services/createDish/createDishIntent";
import { CreateDishIntentSchema } from "@shared/createDishIngredientExpansion";
import { setOneTouchDiet } from "../services/oneTouch/internalRequest";
import { completeOneTouchMeals } from "../services/oneTouch/completion";
import { createHumanFoodRequestScope } from "../services/humanFoodContext/requestScope";
import { buildCreatorHumanFoodPrompt } from "../services/humanFoodContext/adapters";
import { enforceBeforeGenerate, loadUserProtocolEnvelope } from "../services/protocolEnvelope";
import { withOneTouchDiet } from "../services/oneTouch/dietAuthority";
import { buildDietPromptBlock } from "../services/allergyGuardrails";
import { buildGLP1RecommendationBlock, resolveGLP1GlobalContext } from "../services/glp1/resolveGLP1GlobalContext";
import { validateDishIdentity } from "../services/dishAdaptation/dishIdentityValidator";
import { oneTouchContextFingerprint, oneTouchChangedAuthorityBranches } from "../services/oneTouch/contextFingerprint";

type CanonicalCreatorHandler = (req: Request, res: Response) => unknown;

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

async function buildServerCreateDishIntent(
  direction: OneTouchDirection,
  cuisine: string | undefined,
) {
  const originalText = cuisine && !direction.title.toLowerCase().includes(cuisine.toLowerCase())
    ? `${cuisine} ${direction.title}`
    : direction.title;
  const expansion = await expandCreateDishIngredient({
    ingredientInput: originalText,
    creator: "create_a_dish",
    surprisePolicy: { delegatedDimensions: [], selectedOptionIds: {} },
    useAiForGaps: false,
  });
  if (expansion.ingredient.status !== "recognized" || !expansion.resolvedCombination) {
    throw new Error("ONE_TOUCH_CREATOR_VALIDATION_FAILED");
  }
  return revalidateCreateDishIntent(
    CreateDishIntentSchema.parse({
      creator: "create_a_dish",
      originalText,
      cuisine,
      ingredient: expansion.ingredient,
      resolvedCombination: {
        form: expansion.resolvedCombination.form,
        texture: expansion.resolvedCombination.texture,
        flavor: expansion.resolvedCombination.flavor,
        selectionSource: {
          form: "system_selected",
          texture: "system_selected",
          flavor: "system_selected",
        },
      },
    }),
    [],
  );
}

export function invokeCanonical(
  handler: CanonicalCreatorHandler,
  originalRequest: Request,
  body: Record<string, unknown>,
  authorizedDiet?: string,
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    let status = 200;
    let settled = false;
    const finish = (value: { status: number; body: any }) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const request = Object.create(originalRequest) as Request;
    request.body = body;
    setOneTouchDiet(request, authorizedDiet);
    const response = {
      status(code: number) {
        if (!Number.isInteger(code)) throw new Error("ONE_TOUCH_UNSUPPORTED_CANONICAL_RESPONSE");
        status = code;
        return response;
      },
      json(value: unknown) {
        finish({ status, body: value });
        return response;
      },
    } as unknown as Response;
    try {
      const result = handler(request, response);
      if (result && typeof (result as Promise<unknown>).then === "function") {
        (result as Promise<unknown>).then(() => {
          if (!settled) reject(new Error("ONE_TOUCH_CANONICAL_NO_JSON"));
        }).catch(reject);
      } else if (!settled) {
        reject(new Error("ONE_TOUCH_CANONICAL_NO_JSON"));
      }
    } catch (error) {
      reject(error);
    }
  });
}

function matchingMeal(direction: OneTouchDirection, meals: unknown[]): any | null {
  const matches = meals.flatMap((meal: any) => {
    if (!meal || typeof meal.name !== "string" || !Array.isArray(meal.ingredients)) return [];
    const identity = validateDishIdentity(direction.title, meal);
    const ingredients = meal.ingredients.map((item: any) =>
      String(typeof item === "string" ? item : item?.name ?? item?.item ?? "").toLowerCase(),
    );
    const includesPrimary = direction.primaryIngredients.some((item) =>
      ingredients.some((ingredient: string) => ingredient.includes(item.toLowerCase())),
    );
    return identity.passed && includesPrimary ? [{ meal, score: identity.score }] : [];
  });
  matches.sort((a, b) => b.score - a.score);
  return matches[0]?.meal ?? null;
}

function stop(status: number, code: string, error: string): never {
  throw Object.assign(new Error(error), { oneTouchStop: true, status, code });
}

function requestOverrides(request: OneTouchRequest) {
  const cuisineOverride = explicitValue(request.cuisine)?.trim().toLowerCase();
  const dietOverride = explicitValue(request.eatingStyle)?.trim().toLowerCase();
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

export default function createOneTouchRouter(canonicalHandler: CanonicalCreatorHandler) {
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
    const { creator, servings, cuisine } = parsed.data;
    const overrides = requestOverrides(parsed.data);
    if (!overrides) {
      return res.status(400).json({ code: "ONE_TOUCH_INVALID_REQUEST", error: "Choose a listed cuisine and dietary preference." });
    }
    const { cuisineOverride, dietOverride } = overrides;
    const userId = String((req as any).authUser.id);
    try {
      const { scope, context, envelope, glp1, contextFingerprint } =
        await resolveOneTouchAuthority(userId, parsed.data, (req as any).id);
      const requiredCuisine = cuisine.mode === "surprise"
        ? null
        : context.flavor.cuisine.available ? context.flavor.cuisine.value : null;
      const priorHistory = await readOneTouchHistory(userId);
      const generatedFingerprints = priorHistory[creator];
      const tried: OneTouchDirection[] = [];
      const completedNames = new Set<string>();
      const userContext = [
        buildCreatorHumanFoodPrompt(creator, context, scope.executionState),
        buildDietPromptBlock(context.diet.effective),
        enforceBeforeGenerate(envelope, { generatorName: "one-touch-directions" }).combined,
        buildGLP1RecommendationBlock(glp1),
      ];
      const makeDirections = async (count: 1 | 2 | 3, accepted: OneTouchDirection[]) => {
        const history = [
          ...generatedFingerprints,
          ...tried.map(directionToFingerprint),
          ...accepted.map(directionToFingerprint),
        ];
        const result = await generateOneTouchDirections({
          occasion: "lunch",
          targetCount: count,
          history,
          humanFoodContext: context,
          userProtocolEnvelope: envelope,
          requiredCuisine,
          validate: () => [],
          userContext,
          extraInstructions: [
            `Make genuinely different dishes from these already attempted directions: ${tried.map((item) => item.title).join("; ") || "none"}.`,
          ],
        });
        return result.directions;
      };
      const directions = await makeDirections(3, []);
      const completed = await completeOneTouchMeals<any>({
        directions,
        generateDirections: async ({ requestedCount, accepted }) =>
          makeDirections(requestedCount as 1 | 2 | 3, accepted),
        canonicalAccept: async (direction) => {
          tried.push(direction);
          let createDishIntent: Awaited<ReturnType<typeof buildServerCreateDishIntent>> | undefined;
          if (creator === "create_a_dish") {
            try {
              createDishIntent = await buildServerCreateDishIntent(direction, cuisineOverride);
            } catch {
              // Ingredient expansion is advisory in the manual Creator too.
              // The canonical dish-identity and final food checks still run.
            }
          }
          const body: Record<string, unknown> = {
            humanFoodCreator: creator,
            cravingInput: `${direction.title}. ${direction.description}. Main ingredients: ${direction.primaryIngredients.join(", ")}`,
            targetMealType: "lunch",
            servings,
            generationMode: "recipe",
            ...(cuisineOverride || cuisine.mode === "surprise" ? { cultureOverride: cuisineOverride ?? direction.cuisine } : {}),
            ...(dietOverride ? { dietOverride } : {}),
            ...(createDishIntent ? { createDishIntent } : {}),
          };
          const result = await invokeCanonical(canonicalHandler, req, body, dietOverride);
          if ([401, 403, 409, 503].includes(result.status)) {
            stop(result.status, result.body?.code ?? "ONE_TOUCH_CONTEXT_UNRESOLVED",
              result.body?.message ?? result.body?.error ?? "This food request needs review before continuing.");
          }
          if (result.status !== 200 || !Array.isArray(result.body?.meals)) {
            return { accepted: false, failureClass: result.status >= 500 ? "technical_provider" : "authority" };
          }
          const meal = matchingMeal(direction, result.body.meals);
          if (!meal || completedNames.has(String(meal.name).toLowerCase())) return { accepted: false, failureClass: "authority" };
          completedNames.add(String(meal.name).toLowerCase());
          return { accepted: true, value: meal };
        },
      });
      const selected = completed.accepted;
      const currentAuthority = await resolveOneTouchAuthority(userId, parsed.data, (req as any).id);
      if (currentAuthority.contextFingerprint !== contextFingerprint) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[CreatorMenu] Authority changed during completion (field names only):",
            oneTouchChangedAuthorityBranches(
              { request: parsed.data, context, envelope, glp1 },
              { request: parsed.data, context: currentAuthority.context, envelope: currentAuthority.envelope, glp1: currentAuthority.glp1 },
            ));
        }
        stop(409, "ONE_TOUCH_CONTEXT_UNRESOLVED", "Your food protections changed while these meals were being created. Please try again.");
      }
      await appendOneTouchHistory(
        userId,
        creator,
        selected.map(({ direction }) => ({ ...directionToFingerprint(direction), creator })),
      );
      return res.json({
        intentType: "one_touch_delegated",
        meals: selected.map(({ value }) => value),
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
          : "We couldn't safely complete three meals. Please try again.",
      });
    }
  });
  return router;
}