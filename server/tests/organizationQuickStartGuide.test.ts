import fs from "fs";
import path from "path";
import {
  disableOrganizationQuickStartAutoOpen,
  clearOrganizationQuickStartJourney,
  markOrganizationQuickStartShown,
  readOrganizationQuickStartJourney,
  shouldAutoOpenOrganizationQuickStart,
  startOrganizationQuickStartJourney,
} from "../../client/src/hooks/useOrganizationQuickStart";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Organization Quick Start guide contract", () => {
  const hub = read("client/src/pages/OrganizationHub.tsx");
  const modal = read("client/src/components/business/OrganizationQuickStartModal.tsx");
  const hook = read("client/src/hooks/useOrganizationQuickStart.ts");
  const returnControl = read("client/src/components/business/OrganizationQuickStartReturn.tsx");
  const router = read("client/src/components/Router.tsx");

  function memoryStorage() {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
  }

  test("first entry auto-opens once per session and remains isolated by authenticated user", () => {
    const persistent = memoryStorage();
    const session = memoryStorage();
    expect(shouldAutoOpenOrganizationQuickStart("user-a", persistent, session)).toBe(true);
    markOrganizationQuickStartShown("user-a", session);
    expect(shouldAutoOpenOrganizationQuickStart("user-a", persistent, session)).toBe(false);
    expect(shouldAutoOpenOrganizationQuickStart("user-b", persistent, session)).toBe(true);
  });

  test("disabling future automatic opening affects only that user", () => {
    const persistent = memoryStorage();
    const nextSession = memoryStorage();
    disableOrganizationQuickStartAutoOpen("user-a", persistent);
    expect(shouldAutoOpenOrganizationQuickStart("user-a", persistent, nextSession)).toBe(false);
    expect(shouldAutoOpenOrganizationQuickStart("user-b", persistent, nextSession)).toBe(true);
    expect(hook).toContain("ORGANIZATION_QUICK_START_VERSION");
    expect(hook).toContain("organizationQuickStart.v${ORGANIZATION_QUICK_START_VERSION}::${userId}");
    expect(hub).toContain("useOrganizationQuickStart(user?.id)");
  });

  test("automatic opening can be disabled while manual reopening remains visible", () => {
    expect(hook).toContain("disableOrganizationQuickStartAutoOpen(userId, localStorage)");
    expect(hub).toContain('data-testid="organization-quick-start-open"');
    expect(modal).toContain('data-testid="organization-quick-start-disable-auto"');
    expect(modal).toContain("Don't open automatically again");
  });

  test("opening or closing the guide cannot mutate organization state or pilot timing", () => {
    expect(hook).not.toContain("fetch(");
    expect(modal).not.toContain("fetch(");
    expect(modal).not.toContain("/api/");
    expect(modal).toContain("never starts, restarts, or extends the pilot");
  });

  test("content reflects personal Academy and organization-owned Partner & Revenue", () => {
    expect(modal).toContain("Academy teaches each person");
    expect(modal).toContain("It does not activate Partner & Revenue");
    expect(modal).toContain("Partner & Revenue belongs to the organization");
    expect(modal).toContain("exact existing Rewardful affiliate ID");
    expect(modal).toContain("organization's own business contact information");
  });

  test("contractor, staff, client, referral, and Studio relationships stay distinct", () => {
    expect(modal).toContain("Internal staff work for the organization");
    expect(modal).toContain("External delegated contractors can administer it without owning it");
    expect(modal).toContain("Clients and customers remain separate");
    expect(modal).toContain("referrals do not automatically become Studio clients");
  });

  test("only registered current destinations are linked", () => {
    for (const route of [
      "/business-dashboard",
      "/business-center/academy",
      "/business-center/affiliate/dashboard",
      "/care-team",
    ]) {
      expect(modal).toContain(`route: "${route}"`);
    }
  });

  test("journey context survives refresh and is isolated by user and organization", () => {
    const session = memoryStorage();
    startOrganizationQuickStartJourney(session, {
      userId: "user-a",
      organizationId: "organization-a",
      originStep: 1,
      continuationStep: 2,
      destinationPath: "/business-dashboard",
    }, 1_000);

    expect(readOrganizationQuickStartJourney(
      session,
      "user-a",
      "organization-a",
      "/business-dashboard",
      2_000,
    )?.continuationStep).toBe(2);
    expect(readOrganizationQuickStartJourney(session, "user-b", "organization-a", undefined, 2_000)).toBeNull();
    expect(readOrganizationQuickStartJourney(session, "user-a", "organization-b", undefined, 2_000)).toBeNull();
    expect(readOrganizationQuickStartJourney(
      session,
      "user-a",
      "organization-a",
      "/business-center/academy",
      2_000,
    )).toBeNull();
  });

  test("stopping the guide clears journey context without marking work complete", () => {
    const session = memoryStorage();
    const journey = startOrganizationQuickStartJourney(session, {
      userId: "user-a",
      organizationId: "organization-a",
      originStep: 2,
      continuationStep: 3,
      destinationPath: "/business-center/academy",
    }, 1_000);
    expect(journey).not.toHaveProperty("completedSteps");
    expect(journey).not.toHaveProperty("role");
    expect(journey).not.toHaveProperty("authorized");
    clearOrganizationQuickStartJourney(session, "user-a", "organization-a");
    expect(readOrganizationQuickStartJourney(session, "user-a", "organization-a")).toBeNull();
  });

  test("temporary return control requires journey marker and active organization match", () => {
    expect(router).toContain("<OrganizationQuickStartReturn />");
    expect(returnControl).toContain('params.get("organizationQuickStart")');
    expect(returnControl).toContain('fetch("/api/business/workspace/active"');
    expect(returnControl).toContain("activeOrganizationId === markedOrganizationId");
    expect(returnControl).toContain('data-testid="organization-quick-start-return"');
    expect(returnControl).toContain("Return to Organization Quick Start");
  });

  test("return reopens at the continuation step and explicit close clears the journey", () => {
    expect(hub).toContain('params.get("organizationQuickStartReturn")');
    expect(hub).toContain("quickStart.open(journey.continuationStep)");
    expect(hub).toContain("clearOrganizationQuickStartJourney(sessionStorage");
    expect(modal).toContain("continuationStep: Math.min(originStep + 1");
    expect(modal).toContain("Continue here");
  });
});