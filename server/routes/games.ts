import { Router } from "express";
import { and, eq, desc, asc, sql, count } from "drizzle-orm";
import { db } from "../db";
import { gameScores, gameLeader } from "../../shared/schema";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";

dayjs.extend(isoWeek);

const router = Router();

// POST /api/games/:gameId/score
router.post("/:gameId/score", async (req, res) => {
  try {
    const { gameId } = req.params;
    const { userId, userAlias, score, durationMs, meta } = req.body;

    if (!userId || !userAlias || typeof score !== "number") {
      return res.status(400).json({ error: "Missing fields." });
    }
    if (score < 0 || score > 1_000_000) {
      return res.status(400).json({ error: "Score out of bounds." });
    }

    const now = dayjs();
    const periodDay = now.format("YYYY-MM-DD");
    const periodWeek = `${now.year()}-${String(now.isoWeek()).padStart(2, "0")}`;

    // Insert score record
    await db.insert(gameScores).values({
      gameId,
      userId,
      userAlias,
      score,
      durationMs: durationMs ?? 0,
      meta: meta ?? null,
      achievedAt: now.toDate(),
      periodDay,
      periodWeek,
      periodYear: String(now.year()),
    });

    // Handle all-time leaderboard
    const existingAll = await db
      .select()
      .from(gameLeader)
      .where(
        and(
          eq(gameLeader.gameId, gameId),
          eq(gameLeader.userId, userId),
          eq(gameLeader.scope, "all"),
          eq(gameLeader.scopeKey, "")
        )
      )
      .limit(1);

    if (existingAll.length === 0) {
      await db.insert(gameLeader).values({
        gameId,
        userId,
        userAlias,
        scope: "all",
        scopeKey: "",
        bestScore: score,
        bestAt: now.toDate(),
      });
    } else if (score > existingAll[0].bestScore) {
      await db
        .update(gameLeader)
        .set({
          userAlias,
          bestScore: score,
          bestAt: now.toDate(),
        })
        .where(
          and(
            eq(gameLeader.gameId, gameId),
            eq(gameLeader.userId, userId),
            eq(gameLeader.scope, "all"),
            eq(gameLeader.scopeKey, "")
          )
        );
    }

    // Handle weekly leaderboard
    const existingWeek = await db
      .select()
      .from(gameLeader)
      .where(
        and(
          eq(gameLeader.gameId, gameId),
          eq(gameLeader.userId, userId),
          eq(gameLeader.scope, "week"),
          eq(gameLeader.scopeKey, periodWeek)
        )
      )
      .limit(1);

    if (existingWeek.length === 0) {
      await db.insert(gameLeader).values({
        gameId,
        userId,
        userAlias,
        scope: "week",
        scopeKey: periodWeek,
        bestScore: score,
        bestAt: now.toDate(),
      });
    } else if (score > existingWeek[0].bestScore) {
      await db
        .update(gameLeader)
        .set({
          userAlias,
          bestScore: score,
          bestAt: now.toDate(),
        })
        .where(
          and(
            eq(gameLeader.gameId, gameId),
            eq(gameLeader.userId, userId),
            eq(gameLeader.scope, "week"),
            eq(gameLeader.scopeKey, periodWeek)
          )
        );
    }

    // Handle daily leaderboard
    const existingDay = await db
      .select()
      .from(gameLeader)
      .where(
        and(
          eq(gameLeader.gameId, gameId),
          eq(gameLeader.userId, userId),
          eq(gameLeader.scope, "day"),
          eq(gameLeader.scopeKey, periodDay)
        )
      )
      .limit(1);

    if (existingDay.length === 0) {
      await db.insert(gameLeader).values({
        gameId,
        userId,
        userAlias,
        scope: "day",
        scopeKey: periodDay,
        bestScore: score,
        bestAt: now.toDate(),
      });
    } else if (score > existingDay[0].bestScore) {
      await db
        .update(gameLeader)
        .set({
          userAlias,
          bestScore: score,
          bestAt: now.toDate(),
        })
        .where(
          and(
            eq(gameLeader.gameId, gameId),
            eq(gameLeader.userId, userId),
            eq(gameLeader.scope, "day"),
            eq(gameLeader.scopeKey, periodDay)
          )
        );
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error("submit score error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// GET /api/games/:gameId/leaderboard
router.get("/:gameId/leaderboard", async (req, res) => {
  try {
    const { gameId } = req.params;
    const scope = (req.query.scope as string) ?? "week";
    const limit = Number(req.query.limit ?? 50);
    const offset = Number(req.query.offset ?? 0);

    let scopeKey = "";
    if (scope === "day") {
      scopeKey = (req.query.key as string) ?? dayjs().format("YYYY-MM-DD");
    } else if (scope === "week") {
      scopeKey = (req.query.key as string) ?? `${dayjs().year()}-${String(dayjs().isoWeek()).padStart(2, "0")}`;
    } else if (scope === "all") {
      scopeKey = "";
    }

    const rows = await db
      .select({
        userId: gameLeader.userId,
        userAlias: gameLeader.userAlias,
        bestScore: gameLeader.bestScore,
        bestAt: gameLeader.bestAt,
      })
      .from(gameLeader)
      .where(
        and(
          eq(gameLeader.gameId, gameId),
          eq(gameLeader.scope, scope as any),
          eq(gameLeader.scopeKey, scopeKey)
        )
      )
      .orderBy(desc(gameLeader.bestScore), asc(gameLeader.bestAt))
      .limit(limit)
      .offset(offset);

    return res.json({
      scope,
      scopeKey,
      items: rows.map(r => ({
        userId: r.userId,
        userAlias: r.userAlias,
        score: r.bestScore,
        bestAt: r.bestAt,
      })),
    });
  } catch (err) {
    console.error("leaderboard error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// GET /api/games/:gameId/rank/:userId
router.get("/:gameId/rank/:userId", async (req, res) => {
  try {
    const { gameId, userId } = req.params;
    const scope = (req.query.scope as string) ?? "week";

    let scopeKey = "";
    if (scope === "day") {
      scopeKey = (req.query.key as string) ?? dayjs().format("YYYY-MM-DD");
    } else if (scope === "week") {
      scopeKey = (req.query.key as string) ?? `${dayjs().year()}-${String(dayjs().isoWeek()).padStart(2, "0")}`;
    } else if (scope === "all") {
      scopeKey = "";
    }

    const userRecord = await db
      .select({ score: gameLeader.bestScore })
      .from(gameLeader)
      .where(
        and(
          eq(gameLeader.gameId, gameId),
          eq(gameLeader.userId, userId),
          eq(gameLeader.scope, scope as any),
          eq(gameLeader.scopeKey, scopeKey)
        )
      )
      .limit(1);

    if (userRecord.length === 0) {
      return res.json({ rank: null, score: null });
    }

    const myScore = userRecord[0].score;

    const betterScores = await db
      .select({ count: count() })
      .from(gameLeader)
      .where(
        and(
          eq(gameLeader.gameId, gameId),
          eq(gameLeader.scope, scope as any),
          eq(gameLeader.scopeKey, scopeKey),
          sql`${gameLeader.bestScore} > ${myScore}`
        )
      );

    const rank = Number(betterScores[0]?.count || 0) + 1;

    return res.json({ rank, score: myScore });
  } catch (err) {
    console.error("rank error:", err);
    return res.status(500).json({ error: "Internal server error." });
  }
});

export default router;