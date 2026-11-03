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
import { CHEF_ENJOYED_FOOD_LIMIT } from "../services/coaching/memberContextEvidence";
import { CHEF_CONVERSATION_INSTRUCTIONS, getChefConversationInstructions } from "../services/coaching/conciergeInstructions";

const originalEnvironment = process.env.NODE_ENV;
const NOW = new Date("2026-11-03T02:30:00Z"); // November 2 in Chicago
const owner = "synthetic-owner";
let profiles: Record<string, Record<string, any>>;
let prescriptions: Record<string, Array<Record<string, any>>>;
let statements: Array<{ sql: string; params: any[] }>;
let macroEvents: Array<{ at: Date; kcal: number; protein?: number; source?: string; userId?: string }>;

function enjoyment(labels: string[] = ["Curry", "Tacos"], overrides: Record<string, any> = {}) {
  return {
    version: 1, configured: true, updatedAt: NOW.toISOString(),
    items: labels.map((label, index) => ({
      id: `food-${index}`, conceptId: null, kind: "dish", category: "meals-dishes",
      displayLabel: label, originalText: label, locale: "en", source: "free_text",
      provenance: "explicit", selectedAt: NOW.toISOString(), revokedAt: null,
    })),
    ...overrides,
  };
}

function profile(overrides: Record<string, any> = {}) {
  return {
    nickname: "Sunny", first_name: "Sam", cuisine_preference: "indian", cuisine_intensity: "balanced",
    foods_i_enjoy: enjoyment(),
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
  profiles = { [owner]: profile(), "synthetic-other": profile({
    allergies: ["OTHER_MEMBER_SENTINEL"], nickname: "OTHER_MEMBER_NAME_SENTINEL",
    cuisine_preference: "OTHER_MEMBER_CUISINE_SENTINEL", foods_i_enjoy: enjoyment(["OTHER_MEMBER_FOOD_SENTINEL"]),
  }) };
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
      const matching = bounds.length >= 2
        ? macroEvents.filter(event => (event.userId ?? owner) === id &&
          event.at >= new Date(bounds[0]) && event.at <= new Date(bounds[1]))
        : [];
      const locked = sql.includes("locked.source = 'locked-day'") && matching.some(event => event.source === "locked-day");
      const rows = locked ? matching.filter(event => event.source === "locked-day") : matching;
      return { rows: [{ meal_count: String(rows.length), total_kcal: String(rows.reduce((sum, event) => sum + event.kcal, 0)),
        total_protein: String(rows.reduce((sum, event) => sum + (event.protein ?? 0), 0)),
        total_carbs: "0", total_fat: "0", total_fiber: "0", last_logged_at: rows.at(-1)?.at ?? null }] };
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

test.each([
  [" Sunny ", "Sam", "Sunny", "users.nickname"],
  [null, " Sam ", "Sam", "users.first_name"],
  ["   ", "Sam", "Sam", "users.first_name"],
  [undefined, "Sam", "Sam", "users.first_name"],
  ["X".repeat(121), "Sam", "Sam", "users.first_name"],
])("preferred name uses stored nickname then first name: %j / %j", async (nickname, first_name, value, source) => {
  Object.assign(profiles[owner], { nickname, first_name });
  const snapshot = await build();
  expect(snapshot.memberEvidence?.profile.preferredName).toEqual({ value, status: "known", source });
  expect(statements[0].sql).toMatch(/\bnickname\b/);
  expect(statements[0].sql).toMatch(/\bfirst_name\b/);
});

test.each([[null, null], ["", "   "], [undefined, undefined], ["x".repeat(121), "y".repeat(121)]])(
  "missing/invalid names remain unknown, not usernames, emails or auth aliases", async (nickname, first_name) => {
    Object.assign(profiles[owner], { nickname, first_name,
      username: "PRIVATE_USERNAME_SENTINEL", name: "PRIVATE_AUTH_NAME_SENTINEL", last_name: "PRIVATE_LAST_NAME_SENTINEL" });
    const snapshot = await build();
    expect(snapshot.memberEvidence?.profile.preferredName).toMatchObject({ status: "unknown", value: null });
    expect(renderSnapshotForPrompt(snapshot)).not.toMatch(/PRIVATE_|OTHER_MEMBER/);
    expect(statements[0].sql).not.toMatch(/\b(?:username|email|name|last_name)\b/);
  },
);

test("cuisine and explicit enjoyment are accurate, dated, bounded soft evidence alongside unchanged safety and targets", async () => {
  profiles[owner].foods_i_enjoy = enjoyment(["Curry", "Peanut butter"]);
  const evidence = (await build()).memberEvidence!;
  expect(evidence.profile).toMatchObject({
    preferredName: { status: "known", value: "Sunny", source: "users.nickname" },
    cuisinePreference: { status: "known", value: "indian", source: "users.cuisine_preference" },
    cuisineIntensity: { status: "known", value: "balanced", source: "users.cuisine_intensity" },
    foodsIEnjoy: { status: "known", value: ["Curry", "Peanut butter"], source: "users.foods_i_enjoy",
      recordedAt: NOW.toISOString(), totalActive: 2, truncated: false },
    allergies: { value: ["peanuts"] }, restrictions: { value: ["vegetarian"] },
    avoidedFoods: { value: ["sesame"] }, dislikedFoods: { value: ["olives"] },
    goal: { value: "lose" }, target: { value: "10 lb" },
  });
  expect(evidence.savedTargets.targets).toMatchObject({
    calories: { value: 1800 }, protein: { value: 120 }, carbs: { value: 180 },
    fat: { value: 65 }, starchyCarbs: { value: 90 }, fibrousCarbs: { value: 90 },
  });
  expect(resolveDailyNutritionPrescription).not.toHaveBeenCalled();
});

test.each([null, undefined, "   "])("missing cuisine stays unknown even with a default intensity: %j", async cuisine => {
  profiles[owner].cuisine_preference = cuisine;
  const evidence = (await build()).memberEvidence!.profile;
  expect(evidence.cuisinePreference).toMatchObject({ status: "unknown", value: null });
  expect(evidence.cuisineIntensity).toMatchObject({ status: "unknown", value: null });
});

test.each(["None", "No preference"])("explicit recorded no cuisine is distinct from an unknown cuisine: %s", async cuisine => {
  profiles[owner].cuisine_preference = cuisine;
  expect((await build()).memberEvidence!.profile.cuisinePreference).toMatchObject({ status: "none", value: null });
});

test("custom stored cuisines are preserved rather than invented or mapped to a different cuisine", async () => {
  profiles[owner].cuisine_preference = "Armenian";
  profiles[owner].cuisine_intensity = "unsupported";
  const evidence = (await build()).memberEvidence!.profile;
  expect(evidence.cuisinePreference.value).toBe("Armenian");
  expect(evidence.cuisineIntensity).toMatchObject({ status: "unknown", value: null });
});

test.each([
  [null, "unknown"], [undefined, "unknown"], [enjoyment([], { configured: false }), "unknown"],
  [enjoyment(["Unconfirmed"], { configured: false }), "unknown"],
  [enjoyment([]), "none"], [{ version: 999 }, "unavailable"],
])("Foods I Enjoy preserves configuration and evidence status: %j", async (document, status) => {
  profiles[owner].foods_i_enjoy = document;
  profiles[owner].liked_foods = ["LEGACY_LIKED_FOOD_SENTINEL"];
  const snapshot = await build();
  expect(snapshot.memberEvidence!.profile.foodsIEnjoy).toMatchObject({ status, value: status === "none" ? [] : null });
  expect(snapshot.memberEvidence!.profile.allergies.value).toEqual(["peanuts"]);
  expect(renderSnapshotForPrompt(snapshot)).not.toMatch(/Unconfirmed|LEGACY_LIKED_FOOD_SENTINEL/);
});

test("revoked enjoyment is excluded; an explicitly cleared selection is none", async () => {
  const document = enjoyment(["Curry", "REVOKED_FOOD_SENTINEL"]);
  (document.items[1] as any).revokedAt = NOW.toISOString();
  profiles[owner].foods_i_enjoy = document;
  expect((await build()).memberEvidence!.profile.foodsIEnjoy).toMatchObject({
    status: "known", value: ["Curry"], totalActive: 1,
  });
  (document.items[0] as any).revokedAt = NOW.toISOString();
  expect((await build()).memberEvidence!.profile.foodsIEnjoy).toMatchObject({ status: "none", value: [], totalActive: 0 });
});

test("100 valid enjoyment entries produce a small explicit partial projection without truncating allergies", async () => {
  profiles[owner].foods_i_enjoy = enjoyment(Array.from({ length: 100 }, (_, index) => `Food ${index} ${"x".repeat(100)}`));
  profiles[owner].allergies = Array.from({ length: 30 }, (_, index) => `Allergen ${index}`);
  const snapshot = await build();
  const projection = snapshot.memberEvidence!.profile.foodsIEnjoy;
  expect(projection.value).toHaveLength(CHEF_ENJOYED_FOOD_LIMIT);
  expect(projection).toMatchObject({ totalActive: 100, truncated: true, status: "known" });
  const { preferredName, cuisinePreference, cuisineIntensity } = snapshot.memberEvidence!.profile;
  expect(JSON.stringify({ preferredName, cuisinePreference, cuisineIntensity, foodsIEnjoy: projection }).length).toBeLessThan(3000);
  expect(snapshot.memberEvidence!.profile.allergies.value).toHaveLength(30);
  expect(renderSnapshotForPrompt(snapshot)).toContain("Allergen 29");
  expect(renderSnapshotForPrompt(snapshot)).not.toContain("Food 99 ");
});

test.each(["household", "organization", "client"])("the self adapter refuses a %s subject before fetching personalization", async subjectType => {
  await expect(cornerAdapter.loadAdditionalContext({ ...subject, subjectType } as any)).rejects.toMatchObject({ status: 403 });
  expect(db.execute).not.toHaveBeenCalled();
});

test("authenticated identity, not body/client/household identifiers, owns all personalization reads", async () => {
  const self = await cornerAdapter.loadSubject({
    authUser: { id: owner }, body: { userId: "synthetic-other", householdProfileId: "household-sentinel" },
    params: { clientId: "synthetic-other" },
  });
  const context = await cornerAdapter.loadAdditionalContext(self);
  expect(context.coachingContextBlock).toContain("Sunny");
  expect(context.coachingContextBlock).not.toMatch(/OTHER_MEMBER_|household-sentinel/);
  for (const query of statements) {
    expect(query.params).toContain(owner);
    expect(query.sql).not.toMatch(/household_profiles|organization|client_links/);
  }
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
    foodDeclarations: { message: { mode: "none", foods: [] }, conversationMessage: null, handoffMessage: null },
  }) } }] });
  await runConciergeConversation({
    client: { chat: { completions: { create } } } as any,
    userMessage: "Can you help with my goal?", history: [], rollingContext: null, context, tools: [],
  });
  const payload = JSON.parse(create.mock.calls[0][0].messages[1].content);
  expect(payload.authorizedNutritionContext).toContain("peanuts");
  expect(payload.authorizedNutritionContext).toContain("users.daily_calorie_target");
  expect(payload.authorizedNutritionContext).toContain("Sunny");
  expect(payload.authorizedNutritionContext).toContain("indian");
  expect(payload.authorizedNutritionContext).toContain("Curry");
  expect(payload.authorizedNutritionContext).not.toMatch(/PRIVATE_|OTHER_MEMBER_SENTINEL/);
  expect(create).toHaveBeenCalledTimes(1);
});

