import { readFileSync } from "fs";
import { join } from "path";
import {
  BUSINESS_ONBOARDING_PILOT_DAYS,
  createBusinessOnboardingWindow,
  deriveBusinessCommercialState,
  PERMANENT_COMPLIMENTARY_BUSINESS_ACCESS,
} from "../services/businessCommercialAccessService";

describe("Business commercial access", () => {
  const start = new Date("2026-09-11T12:00:00.000Z");
  const root = process.cwd();

  it("creates one timezone-independent 30-day organization window", () => {
    const window = createBusinessOnboardingWindow(start);
    expect(BUSINESS_ONBOARDING_PILOT_DAYS).toBe(30);
    expect(window.startedAt).toEqual(start);
    expect(window.endsAt.toISOString()).toBe("2026-10-11T12:00:00.000Z");
  });

  it("is active before the exact boundary and commercial-required at it", () => {
    const business = {
      status: "active" as const,
      commercialAccessMode: "onboarding_pilot" as const,
      commercialAccessStartedAt: start,
      commercialAccessEndsAt: new Date("2026-10-11T12:00:00.000Z"),
    };
    expect(
      deriveBusinessCommercialState(
        business,
        new Date("2026-10-11T11:59:59.999Z"),
      ),
    ).toBe("pilot_active");
    expect(
      deriveBusinessCommercialState(
        business,
        new Date("2026-10-11T12:00:00.000Z"),
      ),
    ).toBe("commercial_required");
  });

  it("preserves legacy active organizations as commercially active", () => {
    expect(
      deriveBusinessCommercialState({
        status: "active",
        commercialAccessMode: null,
        commercialAccessStartedAt: null,
        commercialAccessEndsAt: null,
      }),
    ).toBe("commercially_active");
  });

  it("does not treat a personal complimentary grant as organization state", () => {
    expect(PERMANENT_COMPLIMENTARY_BUSINESS_ACCESS).toBe(
      "permanent_complimentary_business_access",
    );
    expect(
      deriveBusinessCommercialState({
        status: "active",
        commercialAccessMode: "onboarding_pilot",
        commercialAccessStartedAt: start,
        commercialAccessEndsAt: new Date("2026-09-10T12:00:00.000Z"),
      }, start),
    ).toBe("commercial_required");
  });

  it("recognizes verified paid and authorized arrangements independently", () => {
    for (const mode of ["paid", "authorized_arrangement"] as const) {
      expect(
        deriveBusinessCommercialState({
          status: "active",
          commercialAccessMode: mode,
          commercialAccessStartedAt: start,
          commercialAccessEndsAt: null,
        }),
      ).toBe("commercially_active");
    }
  });

  it("excludes expired onboarding organizations from sponsored effective access", () => {
    const effectiveAccess = readFileSync(
      join(root, "server/services/effectiveAccess.ts"),
      "utf8",
    );
    expect(effectiveAccess).toContain(
      'ne(businesses.commercialAccessMode, "onboarding_pilot")',
    );
    expect(effectiveAccess).toContain(
      "gt(businesses.commercialAccessEndsAt, new Date())",
    );
  });

  it("allows an onboarding organization to use the existing verified checkout pipeline", () => {
    const checkout = readFileSync(
      join(root, "server/routes/stripeCheckout.ts"),
      "utf8",
    );
    const transition = readFileSync(
      join(root, "server/services/businessSubscriptionService.ts"),
      "utf8",
    );
    expect(checkout).toContain(
      'eq(bizTable.commercialAccessMode, "onboarding_pilot")',
    );
    expect(transition).toContain(
      'business.commercialAccessMode !== "onboarding_pilot"',
    );
  });

  it("blocks invitation operations and acceptance after commercial expiry", () => {
    const routes = readFileSync(
      join(root, "server/routes/businessRoutes.ts"),
      "utf8",
    );
    expect(routes).toContain(
      'router.post("/pilots/:pilotId/invitations", requireAuth, requireProOrOrgAdmin, requireSelectedBusinessCommercialAccess',
    );
    expect(routes).toContain(
      'router.post("/pilot-invitations/:inviteId/resend", requireAuth, requireProOrOrgAdmin, requireSelectedBusinessCommercialAccess',
    );
    expect(routes).toContain(
      'deriveBusinessCommercialState(business) === "commercial_required"',
    );
  });
});