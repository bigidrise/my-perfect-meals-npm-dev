import { and, asc, eq, gte, isNotNull, isNull, lte, or } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { db } from "../../db";
import { waterLogs } from "@shared/schema";
import { assignedHydrationLocalDate, hydrationCalendarWindow, shiftLocalDate } from "./hydrationDay";
import { resolveHydrationCenterState, type HydrationCenterState } from "./hydrationCenterService";
import {
  getCurrentLiquidNutritionProtocol,
} from "./liquidNutritionProtocolService";
import type { HydrationProtocolRecord } from "@shared/hydration/fourDoor";

export const HYDRATION_BARRIER_CODES = [
  "forgetting",
  "taste",
  "temperature",
  "carbonation",
  "access",
  "timing",
  "bathroom_concerns",
  "nutrition_conflicts",
  "low_appetite",
] as const;

export type HydrationBarrierCode = (typeof HYDRATION_BARRIER_CODES)[number];
export type HydrationBeverageClass =
  | "water"
  | "tea"
  | "coffee"
  | "milk"
  | "juice"
  | "sparkling"
  | "other";

type HubOption = {
  optionKey: string;
  title: string;
  description: string;
  destinationType: "guidance" | "beverage_creator" | "routine";
  destinationRef?: string;
};

const OPTIONS: Record<HydrationBarrierCode, HubOption[]> = {
  forgetting: [
    { optionKey: "visible-cue", title: "Use a visible cue", description: "Keep your usual cup or bottle where your next routine starts.", destinationType: "routine" },
    { optionKey: "routine-pairing", title: "Pair it with something you already do", description: "Connect a drink with a reliable moment such as breakfast, a commute, or a screen break.", destinationType: "routine" },
  ],
  taste: [
    { optionKey: "flavor-forward", title: "Make it more appealing", description: "Try a fresh, unsweetened flavor direction that sounds good to you.", destinationType: "beverage_creator", destinationRef: "hydration" },
    { optionKey: "alternate-temperature", title: "Change the experience", description: "A different temperature, cup, or straw can make plain fluids easier to return to.", destinationType: "guidance" },
  ],
  temperature: [
    { optionKey: "temperature-choice", title: "Choose your comfortable temperature", description: "Keep a cold, room-temperature, or warm option available based on what feels easiest.", destinationType: "guidance" },
  ],
  carbonation: [
    { optionKey: "sparkling-choice", title: "Use a sparkling option", description: "If bubbles help, choose a plain or unsweetened sparkling beverage that fits your preferences.", destinationType: "guidance" },
  ],
  access: [
    { optionKey: "two-location-setup", title: "Set up a backup location", description: "Keep a ready-to-use cup or bottle in the place where access usually breaks down.", destinationType: "routine" },
    { optionKey: "portable-option", title: "Make it portable", description: "Choose a container that is easy to carry through the part of your day that is hardest.", destinationType: "guidance" },
  ],
  timing: [
    { optionKey: "small-moments", title: "Use smaller moments", description: "Look for a few natural pauses instead of waiting for one large hydration break.", destinationType: "routine" },
  ],
  bathroom_concerns: [
    { optionKey: "plan-access", title: "Plan around access", description: "Choose times and places where a restroom is available and avoid turning hydration into an emergency.", destinationType: "guidance" },
  ],
  nutrition_conflicts: [
    { optionKey: "simple-fluid", title: "Keep the choice simple", description: "Start with a fluid that fits your existing food and nutrition preferences; the Hub does not create a medical target.", destinationType: "guidance" },
    { optionKey: "nutrition-aware-drink", title: "Create a compatible drink", description: "Use Beverage Creator for a constrained, preference-aware idea. Any safety checks still apply there.", destinationType: "beverage_creator", destinationRef: "hydration" },
  ],
  low_appetite: [
    { optionKey: "low-effort-sip", title: "Lower the effort", description: "Keep a comfortable, ready-to-sip option nearby so hydration does not require a full food decision.", destinationType: "guidance" },
  ],
};

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function sum(rows: Array<{ amountMl: number }>) {
  return rows.reduce((total, row) => total + Number(row.amountMl || 0), 0);
}

