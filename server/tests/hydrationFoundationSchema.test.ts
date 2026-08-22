import fs from "node:fs";
import path from "node:path";
import {
  hydrationAuditLog,
  hydrationIntakeEvents,
  hydrationDailyStates,
  hydrationPlanRevisions,
} from "../db/schema/hydration";
import {
  assertPhase1NonnumericPlan,
  HYDRATION_PHASE1_CONTRACT_VERSION,
} from "@shared/hydration/contracts";
import {
  hydrationIntakeEventInputSchema,
  hydrationPhase1PlanSchema,
  hydrationPhase1StateSchema,
} from "@shared/hydration/schemas";

const migrationPath = path.resolve(
  process.cwd(),
  "migrations/0010_hydration_foundation.sql",
);
const drizzleConfigPath = path.resolve(process.cwd(), "drizzle.config.ts");
const intakeServicePath = path.resolve(
  process.cwd(),
  "server/services/hydration/hydrationIntakeService.ts",
);

describe("Hydration Phase 1 schema contract", () => {
  it("exports the canonical Drizzle tables without changing water_logs", () => {
    expect(hydrationIntakeEvents).toBeDefined();
    expect(hydrationPlanRevisions).toBeDefined();
    expect(hydrationDailyStates).toBeDefined();
    expect(hydrationAuditLog.occurredAt.name).toBe("occurred_at");
    expect(HYDRATION_PHASE1_CONTRACT_VERSION).toBe("hydration-foundation-v1");
  });

  it("requires authenticated-owner-free event input and preserves explicit units", () => {
    const parsed = hydrationIntakeEventInputSchema.parse({
      originalAmount: 16,
      originalUnit: "oz",
      occurredAt: "2026-08-21T12:00:00.000Z",
      occurredTimezone: "America/Chicago",
      beverageClass: "water",
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
    });

    expect(parsed.originalUnit).toBe("oz");
    expect(parsed.source).toBe("manual");
    expect("subjectUserId" in parsed).toBe(false);
    expect(() =>
      hydrationIntakeEventInputSchema.parse({
        ...parsed,
        unit: "gallon",
      }),
    ).toThrow();
  });

  it("rejects invalid event data and preserves unknown contribution semantics", () => {
    expect(() =>
      hydrationIntakeEventInputSchema.parse({
        originalAmount: 0,
        originalUnit: "ml",
        occurredAt: "2026-08-21T12:00:00.000Z",
        occurredTimezone: "America/Chicago",
        beverageClass: "water",
        idempotencyKey: "00000000-0000-4000-8000-000000000002",
      }),
    ).toThrow();

    const plan = {
      id: "00000000-0000-4000-8000-000000000003",
      subjectUserId: "user-1",
      localDate: "2026-08-21",
      timezone: "America/Chicago",
      revision: 1,
      status: "monitor_only" as const,
      targetKind: "monitor_only" as const,
      targetMl: null,
      minimumMl: null,
      maximumMl: null,
      remainingMl: null,
      calculationPolicyVersionId: "00000000-0000-4000-8000-000000000004",
      inputSnapshotHash: "hash",
      policyVersionManifest: {},
      missingDataCodes: ["phase1_disabled"],
      rationaleCodes: ["feature_disabled"],
      explanationKeys: [],
      effectiveAt: "2026-08-21T12:00:00.000Z",
      createdAt: "2026-08-21T12:00:00.000Z",
    };

    expect(hydrationPhase1PlanSchema.parse(plan).targetMl).toBeNull();
    expect(() => assertPhase1NonnumericPlan(plan)).not.toThrow();
    expect(() =>
      hydrationPhase1PlanSchema.parse({ ...plan, targetMl: 2000 }),
    ).toThrow();
  });

  it("requires state contribution and progress values to remain unknown", () => {
    const state = {
      id: "00000000-0000-4000-8000-000000000005",
      subjectUserId: "user-1",
      localDate: "2026-08-21",
      timezone: "America/Chicago",
      stateVersion: 1,
      effectivePlanRevisionId: "00000000-0000-4000-8000-000000000006",
      inputWatermark: "watermark",
      activeEventCount: 0,
      totalDeclaredVolumeMl: 0,
      knownContributionMl: null,
      unknownContributionEventCount: 0,
      electrolyteLedgerId: "00000000-0000-4000-8000-000000000007",
      planStatus: "monitor_only" as const,
      progressStatus: "unknown" as const,
      computedAt: "2026-08-21T12:00:00.000Z",
      calculationPolicyVersionId: "00000000-0000-4000-8000-000000000008",
      projectionHash: "hash",
    };

    expect(hydrationPhase1StateSchema.parse(state).progressStatus).toBe(
      "unknown",
    );
    expect(() =>
      hydrationPhase1StateSchema.parse({
        ...state,
        knownContributionMl: 1,
      }),
    ).toThrow();
  });

  it("contains all additive tables and append-only protections in the migration artifact", () => {
    const migration = fs.readFileSync(migrationPath, "utf8");
    const drizzleConfig = fs.readFileSync(drizzleConfigPath, "utf8");
    for (const tableName of [
      "hydration_policy_versions",
      "hydration_baselines",
      "hydration_modifiers",
      "hydration_restrictions",
      "hydration_clinician_directives",
      "hydration_plan_revisions",
      "hydration_intake_events",
      "hydration_event_supersessions",
      "hydration_audit_log",
      "hydration_plan_supersessions",
      "hydration_plan_revision_input_refs",
      "hydration_event_contributions",
      "hydration_electrolyte_ledgers",
      "hydration_daily_states",
      "hydration_backfill_runs",
      "hydration_legacy_event_mappings",
    ]) {
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${tableName}`);
    }
    expect(migration).toContain("hydration_intake_events_owner_idempotency_uniq");
    expect(migration).toContain("HYDRATION_APPEND_ONLY_TABLE");
    expect(migration).toContain("hydration_plan_revisions_phase1_values_null");
    expect(migration).toContain("hydration_daily_states_phase1_unknown");
    expect(migration).toContain("water_logs(id)");
    expect(migration).not.toMatch(/DROP TABLE\s+water_logs/i);
    expect(migration).not.toMatch(/ALTER TABLE\s+water_logs/i);
    expect(drizzleConfig).not.toContain("./server/db/schema/hydration.ts");
  });

  it("keeps every canonical event mutation audit-wired", () => {
    const service = fs.readFileSync(intakeServicePath, "utf8");
    expect(service).toContain("hydrationAuditLog");
    expect(service).toContain('action: "intake_event.create"');
    expect(service).toContain('action: "intake_event.correct"');
    expect(service).toContain('action: "intake_event.void"');
    expect(service).toContain('outcome: "accepted"');
    expect(service).toContain('outcome: "deduplicated"');
    expect(service).toContain("await this.insertAudit(tx");
  });
});