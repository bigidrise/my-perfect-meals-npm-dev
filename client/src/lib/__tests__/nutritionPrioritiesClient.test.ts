import { apiRequest } from "@/lib/queryClient";
import {
  invalidateNutritionPriorityPersonalization,
  invalidateChildNutritionPriorities,
  loadAdultNutritionPriorities,
  loadChildNutritionPriorities,
  replaceAdultNutritionPriorities,
  replaceChildNutritionPriorities,
} from "@/lib/nutritionPrioritiesClient";

jest.mock("@/lib/queryClient", () => ({
  apiRequest: jest.fn(),
}));

const mockedApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

beforeEach(() => {
  mockedApiRequest.mockReset();
});

describe("adult Nutrition Priorities client", () => {
  it("loads only the authenticated adult endpoint", async () => {
    mockedApiRequest.mockResolvedValueOnce({ document: { selectedPriorityIds: [] } });
    await loadAdultNutritionPriorities();
    expect(mockedApiRequest).toHaveBeenCalledWith("/api/nutrition-priorities");
    expect(mockedApiRequest).not.toHaveBeenCalledWith(expect.stringContaining("/household/"));
    expect(mockedApiRequest).not.toHaveBeenCalledWith(expect.stringContaining("/child/"));
  });

  it("replaces the complete validated document and accepts zero selections", async () => {
    mockedApiRequest.mockResolvedValueOnce({ document: { selectedPriorityIds: [] } });
    await replaceAdultNutritionPriorities([]);
    expect(mockedApiRequest).toHaveBeenCalledWith(
      "/api/nutrition-priorities",
      {
        method: "PUT",
        body: JSON.stringify({
          schemaVersion: 1,
          registryVersion: "nutrition-priorities.v1",
          selectedPriorityIds: [],
        }),
      },
    );
  });

  it("propagates API save failures instead of reporting success", async () => {
    mockedApiRequest.mockRejectedValueOnce(new Error("save unavailable"));
    await expect(replaceAdultNutritionPriorities(["fiber_rich_foods"])).rejects.toThrow("save unavailable");
  });

  it("loads and replaces only the requested child's document", async () => {
    mockedApiRequest
      .mockResolvedValueOnce({ document: { selectedPriorityIds: ["iron_rich_foods"] } })
      .mockResolvedValueOnce({ document: { selectedPriorityIds: [] } });

    await loadChildNutritionPriorities("child-a");
    await replaceChildNutritionPriorities("child-b", []);

    expect(mockedApiRequest).toHaveBeenNthCalledWith(
      1,
      "/api/nutrition-priorities/child/child-a",
    );
    expect(mockedApiRequest).toHaveBeenNthCalledWith(
      2,
      "/api/nutrition-priorities/child/child-b",
      {
        method: "PUT",
        body: JSON.stringify({
          schemaVersion: 1,
          registryVersion: "nutrition-priorities.v1",
          selectedPriorityIds: [],
        }),
      },
    );
  });

  it("invalidates the existing nutrition personalization cache after save", async () => {
    const invalidateQueries = jest.fn().mockResolvedValue(undefined);
    await invalidateNutritionPriorityPersonalization({ invalidateQueries } as any, "adult-a");
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["nutrition-priorities", "adult", "adult-a"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["nutrition-summary"] });
  });

  it("invalidates only the exact actor and child cache identity", async () => {
    const invalidateQueries = jest.fn().mockResolvedValue(undefined);
    await invalidateChildNutritionPriorities(
      { invalidateQueries } as any,
      "parent-a",
      "child-b",
    );
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["nutrition-priorities", "child", "parent-a", "child-b"],
    });
  });
});
