import { menuFailureMessage } from "@shared/menuFailureMessage";

describe("Menu failure availability messaging", () => {
  const error = "We couldn't complete three compatible ideas this time.";
  it("only promises availability for compatible choices", () => {
    expect(menuFailureMessage(error, "compatible")).toContain("compatible choices are still available");
  });
  it("explains why stale saved choices are withheld", () => {
    expect(menuFailureMessage(error, "stale")).toContain("withheld because their food context is no longer current");
    expect(menuFailureMessage(error, "stale")).not.toContain("still available");
  });
  it("distinguishes no previous choices from unavailable stale choices", () => {
    expect(menuFailureMessage(error, "none")).toContain("No previous choices are available");
    expect(menuFailureMessage(error)).toBe(error);
  });
});
