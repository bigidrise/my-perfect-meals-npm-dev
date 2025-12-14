import { Router } from "express";
import assistant from "./assistant";
import assistantHealth from "./assistant-health";

const router = Router();

// Avatar assistant endpoint - smart concierge for app navigation and help
// Now uses the new flag-controlled assistant router for safe rollout
router.use("/avatar-assistant", assistant);

// Health check and logging for avatar pipeline
router.use("/avatar", assistantHealth);

export default router;