import type { HealthProtocol } from "../../shared/healthProtocolState";

type Row = {
  id: string; subject_user_id: string; protocol_key: HealthProtocol;
  source_kind: string; evidence_ref: string; status: string;
  owner_user_id?: string | null; care_relationship_id?: string | null;
  accepted_recommendation?: boolean | null; current_medication_use?: boolean | null;
};
let rows: Row[] = [];
let events: { sourceId: string; before: string | null; after: string; reason: string }[] = [];
let membershipActive = true;
let liveAntiPreference = false;
const labStatuses = new Map<number, string>();
let mockBuilder = "anti_inflammatory";
const clientQuery = jest.fn(async (sql: string, args: unknown[] = []) => {
  if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK" || sql.startsWith("SET LOCAL") ||
      sql.includes("pg_advisory_xact_lock")) return { rows: [], rowCount: 0 };
  if (sql.includes("SELECT sm.id FROM studio_memberships")) {
    return { rows: membershipActive ? [{ id: args[0] }] : [], rowCount: Number(membershipActive) };
  }
  if (sql.includes("SELECT id FROM studio_memberships")) {
    return { rows: !membershipActive ? [{ id: args[0] }] : [], rowCount: Number(!membershipActive) };
  }
  if (sql.includes("SELECT r.recommended_protocol")) {
    return { rows: [{ recommended_protocol: "kidney-disease", status: labStatuses.get(Number(args[0])) ?? "accepted" }], rowCount: 1 };
  }
  if (sql.includes("SELECT id, status, owner_user_id FROM health_protocol_sources")) {
    const found = rows.find((row) =>
      row.subject_user_id === args[0] && row.protocol_key === args[1] &&
      row.source_kind === args[2] && row.evidence_ref === args[3]);
    return { rows: found ? [found] : [], rowCount: Number(!!found) };
  }
  if (sql.includes("SELECT id, protocol_key, status FROM health_protocol_sources")) {
    const found = rows.find((row) => row.id === args[0] &&
      row.subject_user_id === args[1] && row.source_kind === "system_recommendation");
    return { rows: found ? [found] : [], rowCount: Number(!!found) };
  }
  if (sql.includes("SELECT protocol_key FROM health_protocol_sources") &&
      sql.includes("source_kind='legacy_migrated'")) {
    const found = rows.find((row) => row.id === args[0] &&
      row.subject_user_id === args[1] && row.source_kind === "legacy_migrated");
    return { rows: found ? [{ protocol_key: found.protocol_key }] : [], rowCount: Number(!!found) };
  }
  if (sql.includes("SELECT app_preferences->>'antiInflammatorySupport' AS current_anti")) {
    return { rows: [{ current_anti: liveAntiPreference ? "true" : null }] };
  }
  if (sql.includes("UPDATE users SET app_preferences")) {
    liveAntiPreference = args[0] === true;
    return { rows: [], rowCount: 1 };
  }
  if (sql.includes("evidence_ref='legacy:app_preferences_anti_inflammatory'") &&
      sql.includes("SELECT id FROM health_protocol_sources")) {
    const found = rows.find((row) => row.subject_user_id === args[0] &&
      row.protocol_key === "anti_inflammatory" && row.source_kind === "legacy_migrated" &&
      row.evidence_ref === "legacy:app_preferences_anti_inflammatory");
    return { rows: found ? [{ id: found.id }] : [] };
  }
  if (sql.includes("SELECT id, status FROM health_protocol_sources") &&
      sql.includes("source_kind='medication'")) {
    const found = rows.find((row) => row.id === args[0] &&
      row.subject_user_id === args[1] && row.protocol_key === "glp1" &&
      row.source_kind === "medication");
    return { rows: found ? [found] : [], rowCount: Number(!!found) };
  }
  if (sql.includes("SELECT id FROM health_protocol_sources") &&
      sql.includes("source_kind='legacy_migrated'")) {
    const found = rows.filter((row) => row.subject_user_id === args[0] &&
      row.protocol_key === args[1] && row.source_kind === "legacy_migrated" &&
      row.status === "pending_review");
    return { rows: found.map((row) => ({ id: row.id })), rowCount: found.length };
  }
  if (sql.includes("INSERT INTO health_protocol_sources")) {
    const row: Row = {
      id: `claim-${rows.length + 1}`, subject_user_id: String(args[0]),
      protocol_key: args[1] as HealthProtocol, source_kind: String(args[2]),
      evidence_ref: String(args[3]), status: String(args[4]),
      owner_user_id: args[5] as string | null,
      care_relationship_id: args[6] as string | null,
      accepted_recommendation: args[7] as boolean | null,
      current_medication_use: args[8] as boolean | null,
    };
    rows.push(row);
    return { rows: [{ id: row.id }], rowCount: 1 };
  }
  if (sql.includes("UPDATE health_protocol_sources SET status='pending_review'")) {
    const changed = rows.filter((row) => row.care_relationship_id === args[0] &&
      row.subject_user_id === args[1] && row.source_kind === "provider" && row.status === "active");
    for (const row of changed) row.status = "pending_review";
    return { rows: changed.map((row) => ({ id: row.id })), rowCount: changed.length };
  }
  if (sql.includes("UPDATE health_protocol_sources") && sql.includes("SET status='historical'")) {
    const found = rows.find((row) => row.id === args[0]);
    if (!found) throw new Error("Test earlier profile entry missing.");
    found.status = "historical";
    return { rows: [], rowCount: 1 };
  }
  if (sql.includes("UPDATE health_protocol_sources") && sql.includes("source_kind='lab'")) {
    const changed = rows.filter((row) => row.subject_user_id === args[0] &&
      row.protocol_key === args[1] && row.source_kind === "lab" && row.status === "active");
    for (const row of changed) row.status = "inactive";
    return { rows: changed.map((row) => ({ id: row.id })), rowCount: changed.length };
  }
  if (sql.includes("UPDATE health_protocol_sources SET status=$1")) {
    if (args.length !== 6) throw new Error("Claim update parameters must be contiguous.");
    const found = rows.find((row) => row.id === args[5]);
    if (!found) throw new Error("Test claim missing.");
    found.status = String(args[0]);
    found.accepted_recommendation = args[3] as boolean | null;
    return { rows: [{ id: found.id }], rowCount: 1 };
  }
  if (sql.includes("UPDATE health_protocol_sources") && sql.includes("SET status='inactive'") &&
      sql.includes("WHERE id=$1")) {
    const found = rows.find((row) => row.id === args[0]);
    if (!found) throw new Error("Test recommendation missing.");
    found.status = "inactive";
    return { rows: [], rowCount: 1 };
  }
  if (sql.includes("INSERT INTO health_protocol_events")) {
    const before = sql.includes("'pending_review','historical'") ? "pending_review"
      : args.length === 5 ? (args[2] as string | null) :
        args.length === 3 && sql.includes("'pending_review'") ? "pending_review" : "active";
    const after = sql.includes("'pending_review','historical'") ||
      sql.includes("'historical','user_reported_medication_past'") ? "historical"
      : args.length === 5 ? String(args[3]) :
        args.length === 3 ? "inactive" : "pending_review";
    events.push({
      sourceId: String(args[0]),
      before, after,
      reason: sql.includes("'user_reported_medication_past'") ? "user_reported_medication_past"
        : args.length === 5 ? String(args[4]) :
          args.length === 3 ? String(args[2]) : "provider_relationship_ended",
    });
    return { rows: [], rowCount: 1 };
  }
  throw new Error(`Unhandled test SQL: ${sql.slice(0, 80)}`);
});
const poolQuery = jest.fn(async (sql: string, args: unknown[] = []) => {
  if (sql.includes("selected_meal_builder") && sql.includes("FROM users")) {
    return { rows: [{
      selected_meal_builder: mockBuilder,
      current_anti: liveAntiPreference ? "true" : null,
    }] };
  }
  if (sql.includes("FROM clinical_protocol_recommendations r")) {
    return { rows: [] };
  }
  if (sql.includes("FROM health_protocol_events e")) {
    return { rows: [] };
  }
  if (sql.includes("FROM health_protocol_sources WHERE subject_user_id")) {
    return { rows: rows.filter((row) => row.subject_user_id === args[0]) };
  }
  if (sql.includes("FROM studio_memberships")) {
    return {
      rows: (args[1] as string[]).map((id) => ({
        id, status: membershipActive ? "active" : "revoked", is_archived: !membershipActive,
      })),
    };
  }
  throw new Error(`Unhandled test read: ${sql.slice(0, 80)}`);
});
jest.mock("../db", () => ({
  pool: { connect: jest.fn(async () => ({ query: clientQuery, release: jest.fn() })), query: poolQuery },
}));

