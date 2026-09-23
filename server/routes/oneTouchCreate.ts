import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { chatJson } from "../utils/openaiSafe";
import { oneTouchRequestSchema, directionToFingerprint, type OneTouchDirection } from "@shared/oneTouch";
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

type CanonicalCreatorHandler = (req: Request, res: Response) => unknown;

// Dev-1 activation only. Production keeps the route closed until its migration
// and release checks are explicitly approved.
export const ONE_TOUCH_CREATE_ENABLED = process.env.NODE_ENV === "development";

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

export default function createOneTouchRouter(canonicalHandler: CanonicalCreatorHandler) {
  const router = Router();
  router.post("/", requireAuth, async (req, res) => {
    if (!ONE_TOUCH_CREATE_ENABLED) {
      return res.status(503).json({
        code: "ONE_TOUCH_NOT_AVAILABLE",
        error: "One-Touch Create is temporarily unavailable while its canonical safety path is being connected.",
        retryable: true,
      });
    }
    const parsed = oneTouchRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ code: "ONE_TOUCH_INVALID_REQUEST", error: "Invalid One-Touch request." });
    }
    const { creator, servings, cuisine, eatingStyle } = parsed.data;
    const cuisineOverride = explicitValue(cuisine)?.trim().toLowerCase();
    const dietOverride = explicitValue(eatingStyle)?.trim().toLowerCase();
    if ((cuisineOverride && !allowedCuisines.has(cuisineOverride)) ||
        (dietOverride && !allowedDiets.has(dietOverride))) {
      return res.status(400).json({ code: "ONE_TOUCH_INVALID_REQUEST", error: "Choose a listed cuisine and dietary preference." });
    }
    const userId = String((req as any).authUser.id);
    try {
      const scope = createHumanFoodRequestScope({
        actorUserId: userId,
        subjectUserId: userId,
        creator,
        correlationId: (req as any).id,
        dietOverride: dietOverride ?? null,
        cuisine: cuisineOverride ?? null,
      });
      const context = await scope.resolve();
      if (context.status === "review_required" || context.status === "blocked") {
        stop(409, "ONE_TOUCH_CONTEXT_UNRESOLVED", context.notices[0] || "Your food context needs review.");
      }
      const profileEnvelope = await loadUserProtocolEnvelope(userId);
      if (!profileEnvelope) stop(409, "ONE_TOUCH_CONTEXT_UNRESOLVED", "Your food protections could not be resolved.");
      const envelope = withOneTouchDiet(profileEnvelope, dietOverride);
      const glp1 = await resolveGLP1GlobalContext(userId, new Date().toISOString().slice(0, 10), "lunch");
      if (glp1.isActive && !glp1.resolvedTargets) stop(503, "ONE_TOUCH_CONTEXT_UNRESOLVED", "Your current GLP-1 targets could not be verified.");
      if (profileEnvelope.glp1DailyTolerance?.shouldEscalate) stop(409, "ONE_TOUCH_CONTEXT_UNRESOLVED", "Your current GLP-1 symptoms need a safety check-in first.");
      const requiredCuisine = cuisine.mode === "surprise"
        ? null
        : context.flavor.cuisine.available ? context.flavor.cuisine.value : null;
      const priorHistory = await readOneTouchHistory(userId);
      const generatedFingerprints = priorHistory[creator];
      const tried: OneTouchDirection[] = [];
      const completedNames = new Set<string>();
      const system = [
        "Create lightweight My Perfect Meals directions, not recipes. Return JSON only with a concepts array.",
        'Each concept has title, description, primaryIngredients, primaryProtein (string or null), produceItems, cuisine, dietaryEvidence, preparationMethod, signature, and culinaryIdentity: {dishForm, preparationStyle, texture, temperature, primaryProteinBase, majorStarchBase, flavorFamily, cuisineEvidence, definingComponents}.',
        "Return exactly the requested number (1 to 3) inside {\"concepts\": [...]}. primaryIngredients, produceItems, dietaryEvidence, and culinaryIdentity.definingComponents must be arrays of strings. If there is no dietary evidence, use an empty array; do not invent evidence.",
        "culinaryIdentity.temperature is optional; if included it must be one of hot, warm, room_temperature, chilled, frozen. primaryProtein and culinaryIdentity.primaryProteinBase/majorStarchBase must be strings or null.",
        "Keep title, description, ingredients, and culinary metadata concise. Name every meaningful ingredient; no quantities, instructions, nutrition numbers, clinical claims or images.",
        "Choose genuinely different dish forms and methods, not only different proteins or cuisine labels. Never relax the supplied protections.",
        requiredCuisine ? `Every direction must be recognizably ${requiredCuisine}.` : "Explore compatible cuisines.",
      ].join("\n");
      const userPrompt = [
        buildCreatorHumanFoodPrompt(creator, context, scope.executionState),
        buildDietPromptBlock(context.diet.effective),
        enforceBeforeGenerate(envelope, { generatorName: "one-touch-directions" }).combined,
        buildGLP1RecommendationBlock(glp1),
      ].join("\n");
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
          generate: ({ requestedCount }) => chatJson({
            temperature: 0.65,
            system,
            user: `${userPrompt}\nReturn exactly ${requestedCount} new, distinct directions, structurally unlike these previously attempted directions: ${tried.map((item) => item.title).join("; ") || "none"}.`,
          }),
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
      await appendOneTouchHistory(
        userId,
        creator,
        selected.map(({ direction }) => ({ ...directionToFingerprint(direction), creator })),
      );
      return res.json({
        intentType: "one_touch_delegated",
        meals: selected.map(({ value }) => value),
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