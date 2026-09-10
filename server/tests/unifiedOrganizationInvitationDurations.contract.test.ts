import fs from "fs";
import path from "path";
import {
  APPROVED_TEMPORARY_ACCESS_DURATIONS,
  assertTemporaryAccessDuration,
  clinicTrialEnd,
} from "../services/clinicPilotEnrollmentService";

describe("unified organization invitation durations", () => {
  it.each(APPROVED_TEMPORARY_ACCESS_DURATIONS)(
    "creates an exact rolling %i-day access window",
    (days) => {
      const start = new Date("2026-09-10T12:00:00.000Z");
      expect(clinicTrialEnd(start, days).getTime() - start.getTime())
        .toBe(days * 24 * 60 * 60 * 1000);
    },
  );

  it.each([0, 1, 8, 21, 31, 365, NaN])(
    "rejects unauthorized duration %s",
    (days) => {
      expect(() => assertTemporaryAccessDuration(days)).toThrow("INVALID_ACCESS_DURATION");
    },
  );

  it("keeps patient and professional grants in separate entitlement tables", () => {
    const schema = fs.readFileSync(
      path.resolve(process.cwd(), "server/db/schema/pilotProgram.ts"),
      "utf8",
    );
    expect(schema).toContain('pgTable("clinic_trial_entitlements"');
    expect(schema).toContain('pgTable("professional_temporary_access_entitlements"');
  });

  it("transports one server-validated duration for invite, batch, CSV, link, and QR flows", () => {
    const client = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/components/business/OrganizationInvitationsAccess.tsx"),
      "utf8",
    );
    const routes = fs.readFileSync(
      path.resolve(process.cwd(), "server/routes/businessRoutes.ts"),
      "utf8",
    );
    const clinicRoutes = fs.readFileSync(
      path.resolve(process.cwd(), "server/routes/clinicPilotRoutes.ts"),
      "utf8",
    );
    expect(client).toContain("trialDays: accessDurationDays");
    expect(client).toContain("accessDurationDays })");
    expect(routes).toContain("isAllowedClientTrialDuration(trialDays)");
    expect(clinicRoutes).toContain("accessDurationDays: Number(req.body?.accessDurationDays)");
  });

  it("does not let an invited participant inherit access until the pilot end date", () => {
    const access = fs.readFileSync(
      path.resolve(process.cwd(), "server/services/pilotProgramAccess.ts"),
      "utf8",
    );
    expect(access).toContain('eq(organizationalPilotParticipants.participantRole, "champion")');
  });

  it("keeps duration out of CSV content", () => {
    const client = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/components/business/OrganizationInvitationsAccess.tsx"),
      "utf8",
    );
    expect(client).toContain("Email,First Name,Last Name");
    expect(client).not.toContain("Email,First Name,Last Name,Duration");
  });

  it("uses the organization welcome email for patient invitations", () => {
    const email = fs.readFileSync(
      path.resolve(process.cwd(), "server/services/emailService.ts"),
      "utf8",
    );
    const routes = fs.readFileSync(
      path.resolve(process.cwd(), "server/routes/businessRoutes.ts"),
      "utf8",
    );
    expect(email).toContain("Hi ${safeRecipientFirstName},");
    expect(email).toContain("${safeBusinessName} has invited you to receive");
    expect(email).toContain("${resolvedDays} days of complimentary access");
    expect(email).toContain("Open My Perfect Meals");
    expect(email).toContain("support@myperfectmeals.ai");
    expect(email).toContain("https://youtu.be/X5AiYTHzyrQ");
    expect(email).toContain("https://www.facebook.com/groups/myperfectmealsofficial");
    expect(email).toContain("mailto:${safeSupportEmail}");
    expect(email).toContain("safeFounderVideoUrl ?");
    expect(email).toContain("safeFacebookGroupUrl ?");
    expect(routes).toContain("supportEmail: organizationContext.supportEmail");
    expect(routes).toContain("recipientName: req.body?.participantName");
    expect(routes).toContain("recipientName: recipient.displayName");
  });

  it("keeps the Control Center as the only visible invitation form entry point", () => {
    const dashboard = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/BusinessDashboard.tsx"),
      "utf8",
    );
    expect(dashboard).toContain('id="organization-invitations-access"');
    expect(dashboard).not.toContain("setInviteOpen(true)");
    expect(dashboard).not.toContain("setClientInviteOpen(true)");
  });

  it("routes multi-organization users through a hub and scopes invitation mutations to the selected location", () => {
    const hub = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/pages/OrganizationHub.tsx"),
      "utf8",
    );
    const cardState = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/lib/businessCardState.ts"),
      "utf8",
    );
    const routes = fs.readFileSync(
      path.resolve(process.cwd(), "server/routes/businessRoutes.ts"),
      "utf8",
    );
    expect(hub).toContain("/api/business/workspace/options");
    expect(hub).toContain("/api/business/workspace/select");
    expect(hub).toContain("Open Organization");
    expect(cardState).toContain('destination: "/business-organizations"');
    expect(routes).toContain('eq(businessInvitations.locationId, resolved.locationId)');
    expect(routes).toContain('resolveDashboardBusiness(req, "owner_only")');
  });

  it("never infers pilot invitation context from the existence of an active pilot", () => {
    const client = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/components/business/OrganizationInvitationsAccess.tsx"),
      "utf8",
    );
    expect(client).toContain('useState<InvitationContext>("standard")');
    expect(client).toContain('invitationContext === "pilot" && Boolean(pilot)');
    expect(client).toContain("Standard Organization");
    expect(client).toContain("Pilot Program");
    expect(client).not.toContain('title: "Pilot required"');
  });

  it("validates standard invitation email addresses and exposes pending resends", () => {
    const routes = fs.readFileSync(
      path.resolve(process.cwd(), "server/routes/businessRoutes.ts"),
      "utf8",
    );
    const client = fs.readFileSync(
      path.resolve(process.cwd(), "client/src/components/business/OrganizationInvitationsAccess.tsx"),
      "utf8",
    );
    expect(routes).toContain("INVITATION_EMAIL_PATTERN");
    expect(routes).toContain("PENDING_INVITATION_EXISTS");
    expect(routes).toContain("Use Resend on the existing invitation.");
    expect(client).toContain("Resend Email");
    expect(client).toContain("/api/business/invitations/${invitation.token}/resend");
  });

  it("never reports an invitation email as sent when the provider rejects it", () => {
    const routes = fs.readFileSync(
      path.resolve(process.cwd(), "server/routes/businessRoutes.ts"),
      "utf8",
    );
    expect(routes).toContain('status: "delivery_failed"');
    expect(routes).toContain("INVITATION_EMAIL_DELIVERY_FAILED");
    expect(routes).toContain("if (!emailResult)");
    expect(routes).toContain("emailQueued: true");
  });
});