import {
  setUserNutritionSupport, setProviderProtocol, markEndedProviderRelationship,
  recordLabDecision, discontinueLabProtocol,
  recordUnverifiedMedicationContext, recordSystemRecommendation, decideSystemRecommendation,
} from "../services/healthProtocols/persistence";
import {
  decideLegacySupport, decideEarlierAntiPreference, markMedicationInformationPast,
  presentHealthContext, readHealthContextView,
} from "../services/healthProtocols/healthContextControl";
import { resolveHealthProtocolState } from "../services/healthProtocols/resolveHealthProtocolState";

describe("DEV shadow protocol persistence and source ownership", () => {
  const oldNodeEnv = process.env.NODE_ENV;
  beforeAll(() => { process.env.NODE_ENV = "development"; });
  afterAll(() => { process.env.NODE_ENV = oldNodeEnv; });
  beforeEach(() => {
    rows = []; events = []; membershipActive = true; liveAntiPreference = false;
    labStatuses.clear(); mockBuilder = "anti_inflammatory";
    clientQuery.mockClear(); poolQuery.mockClear();
  });
  const user = (enabled: boolean, protocol: HealthProtocol = "glp1") =>
    setUserNutritionSupport({
      actorUserId: "subject", subjectUserId: "subject", protocol, enabled,
    });
  const provider = (enabled: boolean) => setProviderProtocol({
    actorUserId: "doctor", subjectUserId: "subject",
    membershipId: "care-1", protocol: "glp1", enabled,
  });

  it("enables, discontinues and re-enables a user claim without deleting its history", async () => {
    expect((await user(true)).activeHealthContext).toEqual(["glp1"]);
    expect((await user(false)).activeHealthContext).toEqual([]);
    expect((await user(true)).activeHealthContext).toEqual(["glp1"]);
    const updates = clientQuery.mock.calls.filter(([sql]) =>
      String(sql).includes("UPDATE health_protocol_sources SET status=$1"));
    expect(updates).toHaveLength(2);
    expect(updates[0][1]).toEqual(["inactive", null, null, null, null, "claim-1"]);
    expect(updates[1][1]).toEqual(["active", null, null, null, null, "claim-1"]);
    expect(rows).toHaveLength(1);
    expect(events.map((event) => event.after)).toEqual(["active", "inactive", "active"]);
    await user(true);
    expect(events).toHaveLength(3); // idempotent repeated enable
  });

  it("keeps an explicit anti-inflammatory personal source and the old preference in one transaction", async () => {
    expect(liveAntiPreference).toBe(false);
    expect((await user(true, "anti_inflammatory")).activeHealthContext).toEqual(["anti_inflammatory"]);
    expect(liveAntiPreference).toBe(true);
    expect((await user(false, "anti_inflammatory")).activeHealthContext).toEqual([]);
    expect(liveAntiPreference).toBe(false);
    expect(rows).toHaveLength(1);
    expect(clientQuery.mock.calls.filter(([sql]) => String(sql).includes("UPDATE users SET app_preferences"))).toHaveLength(2);
  });

  it("cannot allow a patient to edit another person's own claim", async () => {
    await expect(setUserNutritionSupport({
      actorUserId: "patient", subjectUserId: "someone-else",
      protocol: "glp1", enabled: false,
    })).rejects.toThrow(/subject/);
    expect(rows).toHaveLength(0);
  });

  it("keeps a provider source when personal support is stopped, and permits independent provider off", async () => {
    await user(true);
    expect((await provider(true)).activeSourceIds.glp1).toHaveLength(2);
    const afterUserOff = await user(false);
    expect(afterUserOff.activeSourceIds.glp1).toEqual([rows[1].id]);
    expect(afterUserOff.activeHealthContext).toEqual(["glp1"]);
    expect((await provider(false)).activeHealthContext).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(events).toHaveLength(4);
  });

  it("requires an active verified clinical relationship to make a provider write", async () => {
    membershipActive = false;
    await expect(provider(true)).rejects.toThrow(/relationship/);
    expect(rows).toHaveLength(0);
    expect(events).toHaveLength(0);
  });

  it("retains provider history and requires review on disconnect", async () => {
    await provider(true);
    membershipActive = false;
    const after = await markEndedProviderRelationship({
      subjectUserId: "subject", membershipId: "care-1",
    });
    expect(after.effectiveForFood).toBeNull();
    expect(after.needsReview[0].reason).toBe("provider_relationship_ended");
    expect(rows[0].status).toBe("pending_review");
    expect(events.map((event) => event.reason)).toEqual([
      "provider_assigned", "provider_relationship_ended",
    ]);
  });

  it("separates accepted labs from declines and explicitly discontinued claims", async () => {
    const lab = (recommendationId: number) => recordLabDecision({
      actorUserId: "subject", subjectUserId: "subject", recommendationId,
    });
    expect((await lab(7)).state.activeHealthContext).toEqual(["renal"]);
    labStatuses.set(8, "rejected");
    expect((await lab(8)).state.activeHealthContext).toEqual(["renal"]);
    expect((await discontinueLabProtocol({
      actorUserId: "subject", subjectUserId: "subject", protocol: "renal",
    })).activeHealthContext).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0].status).toBe("inactive");
    expect(events.map((event) => event.after)).toEqual(["active", "inactive", "inactive"]);
  });

  it("cannot infer current medication use or activate an unaccepted system suggestion", async () => {
    const medication = await recordUnverifiedMedicationContext({
      actorUserId: "subject", subjectUserId: "subject",
      protocol: "glp1", evidenceRef: "medication:review-1",
    });
    expect(medication.effectiveForFood).toBeNull();
    expect(medication.activeHealthContext).toEqual([]);
    const suggestion = await recordSystemRecommendation({
      subjectUserId: "subject", protocol: "anti_inflammatory", evidenceRef: "suggestion:1",
    });
    expect(suggestion.needsReview).toHaveLength(2);
    expect(rows.every((row) => row.status === "pending_review")).toBe(true);
  });

  it("requires a one-time explicit subject decision for a recommendation", async () => {
    await recordSystemRecommendation({
      subjectUserId: "subject", protocol: "anti_inflammatory", evidenceRef: "suggestion:1",
    });
    await expect(decideSystemRecommendation({
      subjectUserId: "subject", actorUserId: "other",
      recommendationId: rows[0].id, accept: true,
    })).rejects.toThrow(/subject/);
    const accepted = await decideSystemRecommendation({
      subjectUserId: "subject", actorUserId: "subject",
      recommendationId: rows[0].id, accept: true,
    });
    expect(accepted.activeSourceIds.anti_inflammatory).toEqual([rows[1].id]);
    expect(rows[0].status).toBe("inactive");
    expect(events.map((event) => event.reason)).toEqual([
      "system_suggested", "system_suggestion_accepted", "user_accepted_system_suggestion",
    ]);
    await expect(decideSystemRecommendation({
      subjectUserId: "subject", actorUserId: "subject",
      recommendationId: rows[0].id, accept: true,
    })).rejects.toThrow(/undecided/);
    await recordSystemRecommendation({
      subjectUserId: "subject", protocol: "renal", evidenceRef: "suggestion:2",
    });
    const declined = await decideSystemRecommendation({
      subjectUserId: "subject", actorUserId: "subject",
      recommendationId: rows[2].id, accept: false,
    });
    expect(declined.activeHealthContext).toEqual(["anti_inflammatory"]);
    expect(rows[2].status).toBe("inactive");
    expect(events.at(-1)?.reason).toBe("system_suggestion_declined");
  });

  const legacy = (protocol: HealthProtocol, id: string) => {
    rows.push({
      id, subject_user_id: "subject", protocol_key: protocol,
      source_kind: "legacy_migrated", evidence_ref: `legacy:${id}`,
      status: "pending_review",
    });
  };

  it("confirms every earlier GLP-1 origin once without changing Anti-Inflammatory Builder or claiming medication use", async () => {
    legacy("glp1", "earlier-1");
    legacy("glp1", "earlier-2");
    const result = await decideLegacySupport({
      actorUserId: "subject", subjectUserId: "subject", sourceId: "earlier-1", current: true,
    });
    expect(result.builder).toBe("anti_inflammatory");
    const glp1 = result.supports.find((item) => item.protocol === "glp1")!;
    expect(glp1.personalEnabled).toBe(true);
    expect(glp1.sources.filter((source) => source.kind === "earlier_profile")
      .every((source) => source.status === "previous")).toBe(true);
    expect(rows.find((row) => row.source_kind === "user")?.current_medication_use).toBeNull();
    expect(events.map((item) => item.reason)).toEqual([
      "legacy_confirmed_support", "legacy_confirmed_support", "user_confirmed_legacy_support",
    ]);
    await decideLegacySupport({
      actorUserId: "subject", subjectUserId: "subject", sourceId: "earlier-1", current: false,
    });
    expect(events).toHaveLength(3);
    expect(rows).toHaveLength(3);
    await user(false);
    expect((await user(true)).activeHealthContext).toEqual(["glp1"]);
    expect(rows.slice(0, 2).every((row) => row.status === "historical")).toBe(true);
  });

  it("declines earlier GLP-1 support without erasing provider support or changing the Builder", async () => {
    await provider(true);
    legacy("glp1", "earlier-1");
    const result = await decideLegacySupport({
      actorUserId: "subject", subjectUserId: "subject", sourceId: "earlier-1", current: false,
    });
    expect(result.builder).toBe("anti_inflammatory");
    const glp1 = result.supports.find((item) => item.protocol === "glp1")!;
    expect(glp1.status).toBe("active");
    expect(glp1.personalEnabled).toBe(false);
    expect(glp1.sources.some((source) => source.kind === "care_team" && source.status === "active")).toBe(true);
    expect(rows.some((row) => row.source_kind === "user")).toBe(false);
    await expect(decideLegacySupport({
      actorUserId: "other", subjectUserId: "subject", sourceId: "earlier-1", current: true,
    })).rejects.toThrow(/ownership/);
  });

  it("allows simultaneous diabetes, GLP-1 and anti-inflammatory sources independently of Builder", async () => {
    mockBuilder = "diabetic";
    await user(true, "glp1");
    await user(true, "anti_inflammatory");
    await user(true, "diabetes");
    const state = resolveHealthProtocolState({
      builder: "diabetic",
      records: rows.map((row) => ({
        id: row.id, protocol: row.protocol_key, source: "user" as const, status: row.status as "active",
      })),
      relationshipStatus: {},
    });
    const presented = presentHealthContext(rows, state, mockBuilder);
    expect(presented.builder).toBe("diabetic");
    expect(["glp1", "diabetes", "anti_inflammatory"].every((p) =>
      presented.supports.find((item) => item.protocol === p)?.personalEnabled)).toBe(true);
    await user(false, "glp1");
    expect(rows.find((row) => row.protocol_key === "anti_inflammatory")?.status).toBe("active");
    expect(rows.find((row) => row.protocol_key === "diabetes")?.status).toBe("active");
  });

  it.each([
    ["anti_inflammatory", ["glp1"]],
    ["glp1", ["anti_inflammatory"]],
    ["diabetic", ["glp1"]],
    ["diabetic", ["anti_inflammatory"]],
    ["diabetic", ["glp1", "anti_inflammatory"]],
  ] as const)("retains %s Builder alongside supports %j", (builder, enabled) => {
    const records = enabled.map((protocol, index) => ({
      id: `personal-${index}`, protocol, source: "user" as const, status: "active" as const,
    }));
    const resolved = resolveHealthProtocolState({ builder, records, relationshipStatus: {} });
    const view = presentHealthContext(records.map((row) => ({
      id: row.id, protocol_key: row.protocol, source_kind: "user", status: "active",
    })), resolved, builder);
    expect(view.builder).toBe(builder);
    expect(enabled.every((key) => view.supports.find((item) => item.protocol === key)?.personalEnabled)).toBe(true);
    expect(records.some((row) => row.source === "medication")).toBe(false);
    const switched = resolveHealthProtocolState({
      builder: "standard", records, relationshipStatus: {},
    });
    expect(switched.activeHealthContext).toEqual(resolved.activeHealthContext);
  });

  it("marks unconfirmed medication information as past, keeping its history and other GLP-1 sources", async () => {
    await recordUnverifiedMedicationContext({
      actorUserId: "subject", subjectUserId: "subject",
      protocol: "glp1", evidenceRef: "reported-earlier",
    });
    await provider(true);
    const medication = rows.find((row) => row.source_kind === "medication")!;
    const view = await markMedicationInformationPast({
      actorUserId: "subject", subjectUserId: "subject", sourceId: medication.id,
    });
    expect(view.supports.find((item) => item.protocol === "glp1")?.status).toBe("active");
    expect(medication.status).toBe("historical");
    expect(events.at(-1)?.reason).toBe("user_reported_medication_past");
    await markMedicationInformationPast({
      actorUserId: "subject", subjectUserId: "subject", sourceId: medication.id,
    });
    expect(events.filter((event) => event.reason === "user_reported_medication_past")).toHaveLength(1);
  });

  it("shows a live Anti-Inflammatory preference for review without automatically activating shadow support", async () => {
    liveAntiPreference = true;
    const initial = await readHealthContextView("subject");
    expect(initial.legacyAntiPreferenceNeedsReview).toBe(true);
    expect(initial.supports.find((item) => item.protocol === "anti_inflammatory")?.status).toBe("off");
    const reviewed = await decideEarlierAntiPreference({
      actorUserId: "subject", subjectUserId: "subject", current: true,
    });
    expect(reviewed.legacyAntiPreferenceNeedsReview).toBe(false);
    expect(reviewed.supports.find((item) => item.protocol === "anti_inflammatory")?.personalEnabled).toBe(true);
    expect(rows.some((row) => row.source_kind === "legacy_migrated" &&
      row.evidence_ref === "legacy:app_preferences_anti_inflammatory" &&
      row.status === "historical")).toBe(true);
    const eventCount = events.length;
    await decideEarlierAntiPreference({
      actorUserId: "subject", subjectUserId: "subject", current: false,
    });
    expect(events).toHaveLength(eventCount);
  });
});