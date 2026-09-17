import {
  AUTHENTICATED_BUSINESS_WORKSPACE_ROUTES,
  isInAuthenticatedBusinessWorkspace,
} from "../businessWorkspaceRouting";

describe("authenticated Business workspace routing", () => {
  it.each(AUTHENTICATED_BUSINESS_WORKSPACE_ROUTES)(
    "uses the Business workspace shell for %s",
    (route) => {
      expect(isInAuthenticatedBusinessWorkspace(route)).toBe(true);
    },
  );

  it.each([
    "/business-center",
    "/business-center/academy",
    "/business-center/partners/manage",
    "/business-center/promotions",
  ])("uses the Business workspace shell for %s", (route) => {
    expect(isInAuthenticatedBusinessWorkspace(route)).toBe(true);
  });

  it.each([
    "/business/start",
    "/business/setup",
    "/business/join",
    "/join/business-offer",
    "/dashboard",
  ])("does not wrap the standalone flow %s", (route) => {
    expect(isInAuthenticatedBusinessWorkspace(route)).toBe(false);
  });
});