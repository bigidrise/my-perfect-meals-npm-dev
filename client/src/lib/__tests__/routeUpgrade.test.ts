import { openRouteUpgrade } from "../routeUpgrade";

describe("page-level upgrade prompts", () => {
  it.each([
    ["/foods-i-enjoy", "/"],
    ["/saved-meals", "/"],
    ["/select-builder", "/"],
    ["/clinical-labs", "/"],
    ["/lifestyle/dessert-creator", "/lifestyle"],
    ["/lifestyle/beverage-creator", "/lifestyle"],
    ["/lifestyle/sushi-creator", "/lifestyle"],
  ])("leaves %s on an accessible page before showing the modal", (path, expected) => {
    let currentPath = path;
    let open = false;
    const navigate = jest.fn((nextPath: string) => { currentPath = nextPath; });
    const showUpgrade = jest.fn(() => {
      expect(currentPath).toBe(expected);
      open = true;
    });

    openRouteUpgrade(path, navigate, showUpgrade);

    expect(navigate).toHaveBeenCalledWith(expected, { replace: true });
    expect(showUpgrade).toHaveBeenCalledTimes(1);
    expect(open).toBe(true);
    // Close, outside-click, Escape, and Maybe Later all only close this modal.
    open = false;
    expect(currentPath).toBe(expected);
  });

  it("keeps View Plans navigation independent of the safe return page", () => {
    let currentPath = "/foods-i-enjoy";
    openRouteUpgrade(currentPath, path => { currentPath = path; }, () => {});
    currentPath = "/pricing";
    expect(currentPath).toBe("/pricing");
  });
});
