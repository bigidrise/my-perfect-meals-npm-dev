import { Router } from "express";
import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db";
import {
  triviaQuestions, triviaRounds, triviaRoundItems, userTriviaStats, badges, userBadges, weeklyLeaderboard
} from "../db/schema/trivia";
import { getWeekStart } from "../util/date";
import { getPsychProfile } from "../services/psychProfileService";
import { profileToTags } from "../util/psychProfile";
import { upsertDailyChallenge, summarizeMisses } from "../services/dailyChallenge";

const r = Router();
const SECRET = process.env.TRIVIA_HMAC_SECRET || "dev-secret";
const DEFAULT_ROUND = 7;
const TIME_LIMIT = 60;

const XP_PER_CORRECT = 15;
const JACKPOT_BONUS = 50;
const JACKPOT_P = 0.18;

const hmac = (str: string) => crypto.createHmac("sha256", SECRET).update(str).digest("hex");
const pickRandom = <T,>(arr: T[], n: number) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);

function sanitizeQuestion(q: any) {
  const { answerIndex, ...rest } = q;
  return rest;
}

r.post("/start", async (req, res) => {
  const userId = String(req.body?.userId || crypto.randomUUID());
  const roundSize = Math.max(5, Math.min(20, parseInt(String(req.body?.count ?? DEFAULT_ROUND)) || DEFAULT_ROUND));
  const timeLimitSec = TIME_LIMIT;

  // 1) Read onboarding psych profile -> tags
  const profile = await getPsychProfile(userId);
  const tags = profileToTags(profile || undefined);

  // 2) Fetch active questions
  const allQs = await db.select().from(triviaQuestions).where(eq(triviaQuestions.active, true));
  if (!allQs.length) return res.status(500).json({ error: "No trivia questions." });

  // 3) Ensure round composition: 1 easy win, 3-4 growth, 1-2 nutrition/fitness, 1 mindset finisher
  const growth = allQs.filter(q => q.psychProfileTags?.some((t: string) => tags.includes(t)));
  const general = allQs.filter(q => !q.psychProfileTags?.some((t: string) => tags.includes(t)));
  const nutrition = allQs.filter(q => q.category === "Nutrition");
  const fitness = allQs.filter(q => q.category === "Fitness");
  const mindset = allQs.filter(q => ["Habits","Mindfulness","Focus","Resilience","Mental Wellness"].includes(q.mindsetCategory));

  const easyWins = allQs.filter(q => q.difficulty === 1);
  const finisher = mindset.length ? pickRandom(mindset, 1) : pickRandom(allQs, 1);

  const targetGrowth = Math.max(3, Math.floor(roundSize * 0.6));
  const pool: any[] = [];

  // Easy confidence opener
  if (easyWins.length) pool.push(pickRandom(easyWins, 1)[0]);

  // Growth-focused block
  const growthCount = Math.min(targetGrowth, Math.max(0, roundSize - pool.length - 2));
  pool.push(...pickRandom(growth.length ? growth : general, growthCount));

  // Ensure at least one Nutrition and one Fitness
  if (!pool.find(q => q.category === "Nutrition") && nutrition.length) pool.push(pickRandom(nutrition, 1)[0]);
  if (!pool.find(q => q.category === "Fitness") && fitness.length) pool.push(pickRandom(fitness, 1)[0]);

  // Fill remainder with general/growth mix
  while (pool.length < roundSize - 1) {
    const src = Math.random() < 0.6 ? (growth.length ? growth : general) : general;
    pool.push(src[Math.floor(Math.random() * src.length)]);
  }

  // Mindset finisher at the end
  pool.push(finisher[0]);

  // Shuffle lightly but keep finisher last
  const mid = pool.slice(0, pool.length - 1).sort(() => Math.random() - 0.5);
  const ordered = [...mid, pool[pool.length - 1]];

  // Create round
  const roundId = crypto.randomUUID();
  const token = crypto.randomUUID();
  const tokenHash = hmac(`${roundId}:${userId}:${token}`);

  await db.insert(triviaRounds).values({
    id: roundId, userId, roundSize, tokenHash, timeLimitSec,
  });

  await db.insert(triviaRoundItems).values(
    ordered.map((q, i) => ({ roundId, qid: q.id, order: i }))
  );

  res.json({
    roundId,
    token,
    timeLimitSec,
    questions: ordered.map(sanitizeQuestion),
  });
});

