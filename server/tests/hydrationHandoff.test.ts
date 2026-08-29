import {
  issueHydrationHandoff,
  verifyHydrationHandoff,
} from "../services/hydration/hydrationHandoffService";

describe("Hydration Creator handoffs", () => {
  const priorSecret = process.env.SESSION_SECRET;

  beforeAll(() => {
    process.env.SESSION_SECRET = "hydration-handoff-test-secret";
  });

  afterAll(() => {
    if (priorSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = priorSecret;
  });

  it("binds an expiring handoff to the issuing account", () => {
    const now = new Date("2026-08-29T12:00:00.000Z");
    const issued = issueHydrationHandoff({
      userId: "user-a",
      door: "athletic",
      description: "Recovery emphasis after a long run.",
      now,
    });

    expect(
      verifyHydrationHandoff({
        token: issued.token,
        userId: "user-a",
        now: new Date("2026-08-29T12:05:00.000Z"),
      }),
    ).toMatchObject({
      userId: "user-a",
      door: "athletic",
      description: "Recovery emphasis after a long run.",
    });
    expect(() =>
      verifyHydrationHandoff({
        token: issued.token,
        userId: "user-b",
        now,
      }),
    ).toThrow("HYDRATION_HANDOFF_WRONG_ACCOUNT");
    expect(() =>
      verifyHydrationHandoff({
        token: issued.token,
        userId: "user-a",
        now: new Date("2026-08-29T12:31:00.000Z"),
      }),
    ).toThrow("HYDRATION_HANDOFF_EXPIRED");
  });

  it("rejects a tampered payload", () => {
    const issued = issueHydrationHandoff({
      userId: "user-a",
      door: "everyday",
      description: "Simple reminder-friendly drink.",
    });
    const [payload, signature] = issued.token.split(".");

    expect(() =>
      verifyHydrationHandoff({
        token: `${payload}x.${signature}`,
        userId: "user-a",
      }),
    ).toThrow("HYDRATION_HANDOFF_INVALID");
  });
});