import { buildPediatricHumanFoodContext } from "../services/humanFoodContext/pediatricContextAdapter";
import { FOOD_INCLUSION_PRIORITY_REGISTRY } from "../../shared/nutritionPriorities";

const base = {
  actorUserId: "parent-a",
  correlationId: "corr-a",
  resolverContext: null,
  allergies: [],
};

describe("Pediatric Nutrition Priorities context isolation", () => {
  beforeAll(() => {
    process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-session-secret";
  });

  it("binds each child's own priority document into context identity", () => {
    const childA = buildPediatricHumanFoodContext({
      ...base,
      subjectId: "child-a",
      foodInclusionPriorities: {
        schemaVersion: 1,
        registryVersion: "nutrition-priorities.v1",
        selectedPriorityIds: ["fiber_rich_foods"],
        updatedAt: "2026-09-21T00:00:00.000Z",
      },
    });
    const childB = buildPediatricHumanFoodContext({
      ...base,
      subjectId: "child-b",
      foodInclusionPriorities: {
        schemaVersion: 1,
        registryVersion: "nutrition-priorities.v1",
        selectedPriorityIds: ["calcium_rich_foods"],
        updatedAt: "2026-09-21T00:00:00.000Z",
      },
    });
    expect(childA.nutritionPriorities?.selectedPriorityIds).toEqual(["fiber_rich_foods"]);
    expect(childB.nutritionPriorities?.selectedPriorityIds).toEqual(["calcium_rich_foods"]);
    expect(childA.internalFingerprint).not.toBe(childB.internalFingerprint);
  });

  it("treats missing or invalid child documents as empty instead of inheriting adult data", () => {
    const child = buildPediatricHumanFoodContext({
      ...base,
      subjectId: "child-a",
      foodInclusionPriorities: null,
    });
    expect(child.nutritionPriorities?.selectedPriorityIds).toEqual([]);
  });

  it("removes a stored concept if its pediatric projection is no longer approved", () => {
    const definition = FOOD_INCLUSION_PRIORITY_REGISTRY.fermented_foods;
    const previousStatus = definition.pediatricProjection.status;
    definition.pediatricProjection.status = "deferred";
    try {
      const child = buildPediatricHumanFoodContext({
        ...base,
        subjectId: "child-a",
        foodInclusionPriorities: {
          schemaVersion: 1,
          registryVersion: "nutrition-priorities.v1",
          selectedPriorityIds: ["fermented_foods"],
          updatedAt: "2026-09-21T00:00:00.000Z",
        },
      });
      expect(child.nutritionPriorities?.selectedPriorityIds).toEqual([]);
    } finally {
      definition.pediatricProjection.status = previousStatus;
    }
  });
});