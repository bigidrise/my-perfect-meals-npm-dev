import * as fs from "fs";
import * as path from "path";
import {
  PROCARE_PLAN_KEYS,
  canAccessProCareStudio,
  getTierForLookupKey,
  isProCarePlanKey,
} from "../../shared/planFeatures";
import { getEntitlementsForPlan } from "../entitlements";
import { entitlementsForSubscriptionLookupKey } from "../services/subscriptionService";
import { canProviderAccessProCareStudio } from "../services/procareProviderAccess";

const PROCARE_PRODUCT_KEYS = [
  "clinical_business_monthly",
  "mpm_procare_monthly",
  "mpm_procare_trainer_5",
  "mpm_procare_trainer_10",
  "mpm_procare_trainer_25",
  "mpm_procare_trainer_50",
  "mpm_procare_trainer_150",
  "mpm_trainer_5",
  "mpm_trainer_10",
  "mpm_trainer_25",
  "mpm_trainer_50",
  "mpm_physician_50",
  "mpm_physician_150",
] as const;

describe("ProCare Studio access policy", () => {
  it("recognizes every professional product from the single shared catalog", () => {
    for (const planKey of PROCARE_PRODUCT_KEYS) {
      expect(PROCARE_PLAN_KEYS.has(planKey)).toBe(true);
      expect(isProCarePlanKey(planKey)).toBe(true);
      expect(getTierForLookupKey(planKey)).toBe("ultimate");
    }
  });

  it("keeps personal Ultimate distinct from professional Studio access", () => {
    expect(isProCarePlanKey("mpm_ultimate_monthly")).toBe(false);
    expect(isProCarePlanKey("mpm_premium_monthly")).toBe(false);
    expect(isProCarePlanKey("unknown_plan")).toBe(false);
  });

  it.each([
    ["Clinical Business", "PAID_FULL", "clinical_business_monthly", true],
    ["ProCare trainer", "PAID_FULL", "mpm_trainer_10", true],
    ["internal founder", "PAID_FULL", null, true],
    ["personal Ultimate", "PAID_FULL", "mpm_ultimate_monthly", false],
    ["Premium", "PAID_FULL", "mpm_premium_monthly", false],
    ["free user", "FREE", "clinical_business_monthly", false],
  ])("applies the production policy for %s", (_name, accessTier, planLookupKey, expected) => {
    expect(canAccessProCareStudio({
      billingEnforced: true,
      accessTier,
      planLookupKey,
    })).toBe(expected);
  });

  it("requires a clinical membership role for a sponsored Clinical Business seat", () => {
    const base = {
      billingEnforced: true,
      accessTier: "PAID_FULL",
      planLookupKey: "clinical_business_monthly",
      sponsoredByBusinessId: "business-1",
    };

    expect(canAccessProCareStudio({
      ...base,
      sponsoredProCareAccess: false,
    })).toBe(false);
    expect(canAccessProCareStudio({
      ...base,
      sponsoredProCareAccess: true,
    })).toBe(true);
  });

  it("retains founder access when effective access uses a synthetic Ultimate key", () => {
    expect(canAccessProCareStudio({
      billingEnforced: true,
      accessTier: "PAID_FULL",
      planLookupKey: "mpm_ultimate_monthly",
      isInternalAccount: true,
    })).toBe(true);
  });

  it("uses effective membership access for provider-side invitation decisions", () => {
    const provider = {
      id: "sponsored-provider",
      planLookupKey: null,
      isFounder: false,
    };

    const sponsoredAccess = {
      planLookupKey: "clinical_business_monthly",
      entitlements: [],
      tier: "ultimate" as const,
      sponsoredByBusinessId: "business-1",
      sponsoredByBusinessName: "Clinical Practice",
      sponsoredProCareAccess: true,
    };
    const staffAccess = {
      ...sponsoredAccess,
      sponsoredProCareAccess: false,
    };

    expect(canProviderAccessProCareStudio(provider, sponsoredAccess, true)).toBe(true);
    expect(canProviderAccessProCareStudio(provider, staffAccess, true)).toBe(false);
  });

  it("uses the same catalog when persisting checkout entitlements", () => {
    const entitlements = getEntitlementsForPlan("clinical_business_monthly");
    expect(entitlements).toEqual(expect.arrayContaining(["procare", "care_team", "lab_metrics"]));
    expect(getEntitlementsForPlan("mpm_ultimate_monthly")).not.toContain("procare");
    expect(getEntitlementsForPlan("unknown_plan")).toEqual([]);
  });

  it("uses the shared resolver for subscription activation and renewal writes", () => {
    expect(entitlementsForSubscriptionLookupKey("clinical_business_monthly"))
      .toEqual(expect.arrayContaining(["procare", "care_team", "lab_metrics"]));
    expect(entitlementsForSubscriptionLookupKey("mpm_trainer_10")).toContain("procare");
    expect(entitlementsForSubscriptionLookupKey("mpm_ultimate_monthly")).not.toContain("procare");
  });

  it("does not allow route and invite code to recreate local ProCare plan lists", () => {
    const sourceFiles = [
      ["../routes/stripeWebhook.ts", "isProCarePlanKey"],
      ["../routes/careTeamRoutes.ts", "providerHasProCareStudioAccess"],
      ["../services/procareInviteService.ts", "providerHasProCareStudioAccess"],
    ];

    for (const [relativePath, sharedResolver] of sourceFiles) {
      const source = fs.readFileSync(path.resolve(__dirname, relativePath), "utf8");
      expect(source).toContain(sharedResolver);
      expect(source).not.toMatch(/const\s+PROCARE_PLAN_KEYS\s*=/);
    }
  });
});