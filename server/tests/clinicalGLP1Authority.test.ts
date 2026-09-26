const query = jest.fn();
const putClaim = jest.fn();
const update = jest.fn();
const resolveAuthority = jest.fn();
let development = true;

jest.mock("../db", () => ({
  db: { update: (...args: unknown[]) => update(...args) },
}));
jest.mock("../services/glp1/currentMealAuthority", () => ({
  currentGLP1AuthorityEnabled: () => development,
  resolveCurrentGLP1MealAuthority: (...args: unknown[]) => resolveAuthority(...args),
}));
jest.mock("../services/healthProtocols/persistence", () => ({
  shadowTransaction: (work: (client: unknown) => Promise<unknown>) => work({ query }),
  putClaim: (...args: unknown[]) => putClaim(...args),
}));

import { readClinicalGLP1Active, setClinicalGLP1Authority } from "../services/glp1/clinicalProtocolWrite";

describe("clinician GLP-1 current authority", () => {
  beforeEach(() => {
    development = true;
    query.mockReset().mockResolvedValue({ rows: [{ id: "membership-1" }] });
    putClaim.mockReset().mockResolvedValue("claim-1");
    update.mockReset();
    resolveAuthority.mockReset().mockResolvedValue([]);
  });

  it("reports only a verified provider claim as current, not the old array", async () => {
    expect(await readClinicalGLP1Active("subject", ["glp1"])).toBe(false);
    resolveAuthority.mockResolvedValue(["verifiedProvider"]);
    expect(await readClinicalGLP1Active("subject", ["glp1"])).toBe(true);
  });

  it("binds a clinician claim to an active verified clinic without erasing legacy history", async () => {
    const input = {
      clientUserId: "subject", requesterId: "physician", enabled: true,
      existing: ["glp1", "diabetes-type2"], updated: ["glp1", "diabetes-type2"],
    };
    expect(await setClinicalGLP1Authority(input)).toEqual(input.existing);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain("st.verification_status='verified'");
    expect(query.mock.calls[0][1]).toEqual(["subject", "physician"]);
    expect(putClaim).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      protocol: "glp1", source: "provider", status: "active",
      ownerUserId: "physician", careRelationshipId: "membership-1",
    }));
    expect(update).not.toHaveBeenCalled();
    query.mockClear();
    expect(await setClinicalGLP1Authority({ ...input, enabled: false, updated: ["diabetes-type2"] }))
      .toEqual(input.existing);
    expect(putClaim).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ status: "inactive" }));
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("does not grant authority without a verified active relationship", async () => {
    query.mockResolvedValue({ rows: [] });
    await expect(setClinicalGLP1Authority({
      clientUserId: "subject", requesterId: "physician", enabled: true,
      existing: ["glp1"], updated: ["glp1"],
    })).rejects.toThrow("Verified current clinic relationship required");
    expect(putClaim).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("does not read shadow claims outside Development", async () => {
    development = false;
    expect(await readClinicalGLP1Active("subject", ["glp1"])).toBe(true);
    expect(resolveAuthority).not.toHaveBeenCalled();
  });
});