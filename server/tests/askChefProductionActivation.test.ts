import fs from "node:fs";
import { isAskChefConversationEnabled, isAskChefVisible } from "../../shared/coaching/askChefRelease";
import { isChefConversationEnabled } from "../../client/src/lib/chefCornerExperience";

test("Production visibility does not need a Development-only environment variable", () => {
  expect(isAskChefVisible(true)).toBe(true);
  expect(isAskChefVisible(true, "true")).toBe(true);
  expect(isAskChefVisible(true, "false")).toBe(false);
  expect(isAskChefVisible(false)).toBe(false);
  expect(isAskChefVisible(false, "true")).toBe(true);
});

test("conversation activation is explicit in both real runtime environments", () => {
  expect(isAskChefConversationEnabled("production")).toBe(true);
  expect(isAskChefConversationEnabled("development")).toBe(true);
  expect(isAskChefConversationEnabled("test")).toBe(false);
  expect(isAskChefConversationEnabled(undefined)).toBe(false);
  expect(isChefConversationEnabled()).toBe(true);
  const frontend = fs.readFileSync("client/src/lib/chefCornerExperience.ts", "utf8");
  expect(frontend).toContain("return true");
  expect(frontend).not.toContain("import.meta.env.DEV");
});

test("dashboard, App Library, and legacy intake links resolve to the released experience", () => {
  const router = fs.readFileSync("client/src/components/Router.tsx", "utf8");
  for (const name of ["Welcome", "Intake", "Complete"]) {
    expect(router).toContain(`const GuardedChef${name} = () => <AskChefGuard component={isChefConversationEnabled() ? ChefConversationEntry`);
  }
  expect(fs.readFileSync("client/src/pages/DashboardNew.tsx", "utf8"))
    .toContain("{COACHES_CORNER_ENABLED && <CoachCornerCard />}");
  const library = fs.readFileSync("client/src/pages/Learn.tsx", "utf8");
  expect(library).toContain('id: "chefs-corner"');
  expect(library).toContain("title: chefMemberText(originalTopic.title)");
  expect(library).toContain("Ask Chef opens directly into conversation.");
});

test("both entries use authenticated Chef routers; destination Pro guards remain separate", () => {
  const source = fs.readFileSync("server/routes/coachingEngine.ts", "utf8");
  for (const line of source.split("\n").filter(line => /^router\.(get|post|delete|patch)\(/.test(line))) {
    // Shared platform activity collection is not a conversational capability.
    if (line.includes('"/activity-event"')) continue;
    expect(line).toContain("requireAuth,");
  }
  expect(fs.readFileSync("server/routes/coachingNavigation.ts", "utf8"))
    .toContain('router.post("/navigation", requireAuth, resolve)');
  expect(fs.readFileSync("server/routes/coachingNavigation.ts", "utf8"))
    .toContain('destination.access === "pro" ? requireProAccess');
  for (const file of ["server/prod.ts", "server/routes.ts"]) {
    expect(fs.readFileSync(file, "utf8")).toMatch(/\/api\/coach/);
  }
});
