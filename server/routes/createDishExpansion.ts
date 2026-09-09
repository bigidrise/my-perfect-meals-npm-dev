import { Router } from "express";
import { ExpandIngredientRequestSchema } from "../../shared/createDishIngredientExpansion";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { loadSafetyProfile } from "../services/safetyProfileService";
import { expandCreateDishIngredient } from "../services/createDish/ingredientExpansionService";
import { chatJson } from "../utils/openaiSafe";

const router = Router();

router.post("/expand-ingredient", requireAuth, async (req, res) => {
  const parsed = ExpandIngredientRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "INVALID_EXPANSION_REQUEST",
      details: parsed.error.flatten(),
    });
  }

  try {
    const userId = (req as AuthenticatedRequest).authUser.id;
    const profile = await loadSafetyProfile(userId);
    const response = await expandCreateDishIngredient(parsed.data, {
      allergyTags: profile?.allergies ?? [],
      aiProvider: parsed.data.useAiForGaps
        ? {
            expand: (input) =>
              chatJson({
                system:
                  "Return only bounded culinary expansion JSON. Keep form, method, texture, flavor, and cuisine separate. Never invent anatomical cuts or include medical/nutrition claims.",
                user: JSON.stringify(input),
                temperature: 0.1,
              }),
          }
        : undefined,
    });
    return res.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith("UNKNOWN_OPTION_ID")) {
      return res.status(400).json({ error: "UNKNOWN_OPTION_ID" });
    }
    if (message === "CREATE_DISH_SCOPE_REQUIRED") {
      return res.status(403).json({ error: "CREATE_DISH_SCOPE_REQUIRED" });
    }
    console.error("[CreateDishExpansion] expansion failed", error);
    return res.status(503).json({
      error: "EXPANSION_SERVICE_UNAVAILABLE",
      message: "Create a Dish remains available without ingredient expansion.",
    });
  }
});

export default router;