r.post("/answer", async (req, res) => {
  const { roundId, token, order, pickedIndex, userId } = req.body as any;
  const tokenHash = hmac(`${roundId}:${userId}:${token}`);

  const round = (await db.select().from(triviaRounds).where(eq(triviaRounds.id, roundId)))[0];
  if (!round || round.tokenHash !== tokenHash) return res.status(403).json({ error: "Invalid round." });
  if (round.finishedAt) return res.status(400).json({ error: "Round finished." });

  const item = (await db.select().from(triviaRoundItems).where(and(eq(triviaRoundItems.roundId, roundId), eq(triviaRoundItems.order, order))))[0];
  if (!item) return res.status(404).json({ error: "Item not found." });
  if (item.answeredAt) return res.json({ ok: true });

  const q = (await db.select().from(triviaQuestions).where(eq(triviaQuestions.id, item.qid)))[0];
  const correct = pickedIndex === q.answerIndex;

  await db.update(triviaRoundItems)
    .set({ pickedIndex, correct, answeredAt: new Date() })
    .where(and(eq(triviaRoundItems.roundId, roundId), eq(triviaRoundItems.order, order)));

  res.json({ correct });
});

r.post("/finish", async (req, res) => {
  const { roundId, token, userId } = req.body as any;
  const tokenHash = hmac(`${roundId}:${userId}:${token}`);

  const round = (await db.select().from(triviaRounds).where(eq(triviaRounds.id, roundId)))[0];
  if (!round || round.tokenHash !== tokenHash) return res.status(403).json({ error: "Invalid round." });

  const items = await db.select().from(triviaRoundItems).where(eq(triviaRoundItems.roundId, roundId));
  const profile = await getPsychProfile(userId);
  const tags = profileToTags(profile || undefined);

  let score = 0, mistakes = 0, streak = 0, bestStreak = 0, mindsetGain = 0;
  const explanations: Array<{order:number; explanation:string; correct:boolean}> = [];

  for (const it of items) {
    const q = (await db.select().from(triviaQuestions).where(eq(triviaQuestions.id, it.qid)))[0];
    const ok = !!it.correct;

    if (ok) {
      let s = 100;
      if (Math.random() < JACKPOT_P) s += JACKPOT_BONUS;
      score += s;
      streak++;
      bestStreak = Math.max(bestStreak, streak);

      // Mindset XP if this was a growth-targeted question
      if (q.psychProfileTags?.some((t: string) => tags.includes(t))) mindsetGain += 10;
    } else {
      mistakes++;
      streak = 0;
    }

    explanations.push({ order: it.order, explanation: q.explanation, correct: ok });
  }

  // Time limit enforcement
  const now = new Date();
  const started = round.startedAt ?? now;
  const elapsed = (now.getTime() - new Date(started).getTime()) / 1000;
  if (elapsed > (round.timeLimitSec * 2)) score = Math.floor(score * 0.8);

  await db.update(triviaRounds)
    .set({ finishedAt: now, score, mistakes, bestStreak })
    .where(eq(triviaRounds.id, roundId));

  // XP + stats
  const correctCount = items.filter(i => i.correct).length;
  const gainedXp = correctCount * XP_PER_CORRECT;

  const existing = (await db.select().from(userTriviaStats).where(eq(userTriviaStats.userId, userId)))[0];
  if (existing) {
    await db.update(userTriviaStats).set({
      xp: existing.xp + gainedXp,
      mindsetXp: existing.mindsetXp + mindsetGain,
      totalScore: existing.totalScore + score,
      roundsPlayed: existing.roundsPlayed + 1,
      bestStreak: Math.max(existing.bestStreak, bestStreak),
      lastPlayedAt: now,
    }).where(eq(userTriviaStats.userId, userId));
  } else {
    await db.insert(userTriviaStats).values({
      userId, xp: gainedXp, mindsetXp: mindsetGain, totalScore: score, roundsPlayed: 1, bestStreak, lastPlayedAt: now,
    });
  }

  // Badge checking
  const toAward: { id:string; name:string; icon:string }[] = [];
  const allBadges = await db.select().from(badges);
  const owned = await db.select().from(userBadges).where(eq(userBadges.userId, userId));
  const ownedSet = new Set(owned.map(o => o.badgeId));
  
  for (const b of allBadges) {
    if (ownedSet.has(b.id)) continue;
    const c = b.criteria;
    const currentStats = existing ? {
      xp: existing.xp + gainedXp,
      mindsetXp: existing.mindsetXp + mindsetGain,
      totalScore: existing.totalScore + score,
      roundsPlayed: existing.roundsPlayed + 1,
      bestStreak: Math.max(existing.bestStreak, bestStreak)
    } : { xp: gainedXp, mindsetXp: mindsetGain, totalScore: score, roundsPlayed: 1, bestStreak };
    
    const meets =
      (c.type === "streak" && bestStreak >= c.value) ||
      (c.type === "score" && score >= c.value) ||
      (c.type === "xp" && currentStats.xp >= c.value) ||
      (c.type === "mindsetXp" && currentStats.mindsetXp >= c.value) ||
      (c.type === "rounds" && currentStats.roundsPlayed >= c.value);
    
    if (meets) {
      await db.insert(userBadges).values({ userId, badgeId: b.id });
      toAward.push({ id: b.id, name: b.name, icon: b.icon });
    }
  }

  // Weekly leaderboard
  const weekStart = getWeekStart(now);
  const prior = (await db.select().from(weeklyLeaderboard).where(and(eq(weeklyLeaderboard.weekStart, weekStart), eq(weeklyLeaderboard.userId, userId))))[0];
  if (prior) {
    await db.update(weeklyLeaderboard).set({ score: prior.score + score })
      .where(and(eq(weeklyLeaderboard.weekStart, weekStart), eq(weeklyLeaderboard.userId, userId)));
  } else {
    await db.insert(weeklyLeaderboard).values({ weekStart, userId, score });
  }

  // Build miss summary for challenge generation
  const missItems = await Promise.all(items.map(async (it) => {
    const q = (await db.select().from(triviaQuestions).where(eq(triviaQuestions.id, it.qid)))[0];
    return { category: q.category, psychTags: q.psychProfileTags || [], correct: !!it.correct };
  }));
  const missSummary = summarizeMisses(missItems);

  // Local date key (America/Chicago per your project's TZ; if you have per-user TZ, use that)
  const nowLocal = new Date(); // assume server aligned; otherwise use luxon with user tz
  const localIso = nowLocal.toISOString();

  // Create (or reuse) today's challenge based on misses + psych profile
  const todaysChallenge = await upsertDailyChallenge({
    userId,
    localIsoDate: localIso,
    missSummary,
    userPsychTags: tags
  });

  res.json({
    score, mistakes, bestStreak, elapsed,
    xpGained: gainedXp,
    mindsetXpGained: mindsetGain,
    explanations: explanations.sort((a,b) => a.order - b.order),
    badgesAwarded: toAward,
    dailyChallenge: todaysChallenge ? {
      id: todaysChallenge.id,
      title: todaysChallenge.title,
      instructions: todaysChallenge.instructions,
      tags: todaysChallenge.tags
    } : null
  });
});

