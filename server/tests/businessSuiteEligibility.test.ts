import { evaluateBusinessCommercialState } from "../services/businessSuiteEligibility";
import fs from "fs";
import path from "path";

describe("Business Suite eligibility policy", () => {
  const now = new Date("2026-09-15T12:00:00.000Z");

  test("active paid organizations are commercially eligible", () => {
    expect(evaluateBusinessCommercialState({
      businessStatus: "active",
      businessPlan: "clinical_business_monthly",
      now,
    })).toEqual({ state: "active_paid", active: true, reason: null });
  });

  test("an active pilot is eligible only inside its shared window", () => {
    const base = {
      businessStatus: "active",
      businessPlan: "organizational_pilot",
      pilotStatus: "active",
      pilotStartAt: new Date("2026-09-01T05:00:00.000Z"),
      pilotEndAt: new Date("2026-10-01T05:00:00.000Z"),
    };
    expect(evaluateBusinessCommercialState({ ...base, now }).active).toBe(true);
    expect(evaluateBusinessCommercialState({ ...base, now: base.pilotEndAt }).active).toBe(false);
  });

  test("preparing, suspended, and ended organizations cannot be entered", () => {
    expect(evaluateBusinessCommercialState({
      businessStatus: "active",
      businessPlan: "organizational_pilot",
      pilotStatus: "preparing",
      now,
    }).active).toBe(false);
    expect(evaluateBusinessCommercialState({
      businessStatus: "past_due",
      businessPlan: "clinical_business_monthly",
      now,
    }).active).toBe(false);
    expect(evaluateBusinessCommercialState({
      businessStatus: "cancelled",
      businessPlan: "clinical_business_monthly",
      now,
    }).state).toBe("ended");
  });

  test("direct dashboard entry and member-client accounting use server authorization", () => {
    const routes = fs.readFileSync(path.resolve(process.cwd(), "server/routes/businessRoutes.ts"), "utf8");
    expect(routes).toContain('router.get("/eligibility", requireAuth');
    expect(routes).toContain('router.get("/setup-eligibility", requireAuth');
    expect(routes).toContain('router.get("/mine", requireAuth, requireBusinessSuiteEntry');
    expect(routes).toContain('router.get("/membership", requireAuth, requireBusinessSuiteEntry');
    expect(routes).toContain('router.get("/members/:memberId/clients", requireAuth, requireBusinessSuiteEntry');
  });

  test("ordinary registration cannot create an unapproved Business organization", () => {
    const routes = fs.readFileSync(path.resolve(process.cwd(), "server/routes/businessRoutes.ts"), "utf8");
    expect(routes).toContain('"BUSINESS_PROVISIONING_REQUIRED"');
    expect(routes).toContain("Business Suite organizations must be provisioned by My Perfect Meals.");
  });

  test("workspace visibility is not derived from personal plan or professional status", () => {
    const service = fs.readFileSync(path.resolve(process.cwd(), "server/services/businessSuiteEligibility.ts"), "utf8");
    expect(service).not.toMatch(/accessTier|planLookupKey|professionalRole|affiliate|proCare/i);
    expect(service).toContain("businessMembers.status");
    expect(service).toContain("businesses.status");
    expect(service).toContain("organizationalPilots.status");
  });
});