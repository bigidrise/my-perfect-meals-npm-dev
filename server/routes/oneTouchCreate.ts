import { Router, type Request, type Response } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { chatJson } from "../utils/openaiSafe";
import { oneTouchRequestSchema, directionToFingerprint, type OneTouchDirection } from "@shared/oneTouch";
import { generateOneTouchDirections } from "../services/oneTouch/directions";
import { appendOneTouchHistory, readOneTouchHistory } from "../services/oneTouch/history";
import { expandCreateDishIngredient } from "../services/createDish/ingredientExpansionService";
import { revalidateCreateDishIntent } from "../services/createDish/createDishIntent";
import { CreateDishIntentSchema } from "@shared/createDishIngredientExpansion";

type CanonicalCreatorHandler = (req: Request, res: Response) => unknown;

// Create a Dish currently has no safe request-scoped dietary override input in
// the canonical route (it intentionally suppresses dietOverride). Keep this
// endpoint disabled rather than silently dropping an explicit user selection.
export const ONE_TOUCH_CREATE_ENABLED = false;

function explicitValue(value: { mode: string; value?: string }): string | undefined {
  return value.mode === "explicit" ? value.value : undefined;
}

async function buildServerCreateDishIntent(
  direction: OneTouchDirection,
  cuisine: string | undefined,
) {
  const expansion = await expandCreateDishIngredient({
    ingredientInput: direction.primaryIngredients[0],
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
      originalText: direction.primaryIngredients[0],
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

function directionMatchesMeal(direction: OneTouchDirection, meal: any): boolean {
  const text = `${meal?.name ?? ""} ${(meal?.ingredients ?? []).map((item: any) => typeof item === "string" ? item : item?.name ?? item?.item ?? "").join(" ")}`.toLowerCase();
  return direction.primaryIngredients.some((ingredient) => text.includes(ingredient.toLowerCase()))
    || direction.title.toLowerCase().split(/\s+/).filter((word) => word.length > 4).some((word) => text.includes(word));
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
    const cuisineOverride = explicitValue(cuisine);
    const dietOverride = explicitValue(eatingStyle);
    const userId = String((req as any).authUser.id);
    try {
      const priorHistory = await readOneTouchHistory(userId);
      const selected: Array<{ direction: OneTouchDirection; meal: any }> = [];
      const generatedFingerprints = priorHistory[creator].map((entry) => entry);
      const directionPrompt = `Return lightweight food directions only, never recipes or nutrition. Include title, description, primaryIngredients, primaryProtein, produceItems, cuisine, dietaryEvidence, preparationMethod, signature, culinaryIdentity. Respect ${cuisineOverride ?? "the user's cuisine preferences"} and ${dietOverride ?? "the user's resolved dietary preferences"}.`;
      let directions = (await generateOneTouchDirections({
        occasion: "lunch",
        history: generatedFingerprints,
        generate: ({ requestedCount }) => chatJson({
          temperature: 0.7,
          system: directionPrompt,
          user: `Return exactly ${requestedCount} distinct directions.`,
        }),
        validate: () => [],
      })).directions;

      for (let attempt = 0; attempt < 5 && selected.length < 3; attempt += 1) {
        const direction = directions.shift();
        if (!direction) break;
        try {
          const createDishIntent = creator === "create_a_dish"
            ? await buildServerCreateDishIntent(direction, cuisineOverride)
            : undefined;
          const body: Record<string, unknown> = {
            humanFoodCreator: creator,
            cravingInput: `${direction.title}: ${direction.description}. Ingredients: ${direction.primaryIngredients.join(", ")}`,
            targetMealType: "lunch",
            servings,
            generationMode: "recipe",
            skipImages: true,
            ...(cuisineOverride ? { cultureOverride: cuisineOverride } : {}),
            ...(dietOverride ? { dietOverride } : {}),
            ...(createDishIntent ? { createDishIntent } : {}),
          };
          const result = await invokeCanonical(canonicalHandler, req, body);
          const meals = result.status === 200 && Array.isArray(result.body?.meals) ? result.body.meals : [];
          const meal = meals.find((candidate: any) => directionMatchesMeal(direction, candidate));
          if (meal && !selected.some((entry) => entry.meal?.name === meal.name)) {
            selected.push({ direction, meal });
          }
        } catch {
          // A failed canonical invocation is a missing direction, never a partial result.
        }
        if (selected.length < 3 && attempt < 4) {
          const replacement = await generateOneTouchDirections({
            occasion: "lunch",
            history: [...generatedFingerprints, ...selected.map(({ direction }) => directionToFingerprint(direction))],
            existingDirections: selected.map(({ direction }) => direction),
            generate: ({ requestedCount }) => chatJson({
              temperature: 0.8,
              system: directionPrompt,
              user: `Return exactly ${requestedCount} replacement direction(s), structurally unlike prior directions.`,
            }),
            validate: () => [],
          });
          const selectedTitles = new Set(selected.map(({ direction }) => direction.title));
          directions.push(...replacement.directions.filter((candidate) => !selectedTitles.has(candidate.title)));
        }
      }
      if (selected.length !== 3) {
        return res.status(422).json({
          code: "ONE_TOUCH_DIRECTION_COMPLETION_FAILED",
          error: "We couldn't safely complete three meals. Please try again.",
        });
      }
      await appendOneTouchHistory(
        userId,
        creator,
        selected.map(({ direction }) => ({ ...directionToFingerprint(direction), creator })),
      );
      return res.json({
        intentType: "one_touch_delegated",
        meals: selected.map(({ meal }) => meal),
      });
    } catch {
      return res.status(422).json({
        code: "ONE_TOUCH_PROVIDER_INCOMPLETE",
        error: "We couldn't safely complete three meals. Please try again.",
      });
    }
  });
  return router;
}