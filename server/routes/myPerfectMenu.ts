import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { householdProfiles } from "@shared/schema";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { createHumanFoodRequestScope } from "../services/humanFoodContext/requestScope";
import { buildHumanFoodPromptBlock } from "../services/humanFoodContext/buildHumanFoodPromptBlock";
import { chatJson } from "../utils/openaiSafe";

const router = Router();

const requestSchema = z.object({
  ideaType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  subjectUserId: z.string().uuid().optional(),
});

const responseSchema = z.object({
  concepts: z.array(z.object({
    title: z.string().trim().min(3).max(80),
    description: z.string().trim().min(3).max(180),
  })).length(3),
});

router.post("/concepts", requireAuth, async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Choose breakfast, lunch, dinner, or snack ideas." });
  }

  const actorUserId = String((req as AuthenticatedRequest).authUser.id);
  const subjectUserId = parsed.data.subjectUserId ?? actorUserId;
  if (subjectUserId !== actorUserId) {
    const [ownedProfile] = await db
      .select({ id: householdProfiles.id })
      .from(householdProfiles)
      .where(and(
        eq(householdProfiles.id, subjectUserId),
        eq(householdProfiles.ownerUserId, actorUserId),
      ))
      .limit(1);
    if (!ownedProfile) {
      return res.status(403).json({ error: "You don't have access to that food profile." });
    }
  }
  const scope = createHumanFoodRequestScope({
    actorUserId,
    subjectUserId,
    creator: "my_perfect_menu",
    correlationId: (req as any).id,
    actionRequest: `${parsed.data.ideaType} ideas`,
    authorizationAction: "my_perfect_menu",
  });

  try {
    const context = await scope.resolve();
    if (context.status === "review_required" || context.status === "blocked") {
      return res.status(409).json({
        error: context.notices[0] || "We couldn't safely resolve the food profile for these ideas.",
        code: "HUMAN_FOOD_CONTEXT_UNRESOLVED",
      });
    }

    const contextBlock = buildHumanFoodPromptBlock(context);
    const generated = await chatJson({
      temperature: 0.65,
      system: [
        "You create lightweight menu concepts for My Perfect Meals.",
        "Return JSON only with exactly this shape: {\"concepts\":[{\"title\":\"...\",\"description\":\"...\"},{...},{...}]}",
        "Return exactly 3 meaningfully different choices.",
        "These are menu ideas, not recipes. Do not include instructions, quantities, nutrition numbers, medical claims, or images.",
        "Descriptions should be one short appetizing line naming the main components.",
        "Every concept must obey all hard safety, dietary, medical, glucose, and avoidance rules in the supplied context.",
        "Foods I Enjoy and behavioral preferences are soft ranking signals only and never override protections.",
      ].join("\n"),
      user: [
        contextBlock,
        `Create exactly 3 distinct ${parsed.data.ideaType} food concepts.`,
        "Vary the dish format, primary ingredients, cooking method, and flavor profile.",
        "Do not create three superficial versions of the same dish.",
      ].join("\n\n"),
    });

    const concepts = responseSchema.parse(generated).concepts.map((concept, index) => ({
      id: `${parsed.data.ideaType}-${index + 1}`,
      ideaType: parsed.data.ideaType,
      ...concept,
    }));

    return res.json({ concepts });
  } catch (error) {
    await scope.releaseAuthorization().catch(() => {});
    console.error("[my-perfect-menu] concept generation failed", error);
    return res.status(500).json({
      error: "We couldn't create your menu ideas right now. Please try again.",
    });
  }
});

export default router;