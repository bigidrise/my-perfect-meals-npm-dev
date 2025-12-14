import { Router } from "express";
import { deriveConstraints } from "../services/deriveConstraints";

export const constraintsRouter = Router();

// GET /api/meal-engine/constraints?userId=...
constraintsRouter.get("/constraints", async (req, res) => {
  try {
    const userId = String(req.query.userId || "");
    if (!userId) return res.status(400).json({ error: "userId_required" });
    const constraints = await deriveConstraints(userId);
    res.json({ ok: true, constraints });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed_to_compute_constraints" });
  }
});