export async function getHydrationHubState(input: {
  subjectUserId: string;
  localDate: string;
  timezone: string;
  access: Parameters<typeof resolveHydrationCenterState>[0]["access"];
  now?: Date;
}): Promise<HydrationHubState> {
  const thirtyDayWindow = hydrationCalendarWindow({ endingLocalDate: input.localDate, timezone: input.timezone, days: 30 });

  const rows = await db.select({
    id: waterLogs.id,
    amountMl: waterLogs.amountMl,
    unit: waterLogs.unit,
    beverageClass: waterLogs.beverageClass,
    intakeTime: waterLogs.intakeTime,
    eventTimezone: waterLogs.eventTimezone,
    eventLocalDate: waterLogs.eventLocalDate,
  }).from(waterLogs).where(and(
    eq(waterLogs.userId, input.subjectUserId),
    or(
      and(
        isNotNull(waterLogs.eventLocalDate),
        gte(waterLogs.eventLocalDate, shiftLocalDate(input.localDate, -29)),
        lte(waterLogs.eventLocalDate, input.localDate),
      ),
      and(
        isNull(waterLogs.eventLocalDate),
        gte(waterLogs.intakeTime, thirtyDayWindow.start),
        lte(waterLogs.intakeTime, thirtyDayWindow.end),
      ),
    ),
  )).orderBy(asc(waterLogs.intakeTime));

  const assignedDay = (row: typeof rows[number]) =>
    assignedHydrationLocalDate({
      eventTime: row.intakeTime,
      eventLocalDate: row.eventLocalDate,
      currentTimezone: input.timezone,
    });
  const todayRows = rows.filter((row) => assignedDay(row) === input.localDate);
  const sevenDayStart = shiftLocalDate(input.localDate, -6);
  const sevenRows = rows.filter((row) => assignedDay(row) >= sevenDayStart);
  const plainWater = (items: typeof rows) => sum(items.filter((row) => (row.beverageClass || "water") === "water"));
  const mix = (items: typeof rows) => Object.entries(items.reduce<Record<string, number>>((acc, row) => {
    const key = row.beverageClass || "water";
    acc[key] = (acc[key] || 0) + Number(row.amountMl || 0);
    return acc;
  }, {})).map(([beverageClass, amountMl]) => ({ beverageClass, amountMl }));

  const dailyTotals = new Map<string, { totalMl: number; plainWaterMl: number }>();
  for (const row of rows) {
    const day = assignedDay(row);
    const current = dailyTotals.get(day) || { totalMl: 0, plainWaterMl: 0 };
    current.totalMl += Number(row.amountMl || 0);
    if ((row.beverageClass || "water") === "water") current.plainWaterMl += Number(row.amountMl || 0);
    dailyTotals.set(day, current);
  }

  const [preferenceResult, barrierResult, interventionResult, eventResult, liquidProtocol] = await Promise.all([
    db.execute(sql`
      SELECT consented, preferences, opted_out_at AS "optedOutAt"
      FROM hydration_hub_preferences WHERE user_id = ${input.subjectUserId} LIMIT 1
    `),
    db.execute(sql`
      SELECT barrier_code AS "barrierCode", note
      FROM hydration_hub_barriers
      WHERE user_id = ${input.subjectUserId} AND active = true
      ORDER BY updated_at DESC
    `),
    db.execute(sql`
      SELECT id, barrier_code AS "barrierCode", option_key AS "optionKey", title,
             description, destination_type AS "destinationType",
             destination_ref AS "destinationRef", created_at AS "createdAt"
      FROM hydration_hub_interventions
      WHERE user_id = ${input.subjectUserId}
      ORDER BY created_at DESC LIMIT 8
    `),
    db.execute(sql`
      SELECT event_type AS "eventType", COUNT(*)::int AS count
      FROM hydration_hub_intervention_events
      WHERE user_id = ${input.subjectUserId}
      GROUP BY event_type
    `),
    getCurrentLiquidNutritionProtocol({
      userId: input.subjectUserId,
      localDate: input.localDate,
    }),
  ]);

  const centerState = await resolveHydrationCenterState(input);
  return {
    ...centerState,
    projections: {
      today: {
        totalFluidsMl: sum(todayRows),
        plainWaterMl: plainWater(todayRows),
        beverageMix: mix(todayRows),
      },
      sevenDay: {
        totalFluidsMl: sum(sevenRows),
        plainWaterMl: plainWater(sevenRows),
        daysWithEntries: new Set(sevenRows.map(assignedDay)).size,
      },
      thirtyDay: {
        totalFluidsMl: sum(rows),
        plainWaterMl: plainWater(rows),
        daysWithEntries: new Set(rows.map(assignedDay)).size,
      },
      dailyTotals: [...dailyTotals.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([localDate, values]) => ({ localDate, ...values })),
    },
    todayHistory: todayRows.slice(-50).reverse().map((row) => ({
      id: row.id,
      amountMl: Number(row.amountMl),
      unit: row.unit,
      beverageClass: row.beverageClass || "water",
      intakeTime: row.intakeTime.toISOString(),
    })),
    setup: {
      consented: Boolean(preferenceResult.rows[0]?.consented),
      preferences: jsonObject(preferenceResult.rows[0]?.preferences),
      optedOutAt: preferenceResult.rows[0]?.optedOutAt
        ? new Date(preferenceResult.rows[0].optedOutAt as string | Date).toISOString()
        : null,
      barriers: (barrierResult.rows as Array<{ barrierCode: string; note: string | null }>).map((row) => ({ barrierCode: row.barrierCode, note: row.note })),
    },
    interventions: (interventionResult.rows as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      createdAt: new Date(row.createdAt as string).toISOString(),
    })),
    outcomeCounts: Object.fromEntries((eventResult.rows as Array<{ eventType: string; count: number }>).map((row) => [row.eventType, Number(row.count)])),
    liquidProtocol,
  };
}

