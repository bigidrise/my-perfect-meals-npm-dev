import { Router } from "express";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { userDailyChallenges } from "../db/schema/mindset";
import { formatLocalDateKey } from "../util/time";

const r = Router();

r.get("/today", async (req, res) => {
  const userId = String(req.query.userId || "");
  const dateKey = formatLocalDateKey(new Date().toISOString());
  const row = (await db.select().from(userDailyChallenges)
    .where(and(eq(userDailyChallenges.userId, userId), eq(userDailyChallenges.dateKey, dateKey)))
    ).at(0) || null;
  res.json({ challenge: row });
});

r.post("/complete", async (req, res) => {
  const { userId, challengeId } = req.body || {};
  const now = new Date();
  await db.update(userDailyChallenges)
    .set({ completedAt: now })
    .where(and(eq(userDailyChallenges.userId, userId), eq(userDailyChallenges.id, challengeId)));
  res.json({ ok: true });
});

export default r;