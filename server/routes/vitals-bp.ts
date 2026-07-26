import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../db";
import { vitalBp } from "@shared/schema";
import { requireAuth, type AuthenticatedRequest } from "../middleware/requireAuth";

const router = Router();

// ── Auth on every route in this file ────────────────────────────────────────
// All vitals/bp endpoints are patient-owned data. requireAuth is applied
// router-wide so no handler can be reached unauthenticated.
router.use(requireAuth);

// ── Authorization helper ─────────────────────────────────────────────────────
// Resolves the target userId for a request and confirms the caller is allowed
// to access it. Rules:
//   • Self-access: caller's own data — always permitted.
//   • Provider read: coaches, admins, and professional roles may read/write
//     patient data through dedicated ProCare endpoints that carry their own
//     clinical-access checks. These standalone routes are patient-self-service
//     only. If a body/query userId is supplied that doesn't match the caller,
//     we return 403 so providers use the correct ProCare path.
function resolveAndAuthorize(req: Request, fallbackUserId?: string): string {
  const authUser = (req as AuthenticatedRequest).authUser;
  const callerUserId = authUser.id;
  const requestedUserId = fallbackUserId ?? callerUserId;

  if (requestedUserId !== callerUserId) {
    const err: any = new Error(
      "Access denied: use ProCare endpoints to access another user's vitals."
    );
    err.status = 403;
    err.code = "VITALS_AUTH_FORBIDDEN";
    throw err;
  }

  return callerUserId;
}

/**
 * POST /api/vitals/bp
 * Body can be a single object or an array of objects.
 * The userId is always sourced from the authenticated session —
 * any userId in the body is ignored.
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const callerUserId = (req as AuthenticatedRequest).authUser.id;

    const item = z.object({
      userId: z.string().optional(),
      measured_at: z.string(),
      systolic: z.number().int().min(40).max(260),
      diastolic: z.number().int().min(20).max(200),
      pulse: z.number().int().min(20).max(240).optional(),
      source: z.enum(["manual", "apple_health", "import"]).default("manual"),
      meta: z.record(z.any()).optional(),
    });

    const parsed = Array.isArray(req.body)
      ? z.array(item).min(1).parse(req.body)
      : [item.parse(req.body)];

    const rows = parsed.map((r) => ({
      userId: callerUserId,
      measuredAt: new Date(r.measured_at),
      systolic: r.systolic,
      diastolic: r.diastolic,
      pulse: r.pulse ?? null,
      source: r.source,
      meta: r.meta ?? {},
    }));

    const insertedReadings = [];
    for (const row of rows) {
      try {
        const [reading] = await db.insert(vitalBp).values({
          userId: row.userId,
          measuredAt: row.measuredAt,
          systolic: row.systolic,
          diastolic: row.diastolic,
          pulse: row.pulse,
          source: row.source,
          meta: row.meta,
        }).returning();
        insertedReadings.push(reading);
      } catch (error) {
        if ((error as any)?.code !== '23505') {
          throw error;
        }
      }
    }

    res.json({ ok: true, inserted: insertedReadings.length, readings: insertedReadings });
  } catch (err: any) {
    const status = err.status === 403 ? 403 : 400;
    res.status(status).json({ error: err.message ?? "Invalid request" });
  }
});

/**
 * GET /api/vitals/bp
 * Query modes:
 *  1) Latest: ?userId=...&limit=1     → { readings: [{...}] }
 *  2) Aggregated daily: ?userId=...&start=ISO&end=ISO&aggregate=day
 *  3) Raw window: ?userId=...&start=ISO&end=ISO → { readings: [{...}] }
 *
 * userId query param is optional and must equal the caller's own id.
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const qSchema = z.object({
      userId: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      aggregate: z.enum(["day"]).optional(),
    });
    const q = qSchema.parse(req.query);

    const userId = resolveAndAuthorize(req, q.userId);

    if (q.limit) {
      const readings = await db
        .select()
        .from(vitalBp)
        .where(eq(vitalBp.userId, userId))
        .orderBy(desc(vitalBp.measuredAt))
        .limit(q.limit);

      return res.json({
        readings: readings.map((r) => ({
          id: r.id,
          measured_at: r.measuredAt,
          systolic: r.systolic,
          diastolic: r.diastolic,
          pulse: r.pulse ?? undefined,
          source: r.source,
          meta: r.meta ?? {},
        })),
      });
    }

    if (!q.start || !q.end) {
      return res.status(400).json({ error: "start and end are required (ISO8601)" });
    }
    const start = new Date(q.start);
    const end = new Date(q.end);

    if (q.aggregate === "day") {
      const daily = await db.execute(sql`
        SELECT
          to_char(date_trunc('day', measured_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
          AVG(systolic)::numeric(10,2) AS "systolicAvg",
          AVG(diastolic)::numeric(10,2) AS "diastolicAvg",
          COUNT(*)::int AS count
        FROM vital_bp
        WHERE user_id = ${userId}
          AND measured_at >= ${start.toISOString()}::timestamptz
          AND measured_at <= ${end.toISOString()}::timestamptz
        GROUP BY 1
        ORDER BY 1 ASC;
      `);

      const rows = (daily as any).rows ?? daily ?? [];
      return res.json({
        daily: rows.map((r: any) => ({
          date: r.date,
          systolicAvg: Number(r.systolicavg ?? r.systolicAvg ?? r.systolic_avg),
          diastolicAvg: Number(r.diastolicavg ?? r.diastolicAvg ?? r.diastolic_avg),
          count: Number(r.count),
        })),
      });
    }

    const readings = await db
      .select()
      .from(vitalBp)
      .where(
        and(
          eq(vitalBp.userId, userId),
          gte(vitalBp.measuredAt, start),
          lte(vitalBp.measuredAt, end)
        )
      )
      .orderBy(asc(vitalBp.measuredAt));

    return res.json({
      readings: readings.map((r) => ({
        id: r.id,
        measured_at: r.measuredAt,
        systolic: r.systolic,
        diastolic: r.diastolic,
        pulse: r.pulse ?? undefined,
        source: r.source,
        meta: r.meta ?? {},
      })),
    });
  } catch (err: any) {
    const status = err.status === 403 ? 403 : 400;
    res.status(status).json({ error: err.message ?? "Invalid request" });
  }
});

/**
 * DELETE /api/vitals/bp/:id
 * Deletes a single BP reading owned by the current user.
 * The WHERE clause enforces ownership: userId must match the record's userId.
 */