test("natural personalization instructions and evidence share the existing single foreground request per turn", async () => {
  const context = await cornerAdapter.loadAdditionalContext(subject);
  const before = JSON.stringify({ context, profile: profiles[owner] });
  const responses = [
    "Sunny, we can explore more variety while respecting your saved goals and peanut allergy.",
    "Since you enjoy curry and prefer Indian cuisine, we can consider that when discussing vegetarian food options.",
  ];
  let nextResponse = 0;
  const create = jest.fn().mockImplementation(async () => ({ choices: [{ message: { content: JSON.stringify({
    message: responses[nextResponse++], memberNeed: "nutrition_guidance", responsePurpose: "answer",
    navigationIntent: "none", conciergeDecision: null, redFlag: false, careDisposition: "none",
    foodDeclarations: { message: { mode: "discussion", foods: [] }, conversationMessage: null, handoffMessage: null },
  }) } }] }));
  const history: Array<{ role: string; content: string }> = [];
  for (const [index, message] of ["Can we discuss variety?", "What could we explore?"].entries()) {
    const response = await runConciergeConversation({
      client: { chat: { completions: { create } } } as any, userMessage: message,
      history: [...history], rollingContext: null, context, tools: [],
    });
    expect(response.presentation?.message).toBe(responses[index]);
    expect(response.presentation?.navigation).toBeUndefined();
    history.push({ role: "user", content: message }, { role: "assistant", content: responses[index] });
  }
  expect(create).toHaveBeenCalledTimes(2);
  for (const [request] of create.mock.calls) {
    expect(request.model).toBe("gpt-4o");
    expect(request.messages).toHaveLength(2);
    expect(request.messages[0].content).toContain("occasionally and naturally, not in every answer");
    expect(request.messages[0].content).toContain("without asking for information already supplied");
    expect(request.messages[0].content).toContain("never invent one");
    expect(request.messages[0].content).toContain("allergies, restrictions, avoided/disliked foods");
    expect(JSON.parse(request.messages[1].content).authorizedNutritionContext).toBe(context.coachingContextBlock);
  }
  expect(JSON.stringify({ context, profile: profiles[owner] })).toBe(before);
});

