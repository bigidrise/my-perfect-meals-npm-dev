import { normalizeBoardSlotForMacroLog } from "@/lib/mealSlots";

describe("normalizeBoardSlotForMacroLog", () => {
  it.each(["meal4", "meal5", "meal6"] as const)(
    "logs %s under the supported snacks macro category",
    (slot) => {
      expect(normalizeBoardSlotForMacroLog(slot)).toBe("snacks");
    },
  );
});