router.delete("/:id", async (req, res) => {
  try {
    const callerUserId = (req as AuthenticatedRequest).authUser.id;
    const id = z.string().parse(req.params.id);

    const result = await db
      .delete(vitalBp)
      .where(and(eq(vitalBp.id, id), eq(vitalBp.userId, callerUserId)));

    const deleted =
      // @ts-ignore
      typeof result === "number" ? result :
      // @ts-ignore
      (typeof result?.rowCount === "number" ? result.rowCount : 0);

    return res.json({ ok: true, deleted });
  } catch (err: any) {
    return res.status(400).json({ error: err.message ?? "Invalid request" });
  }
});

/**
 * DELETE /api/vitals/bp
 * Query: ?start=ISO&end=ISO
 * Deletes all readings in [start, end] inclusive for the authenticated user only.
 */
router.delete("/", async (req, res) => {
  try {
    const callerUserId = (req as AuthenticatedRequest).authUser.id;

    const qs = z.object({
      start: z.string(),
      end: z.string(),
    }).parse(req.query);

    const start = new Date(qs.start);
    const end = new Date(qs.end);

    if (start > end) {
      return res.status(400).json({ error: "start must be <= end" });
    }

    const result = await db
      .delete(vitalBp)
      .where(
        and(
          eq(vitalBp.userId, callerUserId),
          gte(vitalBp.measuredAt, start),
          lte(vitalBp.measuredAt, end)
        )
      );

    const deleted =
      // @ts-ignore
      typeof result === "number" ? result :
      // @ts-ignore
      (typeof result?.rowCount === "number" ? result.rowCount : 0);

    return res.json({ ok: true, deleted });
  } catch (err: any) {
    return res.status(400).json({ error: err.message ?? "Invalid request" });
  }
});

export default router;