test("Production retains its original query and prompt path", async () => {
  process.env.NODE_ENV = "production";
  const snapshot = await build();
  expect(snapshot.memberEvidence).toBeUndefined();
  expect(statements[0].sql).not.toContain("allergies");
  expect(statements[0].sql).not.toMatch(/nickname|first_name|cuisine_preference|cuisine_intensity|foods_i_enjoy/);
  expect(getChefConversationInstructions("production")).toBe(CHEF_CONVERSATION_INSTRUCTIONS);
  expect(getChefConversationInstructions("production")).not.toContain("MEMBER PERSONALIZATION:");
  expect(statements.some(q => q.sql.includes("CURRENT_DATE"))).toBe(true);
  expect(renderSnapshotForPrompt(snapshot)).toContain("=== COACHING CONTEXT SNAPSHOT ===");
  expect(renderSnapshotForPrompt(snapshot)).not.toContain("AUTHORIZED MEMBER EVIDENCE");
});

test.each([null, "125 grams", "", "NaN"])("invalid dated protein remains missing in both prompt projections: %j", target => {
  prescriptions[owner] = [rx({ target_protein: target })];
  return build().then(snapshot => {
    expect(snapshot.prescription.protein).toMatchObject({ status: "missing", value: null });
    expect(snapshot.memberEvidence?.macroTargets).toMatchObject({
      storedPrescriptionCoverage: "incomplete",
      fields: { protein: { savedBase: 120, storedForDate: null, relationship: "saved_base_only" } },
    });
    expect(renderSnapshotForPrompt(snapshot)).not.toContain("125 grams");
    expect(resolveDailyNutritionPrescription).not.toHaveBeenCalled();
  });
});