r.get("/leaderboard/weekly", async (req, res) => {
  const weekStart = getWeekStart(new Date());
  const rows = await db.select().from(weeklyLeaderboard)
    .where(eq(weeklyLeaderboard.weekStart, weekStart))
    .orderBy(desc(weeklyLeaderboard.score))
    .limit(25);
  res.json(rows);
});

r.get("/stats/:userId", async (req, res) => {
  const userId = req.params.userId;
  const stats = (await db.select().from(userTriviaStats).where(eq(userTriviaStats.userId, userId)))[0];
  const userBadgesList = await db.select().from(userBadges).where(eq(userBadges.userId, userId));
  res.json({ stats: stats || { xp: 0, mindsetXp: 0, totalScore: 0, roundsPlayed: 0, bestStreak: 0 }, badges: userBadgesList });
});

// Simple import endpoint for question bank JSON
r.post("/bank/import", async (req, res) => {
  const items = req.body?.questions as Array<any>;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: "No questions." });
  await db.insert(triviaQuestions).values(items.map(q => ({
    category: q.category, 
    mindsetCategory: q.mindsetCategory || "General",
    psychProfileTags: q.psychProfileTags || [],
    question: q.question, 
    choices: q.choices,
    answerIndex: q.answerIndex, 
    explanation: q.explanation, 
    difficulty: q.difficulty ?? 1, 
    active: true
  })));
  res.json({ imported: items.length });
});

export default r;