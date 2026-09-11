import { readFileSync } from "fs";
import { join } from "path";
import {
  assertOrganizationalPilotMirror,
  BusinessPilotClockConflictError,
  deriveBusinessCommercialState,
  planBusinessPilotWindowReconciliation,
  resolveAuthoritativeBusinessPilotWindow,
} from "../services/businessCommercialAccessService";
import { getPilotReviewConfiguration } from "../config/pilotReviewConfig";

describe("Business pilot prerequisites", () => {
  const startedAt = new Date("2026-09-01T05:00:00.000Z");
  const endsAt = new Date("2026-10-01T05:00:00.000Z");
  const preservedWindow = { startedAt, endsAt };
  const legacyBusiness = {
    status: "active" as const,
    commercialAccessMode: null,
    commercialAccessStartedAt: null,
    commercialAccessEndsAt: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  };

  test("promotes an existing organizational window without changing either date", () => {
    const update = planBusinessPilotWindowReconciliation(
      legacyBusiness,
      preservedWindow,
    );
    expect(update).toEqual({
      commercialAccessMode: "onboarding_pilot",
      commercialAccessStartedAt: startedAt,
      commercialAccessEndsAt: endsAt,
    });
    expect(resolveAuthoritativeBusinessPilotWindow({
      ...legacyBusiness,
      ...update!,
    })).toEqual(preservedWindow);
  });

  test("accepts only an exact compatibility mirror of the Business window", () => {
    expect(() => assertOrganizationalPilotMirror(preservedWindow, {
      pilotStartAt: startedAt,
      pilotEndAt: endsAt,
    })).not.toThrow();
    expect(() => assertOrganizationalPilotMirror(preservedWindow, {
      pilotStartAt: startedAt,
      pilotEndAt: new Date("2026-10-02T05:00:00.000Z"),
    })).toThrow(BusinessPilotClockConflictError);
  });

  test("organization, location, team, and assignment state cannot alter the clock", () => {
    const businessWithUnrelatedState = {
      ...legacyBusiness,
      organizationId: "organization-1",
      locationId: "location-1",
      teamVersion: 7,
      completedAssignments: 0,
    };
    const update = planBusinessPilotWindowReconciliation(
      businessWithUnrelatedState,
      preservedWindow,
    );
    expect(update?.commercialAccessStartedAt).toBe(startedAt);
    expect(update?.commercialAccessEndsAt).toBe(endsAt);
  });

  test("rejects paid, Stripe-backed, authorized, partial, and conflicting clocks", () => {
    const unsafe = [
      { ...legacyBusiness, commercialAccessMode: "paid" as const },
      { ...legacyBusiness, commercialAccessMode: "authorized_arrangement" as const },
      { ...legacyBusiness, stripeSubscriptionId: "sub_existing" },
      { ...legacyBusiness, commercialAccessStartedAt: startedAt },
      {
        ...legacyBusiness,
        commercialAccessMode: "onboarding_pilot" as const,
        commercialAccessStartedAt: startedAt,
        commercialAccessEndsAt: new Date("2026-10-02T05:00:00.000Z"),
      },
    ];
    for (const business of unsafe) {
      expect(() =>
        planBusinessPilotWindowReconciliation(business, preservedWindow),
      ).toThrow(BusinessPilotClockConflictError);
    }
  });

  test("keeps Day-31 enforcement on the Business commercial window", () => {
    const business = {
      status: "active" as const,
      commercialAccessMode: "onboarding_pilot" as const,
      commercialAccessStartedAt: startedAt,
      commercialAccessEndsAt: endsAt,
    };
    expect(deriveBusinessCommercialState(
      business,
      new Date(endsAt.getTime() - 1),
    )).toBe("pilot_active");
    expect(deriveBusinessCommercialState(business, endsAt))
      .toBe("commercial_required");
  });

  test("does not mutate paid or personal complimentary access", () => {
    const source = readFileSync(
      join(process.cwd(), "server/services/businessCommercialAccessService.ts"),
      "utf8",
    );
    expect(() => planBusinessPilotWindowReconciliation({
      ...legacyBusiness,
      commercialAccessMode: "paid",
    }, preservedWindow)).toThrow(BusinessPilotClockConflictError);
    expect(source).toContain("PERMANENT_COMPLIMENTARY_BUSINESS_ACCESS");
    expect(source).toContain("businessAccessGrants");
  });

  test("loads the approved review URL only from central validated configuration", () => {
    expect(getPilotReviewConfiguration({
      PILOT_REVIEW_BOOKING_URL: "https://calendar.app.google/example",
      PILOT_REVIEW_CONTACT_EMAIL: "Pilot@Example.com",
    })).toEqual({
      bookingUrl: "https://calendar.app.google/example",
      fallbackEmail: "pilot@example.com",
    });
    expect(() => getPilotReviewConfiguration({
      PILOT_REVIEW_BOOKING_URL: "http://calendar.app.google/example",
    })).toThrow("must use HTTPS");

    const configSource = readFileSync(
      join(process.cwd(), "server/config/pilotReviewConfig.ts"),
      "utf8",
    );
    const kitchenSource = readFileSync(
      join(process.cwd(), "client/src/pages/kitchen/SignatureKitchenHubPage.tsx"),
      "utf8",
    );
    expect(configSource).toContain("PILOT_REVIEW_BOOKING_URL");
    expect(configSource).not.toContain("J1E5Mx41F5es5RUg8");
    expect(configSource).not.toContain("1TiPNAuMfStVFwKZ7");
    expect(kitchenSource).toContain("1TiPNAuMfStVFwKZ7");
  });
});