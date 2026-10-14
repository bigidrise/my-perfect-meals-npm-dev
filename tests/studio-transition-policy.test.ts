/** @jest-environment jsdom */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  beginStudioNavigation, currentStudioNavigation, isStudioTransitionRoute,
  preloadStudioPage, preloadStudioDemoPage, readStudioNavigationTimings,
} from "../client/src/lib/studioTransition";

let mockDevelopment = true;
jest.mock("../client/src/lib/developmentStudioLoading", () => ({
  get developmentStudioLoadingEnabled() { return mockDevelopment; },
}));
jest.mock("../client/src/pages/ProPortal", () => ({ default: () => null }));
jest.mock("../client/src/pages/pro/DemoPhysicianWorkspace", () => ({ __esModule: true, default: jest.fn() }));
afterEach(() => { mockDevelopment = true; jest.restoreAllMocks(); });

test("Production creates no timings and preloads no extra page code", async () => {
  mockDevelopment = false;
  expect(beginStudioNavigation("/pro-portal")).toBeNull();
  expect(currentStudioNavigation("/pro-portal")).toBeNull();
  expect(readStudioNavigationTimings()).toEqual([]);
  expect(await preloadStudioPage("/pro-portal")).toBeUndefined();
  expect(await preloadStudioDemoPage("/pro-portal")).toBeUndefined();
});

test("only approved exact routes are recognized; IDs and query strings cannot enter timings", () => {
  expect(isStudioTransitionRoute("/care-team/physician")).toBe(true);
  expect(isStudioTransitionRoute("/pro/clients")).toBe(true);
  expect(beginStudioNavigation("/pro/clients/private-patient-id")).toBeNull();
  expect(beginStudioNavigation("/care-team?token=secret")).toBeNull();
  expect(beginStudioNavigation("/admin/pilots")).toBeNull();
});

test("memory-only measurements record real elapsed durations and are idempotent", () => {
  const clock = jest.spyOn(performance, "now").mockReturnValue(10);
  const timing = beginStudioNavigation("/pro-portal")!;
  timing.start("agreements");
  clock.mockReturnValue(35);
  timing.finish("agreements", "verified");
  timing.finish("agreements", "verified");
  const record = readStudioNavigationTimings().at(-1)!;
  expect(record.destination).toBe("Pro Portal");
  expect(record.stages).toEqual([{ stage: "agreements", elapsedMs: 25, outcome: "verified" }]);
  expect(Object.keys(record).sort()).toEqual(["destination", "sequence", "stages"]);
});

test("timings are bounded and returned snapshots cannot mutate internal records", () => {
  for (let i = 0; i < 45; i++) beginStudioNavigation("/care-team");
  const snapshots = readStudioNavigationTimings();
  expect(snapshots).toHaveLength(40);
  snapshots[0].destination = "changed";
  expect(readStudioNavigationTimings()[0].destination).toBe("Care Team");
});

test("concurrent preloads reuse only code promises, not permission approvals", async () => {
  const first = preloadStudioPage("/pro-portal");
  const second = preloadStudioPage("/pro-portal");
  expect(first).toBe(second);
  await first;
});

test("warming demo code does not mount its page or fetch any page data", async () => {
  const first = preloadStudioDemoPage("/care-team/physician");
  expect(first).toBe(preloadStudioDemoPage("/pro/physician-clients"));
  const module = await first as { default: jest.Mock };
  expect(module.default).not.toHaveBeenCalled();
});

test("actual destination code timing excludes the later authorization wait", () => {
  const clock = jest.spyOn(performance, "now").mockReturnValue(10);
  const timing = beginStudioNavigation("/care-team/physician")!;
  clock.mockReturnValue(30);
  timing.codeLoaded("demo", "ready");
  clock.mockReturnValue(40);
  timing.codeLoaded("professional", "error");
  clock.mockReturnValue(210);
  timing.selectCode("demo");
  expect(readStudioNavigationTimings().at(-1)!.stages).toEqual([
    { stage: "code", elapsedMs: 20, outcome: "ready" },
  ]);
});

test("Production guard remains byte-for-byte identical apart from its name", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "client/src/components/Router.tsx"), "utf8");
  const start = source.indexOf("function LegacyProCareStudioGuard(");
  const guard = source.slice(start, source.indexOf("// Plan Builder Pages", start))
    .replace("function LegacyProCareStudioGuard(", "function ProCareStudioGuard(");
  expect(createHash("sha256").update(guard).digest("hex")).toBe("4ffce138f3fc809e44979d6cad720df2dbcaa963de73cd7400e03c545241500f");
  expect(source).toContain("developmentStudioLoadingEnabled && isStudioTransitionRoute(location)");
  expect(source).toContain(": <LegacyProCareStudioGuard component={component} />");
});

test("normal Studio navigation remains outside the lazy-page Suspense boundary", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "client/src/components/Router.tsx"), "utf8");
  expect(source.lastIndexOf("<StudioBottomNav />")).toBeGreaterThan(source.lastIndexOf("</Suspense>"));
  expect(source).toContain('developmentStudioLoadingEnabled && isStudioTransitionRoute(location)');
});

test("timing implementation has no persistence, telemetry, credentials or API payloads", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "client/src/lib/studioTransition.ts"), "utf8");
  expect(source).not.toMatch(/localStorage|sessionStorage|console\.(log|info|error)|sendBeacon|apiRequest|fetch\(/);
});
