import { apiRequest } from "@/lib/queryClient";
import {
  invalidateNutritionPriorityPersonalization,
  loadAdultNutritionPriorities,
  replaceAdultNutritionPriorities,
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

  it("invalidates the existing nutrition personalization cache after save", async () => {
    const invalidateQueries = jest.fn().mockResolvedValue(undefined);
    await invalidateNutritionPriorityPersonalization({ invalidateQueries } as any, "adult-a");
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["nutrition-priorities", "adult", "adult-a"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["nutrition-summary"] });
  });
});