test.each(["saved-only", "different", "matching"] as const)(
  "qualified, concise protein coaching uses one injected foreground request: %s", async scenario => {
    if (scenario === "saved-only") prescriptions[owner] = [];
    if (scenario === "matching") profiles[owner].daily_protein_target = 125;
    if (scenario !== "saved-only") macroEvents = [{ at: NOW, kcal: 200, protein: 30 }];
    const context = await cornerAdapter.loadAdditionalContext(subject);
    const reply = scenario === "saved-only"
      ? "Your saved protein goal is 120 g a day; your latest adjustments are unconfirmed. Lentils could be one option. Roughly how much protein do you get now?"
      : scenario === "different"
        ? "Your saved goal is 120 g, while the goal recorded for today is 125 g; I can't confirm which reflects your latest adjustments. You've logged 30 g so far, which may not cover everything you ate. Which goal matches your latest guidance?"
        : "Your saved and recorded goals both list 125 g, though the latest adjustments are unconfirmed. You've logged 30 g so far; that may not include everything. What makes reaching your protein goal difficult?";
    const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
      message: reply, memberNeed: "nutrition_guidance", responsePurpose: "answer",
      navigationIntent: "none", conciergeDecision: null, redFlag: false, careDisposition: "none",
      foodDeclarations: {
        message: scenario === "saved-only"
          ? { mode: "recommendations", foods: [{ name: "Lentils", ingredients: ["lentils"], ingredientCoverage: "listed" }] }
          : { mode: "discussion", foods: [] },
        conversationMessage: null, handoffMessage: null,
      },
    }) } }] });
    const response = await runConciergeConversation({
      client: { chat: { completions: { create } } } as any, userMessage: "I'm trying to get more protein.",
      history: [], rollingContext: null, context, tools: [],
    });
    expect(create).toHaveBeenCalledTimes(1);
    const request = create.mock.calls[0][0];
    expect(request.messages[0].content).toContain("MACRO COACHING:");
    expect(request.messages[0].content).toContain("retain confirmation, access and subscription checks");
    expect(request.messages[0].content).toContain("Beverage Creator");
    const evidence = JSON.parse(request.messages[1].content).authorizedNutritionContext;
    expect(evidence).toContain('"verifiedCurrentEffective":false');
    expect(evidence).toContain('"professionalOverrideStatus":"unverified"');
    expect(evidence).toContain("Completeness is estimated");
    expect(response.presentation?.message).toContain(reply);
    expect(response.presentation?.message?.length).toBeLessThan(500);
    expect((response.presentation?.message?.match(/\?/g) ?? []).length).toBe(1);
    expect(response.presentation?.message).not.toMatch(/prescription|database|source_version|verified current effective/i);
    expect(response.presentation?.navigation).toBeUndefined();
    expect(response.todayPlan.items).toEqual([]);
    expect(resolveDailyNutritionPrescription).not.toHaveBeenCalled();
  },
);

