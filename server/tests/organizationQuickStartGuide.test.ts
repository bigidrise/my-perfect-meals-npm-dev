import fs from "fs";
import path from "path";
import {
  disableOrganizationQuickStartAutoOpen,
  markOrganizationQuickStartShown,
  shouldAutoOpenOrganizationQuickStart,
} from "../../client/src/hooks/useOrganizationQuickStart";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Organization Quick Start guide contract", () => {
  const hub = read("client/src/pages/OrganizationHub.tsx");
  const modal = read("client/src/components/business/OrganizationQuickStartModal.tsx");
  const hook = read("client/src/hooks/useOrganizationQuickStart.ts");

  function memoryStorage() {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
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
});