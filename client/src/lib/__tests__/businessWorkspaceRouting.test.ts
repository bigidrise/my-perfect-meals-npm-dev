import {
  AUTHENTICATED_BUSINESS_WORKSPACE_ROUTES,
  isInAuthenticatedBusinessWorkspace,
} from "../businessWorkspaceRouting";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

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

  it("renders dedicated desktop and mobile Business workspace shells", () => {
    const workspaceLayout = fs.readFileSync(
      path.join(root, "client/src/layout/BusinessWorkspaceLayout.tsx"),
      "utf8",
    );
    expect(workspaceLayout).toContain("<BusinessMobileLayout>{children}</BusinessMobileLayout>");
    expect(workspaceLayout).toContain("<BusinessDesktopLayout>{children}</BusinessDesktopLayout>");
    expect(workspaceLayout).not.toContain("return <>{children}</>");
  });

  it("gives the desktop Organization Hub an explicit page title", () => {
    const desktopHeader = fs.readFileSync(
      path.join(root, "client/src/layout/DesktopHeader.tsx"),
      "utf8",
    );
    expect(desktopHeader).toContain(
      'if (loc === "/business-organizations") return "Organizational Hub";',
    );
  });

  it("gives the mobile shell Business navigation, safe areas, and content clearance without owning scroll", () => {
    const mobileLayout = fs.readFileSync(
      path.join(root, "client/src/layout/BusinessMobileLayout.tsx"),
      "utf8",
    );
    expect(mobileLayout).toContain('data-testid="business-mobile-navigation"');
    expect(mobileLayout).toContain('aria-label="Business workspace navigation"');
    expect(mobileLayout).toContain(
      '"--business-safe-top": "env(safe-area-inset-top, 0px)"',
    );
    expect(mobileLayout).toContain(
      'paddingTop: "var(--business-safe-top)"',
    );
    expect(mobileLayout).toContain(
      'paddingTop: "calc(var(--business-safe-top) + 3.5rem)"',
    );
    expect(mobileLayout).toContain("var(--safe-bottom)");
    expect(mobileLayout).toContain('paddingBottom: "calc(var(--safe-bottom) + 4.75rem)"');
    expect(mobileLayout).not.toMatch(/overflow-y-(auto|scroll)/);
  });

  it("keeps public enrollment routes outside the shell and consumer bottom nav", () => {
    const router = fs.readFileSync(
      path.join(root, "client/src/components/Router.tsx"),
      "utf8",
    );
    expect(router).toContain('"/business/start"');
    expect(router).toContain('"/business/setup"');
    expect(router).toContain('"/business/join"');
    expect(router).toContain('!location.startsWith("/join/business-offer")');
  });

  it("keeps the Business Dashboard responsive-mode dependency defined", () => {
    const dashboard = fs.readFileSync(
      path.join(root, "client/src/pages/BusinessDashboard.tsx"),
      "utf8",
    );
    expect(dashboard).toContain('import { useIsDesktop } from "@/hooks/useIsDesktop"');
    expect(dashboard).toContain("const isDesktop = useIsDesktop();");
    expect(dashboard).toContain("isDesktop={isDesktop}");
  });
});