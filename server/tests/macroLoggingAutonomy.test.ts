import { db } from "../db";
import macroRouter from "../routes/macroLogs";

jest.mock("../db", () => ({ db: { insert: jest.fn() } }));

describe("explicit consumption retains actual over-target nutrition", () => {
  it("records 60g starch and 800 kcal without reading or clamping daily targets", async () => {
    const actual = {
      kcal: 800, protein: 40, carbs: 80, fat: 25, fiber: 6,
      starchyCarbs: 60, fibrousCarbs: 14, alcohol: 0,
    };
    const values = jest.fn().mockImplementation(row => ({
      returning: async () => [row],
    }));
    (db.insert as jest.Mock).mockReturnValue({ values });
    const layer = (macroRouter as any).stack.find((entry: any) =>
      entry.route?.path === "/macros" && entry.route.methods.post,
    );
    const handler = layer.route.stack[layer.route.stack.length - 1].handle;
    const res = { json: jest.fn(), status: jest.fn() };
    res.status.mockReturnValue(res);
    await handler({
      authUser: { id: "test-subject" },
      body: { ...actual, dailyStarchTarget: 50, dailyCalorieTarget: 500 },
    }, res);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      userId: "test-subject", kcal: "800", protein: "40", carbs: "80",
      fat: "25", starchyCarbs: "60", fibrousCarbs: "14",
    }));
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      kcal: "800", starchyCarbs: "60",
    }));
  });
});