export type HydrationHubState = HydrationCenterState & {
  projections: {
    today: { totalFluidsMl: number; plainWaterMl: number; beverageMix: Array<{ beverageClass: string; amountMl: number }> };
    sevenDay: { totalFluidsMl: number; plainWaterMl: number; daysWithEntries: number };
    thirtyDay: { totalFluidsMl: number; plainWaterMl: number; daysWithEntries: number };
    dailyTotals: Array<{ localDate: string; totalMl: number; plainWaterMl: number }>;
  };
  todayHistory: Array<{ id: string; amountMl: number; unit: string; beverageClass: string; intakeTime: string }>;
  setup: {
    consented: boolean;
    preferences: Record<string, unknown>;
    optedOutAt: string | null;
    barriers: Array<{ barrierCode: string; note: string | null }>;
  };
  interventions: Array<Record<string, unknown>>;
  outcomeCounts: Record<string, number>;
  liquidProtocol: HydrationProtocolRecord | null;
};

export async function saveHydrationPreferences(input: {
  userId: string;
  consented: boolean;
  preferences: Record<string, unknown>;
  optedOut: boolean;
}) {
  const preferences = input.optedOut ? {} : input.preferences;
  await db.execute(sql`
    INSERT INTO hydration_hub_preferences
      (user_id, consented, preferences, opted_out_at, updated_at)
    VALUES
      (${input.userId}, ${input.consented && !input.optedOut}, ${JSON.stringify(preferences)}::jsonb,
       ${input.optedOut ? new Date() : null}, now())
    ON CONFLICT (user_id) DO UPDATE SET
      consented = EXCLUDED.consented,
      preferences = EXCLUDED.preferences,
      opted_out_at = EXCLUDED.opted_out_at,
      updated_at = now()
  `);
}

export async function saveHydrationBarriers(input: {
  userId: string;
  barriers: Array<{ barrierCode: HydrationBarrierCode; note?: string }>;
}) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`UPDATE hydration_hub_barriers SET active = false, updated_at = now() WHERE user_id = ${input.userId}`);
    for (const barrier of input.barriers) {
      await tx.execute(sql`
        INSERT INTO hydration_hub_barriers (user_id, barrier_code, note, active, updated_at)
        VALUES (${input.userId}, ${barrier.barrierCode}, ${barrier.note?.trim() || null}, true, now())
        ON CONFLICT (user_id, barrier_code) DO UPDATE SET
          note = EXCLUDED.note, active = true, updated_at = now()
      `);
    }
  });
}

export async function createHydrationHelp(input: {
  userId: string;
  barriers: HydrationBarrierCode[];
  preferences: Record<string, unknown>;
}) {
  const consent = await db.execute(sql`
    SELECT consented FROM hydration_hub_preferences
    WHERE user_id = ${input.userId} AND consented = true AND opted_out_at IS NULL
    LIMIT 1
  `);
  if (!consent.rows.length) {
    const error = new Error("HYDRATION_HUB_CONSENT_REQUIRED");
    (error as Error & { code?: string }).code = "HYDRATION_HUB_CONSENT_REQUIRED";
    throw error;
  }
  const selected = input.barriers.length ? input.barriers : ["forgetting" as const];
  const options = selected.flatMap((barrierCode) => (OPTIONS[barrierCode] || []).map((option) => ({ barrierCode, ...option }))).slice(0, 6);
  const created = [];
  for (const option of options) {
    const result = await db.execute(sql`
      INSERT INTO hydration_hub_interventions
        (user_id, barrier_code, option_key, title, description, destination_type, destination_ref, provenance)
      VALUES
        (${input.userId}, ${option.barrierCode}, ${option.optionKey}, ${option.title}, ${option.description},
         ${option.destinationType}, ${option.destinationRef || null},
         ${JSON.stringify({ source: "phase1_rules", preferenceKeys: Object.keys(input.preferences).sort(), eligibility: "practical_only" })}::jsonb)
      RETURNING id, barrier_code AS "barrierCode", option_key AS "optionKey", title, description,
                destination_type AS "destinationType", destination_ref AS "destinationRef", created_at AS "createdAt"
    `);
    const row = result.rows[0];
    await db.execute(sql`
      INSERT INTO hydration_hub_intervention_events (intervention_id, user_id, event_type, metadata)
      VALUES (${row.id}, ${input.userId}, 'shown', '{}'::jsonb)
    `);
    created.push(row);
  }
  return created;
}

export async function recordHydrationInterventionEvent(input: {
  userId: string;
  interventionId: string;
  eventType: "accepted" | "dismissed" | "opened" | "completed" | "logged" | "rated";
  metadata?: Record<string, unknown>;
}) {
  const result = await db.execute(sql`
    INSERT INTO hydration_hub_intervention_events (intervention_id, user_id, event_type, metadata)
    SELECT id, ${input.userId}, ${input.eventType}, ${JSON.stringify(input.metadata || {})}::jsonb
    FROM hydration_hub_interventions
    WHERE id = ${input.interventionId} AND user_id = ${input.userId}
    RETURNING id
  `);
  if (!result.rows.length) return false;
  return true;
}