describe("practical, MPM-aware coaching with the existing evidence and food screen", () => {
  // These injected replies prove instruction/history propagation and display
  // contracts, not the natural-language model's live adherence to the strategy.
  async function turn(input: string, text: string, foods: Array<{ name: string; ingredients: string[] }>,
    history: Array<{ role: string; content: string }> = []) {
    const context = await cornerAdapter.loadAdditionalContext(subject);
    const create = jest.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
      message: text, memberNeed: "nutrition_guidance", responsePurpose: "answer",
      navigationIntent: "none", conciergeDecision: null, redFlag: false, careDisposition: "none",
      foodDeclarations: {
        message: { mode: foods.length ? "recommendations" : "none",
          foods: foods.map(food => ({ ...food, ingredientCoverage: "listed" })) },
        conversationMessage: null, handoffMessage: null,
      },
    }) } }] });
    const response = await runConciergeConversation({
      client: { chat: { completions: { create } } } as any,
      userMessage: input, history, rollingContext: null, context, tools: [],
    });
    expect(create).toHaveBeenCalledTimes(1);
    expect(response.presentation?.navigation).toBeUndefined();
    expect(response.presentation?.destinationId).toBeUndefined();
    expect(response.todayPlan.items).toEqual([]);
    expect(resolveDailyNutritionPrescription).not.toHaveBeenCalled();
    return { response, request: create.mock.calls[0][0], context };
  }
  const legumes = [
    { name: "lentils", ingredients: ["lentils"] },
    { name: "chickpeas", ingredients: ["chickpeas"] },
  ];
  test.each([false, true])("the two-turn protein exchange retains context and qualified intake (logs=%s)", async logged => {
    profiles[owner].daily_protein_target = 129;
    prescriptions[owner] = [];
    if (logged) macroEvents = [{ at: NOW, kcal: 200, protein: 30 }];
    const firstInput = "I'm trying to get more protein.";
    // Replay an earlier intake question so the next turn must receive the
    // member's uncertainty as an answered question, not restart discovery.
    const first = await turn(firstInput,
      "Your saved protein goal is 129 g a day; I can't confirm the latest adjustments. " +
      "Try lentils in a meal you enjoy or chickpeas as a snack. Do you know how much protein you're getting?", legumes);
    const history = [{ role: "user", content: firstInput },
      { role: "assistant", content: first.response.presentation!.message }];
    const intake = logged
      ? "Your logs record 30 g so far, which may not cover everything you ate."
      : "I don't have enough logged meals to establish your actual intake.";
    const text = "That's okay. Your saved protein goal is 129 g a day; the latest adjustments are unconfirmed. " +
      intake + " My Perfect Meals meal logs can help track protein. Add lentils to a usual meal or try a chickpea snack. " +
      "Beverage Creator can help with making a shake. Would you like help with a meal or a shake?";
    const second = await turn("I don't know how much protein I'm getting.", text, legumes, history);
    expect(second.response.presentation?.message).toContain(text);
    expect(second.response.foodCompatibility?.status).toBe("screened");
    const payload = JSON.parse(second.request.messages[1].content);
    expect(payload.history).toEqual(history);
    expect(payload.latestMemberMessage).toBe("I don't know how much protein I'm getting.");
    expect(payload.authorizedNutritionContext).toContain('"savedBase":129');
    expect(payload.authorizedNutritionContext).toContain('"verifiedCurrentEffective":false');
    expect(payload.authorizedNutritionContext).toContain(logged ? '"protein":30' : '"protein":{"status":"missing"}');
    for (const result of [first, second]) {
      const instructions = result.request.messages[0].content;
      expect(instructions).toContain("give two or three practical, compatible suggestions when useful");
      expect(instructions).toContain("accept that answer and help rather than asking for the same estimate again");
      expect(instructions).toContain("do not suggest finding another app");
      expect(instructions).toContain("Every actual food proposal still requires");
      expect(instructions).toContain("single confirmation, access and subscription checks");
    }
  });
  test("vegan and soy-allergic context permits compatible practical options, not an animal/soy default list", async () => {
    Object.assign(profiles[owner], {
      nickname: "Betty", daily_protein_target: 110, dietary_restrictions: ["vegan"], allergies: ["soy"],
      foods_i_enjoy: enjoyment(["Lentil stew"]),
    });
    prescriptions[owner] = [];
    const text = "Betty, your saved protein goal is 110 g a day; the latest adjustments are unconfirmed. " +
      "You could add lentils to a meal you enjoy or have chickpeas as a snack. My Perfect Meals can help you build on those meals.";
    const result = await turn("Can you help me get more protein?", text, legumes);
    expect(result.response.presentation?.message).toContain(text);
    expect(result.response.foodCompatibility?.status).toBe("screened");
    const evidence = JSON.parse(result.request.messages[1].content).authorizedNutritionContext;
    expect(evidence).toContain('"value":["vegan"]');
    expect(evidence).toContain('"value":["soy"]');
    expect(evidence).toContain("Lentil stew");
    expect(result.request.messages[0].content).toContain("vegan or vegetarian is a dietary restriction, not a cuisine");
  });
  test.each([
    { name: "tofu", ingredients: ["soybeans"] },
    { name: "chicken", ingredients: ["chicken"] },
    { name: "milk", ingredients: ["milk"] },
  ])("the unchanged food screen still blocks incompatible practical advice: $name", async food => {
    Object.assign(profiles[owner], { dietary_restrictions: ["vegan"], allergies: ["soy"] });
    const rejected = `PRIVATE_REJECTED_PROPOSAL: Try ${food.name} to increase protein.`;
    const result = await turn("I want more protein.", rejected, [food]);
    expect(result.response.foodCompatibility?.status).toBe("blocked");
    expect(JSON.stringify(result.response)).not.toContain("PRIVATE_REJECTED_PROPOSAL");
  });
  test("practical advice with unknown allergies retains explicit uncertainty rather than allergy clearance", async () => {
    profiles[owner].allergies = [];
    const result = await turn("I want more protein.",
      "Lentils could be an option if appropriate for your needs; I can't confirm your allergy status.", [legumes[0]]);
    expect(result.response.foodCompatibility?.uncertainties).toContain("allergies_unknown");
    expect(result.response.foodCompatibility?.uncertainties).toContain("cross_contact_unverified");
    expect(result.response.presentation?.message).toContain("can't confirm your allergy status");
  });
  test("the general strategy is Development-only and does not claim glucose authority", () => {
    const development = getChefConversationInstructions("development");
    expect(development).toContain("across protein, hydration, fiber, carbohydrate choices and meal variety");
    expect(development).toContain("Diabetes-specific quantitative or glucose-responsive advice requires authorized, reliable glucose evidence");
    expect(development).toContain("do not suggest finding another app");
    expect(getChefConversationInstructions("production")).toBe(CHEF_CONVERSATION_INSTRUCTIONS);
    expect(CHEF_CONVERSATION_INSTRUCTIONS).not.toContain("FOLLOW-THROUGH — MPM AWARENESS:");
  });
});
