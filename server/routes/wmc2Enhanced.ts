// server/routes/wmc2Enhanced.ts
// Enhanced WMC2 routes with error handling, rate limiting and telemetry
import { Router } from "express";
import { wmc2Generate, wmc2Regenerate } from "../services/wmc2Adapter";
import { createApiRateLimit } from "../middleware/rateLimit";

const apiRateLimit = createApiRateLimit();
import { bumpPlan, bumpError } from "./wmc2Telemetry";
import { pushError } from "../services/errorLog";
import { costGuardCheck } from "../services/costGuard";

const router = Router();

router.post("/api/wmc2/generate", apiRateLimit, async (req, res) => {
  const userId = String(req.body?.userId || "anon");
  try {
    costGuardCheck(userId);
    const t0 = Date.now();
    const plan = await wmc2Generate(req.body);
    bumpPlan(plan?.items?.length || 0, Date.now() - t0);
    res.json(plan);
  } catch (e: any) {
    const msg = String(e?.message || "Failed to generate plan");
    const code = msg.startsWith("budget:") ? msg : (msg.split(":")[0]);
    pushError(msg, code);
    bumpError();
    const status = code.startsWith("budget") ? 429 : 422;
    res.status(status).json({ error: msg, code });
  }
});

router.post("/api/wmc2/:userId/regenerate", apiRateLimit, async (req, res) => {
  const userId = String(req.params?.userId || "anon");
  try { 
    costGuardCheck(userId); 
    const result = await wmc2Regenerate(userId, req.body);
    res.json(result);
  } catch (e: any) { 
    const code = String(e?.message || "").startsWith("budget:") ? "budget:user" : "regen_failed"; 
    const status = code.startsWith("budget") ? 429 : 400;
    pushError(e.message || "Failed to regenerate", code);
    bumpError();
    res.status(status).json({ error: e.message || "Failed to regenerate", code }); 
  }
});

export default router;