const state = {
  ownedHousehold: false,
  professionalAccess: false,
  professionalFailure: false,
  crossOrg: false,
  householdFailure: false,
  organizationFailure: false,
};

jest.mock("../db", () => ({
  db: {
    select: () => ({
      from: (table: any) => ({
        where: () => ({
          limit: async () => {
            const name = table?.[Symbol.for("drizzle:Name")] ?? table?._?.name;
            if (name === "household_profiles") {
              if (state.householdFailure) throw new Error("database unavailable");
              return state.ownedHousehold ? [{ id: "household-a" }] : [];
            }
            if (state.crossOrg) {
              return [
                { id: "physician-a", organizationId: "org-a" },
                { id: "client-a", organizationId: "org-b" },
              ];
            }
            if (state.organizationFailure) throw new Error("organization lookup unavailable");
            return [
              { id: "physician-a", organizationId: null },
              { id: "client-a", organizationId: null },
              { id: "user-a", organizationId: null },
              { id: "user-b", organizationId: null },
            ];
          },
        }),
      }),
    }),
  },
}));

jest.mock("../services/procareAccessService", () => ({
  verifyPhysicianClientAccess: jest.fn(async () => {
    if (state.professionalFailure) throw new Error("database unavailable");
    if (state.crossOrg) {
      throw Object.assign(new Error("cross-org denial"), {
        code: "ORG_ISOLATION_VIOLATION",
      });
    }
    return state.professionalAccess;
  }),
}));

import { assertHumanFoodSubjectAccess } from "../services/humanFoodContext/resolveHumanFoodContext";

beforeEach(() => {
  state.ownedHousehold = false;
  state.professionalAccess = false;
  state.professionalFailure = false;
  state.crossOrg = false;
  state.householdFailure = false;
  state.organizationFailure = false;
});

describe("Human Food Context subject authorization", () => {
  it("allows self, owned household, and verified professional subjects", async () => {
    await expect(assertHumanFoodSubjectAccess("user-a", "user-a")).resolves.toBeUndefined();
    state.ownedHousehold = true;
    await expect(assertHumanFoodSubjectAccess("owner-a", "household-a")).resolves.toBeUndefined();
    state.ownedHousehold = false;
    state.professionalAccess = true;
    await expect(assertHumanFoodSubjectAccess("physician-a", "client-a")).resolves.toBeUndefined();
  });

  it("does not resolve another adult without explicit authorization", async () => {
    await expect(assertHumanFoodSubjectAccess("user-a", "user-b")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("fails closed but distinguishes an operational authorization failure", async () => {
    state.professionalFailure = true;
    await expect(assertHumanFoodSubjectAccess("physician-a", "client-a")).rejects.toMatchObject({
      status: 503,
    });
    state.professionalFailure = false;
    state.householdFailure = true;
    await expect(assertHumanFoodSubjectAccess("owner-a", "household-a")).rejects.toMatchObject({
      status: 503,
    });
    state.householdFailure = false;
    state.organizationFailure = true;
    await expect(assertHumanFoodSubjectAccess("physician-a", "client-a")).rejects.toMatchObject({
      status: 503,
    });
  });

  it("keeps cross-organization denials indistinguishable from missing subjects", async () => {
    state.crossOrg = true;
    await expect(assertHumanFoodSubjectAccess("physician-a", "client-a")).rejects.toMatchObject({
      status: 404,
    });
  });
});