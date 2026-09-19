import fs from "fs";
import path from "path";
import {
  getDisplayFeaturesForTier,
  getMinTierForEntitlement,
  IOS_DISPLAY_FEATURES,
  tierIncludesEntitlement,
} from "../../shared/planFeatures";

describe("My Perfect Menu Essential access", () => {
  it("begins at Essential and remains included in higher consumer tiers", () => {
    expect(getMinTierForEntitlement("my_perfect_menu")).toBe("basic");
    expect(tierIncludesEntitlement("free", "my_perfect_menu")).toBe(false);
    expect(tierIncludesEntitlement("basic", "my_perfect_menu")).toBe(true);
    expect(tierIncludesEntitlement("premium", "my_perfect_menu")).toBe(true);
    expect(tierIncludesEntitlement("ultimate", "my_perfect_menu")).toBe(true);
  });

  it("appears in Essential subscription copy on web and iOS", () => {
    expect(getDisplayFeaturesForTier("basic").some((feature) => feature.includes("My Perfect Menu"))).toBe(true);
    expect(IOS_DISPLAY_FEATURES.basic.some((feature) => feature.includes("My Perfect Menu"))).toBe(true);
  });

  it("uses Essential access guards on both server and client", () => {
    const serverRoutes = fs.readFileSync(path.join(process.cwd(), "server/routes.ts"), "utf8");
    const clientRouter = fs.readFileSync(path.join(process.cwd(), "client/src/components/Router.tsx"), "utf8");

    expect(serverRoutes).toContain(
      'app.use("/api/my-perfect-menu", requireAuth, requireEssentialAccess, myPerfectMenuRouter)',
    );
    expect(clientRouter).toContain("const GuardedMyPerfectMenu = () => <PaywallGuard component={MyPerfectMenu} />");
    expect(clientRouter).toContain('<Route path="/foods-i-enjoy" component={GuardedMyPerfectMenu} />');
  });
});