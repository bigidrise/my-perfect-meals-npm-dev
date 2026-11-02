// Synthetic database projection and injected provider only. No application DB/API calls.
jest.mock("../db", () => ({
  db: { execute: jest.fn() },
  pool: { query: jest.fn(() => { throw new Error("Unexpected pool access"); }) },
}));
jest.mock("../services/glp1/currentMealAuthority", () => ({
  currentGLP1AuthorityEnabled: () => false,
  resolveCurrentGLP1MealAuthority: jest.fn(() => { throw new Error("Unexpected clinical lookup"); }),
}));
jest.mock("../services/coaching/featureIntelligence", () => ({
  ...jest.requireActual("../services/coaching/featureIntelligence"),
  featureIntelligenceEnabled: () => false,
}));
jest.mock("../services/prescriptionResolver", () => ({
  resolveDailyNutritionPrescription: jest.fn(() => { throw new Error("Prescription resolution must not run"); }),
}));
jest.mock("openai", () => ({
  __esModule: true, default: jest.fn(() => { throw new Error("No provider construction allowed"); }),
}));

import { PgDialect } from "drizzle-orm/pg-core";
import { db } from "../db";
import { buildCoachingContext, renderSnapshotForPrompt } from "../services/coaching/coachingContext";
import { cornerAdapter } from "../services/coaching/adapters/cornerAdapter";
import { runConciergeConversation } from "../services/coaching/conciergeConversation";
import { resolveDailyNutritionPrescription } from "../services/prescriptionResolver";

const originalEnvironment = process.env.NODE_ENV;
const NOW = new Date("2026-11-03T02:30:00Z"); // November 2 in Chicago
const owner = "synthetic-owner";
let profiles: Record<string, Record<string, any>>;
let prescriptions: Record<string, Array<Record<string, any>>>;
let statements: Array<{ sql: string; params: any[] }>;
let macroEvents: Array<{ at: Date; kcal: number }>;

function profile(overrides: Record<string, any> = {}) {
  return {
    goal_type: "lose", goal_target: "10 lb", goal_timeline_weeks: 12,
    goal_start_date: new Date("2026-10-01T00:00:00Z"), fitness_goal: "weight_loss",
    activity_level: "lightly_active", dietary_restrictions: ["vegetarian"],
    allergies: ["peanuts"], avoided_foods: ["sesame"], disliked_foods: ["olives"],
    preferred_sweeteners: ["stevia"], avoid_sweeteners: ["aspartame"],
    timezone: "America/Chicago", medical_conditions: ["diabetes-type2"],
    specialty_conditions: [], performance_mode_enabled: false, selected_meal_builder: "general",
    daily_calorie_target: 1800, daily_protein_target: 120, daily_carbs_target: 180,
    daily_fat_target: 65, daily_starchy_carbs_target: 90, daily_fibrous_carbs_target: 90,
    email: "PRIVATE_EMAIL_SENTINEL", password: "PRIVATE_CREDENTIAL_SENTINEL",
    raw_labs: "PRIVATE_LAB_SENTINEL", ...overrides,
  };
}
function rx(overrides: Record<string, any> = {}) {
  return {
    date: "2026-11-02", target_calories: "1700", target_protein: "125",
    target_total_carbs: "170", target_fat: "60", target_starchy_carbs: "85",
    target_fibrous_carbs: "85", source: "procare", source_version: "synthetic-version",
    performance_day_type: null, updated_at: new Date("2026-11-02T17:00:00Z"), ...overrides,
  };
}

/** Fixtures return selected columns, not whole records (which can hide query omissions). */
function selectedColumns(sql: string, row: Record<string, any>) {
  const select = sql.slice(sql.indexOf("SELECT") + 6, sql.indexOf("FROM"));
  return Object.fromEntries(Object.entries(row).filter(([key]) => new RegExp(`\\b${key}\\b`).test(select)));
}

