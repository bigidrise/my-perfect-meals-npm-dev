/**
 * Development-only presentation preferences. Not imported by the app yet.
 * Never store task completion, access decisions, targets, or saved meal data here.
 */
export const GUIDANCE_PREFERENCE_SCHEMA_VERSION = 1;
export const PERSONAL_GUIDANCE_VERSION = 1;
const KEY_PREFIX = "mpm.guidedJourney.development.preferences.v1";

export interface GuidancePreferenceScope {
  /** Immutable account ID from signed-in auth state, never an email or token. */
  accountId: string;
  journeyVersion?: number;
}
export interface GuidancePreferences {
  mode: "not_started" | "active" | "paused";
  automaticExplanationsEnabled: boolean;
  replayRequested: boolean;
}
export type GuidancePreferenceCommand =
  | "start" | "pause" | "resume"
  | "disable_automatic" | "enable_automatic"
  | "restart_explanations" | "finish_replay";
type PreferenceIssue =
  | "none" | "storage_unavailable" | "invalid_record" | "unsupported_version" | "disposed";
export interface GuidancePreferenceResult {
  scope: { accountId: string; journeyVersion: number };
  preferences: GuidancePreferences;
  persistence: "stored" | "not_stored" | "memory_only";
  issue: PreferenceIssue;
}
export type GuidancePreferenceStorage = Pick<Storage, "getItem" | "setItem">;
interface StoredPreferences {
  schemaVersion: number;
  journeyVersion: number;
  accountId: string;
  preferences: GuidancePreferences;
}

function normalizedScope(scope: GuidancePreferenceScope) {
  const version = scope.journeyVersion ?? PERSONAL_GUIDANCE_VERSION;
  if (!scope.accountId || scope.accountId !== scope.accountId.trim()
    || scope.accountId.length > 200 || scope.accountId.startsWith("guest-")
    || ["anon", "anonymous"].includes(scope.accountId)
    || !Number.isSafeInteger(version) || version < 1) {
    throw new Error("Guidance preferences require a signed-in account and a valid journey version.");
  }
  return { accountId: scope.accountId, journeyVersion: version };
}
export function guidancePreferenceKey(scope: GuidancePreferenceScope): string {
  const normalized = normalizedScope(scope);
  return `${KEY_PREFIX}:personal:${encodeURIComponent(normalized.accountId)}:self:${normalized.journeyVersion}`;
}
export function defaultGuidancePreferences(): GuidancePreferences {
  // No opt-in has occurred. Merely reading preferences cannot activate guidance.
  return { mode: "not_started", automaticExplanationsEnabled: true, replayRequested: false };
}
export function canOfferAutomaticGuidance(preferences: GuidancePreferences): boolean {
  return preferences.mode === "active" && preferences.automaticExplanationsEnabled;
}
export function reduceGuidancePreferences(
  preferences: GuidancePreferences, command: GuidancePreferenceCommand,
): GuidancePreferences {
  switch (command) {
    case "start": return { ...preferences, mode: "active", replayRequested: false };
    case "pause": return { ...preferences, mode: "paused" };
    case "resume": return { ...preferences, mode: "active" };
    case "disable_automatic": return { ...preferences, automaticExplanationsEnabled: false, mode: "paused" };
    case "enable_automatic": return { ...preferences, automaticExplanationsEnabled: true };
    // Replay is a presentation request, never a reset of authoritative progress.
    case "restart_explanations": return { ...preferences, mode: "active", replayRequested: true };
    case "finish_replay": return { ...preferences, replayRequested: false };
  }
}

