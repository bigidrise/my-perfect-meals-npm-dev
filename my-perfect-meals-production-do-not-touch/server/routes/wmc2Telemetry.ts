// server/routes/wmc2Telemetry.ts
// Exposes basic counters so you can see health in dev.
import { Router } from "express";
import { getErrors } from "../services/errorLog";

let counters = { plans: 0, items: 0, msTotal: 0, errors: 0 } as any;

export function bumpPlan(items: number, ms: number) { 
  counters.plans++; 
  counters.items += items; 
  counters.msTotal += ms; 
}

export function bumpError() { 
  counters.errors++; 
}

const router = Router();

router.get("/api/wmc2/telemetry", (req, res) => {
  const avgItems = counters.plans ? (counters.items / counters.plans) : 0;
  const avgMs = counters.plans ? Math.round(counters.msTotal / counters.plans) : 0;
  res.json({ ...counters, avgItems, avgMs, lastErrors: getErrors() });
});

export default router;