beforeEach(() => {
  process.env.NODE_ENV = "development";
  jest.useFakeTimers().setSystemTime(NOW);
  jest.clearAllMocks();
  profiles = { [owner]: profile(), "synthetic-other": profile({ allergies: ["OTHER_MEMBER_SENTINEL"] }) };
  prescriptions = { [owner]: [rx()] };
  statements = []; macroEvents = [];
  (db.execute as jest.Mock).mockImplementation(async query => {
    const decoded = new PgDialect().sqlToQuery(query);
    const { sql, params } = decoded;
    statements.push(decoded);
    if (!/^\s*SELECT\b/i.test(sql) || /\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|CALL)\b/i.test(sql)) {
      throw new Error("Only SELECT statements permitted");
    }
    const id = params.find(value => typeof value === "string" && value.startsWith("synthetic-"));
    if (!id || !/\bWHERE\s+(?:user_id|id)\s*=/i.test(sql)) throw new Error("Missing account boundary");
    if (sql.includes("FROM users")) return { rows: profiles[id] ? [selectedColumns(sql, profiles[id])] : [] };
    if (sql.includes("FROM daily_nutrition_prescriptions")) {
      const date = params.find(value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value));
      const row = (prescriptions[id] ?? []).filter(value => !date || value.date <= date)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      return { rows: row ? [{ ...selectedColumns(sql, row),
        ...(sql.includes("AS evidence_date") ? { evidence_date: row.date } : {}) }] : [] };
    }
    if (sql.includes("avg_meals_per_day")) return { rows: [{ avg_meals_per_day: "2" }] };
    if (sql.includes("FROM macro_logs")) {
      const bounds = params.filter(value => typeof value === "string" && /^\d{4}-.*T/.test(value));
      const rows = bounds.length === 2
        ? macroEvents.filter(event => event.at >= new Date(bounds[0]) && event.at <= new Date(bounds[1]))
        : [];
      return { rows: [{ meal_count: String(rows.length), total_kcal: String(rows.reduce((sum, event) => sum + event.kcal, 0)),
        total_protein: "0", total_carbs: "0", total_fat: "0", total_fiber: "0", last_logged_at: rows.at(-1)?.at ?? null }] };
    }
    if (sql.includes("FROM water_logs")) return { rows: [{ total_ml: "0", entry_count: "0" }] };
    if (sql.includes("FROM ace_daily_checkins")) return { rows: [{ hunger: 4, energy: 5, mood: 6, stress: 2, cravings: 3 }] };
    throw new Error(`Unexpected query: ${sql}`);
  });
});
afterEach(() => { jest.useRealTimers(); });
afterAll(() => { process.env.NODE_ENV = originalEnvironment; });
const build = () => buildCoachingContext({ userId: owner, specialization: "corner" });
const subject = { subjectType: "user" as const, subjectId: owner, ownerId: owner };

test("selected goals, timeline, restrictions, allergies and preferences reach the existing snapshot", async () => {
  const snapshot = await build();
  expect(snapshot.memberEvidence?.profile).toMatchObject({
    goal: { status: "known", value: "lose", source: "users.goal_type" },
    target: { value: "10 lb" }, timelineWeeks: { value: 12 }, goalStartedAt: { value: "2026-10-01T00:00:00.000Z" },
    fitnessGoal: { value: "weight_loss" }, restrictions: { value: ["vegetarian"] },
    allergies: { value: ["peanuts"] }, avoidedFoods: { value: ["sesame"] },
    dislikedFoods: { value: ["olives"] }, preferredSweeteners: { value: ["stevia"] },
    avoidedSweeteners: { value: ["aspartame"] },
  });
  const prompt = renderSnapshotForPrompt(snapshot);
  for (const known of ["peanuts", "vegetarian", "sesame", "olives", "stevia", "weight_loss"]) expect(prompt).toContain(known);
  expect(prompt).toContain("12");
  expect(prompt).not.toMatch(/PRIVATE_|OTHER_MEMBER_SENTINEL/);
  expect(snapshot.clinical).toBeNull();
});

test.each([null, undefined, [], [""], ["None", null]])(
  "missing, default or malformed allergy evidence is unknown: %j", async allergies => {
    profiles[owner].allergies = allergies;
    expect((await build()).memberEvidence?.profile.allergies).toMatchObject({ status: "unknown", value: null });
  },
);

test("explicit stored None differs from default [] and never suppresses a named allergy", async () => {
  profiles[owner].allergies = ["None"];
  expect((await build()).memberEvidence?.profile.allergies).toMatchObject({ status: "none", value: [] });
  profiles[owner].allergies = ["None", "peanuts"];
  expect((await build()).memberEvidence?.profile.allergies).toMatchObject({ status: "known", value: ["peanuts"] });
  profiles[owner].allergies = ["peanuts", null];
  expect((await build()).memberEvidence?.profile.allergies).toMatchObject({ status: "known", value: ["peanuts"] });
});

