import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const result = await db.execute(
      sql`SELECT * FROM coaching_profiles WHERE user_id = ${authReq.authUser.id} LIMIT 1`
    );
    if (result.rows.length === 0) {
      return res.json({ profile: null });
    }
    return res.json({ profile: result.rows[0] });
  } catch (err: any) {
    console.error("[ACE] GET /profile error:", err.message);
    return res.status(500).json({ error: "Failed to load coaching profile" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.authUser.id;

  const {
    coaching_style,
    accountability_pref,
    motivations,
    lifestyle_flags,
    biggest_challenges,
  } = req.body;

  const validStyles = ["direct", "encouraging", "educational", "balanced"];
  const validAccountability = [
    "push_hard",
    "encourage",
    "remind",
    "self_directed",
  ];

  if (coaching_style && !validStyles.includes(coaching_style)) {
    return res.status(400).json({ error: "Invalid coaching_style value" });
  }
  if (accountability_pref && !validAccountability.includes(accountability_pref)) {
    return res
      .status(400)
      .json({ error: "Invalid accountability_pref value" });
  }
  if (motivations && !Array.isArray(motivations)) {
    return res.status(400).json({ error: "motivations must be an array" });
  }
  if (lifestyle_flags && !Array.isArray(lifestyle_flags)) {
    return res.status(400).json({ error: "lifestyle_flags must be an array" });
  }
  if (biggest_challenges && !Array.isArray(biggest_challenges)) {
    return res
      .status(400)
      .json({ error: "biggest_challenges must be an array" });
  }

  try {
    const result = await db.execute(sql`
      INSERT INTO coaching_profiles
        (user_id, coaching_style, accountability_pref, motivations, lifestyle_flags, biggest_challenges, updated_at)
      VALUES (
        ${userId},
        ${coaching_style ?? null},
        ${accountability_pref ?? null},
        ${motivations ?? null},
        ${lifestyle_flags ?? null},
        ${biggest_challenges ?? null},
        now()
      )
      ON CONFLICT (user_id) DO UPDATE SET
        coaching_style       = EXCLUDED.coaching_style,
        accountability_pref  = EXCLUDED.accountability_pref,
        motivations          = EXCLUDED.motivations,
        lifestyle_flags      = EXCLUDED.lifestyle_flags,
        biggest_challenges   = EXCLUDED.biggest_challenges,
        updated_at           = now()
      RETURNING *
    `);

    return res.json({ profile: result.rows[0] });
  } catch (err: any) {
    console.error("[ACE] POST /profile error:", err.message);
    return res.status(500).json({ error: "Failed to save coaching profile" });
  }
});

export default router;
