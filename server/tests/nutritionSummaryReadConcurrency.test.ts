// No database, authentication state, nutrition records or providers are touched.
jest.mock("../db", () => ({ db: { select: jest.fn() } }));
jest.mock("../services/protocolEnvelope", () => ({ loadUserProtocolEnvelope: jest.fn() }));
jest.mock("../services/nutritionSummary/buildNutritionSummary", () => ({ buildNutritionSummary: jest.fn() }));

import { db } from "../db";
import { loadUserProtocolEnvelope } from "../services/protocolEnvelope";
import { buildNutritionSummary } from "../services/nutritionSummary/buildNutritionSummary";
import { loadSelfNutritionSummary } from "../services/nutritionSummary/loadSelfSummary";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => jest.resetAllMocks());

test.each([false, true])("independent reads start before the envelope resolves (daily=%s)", async daily => {
  const envelope = deferred<any>();
  const user = deferred<any[]>();
  const glucose = deferred<any[]>();
  (loadUserProtocolEnvelope as jest.Mock).mockReturnValue(envelope.promise);
  let read = 0;
  (db.select as jest.Mock).mockImplementation(() => {
    const result = read++ === 0 ? user.promise : glucose.promise;
    const query: any = { from: jest.fn(() => query), where: jest.fn(() => query), orderBy: jest.fn(() => query), limit: jest.fn(() => result) };
    return query;
  });
  (buildNutritionSummary as jest.Mock).mockReturnValue({ authoritative: true });
  const pending = loadSelfNutritionSummary("synthetic-self", daily);
  expect(db.select).toHaveBeenCalledTimes(daily ? 2 : 1);
  expect(buildNutritionSummary).not.toHaveBeenCalled();
  envelope.resolve({ dietaryIdentity: ["vegetarian"] });
  user.resolve([{ dailyCalorieTarget: 1900, dailyProteinTarget: 110, selectedMealBuilder: "diabetic" }]);
  glucose.resolve([{ value: 140 }]);
  expect(await pending).toEqual({ authoritative: true });
  expect(buildNutritionSummary).toHaveBeenCalledWith(
    { dietaryIdentity: ["vegetarian"] },
    expect.objectContaining({ dailyCalorieTarget: 1900, dailyProteinTarget: 110, latestGlucose: daily ? 140 : null, selectedMealBuilder: "diabetic" }),
    { includeDayContext: daily },
  );
});

test("a read failure rejects instead of manufacturing nutrition defaults", async () => {
  (loadUserProtocolEnvelope as jest.Mock).mockResolvedValue({});
  const query: any = { from: () => query, where: () => query, limit: () => Promise.reject(new Error("database unavailable")) };
  (db.select as jest.Mock).mockReturnValue(query);
  await expect(loadSelfNutritionSummary("synthetic-self", false)).rejects.toThrow("database unavailable");
  expect(buildNutritionSummary).not.toHaveBeenCalled();
});

test("missing envelope still returns no summary", async () => {
  (loadUserProtocolEnvelope as jest.Mock).mockResolvedValue(null);
  const query: any = { from: () => query, where: () => query, limit: () => Promise.resolve([]) };
  (db.select as jest.Mock).mockReturnValue(query);
  expect(await loadSelfNutritionSummary("synthetic-self", false)).toBeNull();
  expect(buildNutritionSummary).not.toHaveBeenCalled();
});
