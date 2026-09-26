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

  it("does not read saved personal overlays in Development while frozen", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.REPLIT_DEPLOYMENT;
    mockQuery.mockResolvedValue({ rows: [{ protocol_key: "glp1" }, { protocol_key: "anti_inflammatory" }] });
    expect(await readDevelopmentPersonalFoodSupports("subject-a")).toEqual(new Set());
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("never reads shadow sources from production", async () => {
    process.env.NODE_ENV = "production";
    expect(await readDevelopmentPersonalFoodSupports("subject-a")).toEqual(new Set());
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("cannot activate optional overlays from a failing source query while frozen", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.REPLIT_DEPLOYMENT;
    mockQuery.mockRejectedValue(new Error("source storage unavailable"));
    expect(await readDevelopmentPersonalFoodSupports("subject-a")).toEqual(new Set());
    expect(mockQuery).not.toHaveBeenCalled();
  });
});