import {
  recordClinicalProtocolDecision, recordSubjectProtocolChanges,
  PHYSICIAN_PROTOCOL_DECISION, SUBJECT_PROFILE_DECISION,
} from "../services/clinicalProtocolProvenance";
const rows: any[] = [];
const tx: any = { insert: () => ({ values: async (row: any) => { rows.push(row); } }) };
beforeEach(() => { rows.length = 0; });
test("self profile ownership is recorded only for explicit additions and removals, never backfilled", async () => {
  await recordSubjectProtocolChanges(tx, "synthetic-member",
    ["heart-failure", "liver-support"], ["cardiac", "thyroid-support"]);
  expect(rows).toEqual([
    { userId: "synthetic-member", recommendedProtocol: "thyroid-support", status: "accepted", reason: SUBJECT_PROFILE_DECISION },
    { userId: "synthetic-member", recommendedProtocol: "liver-support", status: "removed", reason: SUBJECT_PROFILE_DECISION },
  ]);
  rows.length = 0;
  await recordSubjectProtocolChanges(tx, "synthetic-member", ["heart-failure"], ["cardiac"]);
  expect(rows).toHaveLength(0);
});
test("authorized physician assignment has a distinct server-owned decision reason", async () => {
  await recordClinicalProtocolDecision(tx, "synthetic-member", "hormone-optimization", "accepted", "physician");
  expect(rows[0]).toEqual({
    userId: "synthetic-member", recommendedProtocol: "hormone-optimization",
    status: "accepted", reason: PHYSICIAN_PROTOCOL_DECISION,
  });
  expect(rows[0]).not.toHaveProperty("clinicalLabId");
});
test("provenance write failure is propagated to the profile transaction", async () => {
  const failedTx: any = { insert: () => ({ values: async () => { throw new Error("synthetic audit failure"); } }) };
  await expect(recordClinicalProtocolDecision(failedTx, "synthetic-member", "thyroid-support", "accepted", "self"))
    .rejects.toThrow("synthetic audit failure");
});
