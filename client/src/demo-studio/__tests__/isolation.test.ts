import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { buildSync } from "esbuild";
import { permitsDemoIdentity, assertSyntheticIdentity, type DemoAuthority } from "../authority";
import { DemoStore, freshDemo, computeDemoMacros, validateDemoState } from "../state";
import { demoRequest, UnsupportedDemoRequest } from "../adapter";
import { DemoMemoryStorage } from "../isolation";
import { makeDemoDocument } from "../frameDocument";
import { foodInclusionPrioritiesDocumentSchema } from "@shared/nutritionPriorities";
import { parsePersonalJourneyProgress } from "@/lib/guidedJourney/progress";

jest.mock("../runtimeAuthority", () => ({ assertIsolatedDemoRuntime: jest.fn() }));
jest.mock("@/lib/apiRequest", () => ({ apiRequest: jest.fn() }));

const accepted: DemoAuthority = {
  development: true, production: false, mode: "development",
  childFrame: true, opaqueOrigin: true, srcDoc: true, marker: true,
};
describe("synthetic identity authority", () => {
  it("requires the complete isolated Development runtime", () => {
    expect(permitsDemoIdentity(accepted)).toBe(true);
    for (const patch of [
      { development: false }, { production: true }, { mode: "production" },
      { mode: "test" }, { childFrame: false }, { opaqueOrigin: false },
      { srcDoc: false }, { marker: false },
    ]) expect(permitsDemoIdentity({ ...accepted, ...patch })).toBe(false);
  });
  it("rejects live, null, administrator, and professional identities", () => {
    const user = freshDemo().user;
    expect(() => assertSyntheticIdentity(user)).not.toThrow();
    for (const u of [null, { ...user, id: "real-user" }, { ...user, email: "real@example.com" },
      { ...user, isAdmin: true }, { ...user, isFounder: true }, { ...user, role: "coach" },
      { ...user, professionalRole: "physician" }]) expect(() => assertSyntheticIdentity(u)).toThrow();
  });
  it.each([true, false])("checks the actual compiled runtime guard (production=%s)", production => {
    const result = buildSync({
      entryPoints: ["client/src/demo-studio/runtimeAuthority.ts"], bundle: true,
      write: false, platform: "node", format: "cjs",
      define: { "import.meta.env": JSON.stringify({
        DEV: !production, PROD: production, MODE: production ? "production" : "development",
      }) },
    });
    const module = { exports: {} as { assertIsolatedDemoRuntime: () => void } };
    runInNewContext(result.outputFiles![0].text, { module, exports: module.exports,
      window: { parent: {}, origin: "null", location: { href: "about:srcdoc" } },
      document: { URL: "about:srcdoc", querySelector: () => ({ getAttribute: () => "phase-1" }) },
    });
    if (production) expect(() => module.exports.assertIsolatedDemoRuntime()).toThrow("Development");
    else expect(() => module.exports.assertIsolatedDemoRuntime()).not.toThrow();
  });
});
describe("connected synthetic journey", () => {
  let store: DemoStore;
  const request = async (url: string, method = "GET", body?: unknown) =>
    (await demoRequest(store, url, { method, ...(body ? { body: JSON.stringify(body) } : {}) })).json();
  beforeEach(() => { store = new DemoStore(freshDemo("onboarding")); });
  it("saves onboarding, then macro targets, and preserves them through dashboard navigation", async () => {
    await request("/api/users/profile", "PUT", { firstName: "Morgan", lastName: "Demo", goalType: "lose" });
    await request("/api/user/complete-onboarding", "POST");
    store.navigate("/macro-counter?from=onboarding");
    expect(JSON.parse(store.state.local["macro_calculator_settings::development::demo-studio-user"]))
      .toMatchObject({ goal: "loss", units: "imperial", age: 42, sex: "male" });
    const result = await request("/api/macro-calculator/compute", "POST", {
      age: 40, kg: 80, cm: 175, sex: "female", goal: "loss", activity: "moderate",
    });
    const targets = { calories: result.target, protein_g: result.macros.protein.g,
      carbs_g: result.macros.carbs.g, fat_g: result.macros.fat.g };
    await request("/api/users/demo-studio-user/macro-targets", "PUT", targets);
    store.navigate("/dashboard");
    expect(store.state.workflow).toBe("dashboard");
    expect((await request("/api/user/profile")).firstName).toBe("Morgan");
    expect((await request("/api/user/profile")).name).toBe("Morgan Demo");
    expect((await request("/api/user/profile")).onboardingCompletedAt).toBeTruthy();
    expect(await request("/api/users/demo-studio-user/macro-targets")).toMatchObject({ ...targets, hasTargets: true });
    store.navigate("/"); store.navigate("/macro-counter");
    expect(store.state.targets).toEqual(targets);
    const restored = new DemoStore(JSON.parse(JSON.stringify(store.state)));
    expect(restored.state.user.firstName).toBe("Morgan");
    expect(restored.state.targets).toEqual(targets);
  });
  it("never grants identity or role changes through synthetic save payloads", async () => {
    await request("/api/users/profile", "PUT", {
      id: "real-user", email: "live@example.com", role: "admin", isAdmin: true,
      isFounder: true, professionalRole: "physician",
    });
    expect(store.state.user.id).toBe("demo-studio-user");
    expect(() => assertSyntheticIdentity(store.state.user)).not.toThrow();
  });
  it("resets all synthetic data without reusing prior storage or caches", async () => {
    await request("/api/users/profile", "PUT", { firstName: "Morgan" });
    store.state.local.draft = "old"; store.state.session.resume = "step 4";
    store.reset("macro");
    expect(store.state.user.firstName).toBe("Demo");
    expect(store.state.local.draft).toBeUndefined();
    expect(store.state.session.resume).toBeUndefined();
    expect(store.state.workflow).toBe("macro");
    store.reset(null); expect(store.state.workflow).toBeNull();
    expect(store.state.targets).toBeNull();
  });
  it("rejects invalid restored state and foreign identity", () => {
    expect(validateDemoState({ ...freshDemo(), user: { id: "real-user" } })).toBe(false);
    expect(new DemoStore({ user: { id: "real-user" } }).state.user.id).toBe("demo-studio-user");
  });
  it("confirms fresh macro state has no saved targets, rather than an invalid null response", async () => {
    expect(await request("/api/users/demo-studio-user/macro-targets")).toEqual({ hasTargets: false });
  });
  it("accepts the reserved synthetic URL used by the real URL helper without real network I/O", async () => {
    expect(await request("https://demo.invalid/api/user/profile")).toMatchObject({ id: "demo-studio-user" });
    expect(await request("/api/auth/csrf")).toEqual({ csrfToken: "synthetic-demo-not-a-live-credential" });
  });
  it("supplies the real onboarding priority-document contract and synthetic PIN completion", async () => {
    const priorities = await request("/api/nutrition-priorities");
    expect(foodInclusionPrioritiesDocumentSchema.safeParse(priorities.document).success).toBe(true);
    expect(priorities.document.selectedPriorityIds).toEqual([]);
    await request("/api/safety-pin/set", "POST", { pin: "9876" });
    expect(JSON.stringify(store.state)).not.toContain("9876");
  });
  it("supplies real dashboard summary structure from the same saved targets", async () => {
    const targets = { calories: 2100, protein_g: 150, carbs_g: 225, fat_g: 66 };
    await request("/api/users/demo-studio-user/macro-targets", "PUT", targets);
    const summary = await request("/api/nutrition-summary/baseline");
    expect(summary.activeInputs.macros).toMatchObject({ calories: 2100, proteinG: 150, carbsG: 225, fatG: 66 });
    expect(summary.activeInputs.health).toEqual([]);
    expect(summary.hasAnyActiveProtocol).toBe(false);
    store.patchUser({ fitnessGoal: "gain" });
    expect((await request("/api/nutrition-summary/baseline")).activeInputs.goal).toBe("gain");
    expect((await request("/api/nutrition-summary/dynamic")).liveMetrics).toEqual([]);
  });
  it("supplies authoritative-shaped synthetic setup progress and empty body composition", async () => {
    const initial = parsePersonalJourneyProgress(await request("/api/guided-journey/progress"), store.state.user.id);
    expect(initial.nextStep).toBe("get_to_know_you");
    await request("/api/user/complete-onboarding", "POST");
    await request("/api/users/demo-studio-user/macro-targets", "PUT",
      { calories: 2100, protein_g: 150, carbs_g: 225, fat_g: 66 });
    const complete = parsePersonalJourneyProgress(await request("/api/guided-journey/progress"), store.state.user.id);
    expect(complete.status).toBe("complete");
    expect(await request("/api/users/demo-studio-user/body-composition/latest")).toMatchObject({ entry: null });
  });
});
describe("fail-closed data boundary", () => {
  const store = new DemoStore(freshDemo());
  it.each([
    ["/api/billing/checkout", "POST"], ["/api/ai/generate", "POST"],
    ["/api/uploads", "POST"], ["/api/email/send", "POST"],
    ["/api/users/real-user/macro-targets", "GET"],
    ["https://production.example/api/users/profile", "PUT"],
    ["//production.example/api/users/profile", "GET"],
    ["/api/unknown", "GET"],
  ])("rejects %s without a live fallback", async (url, method) => {
    await expect(demoRequest(store, url, { method })).rejects.toBeInstanceOf(UnsupportedDemoRequest);
  });
  it("blocks unsupported navigation", () => {
    store.navigate("/checkout");
    expect(store.state.workflow).toBeNull();
    expect([...store.blocked]).toContain("Navigation outside Phase 1: /checkout");
  });
  it("uses only memory for the Storage API, including clear", () => {
    let data = { sample: "synthetic" } as Record<string, string>;
    const changed = jest.fn();
    const storage = new DemoMemoryStorage(() => data, changed);
    expect(storage.getItem("realUserId")).toBeNull();
    expect(storage.getItem("constructor")).toBeNull();
    storage.setItem("draft", "demo"); expect(storage.length).toBe(2);
    storage.clear(); expect(data).toEqual({});
    expect(changed).toHaveBeenCalledTimes(2);
  });
  it("includes a network-denying CSP and escapes embedded HTML terminators", () => {
    const doc = makeDemoDocument('console.log("</script>")', 'x{content:"</style>"}', freshDemo(), "channel");
    expect(doc).toContain("connect-src 'none'");
    expect(doc).toContain("form-action 'none'");
    expect(doc).not.toContain('console.log("</script>")');
    expect(doc).toContain("<\\/script>");
    const launcher = readFileSync("client/src/demo-studio/DemoStudioLauncher.tsx", "utf8");
    expect(launcher).toContain('sandbox="allow-scripts"');
    expect(launcher).not.toContain("allow-same-origin");
    expect(launcher).toContain('credentials: "omit"');
  });
});
describe("live implementation preservation", () => {
  it("leaves normal AuthProvider and useAuth implementation byte-identical", () => {
    const original = execFileSync("git", ["show", "HEAD:client/src/contexts/AuthContext.tsx"], { encoding: "utf8" });
    const current = readFileSync("client/src/contexts/AuthContext.tsx", "utf8");
    const functions = (text: string) => text.slice(text.indexOf("export function AuthProvider("))
      .split("\n/**\n * Additive provider seam")[0].trim();
    expect(functions(current)).toBe(functions(original));
  });
  it("does not edit the real three customer screens or server authentication/CSRF", () => {
    for (const file of [
      "client/src/pages/OnboardingV3.tsx", "client/src/pages/MacroCalculator.tsx",
      "client/src/pages/DashboardNew.tsx", "server/middleware/requireAuth.ts",
    ]) expect(readFileSync(file, "utf8")).toBe(execFileSync("git", ["show", `HEAD:${file}`], { encoding: "utf8" }));
  });
  it("limits navigation cleanup to retired links and preserves compatibility routes", () => {
    const menu = readFileSync("client/src/components/DevNavigator.tsx", "utf8");
    for (const link of ["/craving-studio", "/dessert-studio", "/fridge-rescue-studio",
      "/beer-pairing", "/bourbon-spirits", "/wine-pairing", "/meal-pairing-ai", "/onboarding-legacy"]) {
      expect(menu).not.toContain(`path: "${link}"`);
    }
    expect(menu).toContain('path: "/onboarding-v2", label: "Onboarding (V3 compatibility route)"');
  });
  it("does not invoke application server, migrations, or production build from demo preparation", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    expect(packageJson.scripts["demo:prepare"]).toBe("node scripts/build-demo-studio.mjs");
    const build = readFileSync("scripts/build-demo-studio.mjs", "utf8");
    expect(build).toContain('process.env.REPLIT_DEPLOYMENT === "1"');
    expect(readFileSync(".gitignore", "utf8")).toContain("client/.demo-studio-runtime/");
  });
});
