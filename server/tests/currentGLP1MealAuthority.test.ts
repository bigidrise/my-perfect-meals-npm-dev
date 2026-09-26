const query = jest.fn();
jest.mock("../db", () => ({ pool: { query: (...args: unknown[]) => query(...args) } }));

import { resolveCurrentGLP1MealAuthority } from "../services/glp1/currentMealAuthority";

describe("Development GLP-1 meal authority", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalDeployment = process.env.REPLIT_DEPLOYMENT;
  const subject = { id: "subject", selectedMealBuilder: "anti_inflammatory", medicalConditions: ["glp1"] };
  beforeEach(() => {
    process.env.NODE_ENV = "development";
    delete process.env.REPLIT_DEPLOYMENT;
    query.mockReset().mockResolvedValue({ rows: [] });
  });
  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
    else process.env.REPLIT_DEPLOYMENT = originalDeployment;
  });

  it.each(["anti_inflammatory", "diabetic"])("ignores ambiguous and historical legacy data under %s", async (builder) => {
    expect(await resolveCurrentGLP1MealAuthority({ ...subject, selectedMealBuilder: builder })).toEqual([]);
    const [statement, args] = query.mock.calls[0];
    expect(statement).toContain("s.status='active'");
    expect(statement).toContain("s.ended_at IS NULL");
    expect(statement).toContain("s.current_medication_use=true");
    expect(statement).toContain("st.verification_status='verified'");
    expect(args).toEqual(["subject"]);
  });

  it("activates from GLP-1 Builder, then stops when it is left, without editing medical history", async () => {
    const glp1 = { ...subject, selectedMealBuilder: "glp1" };
    expect(await resolveCurrentGLP1MealAuthority(glp1)).toEqual(["selectedMealBuilder"]);
    expect(await resolveCurrentGLP1MealAuthority(subject)).toEqual([]);
    expect(subject.medicalConditions).toEqual(["glp1"]);
  });

  it.each([["provider", "verifiedProvider"], ["medication", "verifiedMedication"]])(
    "keeps a verified current %s source under another Builder", async (source_kind, expected) => {
      query.mockResolvedValue({ rows: [{ source_kind }] });
      expect(await resolveCurrentGLP1MealAuthority(subject)).toEqual([expected]);
      // A historical/inactive source is excluded by the status predicate, not the legacy array.
      query.mockResolvedValue({ rows: [] });
      expect(await resolveCurrentGLP1MealAuthority(subject)).toEqual([]);
    },
  );

  it("does not transfer owner medication or clinician authority to a household member", async () => {
    query.mockResolvedValue({ rows: [{ source_kind: "provider" }] });
    expect(await resolveCurrentGLP1MealAuthority(subject, true)).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it("fails closed if current clinical authority cannot be checked", async () => {
    query.mockRejectedValue(new Error("database unavailable"));
    await expect(resolveCurrentGLP1MealAuthority(subject)).rejects.toThrow("database unavailable");
  });

  it("does not read shadow claims in Production", async () => {
    process.env.NODE_ENV = "production";
    expect(await resolveCurrentGLP1MealAuthority(subject)).toEqual(["medicalConditions"]);
    expect(query).not.toHaveBeenCalled();
  });
});