test("saved baseline and dated professional prescription retain separate provenance without recalculation", async () => {
  const snapshot = await build();
  expect(snapshot.memberEvidence?.savedTargets).toMatchObject({
    source: "users.saved_nutrition_targets", recordedAt: null,
    freshness: "current_saved_values_timestamp_unknown",
    targets: { calories: { value: 1800, source: "users.daily_calorie_target" } },
  });
  expect(snapshot.memberEvidence?.prescription).toMatchObject({
    status: "current_day_snapshot", date: "2026-11-02", source: "procare",
    recordedAt: "2026-11-02T17:00:00.000Z", freshness: "not_revalidated",
  });
  expect(snapshot.prescription.calories.value).toBe(1700);
  expect(resolveDailyNutritionPrescription).not.toHaveBeenCalled();
});

test("missing prescriptions and baseline fields remain unknown, never fabricated or recalculated", async () => {
  prescriptions[owner] = [];
  profiles[owner].daily_calorie_target = null;
  const snapshot = await build();
  expect(snapshot.memberEvidence?.prescription.status).toBe("missing");
  expect(snapshot.memberEvidence?.savedTargets.targets.calories).toMatchObject({ status: "unknown", value: null });
  expect(snapshot.prescription.calories.status).toBe("missing");
  expect(renderSnapshotForPrompt(snapshot)).toContain("CURRENT DAILY TARGETS: unknown");
});

test("historical prescriptions supply metadata, not today's target numbers", async () => {
  prescriptions[owner] = [rx({ date: "2026-10-01", target_calories: "999" })];
  const snapshot = await build();
  expect(snapshot.memberEvidence?.prescription).toMatchObject({ status: "historical_only", freshness: "stale_for_today", date: "2026-10-01" });
  expect(snapshot.prescription.calories.status).toBe("missing");
  expect(renderSnapshotForPrompt(snapshot)).not.toMatch(/"calories":999\b|"value":999\b/);
});

test("future prescriptions cannot become today's evidence", async () => {
  prescriptions[owner] = [rx({ date: "2026-11-04" })];
  expect((await build()).memberEvidence?.prescription.status).toBe("missing");
});

test("missing goal and restriction facts are unknown; zero logged intake is an observed zero", async () => {
  profiles[owner] = profile({
    goal_type: null, goal_target: null, fitness_goal: null, goal_timeline_weeks: null,
    goal_start_date: null, dietary_restrictions: [],
  });
  macroEvents = [{ at: NOW, kcal: 0 }];
  const snapshot = await build();
  for (const key of ["goal", "target", "fitnessGoal", "timelineWeeks", "goalStartedAt", "restrictions"] as const) {
    expect(snapshot.memberEvidence!.profile[key].status).toBe("unknown");
  }
  expect(snapshot.today.macros.calories).toMatchObject({ status: "zero", value: 0 });
  expect(renderSnapshotForPrompt(snapshot)).toContain('"calories":0');
});

test("an old save timestamp on today's snapshot is not described as freshly validated", async () => {
  prescriptions[owner] = [rx({ updated_at: new Date("2026-09-01T00:00:00Z") })];
  const snapshot = await build();
  expect(snapshot.memberEvidence?.prescription).toMatchObject({
    status: "current_day_snapshot", recordedAt: "2026-09-01T00:00:00.000Z", freshness: "not_revalidated",
  });
  expect(renderSnapshotForPrompt(snapshot)).toContain("not a newly calculated or revalidated target");
});

test("today uses member-local dates for prescriptions, logs, check-ins and hydration", async () => {
  macroEvents = [
    { at: new Date("2026-11-02T05:59:59.999Z"), kcal: 100 },
    { at: new Date("2026-11-02T06:00:00Z"), kcal: 200 },
    { at: new Date("2026-11-03T05:59:59.999Z"), kcal: 300 },
    { at: new Date("2026-11-03T06:00:00Z"), kcal: 400 },
  ];
  const snapshot = await build();
  expect(snapshot.memberEvidence?.day).toMatchObject({
    date: "2026-11-02", start: "2026-11-02T06:00:00.000Z", end: "2026-11-03T05:59:59.999Z", timezoneBasis: "recorded",
  });
  expect(snapshot.today.macros.calories.value).toBe(500);
  expect(statements.some(q => /CURRENT_DATE|DATE\(at AT TIME ZONE 'UTC'\)/.test(q.sql))).toBe(false);
  expect(statements.find(q => q.sql.includes("FROM ace_daily_checkins"))?.params).toContain("2026-11-02");
  const avg = statements.find(q => q.sql.includes("avg_meals_per_day"))!;
  expect(avg.params).toEqual(expect.arrayContaining(["America/Chicago", "2026-10-26T05:00:00.000Z", "2026-11-02T06:00:00.000Z"]));
});

