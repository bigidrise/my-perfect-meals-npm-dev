import { Router } from "express";
import { z } from "zod";
import { MealConstraints } from "../services/deriveConstraints";

export const generationRouter = Router();

const CandidateSchema = z.object({
  id: z.string().optional(),
  name: z.string().default("Meal Candidate"),
  mealType: z.enum(["breakfast","lunch","dinner","snack"]),
  nutrition: z.object({
    calories: z.number().optional(),
    protein: z.number().optional(),
    carbs: z.number().optional(),
    fiber: z.number().optional(),
    netCarbs: z.number().optional(),
    fat: z.number().optional(),
  }).partial().passthrough(),
  flags: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  variants: z.object({
    lowerCarb: z.any().optional(),
  }).partial().optional(),
}).passthrough();

const EnforceReq = z.object({
  candidate: CandidateSchema,
  constraints: z.any(),
  mealType: z.enum(["breakfast","lunch","dinner","snack"]),
});

function computeNetCarbs(n: any) {
  if (!n) return undefined;
  if (typeof n.netCarbs === "number") return n.netCarbs;
  if (typeof n.carbs === "number") {
    const fiber = typeof n.fiber === "number" ? n.fiber : 0;
    return Math.max(0, n.carbs - fiber);
  }
  return undefined;
}

// POST /api/generation/enforce
// Returns 200 OK with adjusted/accepted meal, or 409 if rejected
generationRouter.post("/enforce", async (req, res) => {
  try {
    const body = EnforceReq.parse(req.body);
    const { candidate, constraints, mealType } = body as { candidate: any; constraints: MealConstraints; mealType: any };

    // 1) Carb cap
    const [minC, maxC] = constraints.carbCaps[mealType];
    const netCarbs = computeNetCarbs(candidate.nutrition);
    if (typeof netCarbs === "number" && netCarbs > maxC) {
      if (candidate?.variants?.lowerCarb) {
        const adj = { ...candidate.variants.lowerCarb, tags: [ ...(candidate.tags||[]), "Diabetes-Adjusted" ] };
        return res.json(adj);
      }
      return res.status(409).json({ error: "CARBS_EXCEED_CAP" });
    }

    // 2) GI guardrail
    if (constraints.lowGiOnly && candidate.flags?.includes("HIGH_GI")) {
      return res.status(409).json({ error: "HIGH_GI_BLOCKED" });
    }

    // Accept
    return res.json(candidate);
  } catch (e: any) {
    console.error(e);
    return res.status(400).json({ error: "bad_request", details: e?.message });
  }
});

// POST /api/generation/candidate
// Minimal stub that would normally call your catalog/LLM. For alpha, returns a safe template with a lower‑carb variant.
generationRouter.post("/candidate", async (req, res) => {
  try {
    const body = req.body || {};
    const mealType = (body.mealType || "lunch") as "breakfast"|"lunch"|"dinner"|"snack";

    // Example template (replace with your existing templates)
    const base = {
      id: undefined,
      mealType,
      name: mealType === "breakfast" ? "Greek Yogurt Power Bowl" : mealType === "snack" ? "Cottage Cheese & Berries" : "Chicken, Quinoa & Greens Bowl",
      nutrition: mealType === "breakfast" ? { calories: 380, protein: 35, carbs: 38, fiber: 7, netCarbs: 31, fat: 9 } : mealType === "snack" ? { calories: 220, protein: 22, carbs: 16, fiber: 4, netCarbs: 12, fat: 7 } : { calories: 520, protein: 42, carbs: 48, fiber: 10, netCarbs: 38, fat: 16 },
      flags: ["LOW_GI"],
      tags: [],
      variants: {
        lowerCarb: {
          name: mealType === "breakfast" ? "Low‑Carb Greek Yogurt Bowl" : mealType === "snack" ? "High‑Protein Berry Cup" : "Chicken & Greens (No Quinoa)",
          nutrition: mealType === "breakfast" ? { calories: 350, protein: 36, carbs: 26, fiber: 7, netCarbs: 19, fat: 10 } : mealType === "snack" ? { calories: 200, protein: 23, carbs: 12, fiber: 4, netCarbs: 8, fat: 7 } : { calories: 430, protein: 44, carbs: 22, fiber: 8, netCarbs: 14, fat: 18 },
          tags: ["lower-carb"],
        },
      },
      ingredients: [],
      instructions: [],
    };
    res.json(base);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "candidate_failed" });
  }
});