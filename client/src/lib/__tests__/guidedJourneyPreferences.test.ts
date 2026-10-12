import {
  createGuidancePreferenceStore, guidancePreferenceKey, defaultGuidancePreferences,
  reduceGuidancePreferences, canOfferAutomaticGuidance,
  type GuidancePreferenceCommand, type GuidancePreferenceStorage,
} from "../guidedJourney/preferences";

function storageFixture() {
  const records = new Map<string, string>();
  const storage: GuidancePreferenceStorage = {
    getItem: jest.fn(key => records.get(key) ?? null),
    setItem: jest.fn((key, value) => { records.set(key, value); }),
  };
  return { storage, records };
}
const scope = { accountId: "account-one" };
function record(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    schemaVersion: 1, journeyVersion: 1, accountId: scope.accountId,
    preferences: { mode: "paused", automaticExplanationsEnabled: false, replayRequested: false },
    ...overrides,
  });
}

test("missing preferences are inactive, account-bound and never written on read", () => {
  const f = storageFixture();
  const result = createGuidancePreferenceStore(scope, f.storage).read();
  expect(result).toMatchObject({ scope: { accountId: "account-one", journeyVersion: 1 },
    preferences: { mode: "not_started", replayRequested: false }, persistence: "not_stored" });
  expect(canOfferAutomaticGuidance(result.preferences)).toBe(false);
  expect(f.storage.setItem).not.toHaveBeenCalled();
});
test("explicit start, pause and resume persist across new store instances", () => {
  const f = storageFixture();
  const one = createGuidancePreferenceStore(scope, f.storage);
  expect(canOfferAutomaticGuidance(one.apply("start").preferences)).toBe(true);
  one.apply("pause");
  one.dispose();
  const two = createGuidancePreferenceStore(scope, f.storage);
  expect(two.read().preferences.mode).toBe("paused");
  expect(canOfferAutomaticGuidance(two.read().preferences)).toBe(false);
  expect(two.apply("resume").preferences.mode).toBe("active");
});
test("disabled automatic explanations stay disabled across reload, resume and replay", () => {
  const f = storageFixture();
  const one = createGuidancePreferenceStore(scope, f.storage);
  one.apply("start");
  one.apply("disable_automatic");
  const two = createGuidancePreferenceStore(scope, f.storage);
  expect(two.read().preferences.automaticExplanationsEnabled).toBe(false);
  expect(canOfferAutomaticGuidance(two.apply("resume").preferences)).toBe(false);
  const replay = two.apply("restart_explanations");
  expect(replay.preferences).toEqual({
    mode: "active", replayRequested: true, automaticExplanationsEnabled: false,
  });
  expect(canOfferAutomaticGuidance(replay.preferences)).toBe(false);
  expect(two.apply("finish_replay").preferences.replayRequested).toBe(false);
});
test("enable automatic does not silently resume paused guidance", () => {
  const f = storageFixture();
  const store = createGuidancePreferenceStore(scope, f.storage);
  store.apply("disable_automatic");
  expect(store.apply("enable_automatic").preferences).toMatchObject({
    mode: "paused", automaticExplanationsEnabled: true,
  });
  expect(canOfferAutomaticGuidance(store.read().preferences)).toBe(false);
});
test("pause during replay keeps the request for explicit resume", () => {
  const f = storageFixture();
  const store = createGuidancePreferenceStore(scope, f.storage);
  store.apply("restart_explanations");
  expect(store.apply("pause").preferences).toMatchObject({ mode: "paused", replayRequested: true });
  expect(store.apply("resume").preferences).toMatchObject({ mode: "active", replayRequested: true });
});
test("accounts cannot read or overwrite each other's preferences", () => {
  const f = storageFixture();
  const one = createGuidancePreferenceStore(scope, f.storage);
  const two = createGuidancePreferenceStore({ accountId: "account-two" }, f.storage);
  one.apply("disable_automatic");
  const savedOne = f.records.get(guidancePreferenceKey(scope));
  expect(two.read().preferences).toEqual(defaultGuidancePreferences());
  two.apply("restart_explanations");
  expect(f.records.get(guidancePreferenceKey(scope))).toBe(savedOne);
  expect(one.read().preferences.replayRequested).toBe(false);
});
test("journey versions and delimiter-containing account IDs have distinct keys", () => {
  expect(guidancePreferenceKey(scope)).not.toBe(guidancePreferenceKey({ ...scope, journeyVersion: 2 }));
  expect(guidancePreferenceKey({ accountId: "one:two" })).not.toBe(guidancePreferenceKey({ accountId: "one%3Atwo" }));
  const f = storageFixture();
  createGuidancePreferenceStore(scope, f.storage).apply("disable_automatic");
  expect(createGuidancePreferenceStore({ ...scope, journeyVersion: 2 }, f.storage).read().preferences.mode)
    .toBe("not_started");
});
test.each([
  { accountId: "" }, { accountId: " account-one" }, { accountId: "guest-demo" },
  { accountId: "anon" }, { accountId: "anonymous" },
  { ...scope, journeyVersion: 0 }, { ...scope, journeyVersion: 1.5 },
])("invalid or anonymous scope is rejected before storage access: %j", input => {
  const f = storageFixture();
  expect(() => createGuidancePreferenceStore(input, f.storage)).toThrow();
  expect(f.storage.getItem).not.toHaveBeenCalled();
  expect(f.storage.setItem).not.toHaveBeenCalled();
});
test.each([
  "not-json", "null", "[]",
  record({ accountId: "account-two" }), record({ journeyVersion: 2 }),
  record({ completedSteps: ["saved_meal_plan"] }),
  record({ preferences: { mode: "active", automaticExplanationsEnabled: "false", replayRequested: false } }),
  record({ preferences: { mode: "complete", automaticExplanationsEnabled: true, replayRequested: false } }),
  record({ preferences: { mode: "active", automaticExplanationsEnabled: true, replayRequested: false, targetsSaved: true } }),
])("corrupt or foreign record stays inactive and is not repaired on read: %s", raw => {
  const f = storageFixture();
  f.records.set(guidancePreferenceKey(scope), raw);
  const result = createGuidancePreferenceStore(scope, f.storage).read();
  expect(result.issue).toBe("invalid_record");
  expect(canOfferAutomaticGuidance(result.preferences)).toBe(false);
  expect(f.records.get(guidancePreferenceKey(scope))).toBe(raw);
  expect(f.storage.setItem).not.toHaveBeenCalled();
});
test("explicit choice can replace corrupt current-version preferences", () => {
  const f = storageFixture();
  f.records.set(guidancePreferenceKey(scope), "broken");
  const store = createGuidancePreferenceStore(scope, f.storage);
  expect(store.apply("pause")).toMatchObject({ persistence: "stored", issue: "none",
    preferences: { mode: "paused" } });
});
test("unsupported schema is preserved, with explicit choice available only in memory", () => {
  const f = storageFixture();
  const raw = record({ schemaVersion: 2 });
  f.records.set(guidancePreferenceKey(scope), raw);
  const store = createGuidancePreferenceStore(scope, f.storage);
  expect(store.read().issue).toBe("unsupported_version");
  expect(store.apply("disable_automatic")).toMatchObject({
    persistence: "memory_only", issue: "unsupported_version",
    preferences: { automaticExplanationsEnabled: false },
  });
  store.apply("restart_explanations");
  expect(f.records.get(guidancePreferenceKey(scope))).toBe(raw);
  expect(f.storage.setItem).not.toHaveBeenCalled();
});
test("missing browser storage retains choices in memory without claiming durability", () => {
  const store = createGuidancePreferenceStore(scope, null);
  expect(store.read().issue).toBe("storage_unavailable");
  expect(store.apply("disable_automatic")).toMatchObject({ persistence: "memory_only" });
  expect(store.read().preferences.automaticExplanationsEnabled).toBe(false);
  expect(createGuidancePreferenceStore(scope, null).read().preferences.mode).toBe("not_started");
});
test("quota failure must not reload stale saved preferences over an explicit pause", () => {
  const f = storageFixture();
  const store = createGuidancePreferenceStore(scope, f.storage);
  store.apply("start");
  (f.storage.setItem as jest.Mock).mockImplementationOnce(() => { throw new Error("QuotaExceededError"); });
  expect(store.apply("pause")).toMatchObject({ persistence: "memory_only", issue: "storage_unavailable" });
  expect(store.read().preferences.mode).toBe("paused");
  expect(store.apply("disable_automatic").persistence).toBe("stored");
  expect(createGuidancePreferenceStore(scope, f.storage).read().preferences.automaticExplanationsEnabled).toBe(false);
});
test("SecurityError reads and writes do not escape to application callers", () => {
  const inaccessible = { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("SecurityError"); } };
  const store = createGuidancePreferenceStore(scope, inaccessible);
  expect(() => store.read()).not.toThrow();
  expect(() => store.apply("restart_explanations")).not.toThrow();
  expect(store.read()).toMatchObject({ persistence: "memory_only", issue: "storage_unavailable",
    preferences: { replayRequested: true } });
});
test("separate same-account instances merge the latest persisted settings before commands", () => {
  const f = storageFixture();
  const one = createGuidancePreferenceStore(scope, f.storage);
  const two = createGuidancePreferenceStore(scope, f.storage);
  one.apply("disable_automatic");
  expect(two.apply("restart_explanations").preferences.automaticExplanationsEnabled).toBe(false);
});
test("a recovered read preserves disabled automatic guidance instead of writing defaults", () => {
  const f = storageFixture();
  f.records.set(guidancePreferenceKey(scope), record());
  const store = createGuidancePreferenceStore(scope, f.storage);
  (f.storage.getItem as jest.Mock).mockImplementationOnce(() => { throw new Error("Temporary read error"); });
  expect(store.apply("restart_explanations").preferences).toMatchObject({
    replayRequested: true, automaticExplanationsEnabled: false,
  });
});
test("a newer record appearing during a command is never overwritten", () => {
  const f = storageFixture();
  const store = createGuidancePreferenceStore(scope, f.storage);
  const future = record({ schemaVersion: 2 });
  (f.storage.getItem as jest.Mock).mockImplementationOnce(() => {
    f.records.set(guidancePreferenceKey(scope), future);
    return null;
  });
  expect(store.apply("pause")).toMatchObject({ persistence: "memory_only", issue: "unsupported_version" });
  expect(f.records.get(guidancePreferenceKey(scope))).toBe(future);
  expect(f.storage.setItem).not.toHaveBeenCalled();
});
test("disposal prevents stale account callbacks from reading or writing preferences", () => {
  const f = storageFixture();
  const store = createGuidancePreferenceStore(scope, f.storage);
  store.apply("pause");
  const raw = f.records.get(guidancePreferenceKey(scope));
  store.dispose();
  expect(store.apply("start").issue).toBe("disposed");
  expect(store.read().preferences.mode).toBe("not_started");
  expect(f.records.get(guidancePreferenceKey(scope))).toBe(raw);
  expect(createGuidancePreferenceStore(scope, f.storage).read().preferences.mode).toBe("paused");
});
test("scope and returned objects cannot be mutated into another account's settings", () => {
  const f = storageFixture();
  const mutableScope = { ...scope };
  const store = createGuidancePreferenceStore(mutableScope, f.storage);
  mutableScope.accountId = "account-two";
  const returned = store.read();
  returned.scope.accountId = "account-three";
  returned.preferences.mode = "active";
  expect(store.read().scope.accountId).toBe("account-one");
  expect(store.read().preferences.mode).toBe("not_started");
  store.apply("pause");
  expect(f.records.has(guidancePreferenceKey(scope))).toBe(true);
  expect(f.records.has(guidancePreferenceKey(mutableScope))).toBe(false);
});
test("every command is presentation-only and leaves completion evidence untouched", () => {
  const f = storageFixture();
  const evidence = Object.freeze({ onboarding: "complete", targets: "unknown", mealPlan: "incomplete" });
  const store = createGuidancePreferenceStore(scope, f.storage);
  const commands: GuidancePreferenceCommand[] = ["start", "pause", "resume", "disable_automatic",
    "enable_automatic", "restart_explanations", "finish_replay"];
  for (const command of commands) store.apply(command);
  const stored = JSON.parse(f.records.get(guidancePreferenceKey(scope))!);
  expect(Object.keys(stored.preferences).sort())
    .toEqual(["automaticExplanationsEnabled", "mode", "replayRequested"]);
  expect(evidence).toEqual({ onboarding: "complete", targets: "unknown", mealPlan: "incomplete" });
});
test("reducer never mutates its input", () => {
  const defaults = Object.freeze(defaultGuidancePreferences());
  expect(reduceGuidancePreferences(defaults, "pause").mode).toBe("paused");
  expect(defaults.mode).toBe("not_started");
});
