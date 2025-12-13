// server/routes/wmc2Log.ts
// POST /api/wmc2/log-meal — formats PlanItem into the locked logger shape
import { Router } from "express";
import { logMealViaLockedAPI } from "../services/wmc2Logger";

const router = Router();

router.post("/api/wmc2/log-meal", async (req, res) => {
  try {
    const {
      userId,
      dayIndex,
      time,               // "HH:mm"
      timezone = "America/Chicago",
      mealType,           // Breakfast | Lunch | Dinner | Snack
      name,
      ingredients,
      calories, protein, carbs, fats,
    } = req.body || {};

    if (!userId) return res.status(400).json({ error: "userId required" });
    if (typeof dayIndex !== "number") return res.status(400).json({ error: "dayIndex required" });
    if (!time) return res.status(400).json({ error: "time required" });
    if (!mealType) return res.status(400).json({ error: "mealType required" });
    if (!name) return res.status(400).json({ error: "name required" });

    // Build ISO timestamp based on today + dayIndex at provided time
    const now = new Date();
    const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayIndex);
    const [hh, mm] = String(time).split(":");
    dt.setHours(parseInt(hh || "0", 10), parseInt(mm || "0", 10), 0, 0);
    const iso = dt.toISOString();

    const resp = await logMealViaLockedAPI({
      userId,
      iso,
      timezone,
      mealType,
      name,
      ingredients: Array.isArray(ingredients) ? ingredients : [],
      calories: numOrNull(calories), 
      protein: numOrNull(protein), 
      carbs: numOrNull(carbs), 
      fats: numOrNull(fats),
      source: "ai-meal-creator",
    });

    res.json({ ok: true, result: resp });
  } catch (e: any) {
    console.error("WMC2 log meal error:", e);
    res.status(400).json({ error: e.message || "Failed to log meal" });
  }
});

function numOrNull(x: any) { 
  return x == null ? null : Number(x); 
}

export default router;