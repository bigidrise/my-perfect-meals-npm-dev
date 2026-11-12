import { PgDialect } from "drizzle-orm/pg-core";
import { oneTouchHistorySchema } from "@shared/oneTouch";
import { refreshOneTouchConceptAuthority } from "../services/oneTouch/history";

let mockDocument: any;
const mockSet = jest.fn();
const mockSelectWhere = jest.fn();
const mockUpdateWhere = jest.fn();
const mockLock = jest.fn();
jest.mock("../db", () => ({
  db: {
    transaction: async (operation: any) => {
      const select = {
        from: () => select,
        where: (condition: any) => { mockSelectWhere(condition); return select; },
        limit: () => select,
        for: async (lock: string) => { mockLock(lock); return [{ value: mockDocument }]; },
      };
      return operation({
        select: () => select,
        update: () => ({
          set: (value: unknown) => {
            mockSet(value);
            return { where: async (condition: any) => { mockUpdateWhere(condition); } };
          },
        }),
      });
    },
  },
}));

const concept = (n: number) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  title: `Tomato Lentil Stew ${n}`, description: "A tomato and lentil stew.",
  primaryIngredients: ["tomatoes", "lentils"], primaryProtein: "lentils",
  produceItems: ["tomatoes"], cuisine: "Italian", dietaryEvidence: [],
  preparationMethod: "simmered", signature: `lentil-stew-${n}`, occasion: "lunch",
  culinaryIdentity: {
    dishForm: "stew", preparationStyle: "simmered", temperature: "hot",
    primaryProteinBase: "lentils", majorStarchBase: null, flavorFamily: "tomato",
    cuisineEvidence: "Italian", definingComponents: ["tomatoes", "lentils"],
  },
});
beforeEach(() => {
  jest.clearAllMocks();
  mockDocument = oneTouchHistorySchema.parse({
    version: 1, create_a_dish: [], craving_creator: [],
    ideaHistory: { create_a_dish: [], craving_creator: [] },
    workingSets: Object.fromEntries(["create_a_dish", "craving_creator"].map(creator => [creator, {
      request: { creator, servings: 2, cuisine: { mode: "profile" }, eatingStyle: { mode: "profile" } },
      contextFingerprint: "a".repeat(43), concepts: [1, 2, 3].map(concept),
    }])),
  });
});
test("locks the exact account and updates only the saved set's authority, not ideas or history", async () => {
  const before = structuredClone(mockDocument);
  expect(await refreshOneTouchConceptAuthority(
    "person-a", "create_a_dish", before.workingSets.create_a_dish, "b".repeat(43),
  )).toBe(true);
  const expected = structuredClone(before);
  expected.workingSets.create_a_dish.contextFingerprint = "b".repeat(43);
  expect(mockSet).toHaveBeenCalledWith({ oneTouchHistory: expected });
  expect(mockLock).toHaveBeenCalledWith("update");
  const dialect = new PgDialect();
  expect(dialect.sqlToQuery(mockSelectWhere.mock.calls[0][0]).params).toEqual(["person-a"]);
  expect(dialect.sqlToQuery(mockUpdateWhere.mock.calls[0][0]).params).toEqual(["person-a"]);
});
test.each(["fingerprint", "request", "concept"])("never overwrites a Menu changed concurrently in %s", async change => {
  const expected = structuredClone(mockDocument.workingSets.create_a_dish);
  if (change === "fingerprint") mockDocument.workingSets.create_a_dish.contextFingerprint = "c".repeat(43);
  if (change === "request") mockDocument.workingSets.create_a_dish.request.servings = 3;
  if (change === "concept") mockDocument.workingSets.create_a_dish.concepts[0].title = "Another saved dish";
  expect(await refreshOneTouchConceptAuthority("person-a", "create_a_dish", expected, "b".repeat(43))).toBe(false);
  expect(mockSet).not.toHaveBeenCalled();
});
