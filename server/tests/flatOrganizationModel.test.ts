import fs from "fs";
import path from "path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("flat ordinary Organization backend model", () => {
  const routes = read("server/routes/businessRoutes.ts");
  const checkout = read("server/routes/stripeCheckout.ts");
  const webhook = read("server/routes/stripeWebhook.ts");
  const reconciliation = read("server/services/stripeReconciliationService.ts");
  const effectiveAccess = read("server/services/effectiveAccess.ts");
  const proCareActivation = read("server/services/procareActivation.ts");
  const pricing = read("client/src/pages/PricingPage.tsx");
  const dashboard = read("client/src/pages/BusinessDashboard.tsx");
  const successCenter = read("client/src/pages/OrganizationSuccessCenter.tsx");
  const orgContext = read("client/src/contexts/OrgContext.tsx");
  const setup = read("client/src/pages/BusinessSetup.tsx");

  test("ordinary checkout is and remains Stripe quantity one", () => {
    expect(checkout).toContain("const requestedSeats = 1");
    expect(checkout).toContain("quantity: requestedSeats");
    expect(webhook).toContain("const seatCount = 1");
    expect(webhook).toContain("Flat organization subscriptions must retain Stripe quantity 1");
    expect(reconciliation).toContain("Flat organization subscriptions must retain Stripe quantity 1");
  });

  test("ordinary Organization is displayed as a flat $44.99 plan without seat purchasing", () => {
    expect(pricing).toContain("$44.99");
    expect(pricing).toContain("A flat-rate Organization plan");
    expect(setup).toContain("$44.99/month");
    expect(dashboard).not.toContain("Manage Seats");
    expect(dashboard).not.toContain("Team Seats");
    expect(dashboard).not.toContain("44.99 * managedSeats");
  });

  test("Organization Success Center narration uses stable sections", () => {
    expect(successCenter).toContain("const sections = useMemo(");
    expect(successCenter).toContain("<SuccessCenterNarration");
    expect(successCenter).not.toContain(
      '<NarrationBar sections={[{ heading: mod.title, text: mod.narration }]} />',
    );
  });

  test("partial Organization config cannot crash feature-flag consumers", () => {
    expect(orgContext).toContain("...DEFAULT_ORG_CONFIG.featureFlags");
    expect(orgContext).toContain("...(data?.featureFlags ?? {})");
    expect(orgContext).toContain("org.featureFlags?.[flag] === true");
  });

  test("ordinary invitations and acceptance do not enforce purchased seats", () => {
    expect(routes).toContain("!isClient && !isFlatOrganization(business)");
    expect(routes).toContain("!isFlatOrganization(business) && usedSeats >= business.seatLimit");
    expect(routes).toContain("FLAT_ORGANIZATION_NO_SEAT_MUTATION");
  });

  test("flat professional access is a one-time 30-day introduction, not sponsorship", () => {
    expect(routes).toContain("NOW() + interval '30 days'");
    expect(routes).toContain("acceptedByUserId, userId");
    expect(effectiveAccess).toContain("membership.plan === \"clinical_business_monthly\"");
    expect(effectiveAccess).toContain("sponsoredProCareAccess: false");
  });

  test("client invitation consumption and ProCare activation share one transaction", () => {
    expect(proCareActivation).toContain("finalizeInTransaction");
    expect(routes).toContain("INVITATION_NOT_PENDING");
    expect(routes).toContain(".returning({ id: businessInvitations.id })");
  });

  test("invitation sends have owner throttling and recipient resend cooldown", () => {
    expect(routes).toContain("ORGANIZATION_INVITE_SEND_LIMIT = 20");
    expect(routes).toContain("INVITATION_SEND_THROTTLED");
    expect(routes).toContain("INVITATION_RESEND_COOLDOWN");
  });
});