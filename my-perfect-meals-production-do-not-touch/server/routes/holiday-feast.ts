// server/routes/holiday-feast.ts
import express, { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { generateHolidayFeast } from "../services/holidayFeastService";

const router = express.Router();

/* ----------------------------------------
   Optional middleware hooks (uncomment if needed)
-----------------------------------------*/
// Basic request logger (dev only)
// router.use((req, _res, next) => {
//   console.log(`[holiday-feast] ${req.method} ${req.path}`);
//   next();
// });

// Simple content-type guard for POST JSON
function requireJson(req: Request, res: Response, next: NextFunction) {
  if (req.method === "POST" && !req.is("application/json")) {
    return res
      .status(415)
      .json({ error: "Content-Type must be application/json" });
  }
  next();
}
router.use(requireJson);

// You can attach rate-limiting/auth here if desired
// router.use(authMiddleware);
// router.use(rateLimiter);

/* ----------------------------------------
   Zod schema for request validation
-----------------------------------------*/
export const FeastRequest = z.object({
  occasion: z.string().min(2, "occasion must be at least 2 chars"),
  servings: z.number().int().min(2).max(100),
  counts: z.object({
    appetizers: z.number().int().min(0).max(12),
    mainDishes: z.number().int().min(0).max(8),
    sideDishes: z.number().int().min(0).max(12),
    desserts: z.number().int().min(0).max(8),
  }),
  dietaryRestrictions: z.array(z.string()).optional().default([]),
  cuisineType: z.string().optional(),
  budgetLevel: z
    .enum(["low", "moderate", "high"])
    .optional()
    .default("moderate"),
  userId: z.string().optional(),
  familyRecipe: z
    .object({
      name: z.string(),
      ingredients: z
        .array(
          z.object({
            name: z.string(),
            quantity: z.number().optional(),
            unit: z.string().optional(),
            prep: z.string().optional(),
          }),
        )
        .optional()
        .default([]),
      mealType: z
        .enum(["appetizer", "main", "side", "dessert"])
        .optional()
        .default("main"),
      servings: z.number().int().min(1).max(50).optional().default(6),
      instructions: z.array(z.string()).optional().default([]),
    })
    .optional(),
});

/* ----------------------------------------
   Helpers
-----------------------------------------*/
function formatZodIssues(issues: any) {
  // Keep responses tidy for the client
  return issues?.fieldErrors ?? issues;
}

const coerceServings = (n: number) => (d: any) => ({
  ...d,
  servings: n,
  servingSize: n,
  serves: n,
});

/* ----------------------------------------
   Routes
-----------------------------------------*/

// Optional: quick schema probe for QA/debug (safe to keep)
router.get("/api/holiday-feast/schema", (_req, res) => {
  res.json({
    description: "POST /api/holiday-feast/generate expects this shape",
    schema: FeastRequest.describe(), // Zod’s description, not PII
  });
});

// Main generator endpoint (matches your frontend fetch)
router.post(
  "/",
  async (req: Request, res: Response) => {
    console.log("🎯 Holiday Feast route HIT! Body:", req.body);
    const parsed = FeastRequest.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid payload",
        issues: formatZodIssues(parsed.error.flatten()),
      });
    }
    const input = parsed.data;

    try {
      const result = await generateHolidayFeast({
        occasion: input.occasion,
        servings: input.servings,
        counts: input.counts,
        dietaryRestrictions: input.dietaryRestrictions || [],
        cuisineType: input.cuisineType,
        budgetLevel: input.budgetLevel || "moderate",
        familyRecipe: input.familyRecipe,
      });

      const feast = (result.feast || []).map(coerceServings(input.servings));
      const recipes = (result.recipes || []).map(
        coerceServings(input.servings),
      );

      return res.json({
        holiday: input.occasion,
        servings: input.servings,
        feast,
        recipes,
        colorTheme: result.colorTheme,
      });
    } catch (err: any) {
      console.error("[holiday-feast] generation failed:", err?.stack || err);
      return res.status(500).json({ error: "Generation failed" });
    }
  },
);

// Optional: 405 guard for other methods on base path
router.all("/api/holiday-feast/*", (_req, res) => {
  res.status(405).json({ error: "Method Not Allowed" });
});

export default router;