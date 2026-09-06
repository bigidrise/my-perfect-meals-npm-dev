import {
  _resetTokenStoreForTesting,
  claimAdvisoryOverrideToken,
  commitAdvisoryOverrideToken,
  issueAdvisoryOverrideToken,
  rollbackAdvisoryOverrideToken,
} from "../services/safetyPinService";

describe("food governance advisory override tokens", () => {
  beforeEach(() => {
    _resetTokenStoreForTesting();
  });

  it("binds a token to the authenticated user, exact request, and exact advisory", () => {
    const token = issueAdvisoryOverrideToken(
      "user-a",
      "avoidance:pork",
      "pork",
      "Pork Chop",
    );

    expect(claimAdvisoryOverrideToken(token, "user-b", "Pork Chop")).toBeNull();
    expect(claimAdvisoryOverrideToken(token, "user-a", "Chicken")).toBeNull();
    expect(claimAdvisoryOverrideToken(token, "user-a", "  pork   chop ")).toMatchObject({
      userId: "user-a",
      reasonCode: "avoidance:pork",
      matchedTerm: "pork",
    });
  });

  it("is single-use after the generation request commits it", () => {
    const token = issueAdvisoryOverrideToken(
      "user-a",
      "avoidance:pork",
      "pork",
      "Pork Chop",
    );

    expect(claimAdvisoryOverrideToken(token, "user-a", "Pork Chop")).not.toBeNull();
    commitAdvisoryOverrideToken(token);
    expect(claimAdvisoryOverrideToken(token, "user-a", "Pork Chop")).toBeNull();
  });

  it("can be restored only when audit persistence fails", () => {
    const token = issueAdvisoryOverrideToken(
      "user-a",
      "avoidance:pork",
      "pork",
      "Pork Chop",
    );

    expect(claimAdvisoryOverrideToken(token, "user-a", "Pork Chop")).not.toBeNull();
    rollbackAdvisoryOverrideToken(token);
    expect(claimAdvisoryOverrideToken(token, "user-a", "Pork Chop")).not.toBeNull();
  });

  it("rejects an expired token", () => {
    const now = jest.spyOn(Date, "now");
    now.mockReturnValue(1_000);
    const token = issueAdvisoryOverrideToken(
      "user-a",
      "dietary_identity:vegan",
      "steak",
      "Steak",
    );
    now.mockReturnValue(1_000 + 5 * 60 * 1000 + 1);

    expect(claimAdvisoryOverrideToken(token, "user-a", "Steak")).toBeNull();
    now.mockRestore();
  });
});