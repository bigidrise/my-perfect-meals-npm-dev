// server/routes/assistant.ts
import { Router } from "express";
import legacyAssistant from "./assistant_legacy";      // your current handler (unchanged)
import modernAssistant from "./assistant_pipeline";    // the smarter concierge

const r = Router();
const ENABLED = process.env.AVATAR_PIPELINE_ENABLED === "true";
const ALLOWLIST = (process.env.AVATAR_PIPELINE_USERS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

r.post("/ask", async (req, res) => {
  const userId = String(req.body?.userId || "guest");
  const canUseModern = ENABLED && (ALLOWLIST.length === 0 || ALLOWLIST.includes(userId));

  if (!canUseModern) {
    // Guaranteed: identical output shape to your current UI
    return legacyAssistant(req, res);
  }

  try {
    const out = await modernAssistant(req, res);
    // Contract enforcement (belt + suspenders)
    if (!out || typeof out !== "object") throw new Error("Bad modern output");
    const text = typeof out.text === "string" ? out.text : "Done.";
    const captions = typeof out.captions === "string" ? out.captions : text;
    const navigateTo = typeof out.navigateTo === "string" ? out.navigateTo : undefined;
    return res.json({ text, captions, navigateTo });
  } catch (e) {
    console.warn("[Avatar] Modern pipeline failed for", userId, e);
    // Instant safe fallback
    return legacyAssistant(req, res);
  }
});

export default r;