test.each([
  ["2026-03-08T18:00:00Z", 23], ["2026-11-01T18:00:00Z", 25],
])("reuses DST-aware day boundaries: %s", async (now, hours) => {
  jest.setSystemTime(new Date(now));
  const day = (await build()).memberEvidence!.day;
  expect(new Date(day.end).getTime() + 1 - new Date(day.start).getTime()).toBe(Number(hours) * 3600000);
});

test.each(["Pacific/Kiritimati", "Asia/Kolkata"])("supports non-US member days: %s", async timezone => {
  profiles[owner].timezone = timezone;
  const snapshot = await build();
  expect(snapshot.memberEvidence?.day.timezone).toBe(timezone);
  expect(statements.find(q => q.sql.includes("FROM ace_daily_checkins"))?.params).toContain(snapshot.memberEvidence!.day.date);
});

test("invalid timezone is explicit fallback, not a claim about the member", async () => {
  profiles[owner].timezone = "invalid";
  expect((await build()).memberEvidence?.day).toMatchObject({ timezone: "UTC", timezoneBasis: "fallback" });
});

test("all reads are account-scoped SELECTs; no other member or private columns reach the snapshot", async () => {
  const snapshot = await build();
  expect(statements).toHaveLength(6);
  for (const query of statements) expect(query.params).toContain(owner);
  expect(JSON.stringify(snapshot)).not.toMatch(/PRIVATE_|OTHER_MEMBER_SENTINEL/);
  expect(statements[0].sql).not.toMatch(/\b(?:email|password|raw_labs)\b/);
});

test.each(["synthetic-other", "child"])("adapter rejects a mismatched subject before any read: %s", async subjectId => {
  await expect(cornerAdapter.loadAdditionalContext({ ...subject, subjectId })).rejects.toMatchObject({ status: 403 });
  expect(db.execute).not.toHaveBeenCalled();
});

test.each(["missing profile", "database error"])("retrieval failure is unavailable, not an empty healthy profile: %s", async failure => {
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    if (failure === "missing profile") delete profiles[owner];
    else (db.execute as jest.Mock).mockRejectedValue(new Error("PRIVATE_FAILURE_SENTINEL"));
    const result = await cornerAdapter.loadAdditionalContext(subject);
    expect(result.coachingContextBlock).toContain("MEMBER CONTEXT UNAVAILABLE");
    expect(result.coachingContextBlock).not.toContain("PRIVATE_FAILURE_SENTINEL");
  } finally { log.mockRestore(); }
});

test("the current conversation actually receives the adapter evidence without a real provider", async () => {
  const context = await cornerAdapter.loadAdditionalContext(subject);
  const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
    message: "For personal guidance, what is your main challenge right now?",
    memberNeed: "nutrition_guidance", responsePurpose: "clarify", navigationIntent: "none",
    conciergeDecision: null, redFlag: false, careDisposition: "none",
  }) } }] });
  await runConciergeConversation({
    client: { chat: { completions: { create } } } as any,
    userMessage: "Can you help with my goal?", history: [], rollingContext: null, context, tools: [],
  });
  const payload = JSON.parse(create.mock.calls[0][0].messages[1].content);
  expect(payload.authorizedNutritionContext).toContain("peanuts");
  expect(payload.authorizedNutritionContext).toContain("users.daily_calorie_target");
  expect(payload.authorizedNutritionContext).not.toMatch(/PRIVATE_|OTHER_MEMBER_SENTINEL/);
  expect(create).toHaveBeenCalledTimes(1);
});

test("Production retains its original query and prompt path", async () => {
  process.env.NODE_ENV = "production";
  const snapshot = await build();
  expect(snapshot.memberEvidence).toBeUndefined();
  expect(statements[0].sql).not.toContain("allergies");
  expect(statements.some(q => q.sql.includes("CURRENT_DATE"))).toBe(true);
  expect(renderSnapshotForPrompt(snapshot)).toContain("=== COACHING CONTEXT SNAPSHOT ===");
  expect(renderSnapshotForPrompt(snapshot)).not.toContain("AUTHORIZED MEMBER EVIDENCE");
});
