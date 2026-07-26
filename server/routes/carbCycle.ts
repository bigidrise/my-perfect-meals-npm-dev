import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";
import { getAuthUserId } from "../utils/getAuthUserId";
import {
  runCarbEngine,
  buildInitialCarbCycleState,
  applyRefeedTransition,
  applyLowCarbTransition,
  type CarbCycleState,
  type WeightLogEntry,
} from "../services/protocol/carbResponseEngine";

const router = Router();

const KG_TO_LB = 2.20462;
const MAX_LOG_ENTRIES = 30;

function kgToLb(kg: number): number {
  return Math.round(kg * KG_TO_LB * 10) / 10;
}

async function loadState(userId: string): Promise<{
  state: CarbCycleState;
  bodyWeightLb: number;
  baseCarbTargetG: number;
}> {
  const [user] = await db
    .select({
      weight: users.weight,
      dailyCarbsTarget: users.dailyCarbsTarget,
      carbCycleState: users.carbCycleState,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new Error("User not found");

  const bodyWeightLb = user.weight ? kgToLb(user.weight) : 160;
  const baseCarbTargetG = user.dailyCarbsTarget ?? 150;

  const state: CarbCycleState =
    (user.carbCycleState as CarbCycleState | null) ??
    buildInitialCarbCycleState(bodyWeightLb, baseCarbTargetG);

  return { state, bodyWeightLb, baseCarbTargetG };
}

async function persistState(userId: string, state: CarbCycleState): Promise<void> {
  await db
    .update(users)
    .set({ carbCycleState: state as any })
    .where(eq(users.id, userId));
}

router.get("/carb-cycle", requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req as AuthenticatedRequest);
    const { state, bodyWeightLb, baseCarbTargetG } = await loadState(userId);
    const engineResult = runCarbEngine(bodyWeightLb, state);

    res.json({
      state,
      engine: engineResult,
      bodyWeightLb,
      baseCarbTargetG,
    });
  } catch (err: any) {
    console.error("[carbCycle] GET error:", err);
    res.status(500).json({ error: err.message });
  }
});

const logEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weight: z.number().positive().max(600),
  carbsG: z.number().min(0).max(2000),
});

router.post("/carb-cycle/log", requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req as AuthenticatedRequest);
    const parsed = logEntrySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid log entry", details: parsed.error.flatten() });
    }

    const { state, bodyWeightLb, baseCarbTargetG } = await loadState(userId);
    const entry: WeightLogEntry = parsed.data as any;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const deduped = state.weightLog.filter((e) => e.date !== entry.date);
    const updatedLog = [...deduped, entry]
      .sort((a, b) => a.date.localeCompare(b.date))
      .filter((e) => e.date >= thirtyDaysAgo)
      .slice(-MAX_LOG_ENTRIES);

    let updatedState: CarbCycleState = { ...state, weightLog: updatedLog };

    const engineResult = runCarbEngine(bodyWeightLb, updatedState);

    if (!updatedState.manualOverride) {
      if (engineResult.recommendation === "start_refeed") {
        updatedState = applyRefeedTransition(updatedState, bodyWeightLb, baseCarbTargetG);
      } else if (engineResult.recommendation === "exit_refeed") {
        updatedState = applyLowCarbTransition(updatedState, baseCarbTargetG);
      } else {
        updatedState = { ...updatedState, lastUpdated: new Date().toISOString() };
      }
    } else {
      updatedState = { ...updatedState, lastUpdated: new Date().toISOString() };
    }

    await persistState(userId, updatedState);

    const freshEngine = runCarbEngine(bodyWeightLb, updatedState);
    res.json({
      state: updatedState,
      engine: freshEngine,
      autoTransitioned: engineResult.recommendation === "start_refeed" || engineResult.recommendation === "exit_refeed",
      transitionReason: engineResult.recommendation,
    });
  } catch (err: any) {
    console.error("[carbCycle] POST /log error:", err);
    res.status(500).json({ error: err.message });
  }
});

const overrideSchema = z.object({
  action: z.enum(["start_refeed", "end_refeed"]),
});

router.post("/carb-cycle/override", requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req as AuthenticatedRequest);
    const parsed = overrideSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid override", details: parsed.error.flatten() });
    }

    const { action } = parsed.data;
    const { state, bodyWeightLb, baseCarbTargetG } = await loadState(userId);

    let updatedState: CarbCycleState;
    if (action === "start_refeed") {
      updatedState = { ...applyRefeedTransition(state, bodyWeightLb, baseCarbTargetG), manualOverride: true };
    } else {
      updatedState = { ...applyLowCarbTransition(state, baseCarbTargetG), manualOverride: true };
    }

    await persistState(userId, updatedState);

    const engineResult = runCarbEngine(bodyWeightLb, updatedState);
    res.json({ state: updatedState, engine: engineResult });
  } catch (err: any) {
    console.error("[carbCycle] POST /override error:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
