import { strictOwnerDevelopmentEnabled } from "./strictOwnerRuntime";

/**
 * Server-only resolution evidence, not clinical policy. No database/provider imports.
 * Every strict request owns a fresh recorder; default callers never create one.
 */
export type SourceOutcome<T> =
  | { status: "success"; value: T; basis: "stored" | "calculated" | "existing_default" }
  | { status: "not_applicable"; reasonCode: string }
  | { status: "absent"; reasonCode: "successful_empty_read" }
  | { status: "incomplete"; reasonCode: "read_failed" | "invalid_data" | "missing_required" | "unsupported" };

export type SafetySourceKey =
  | "owner_profile" | "timezone" | "glp1_activation" | "personal_supports"
  | "provider_interventions" | "diabetes_context" | "glp1_tolerance"
  | "competition" | "condition_guidance" | "daily_state" | "prescription"
  | "glp1_guardrails" | "performance" | "preferences" | "write_boundary";

export type OwnerDay = { readonly timezone: string; readonly localDate: string };
export interface SafetySourceMap {
  owner_profile: { id: string };
  timezone: OwnerDay;
  glp1_activation: readonly string[];
  personal_supports: readonly string[];
  provider_interventions: readonly unknown[];
  diabetes_context: unknown;
  glp1_tolerance: unknown;
  competition: unknown;
  condition_guidance: readonly string[];
  daily_state: unknown;
  prescription: unknown;
  glp1_guardrails: unknown;
  performance: unknown;
  preferences: unknown;
  write_boundary: "none";
}
const required: SafetySourceKey[] = [
  "owner_profile", "timezone", "glp1_activation", "personal_supports",
  "provider_interventions", "diabetes_context", "glp1_tolerance", "competition",
  "condition_guidance", "daily_state", "prescription", "glp1_guardrails", "performance", "write_boundary",
];
export class SafetyResolutionRecorder {
  private readonly results = new Map<SafetySourceKey, SourceOutcome<unknown>>();
  private readonly pending = new Map<SafetySourceKey, Promise<unknown>>();

  record<K extends SafetySourceKey>(key: K, outcome: SourceOutcome<SafetySourceMap[K]>): void {
    // A later default or success must never erase a required failure.
    if (this.results.get(key)?.status !== "incomplete") this.results.set(key, outcome);
  }
  get<K extends SafetySourceKey>(key: K): SourceOutcome<SafetySourceMap[K]> | undefined {
    return this.results.get(key) as SourceOutcome<SafetySourceMap[K]> | undefined;
  }
  notApplicable(key: SafetySourceKey, reasonCode: string): void {
    this.record(key, { status: "not_applicable", reasonCode });
  }
  fail(key: SafetySourceKey, reasonCode: Extract<SourceOutcome<unknown>, { status: "incomplete" }>["reasonCode"]): void {
    this.record(key, { status: "incomplete", reasonCode });
  }
  async once<T>(key: SafetySourceKey, work: () => Promise<T>): Promise<T> {
    let pending = this.pending.get(key);
    if (!pending) {
      pending = Promise.resolve().then(work);
      this.pending.set(key, pending);
    }
    return pending as Promise<T>;
  }
  incompleteSources(): SafetySourceKey[] {
    return required.filter(key => {
      const result = this.results.get(key);
      return !result || result.status === "incomplete"
        || (["owner_profile", "timezone", "prescription"].includes(key) && result.status === "absent");
    });
  }
  snapshot(): Readonly<Partial<{ [K in SafetySourceKey]: SourceOutcome<SafetySourceMap[K]> }>> {
    return Object.freeze(Object.fromEntries(this.results));
  }
}
export interface StrictOwnerScope {
  readonly mode: "pairing_advisor_owner";
  readonly ownerId: string;
  readonly now: Date;
  readonly resolution: SafetyResolutionRecorder;
}
export interface StrictOwnerClinicalContext extends StrictOwnerScope {
  readonly day: OwnerDay;
}
export class StrictOwnerResolutionError extends Error {
  constructor(readonly source: SafetySourceKey, readonly reasonCode: string) {
    super("Required owner safety context is unavailable");
  }
}
export function assertStrictOwner(scope: StrictOwnerScope, userId: string, household = false): void {
  if (!strictOwnerDevelopmentEnabled()) {
    scope.resolution.fail("owner_profile", "unsupported");
    throw new StrictOwnerResolutionError("owner_profile", "unsupported");
  }
  if (scope.mode !== "pairing_advisor_owner" || !userId || userId !== scope.ownerId || household) {
    scope.resolution.fail("owner_profile", "invalid_data");
    throw new StrictOwnerResolutionError("owner_profile", "invalid_data");
  }
}
export function establishOwnerDay(scope: StrictOwnerScope, timezone: unknown): StrictOwnerClinicalContext {
  try {
    if (typeof timezone !== "string" || !timezone.trim()) throw new Error("Missing timezone");
    const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(scope.now);
    const day = Object.freeze({ timezone, localDate });
    scope.resolution.record("timezone", { status: "success", value: day, basis: "stored" });
    return { ...scope, day };
  } catch {
    scope.resolution.fail("timezone", "invalid_data");
    throw new StrictOwnerResolutionError("timezone", "invalid_data");
  }
}
export function assertOwnerDay(scope: StrictOwnerClinicalContext, userId: string, date: string): void {
  assertStrictOwner(scope, userId);
  if (scope.day.localDate !== date) {
    scope.resolution.fail("timezone", "invalid_data");
    throw new StrictOwnerResolutionError("timezone", "invalid_data");
  }
}

export function observeSource<K extends SafetySourceKey, T extends SafetySourceMap[K]>(
  scope: StrictOwnerScope | undefined, key: K, work: () => Promise<T>,
): Promise<T> {
  try {
    const pending = work();
    if (!scope) return pending;
    return pending.then(value => {
      scope.resolution.record(key, { status: "success", value, basis: "calculated" });
      return value;
    }, error => {
      scope.resolution.fail(key, "read_failed");
      throw error;
    });
  } catch (error) {
    scope?.resolution.fail(key, "read_failed");
    throw error;
  }
}
