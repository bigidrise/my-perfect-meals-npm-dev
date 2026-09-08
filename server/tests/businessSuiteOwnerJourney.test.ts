import fs from "fs";
import path from "path";

const root = process.cwd();
const more = fs.readFileSync(
  path.join(root, "client/src/pages/More.tsx"),
  "utf8",
);
const setup = fs.readFileSync(
  path.join(root, "client/src/pages/BusinessSetup.tsx"),
  "utf8",
);
const start = fs.readFileSync(
  path.join(root, "client/src/pages/BusinessStart.tsx"),
  "utf8",
);
const dashboard = fs.readFileSync(
  path.join(root, "client/src/pages/BusinessDashboard.tsx"),
  "utf8",
);
const businessRoutes = fs.readFileSync(
  path.join(root, "server/routes/businessRoutes.ts"),
  "utf8",
);
const emailService = fs.readFileSync(
  path.join(root, "server/services/emailService.ts"),
  "utf8",
);
const checkout = fs.readFileSync(
  path.join(root, "server/routes/stripeCheckout.ts"),
  "utf8",
);
const mfaPolicy = fs.readFileSync(
  path.join(root, "server/lib/privilegedMfaPolicy.ts"),
  "utf8",
);

describe("Business Suite owner-first journey", () => {
  test("More gives users without an organization the $44.99 Business Suite front door", () => {
    expect(more).toContain('data-testid="card-business-suite"');
    expect(more).toContain('"Start Your Organization"');
    expect(more).toContain('"$44.99/month · Set up your Business Suite"');
    expect(more).toContain('businessCard?.status === "active" ? "/business-dashboard" : "/business/start"');
    expect(more).toContain('"Complete Organization Setup"');
  });

  test("Business Suite explains the full client journey before setup", () => {
    expect(start).toContain("Turn My Perfect Meals into a business platform");
    expect(start).toContain("Set up your organization");
    expect(start).toContain("Activate your Business Suite");
    expect(start).toContain("Existing members connect automatically");
    expect(start).toContain("New members create an account");
    expect(start).toContain("Work with them in ProCare");
    expect(start).toContain('setLocation("/business/setup")');
    expect(start).toContain('setLocation("/business-dashboard")');
  });

  test("client invitation durations are exactly 7, 14, or 30 days on both sides", () => {
    expect(dashboard).toContain('{["7", "14", "30"].map');
    expect(dashboard).not.toMatch(/"60"|"90"|clientCustomDays|clientTrialOption === "custom"/);
    expect(businessRoutes).toContain("const CLIENT_TRIAL_DURATIONS = [7, 14, 30] as const");
    expect(businessRoutes).toContain("isAllowedClientTrialDuration(days)");
    expect(businessRoutes).toContain("isAllowedClientTrialDuration(trialDays)");
  });

  test("invitation email converges existing and new users on one acceptance", () => {
    expect(emailService).toContain("Already have My Perfect Meals?");
    expect(emailService).toContain("Sign in with your existing account");
    expect(emailService).toContain("New to My Perfect Meals?");
    expect(emailService).toContain("Both paths connect you");
    expect(emailService).toContain("escapeEmailHtml");
    expect(emailService).toContain("safeEmailSubject");
  });

  test("organization information is saved before owner-only checkout begins", () => {
    const createIndex = setup.indexOf('fetch("/api/business/create-org"');
    const checkoutIndex = setup.indexOf(
      'fetch("/api/stripe/checkout/business"',
    );

    expect(createIndex).toBeGreaterThan(-1);
    expect(checkoutIndex).toBeGreaterThan(createIndex);
    expect(setup).toContain("JSON.stringify({ seats: 1 })");
    expect(checkout).toContain("clientRequestedSeats !== 1");
    expect(checkout).toContain('getTrustedCheckoutPlan("clinical_business_monthly")');
  });

  test("MFA failures send only affected users to Account Security", () => {
    expect(setup).toContain('createData.code === "MFA_ENROLLMENT_REQUIRED"');
    expect(setup).toContain('createData.code === "MFA_REQUIRED"');
    expect(setup).toContain('setLocation("/more")');
    expect(mfaPolicy).toContain("requiresPrivilegedMfa");
    expect(mfaPolicy).not.toMatch(/professionalRole|business|organization/i);
  });

  test("the owner journey never changes training, clients, or paid access locally", () => {
    const frontDoor = more.slice(
      more.indexOf("{/* Business Suite"),
      more.indexOf("{/* Business education"),
    );

    expect(frontDoor).not.toMatch(
      /procareTrainingCompleted|client_links|planLookupKey|stripeSubscriptionId/,
    );
  });
});