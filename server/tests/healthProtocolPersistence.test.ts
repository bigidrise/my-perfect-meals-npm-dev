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
const labStatuses = new Map<number, string>();
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
  if (sql.includes("UPDATE health_protocol_sources") && sql.includes("source_kind='lab'")) {
    const changed = rows.filter((row) => row.subject_user_id === args[0] &&
      row.protocol_key === args[1] && row.source_kind === "lab" && row.status === "active");
    for (const row of changed) row.status = "inactive";
    return { rows: changed.map((row) => ({ id: row.id })), rowCount: changed.length };
  }
  if (sql.includes("UPDATE health_protocol_sources SET status=$5")) {
    const found = rows.find((row) => row.id === args[9]);
    if (!found) throw new Error("Test claim missing.");
    found.status = String(args[4]);
    found.accepted_recommendation = args[7] as boolean | null;
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
    events.push({
      sourceId: String(args[0]),
      before: args.length === 5 ? (args[2] as string | null) :
        args.length === 3 && sql.includes("'pending_review'") ? "pending_review" : "active",
      after: args.length === 5 ? String(args[3]) :
        args.length === 3 ? "inactive" : "pending_review",
      reason: args.length === 5 ? String(args[4]) :
        args.length === 3 ? String(args[2]) : "provider_relationship_ended",
    });
    return { rows: [], rowCount: 1 };
  }
  throw new Error(`Unhandled test SQL: ${sql.slice(0, 80)}`);
});
const poolQuery = jest.fn(async (sql: string, args: unknown[] = []) => {
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

describe("DEV shadow protocol persistence and source ownership", () => {
  const oldNodeEnv = process.env.NODE_ENV;
  beforeAll(() => { process.env.NODE_ENV = "development"; });
  afterAll(() => { process.env.NODE_ENV = oldNodeEnv; });
  beforeEach(() => {
    rows = []; events = []; membershipActive = true; labStatuses.clear();
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
    expect(rows).toHaveLength(1);
    expect(events.map((event) => event.after)).toEqual(["active", "inactive", "active"]);
    await user(true);
    expect(events).toHaveLength(3); // idempotent repeated enable
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
});