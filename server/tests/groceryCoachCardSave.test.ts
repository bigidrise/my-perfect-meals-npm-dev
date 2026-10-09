const mockFind = jest.fn();
const mockReturn = jest.fn();
const mockConflict = jest.fn(() => ({ returning: mockReturn }));
const mockValues = jest.fn(() => ({ onConflictDoNothing: mockConflict }));
const mockInsert = jest.fn(() => ({ values: mockValues }));
jest.mock("../db", () => ({
  db: {
    select: () => ({ from: () => ({ where: () => ({ limit: mockFind }) }) }),
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));
import { saveGroceryCardOnce } from "../services/groceryCoachCardSave";
import { savedMeals } from "../db/schema/savedMeals";

const row = {
  userId: "test-user", title: "Dinner", sourceType: "grocery-coach",
  signatureHash: "same-recommendation", mealData: { name: "Dinner" },
};
beforeEach(() => jest.clearAllMocks());

it("reuses an already saved Favorite without another insert", async () => {
  mockFind.mockResolvedValueOnce([{ id: "existing" }]);
  expect(await saveGroceryCardOnce(row)).toBe("existing");
  expect(mockInsert).not.toHaveBeenCalled();
});
it("saves a new card with the existing account-scoped unique constraint", async () => {
  mockFind.mockResolvedValueOnce([]);
  mockReturn.mockResolvedValueOnce([{ id: "new" }]);
  expect(await saveGroceryCardOnce(row)).toBe("new");
  expect(mockConflict).toHaveBeenCalledWith({
    target: [savedMeals.userId, savedMeals.signatureHash],
  });
  expect(mockValues).toHaveBeenCalledWith(row);
});
it("recovers the winner of a concurrent save instead of failing or duplicating", async () => {
  mockFind.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "other-tab" }]);
  mockReturn.mockResolvedValueOnce([]);
  expect(await saveGroceryCardOnce(row)).toBe("other-tab");
  expect(mockInsert).toHaveBeenCalledTimes(1);
});
it("does not report a ready card when its save cannot be confirmed", async () => {
  mockFind.mockResolvedValue([]);
  mockReturn.mockResolvedValueOnce([]);
  await expect(saveGroceryCardOnce(row)).rejects.toThrow("could not be confirmed");
});
