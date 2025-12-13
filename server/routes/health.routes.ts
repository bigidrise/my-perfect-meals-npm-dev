import { Router } from "express";
const router = Router();

router.get("/healthz", (_req, res) => res.json({ ok: true, ts: Date.now() }));
router.get("/readyz", (_req, res) => {
  // Add deeper checks here if needed (DB ping, env sanity)
  res.json({ ready: true, ts: Date.now() });
});

export default router;