function browserStorage(): GuidancePreferenceStorage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; }
  catch { return null; }
}
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function decode(
  raw: string, scope: { accountId: string; journeyVersion: number },
): { preferences?: GuidancePreferences; issue: PreferenceIssue } {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { issue: "invalid_record" }; }
  if (!isObject(value)) return { issue: "invalid_record" };
  if (typeof value.schemaVersion === "number" && value.schemaVersion !== GUIDANCE_PREFERENCE_SCHEMA_VERSION) {
    return { issue: "unsupported_version" };
  }
  if (!hasExactKeys(value, ["schemaVersion", "journeyVersion", "accountId", "preferences"])
    || value.schemaVersion !== GUIDANCE_PREFERENCE_SCHEMA_VERSION
    || value.journeyVersion !== scope.journeyVersion || value.accountId !== scope.accountId
    || !isObject(value.preferences)) return { issue: "invalid_record" };
  const preferences = value.preferences;
  if (!hasExactKeys(preferences, ["mode", "automaticExplanationsEnabled", "replayRequested"])
    || !["not_started", "active", "paused"].includes(preferences.mode as string)
    || typeof preferences.automaticExplanationsEnabled !== "boolean"
    || typeof preferences.replayRequested !== "boolean") return { issue: "invalid_record" };
  return { preferences: {
    mode: preferences.mode as GuidancePreferences["mode"],
    automaticExplanationsEnabled: preferences.automaticExplanationsEnabled,
    replayRequested: preferences.replayRequested,
  }, issue: "none" };
}

/**
 * Create one store per current account. No global account or preference cache.
 * Dispose on logout/account change; a new store reloads that account's record.
 * Storage failures retain explicit choices in this instance and report that
 * they are not durable. Reading never creates, removes, or repairs records.
 */
export function createGuidancePreferenceStore(
  input: GuidancePreferenceScope,
  storage: GuidancePreferenceStorage | null = browserStorage(),
) {
  const scope = Object.freeze(normalizedScope(input));
  const key = guidancePreferenceKey(scope);
  let disposed = false;
  let volatile: { preferences: GuidancePreferences; issue: PreferenceIssue } | null = null;
  const result = (
    preferences: GuidancePreferences, persistence: GuidancePreferenceResult["persistence"],
    issue: PreferenceIssue,
  ): GuidancePreferenceResult => ({ scope: { ...scope }, preferences: { ...preferences }, persistence, issue });

  function read(): GuidancePreferenceResult {
    if (disposed) return result(defaultGuidancePreferences(), "not_stored", "disposed");
    if (volatile) return result(volatile.preferences, "memory_only", volatile.issue);
    if (!storage) return result(defaultGuidancePreferences(), "not_stored", "storage_unavailable");
    try {
      const raw = storage.getItem(key);
      if (raw === null) return result(defaultGuidancePreferences(), "not_stored", "none");
      const decoded = decode(raw, scope);
      return decoded.preferences ? result(decoded.preferences, "stored", "none")
        : result(defaultGuidancePreferences(), "not_stored", decoded.issue);
    } catch { return result(defaultGuidancePreferences(), "not_stored", "storage_unavailable"); }
  }

  function apply(command: GuidancePreferenceCommand): GuidancePreferenceResult {
    const current = read();
    if (disposed) return current;
    let preferences = reduceGuidancePreferences(current.preferences, command);
    // Never overwrite a newer/unrecognized schema with this older writer.
    if (current.issue === "unsupported_version") {
      volatile = { preferences, issue: "unsupported_version" };
      return result(preferences, "memory_only", "unsupported_version");
    }
    if (storage) {
      try {
        // A transient failed read must not overwrite an unseen newer record.
        const raw = storage.getItem(key);
        const decoded = raw === null ? null : decode(raw, scope);
        if (decoded?.issue === "unsupported_version") {
          volatile = { preferences, issue: "unsupported_version" };
          return result(preferences, "memory_only", "unsupported_version");
        }
        // Rebase on the latest readable record (including after a transient read
        // failure). Keep our own explicit memory-only choices if a write failed.
        if (decoded?.preferences && !volatile) {
          preferences = reduceGuidancePreferences(decoded.preferences, command);
        }
        const record: StoredPreferences = {
          schemaVersion: GUIDANCE_PREFERENCE_SCHEMA_VERSION,
          journeyVersion: scope.journeyVersion, accountId: scope.accountId, preferences,
        };
        storage.setItem(key, JSON.stringify(record));
        volatile = null;
        return result(preferences, "stored", "none");
      } catch { /* Keep this explicit choice in memory, without claiming a save. */ }
    }
    volatile = { preferences, issue: "storage_unavailable" };
    return result(preferences, "memory_only", "storage_unavailable");
  }
  return {
    read, apply,
    dispose() { disposed = true; volatile = null; },
  };
}
