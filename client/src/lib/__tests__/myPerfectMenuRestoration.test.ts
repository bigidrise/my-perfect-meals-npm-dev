import { shouldGenerateMissingMyPerfectMenuCategory } from "../myPerfectMenuRestoration";

describe("My Perfect Menu restoration failure semantics", () => {
  it.each(["loading", "failed"] as const)(
    "does not generate replacements when restoration is %s",
    (status) => {
      expect(shouldGenerateMissingMyPerfectMenuCategory(status, 0)).toBe(false);
    },
  );

  it("allows generation only after an authoritative successful empty response", () => {
    expect(shouldGenerateMissingMyPerfectMenuCategory("succeeded", 0)).toBe(true);
  });

  it("never generates when a successful restore contains the persisted set", () => {
    expect(shouldGenerateMissingMyPerfectMenuCategory("succeeded", 3)).toBe(false);
  });
});