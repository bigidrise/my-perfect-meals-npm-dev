import React from "react";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { DemoStore, freshDemo, validateDemoState } from "../state";
import { demoRequest } from "../adapter";
import { demoDestination, DEMO_ROUTES } from "../navigation";
import { canAccessMealBuilders, isProOrAbove, isClinicalOrAbove } from "@/lib/subscriptionCheck";

const routerSource = readFileSync("client/src/components/Router.tsx", "utf8");
const ast = ts.createSourceFile("Router.tsx", routerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

describe("approved shared routing boundary", () => {
  it("preserves every byte of existing routes, redirects, guards and imports", () => {
    const original = routerSource.split("\n// Additive exports only:")[0];
    expect(createHash("sha256").update(original).digest("hex"))
      .toBe("a5ca095ada0db11a59d1fe7806907f93d7a0a02e61f574376a4e38534f66b84d");
  });
  it("exports only the approved existing page components, never a professional bypass", () => {
    const added = routerSource.split("\n// Additive exports only:")[1];
    const names = [...added.matchAll(/\b(?:Safe\w+|Guarded\w+|LifestyleLandingPage)\b/g)].map(m => m[0]);
    expect(names.sort()).toEqual([
      "SafeOnboarding", "SafeDashboard", "SafeMacroCounter", "GuardedBuilders",
      "GuardedMealBuilderSelection", "LifestyleLandingPage", "SafeMore",
      "GuardedCravingCreatorLanding", "GuardedBeverageCreatorHub",
    ].sort());
    const runtime = readFileSync("client/src/demo-studio/CustomerShell.tsx", "utf8");
    expect(runtime).toContain('from "@/components/Router"');
    expect(runtime).not.toMatch(/import\s+\w+\s+from\s+["']@\/components\/Router/);
    expect(runtime).not.toContain('from "@/pages/');
    expect(runtime).toContain("<CustomerAccessLayout>");
    const composition = readFileSync("client/src/demo-studio/DemoRuntime.tsx", "utf8");
    expect(composition).toMatch(/<React\.Suspense[\s\S]*?<CustomerShell\s*\/>[\s\S]*?<\/React\.Suspense>/);
  });
  it.each([
    ["MealBuildersGuard", canAccessMealBuilders],
    ["ProGuard", isProOrAbove],
    ["ClinicalGuard", isClinicalOrAbove],
  ] as const)("keeps actual %s denial and paid-access behavior", (name, policy) => {
    const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)!;
    const js = ts.transpileModule(node.getText(ast), {
      compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const upgrade = jest.fn();
    const makeGuard = (user: unknown) => new Function(
      "React", "useAuth", "useLocation", "useEffect", "useUpgradeModal",
      "canAccessMealBuilders", "isProOrAbove", "isClinicalOrAbove",
      "openRouteUpgrade", "getFeatureNameFromPath",
      `${js};return ${name};`,
    )(React, () => ({ user }), () => ["/builders", jest.fn()],
      (fn: () => void) => fn(), () => ({ requestUpgrade: upgrade }),
      canAccessMealBuilders, isProOrAbove, isClinicalOrAbove,
      (_path: string, _navigate: unknown, fn: () => void) => fn(), () => "Feature");
    const Page = () => null;
    expect(policy({})).toBe(false);
    expect(makeGuard({})({ component: Page })).toBeNull();
    expect(upgrade).toHaveBeenCalled();
    upgrade.mockClear();
    expect(makeGuard(null)({ component: Page })).toBeNull();
    expect(upgrade).not.toHaveBeenCalled();
    expect(policy(freshDemo("dashboard").user)).toBe(true);
    expect(makeGuard(freshDemo("dashboard").user)({ component: Page }).type).toBe(Page);
    expect(upgrade).not.toHaveBeenCalled();
  });
});

describe("one connected Group 1 session", () => {
  const request = async (s: DemoStore, path: string, method = "GET", body?: unknown) => {
    const result = await demoRequest(s, path, { method, body: body ? JSON.stringify(body) : undefined });
    return { status: result.status, data: await result.json() };
  };
  it("enters the actual Dashboard with a returning synthetic seed, not a new identity per page", () => {
    const store = new DemoStore(null);
    expect(store.state.journeyStarted).toBe(false);
    store.enter();
    expect(store.state.path).toBe("/dashboard");
    const user = store.state.user, targets = store.state.targets;
    for (const path of Object.keys(DEMO_ROUTES).filter(p => !p.startsWith("/onboarding"))) {
      store.navigate(path);
      expect(store.state.path).toBe(path);
      expect(store.state.user).toBe(user);
      expect(store.state.targets).toBe(targets);
    }
    store.navigate("/"); store.enter();
    expect(store.state.user).toBe(user);
  });
  it("supports query strings, hashes, replace, back and forward without native history", () => {
    const s = new DemoStore(freshDemo("dashboard"));
    s.navigate("/more?code=synthetic#details");
    s.navigate("?code=changed", { replace: true });
    expect(s.state.path).toBe("/more?code=changed");
    s.navigate("/lifestyle");
    s.travel(-1); expect(s.state.path).toBe("/more?code=changed");
    s.travel(-1); expect(s.state.path).toBe("/dashboard");
    s.travel(1); expect(s.state.path).toBe("/more?code=changed");
    s.navigate("/builders");
    s.travel(1); expect(s.state.path).toBe("/builders");
    const restored = new DemoStore(JSON.parse(JSON.stringify(s.state)));
    restored.travel(-1); expect(restored.state.path).toBe("/more?code=changed");
    expect(demoDestination("/planner?from=dashboard")).toBe("/builders?from=dashboard");
  });
  it.each([
    "/diabetic-hub", "/glp1-hub", "/performance", "/general-nutrition-builder/build",
    "/lifestyle/create-a-dish", "/craving-creator", "/craving-desserts",
    "/lifestyle/beverage-creator", "/pro/clients/real-client", "/business/dashboard",
    "/pricing", "//production.example/dashboard", "javascript:alert(1)",
  ])("blocks unverified or restricted destination %s without leaving its safe page", path => {
    const s = new DemoStore(freshDemo("dashboard"));
    s.navigate(path);
    expect(s.state.path).toBe("/dashboard");
    expect(s.blocked.size).toBe(1);
  });
  it("preserves Coming Soon and rejects a persisted unverified route", () => {
    const s = new DemoStore(freshDemo("dashboard"));
    s.navigate("/lifestyle/my-perfect-pregnancy");
    s.navigate("/lifestyle/pairings-hub");
    expect([...s.blocked].every(v => v.startsWith("Coming Soon"))).toBe(true);
    expect(validateDemoState({ ...s.state, path: "/pro/clients/123" })).toBe(false);
  });
  it("persists ordinary builder selections with matching metadata and bounded switches", async () => {
    const s = new DemoStore(freshDemo("dashboard"));
    const save = (id: string) => request(s, "/api/user/meal-builder", "PATCH", { selectedMealBuilder: id });
    for (const id of ["diabetic", "glp1", "anti_inflammatory", "beach_body"]) {
      expect((await save(id)).status).toBe(200);
      s.navigate("/builders"); s.navigate("/dashboard");
      expect(s.state.user.selectedMealBuilder).toBe(id);
      expect((await request(s, "/api/my-perfect-menu/effective-builder")).data.builderId).toBe(id);
    }
    expect((await save("general_nutrition")).status).toBe(403);
    expect((await save("weekly")).status).toBe(400);
    expect((await request(s, "/api/user/builder-switch-status")).data)
      .toMatchObject({ changesUsed: 4, changesRemaining: 0, isUnlimited: false });
    s.reset("dashboard");
    expect((await request(s, "/api/user/builder-switch-status")).data.changesUsed).toBe(0);
  });
  it("does not let profile saves grant privileges, memberships or unlimited builder changes", async () => {
    const s = new DemoStore(freshDemo("dashboard"));
    await request(s, "/api/users/profile", "PUT", { role: "physician", isAdmin: true,
      professionalRole: "physician", isTester: true, isSandbox: true,
      hasStudioMembership: true, builderSwitchUnlimited: true, builderChangesUsed: -999,
      planLookupKey: "modified", firstName: "Morgan" });
    expect(s.state.user).toMatchObject({ role: "client", isAdmin: false,
      professionalRole: null, isTester: false, isSandbox: false, hasStudioMembership: false,
      planLookupKey: "mpm_ultimate_monthly", firstName: "Morgan" });
    expect(s.state.user.builderSwitchUnlimited).not.toBe(true);
    expect((await request(s, "/api/user/builder-switch-status")).data.changesUsed).toBe(0);
  });
  it("returns only personal/no-professional membership discovery and blocks all service mutations", async () => {
    const s = new DemoStore(freshDemo("dashboard"));
    const availability = (await request(s, "/api/business/workspace/availability")).data.availability;
    expect(availability.personal.available).toBe(true);
    expect(availability.organization.available).toBe(false);
    expect(availability.studio.available).toBe(false);
    expect((await request(s, "/api/auth/mfa/status")).data).toEqual({ mfaEnabled: false, enrolledAt: null });
    expect((await request(s, "/api/certifications/academy-progression")).data).toMatchObject({
      phase1: { complete: false, completed: 0 }, phase2: { complete: false, completed: 0 },
      specialist: { eligible: false, complete: false }, proCare: { eligible: false, complete: false },
    });
    for (const path of ["/api/stripe/studio/checkout", "/api/care-team/connect",
      "/api/performance/mode", "/api/business/workspace/select", "/api/meals/craving-creator",
      "/api/auth/mfa/setup/begin", "/api/certifications/academy/complete"]) {
      await expect(request(s, path, "POST", {})).rejects.toThrow("Not connected");
    }
  });
});
