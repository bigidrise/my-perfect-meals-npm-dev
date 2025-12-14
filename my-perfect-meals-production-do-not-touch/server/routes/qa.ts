// server/routes/qa.ts
// Mount QA dashboard route with admin gate and flag.
import { Router } from "express";
import telemetry from "./wmc2Telemetry";
import { requireAdmin } from "../middleware/adminAuth";
import { flags } from "../config/flags";

const router = Router();

router.use((req, res, next) => { 
  if (!flags.QA_DASHBOARD) return res.status(404).end(); 
  next(); 
});

router.use(requireAdmin);
router.use(telemetry); // exposes /api/wmc2/telemetry under admin gate

export default router;