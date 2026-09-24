const mockQuery = jest.fn();
jest.mock("../db", () => ({ pool: { query: (...args: unknown[]) => mockQuery(...args) } }));
import { readDevelopmentPersonalFoodSupports } from "../services/healthProtocols/developmentFoodSupports";

describe("Development personal support food authority", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalDeployment = process.env.REPLIT_DEPLOYMENT;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalDeployment === undefined) delete process.env.REPLIT_DEPLOYMENT;
    else process.env.REPLIT_DEPLOYMENT = originalDeployment;
    jest.clearAllMocks();
  });

  it("only reads active, explicitly subject-owned personal support", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.REPLIT_DEPLOYMENT;
    mockQuery.mockResolvedValue({ rows: [{ protocol_key: "glp1" }, { protocol_key: "anti_inflammatory" }] });
    expect(await readDevelopmentPersonalFoodSupports("subject-a")).toEqual(new Set(["glp1", "anti_inflammatory"]));
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("source_kind='user'");
    expect(sql).toContain("status='active'");
    expect(sql).toContain("evidence_ref='personal_support'");
    expect(params).toEqual(["subject-a"]);
  });

  it("never reads shadow sources from production", async () => {
    process.env.NODE_ENV = "production";
    expect(await readDevelopmentPersonalFoodSupports("subject-a")).toEqual(new Set());
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("fails rather than silently omitting a claimed active support when its source query fails", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.REPLIT_DEPLOYMENT;
    mockQuery.mockRejectedValue(new Error("source storage unavailable"));
    await expect(readDevelopmentPersonalFoodSupports("subject-a")).rejects.toThrow("source storage unavailable");
  });
});