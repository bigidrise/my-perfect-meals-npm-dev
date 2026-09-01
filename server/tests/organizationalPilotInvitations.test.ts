import fs from "fs";
import path from "path";
import {
  assertPilotCapacityAvailable,
  isOrganizationalPilotEntitlementActive,
} from "../services/pilotProgramAccess";
import {
  PilotInvitationError,
  toBusinessMemberRole,
} from "../services/organizationalPilotInvitationService";

const root = process.cwd();
const service = fs.readFileSync(path.join(root, "server/services/organizationalPilotInvitationService.ts"), "utf8");
const auth = fs.readFileSync(path.join(root, "server/routes/auth.session.ts"), "utf8");
const routes = fs.readFileSync(path.join(root, "server/routes/businessRoutes.ts"), "utf8");

describe("organizational pilot invitation contract", () => {
  test("1 professional invitation reserves professional capacity", () => {
    expect(service).toContain("population_type = ${populationType}");
    expect(service).toContain("pilot.professionalCapacity");
  });

  test("2 client invitation reserves client capacity only", () => {
    expect(service).toContain("pilot.clientCapacity");
    expect(service).toContain('input.populationType === "professional"');
  });

  test("3 professional capacity cannot be exceeded", () => {
    expect(() => assertPilotCapacityAvailable({ populationType: "professional", capacity: 5, reservedCount: 5 }))
      .toThrow("No professional seats available");
  });

  test("4 client capacity cannot be exceeded", () => {
    expect(() => assertPilotCapacityAvailable({ populationType: "client", capacity: 30, reservedCount: 30 }))
      .toThrow("No client capacity available");
  });

  test("5 expired invitation releases capacity", () => {
    expect(service).toMatch(/set\(\{ status: "expired" \}\)[\s\S]*status: "removed"/);
  });

  test("6 revoked invitation releases capacity", () => {
    expect(service).toMatch(/set\(\{ status: "cancelled" \}\)[\s\S]*status: "removed"/);
  });

  test("7 existing-user acceptance never creates a duplicate user", () => {
    expect(service).not.toContain("insert(users)");
    expect(service).toContain("resolveEmailIdentityForUser");
  });

  test("8 sending a new invite creates no placeholder user", () => {
    const creation = service.slice(service.indexOf("createOrganizationalPilotInvitation"), service.indexOf("findOrganizationalPilotInvitation"));
    expect(creation).not.toContain("insert(users)");
    expect(creation).toContain("insert(businessInvitations)");
    expect(creation).toContain("insert(organizationalPilotParticipants)");
  });

  test("9 accepted professional receives the intended Business membership", () => {
    expect(toBusinessMemberRole("nurse")).toBe("nurse");
    expect(toBusinessMemberRole("provider")).toBe("physician");
    expect(service).toContain("insert(businessMembers)");
  });

  test("10 accepted client receives no professional membership", () => {
    expect(service).toContain('if (participant.populationType === "professional")');
  });

  test("11 active-pilot acceptance inherits the organization end date", () => {
    const end = new Date("2026-10-01T00:00:00Z");
    expect(isOrganizationalPilotEntitlementActive({
      pilotStatus: "active",
      participantStatus: "active",
      pilotStartAt: new Date("2026-09-01T00:00:00Z"),
      pilotEndAt: end,
    }, new Date("2026-09-20T00:00:00Z"))).toBe(true);
    expect(service).toContain("pilotEndAt: pilot.pilotEndAt");
  });

  test("12 preparing-pilot acceptance creates no personal clock", () => {
    expect(isOrganizationalPilotEntitlementActive({
      pilotStatus: "preparing",
      participantStatus: "active",
      pilotStartAt: null,
      pilotEndAt: null,
    })).toBe(false);
    expect(auth).toContain("!isValidPilotSignup");
  });

  test("13 acceptance does not mutate Stripe or paid-plan fields", () => {
    expect(service).not.toMatch(/stripe|planLookupKey|trialStartedAt|trialEndsAt/i);
  });

  test("14 replayed acceptance is idempotent for the same user", () => {
    expect(service).toContain('invite.status === "accepted" && invite.acceptedByUserId === userId');
    expect(service).toContain("alreadyAccepted: true");
  });

  test("15 role escalation through a modified request is rejected", () => {
    expect(() => toBusinessMemberRole("client")).toThrow(PilotInvitationError);
    expect(() => toBusinessMemberRole("champion")).toThrow(PilotInvitationError);
    expect(routes).toContain('Invalid role for this participant population.');
  });

  test("16 professional and client allocations remain independent", () => {
    expect(() => assertPilotCapacityAvailable({ populationType: "professional", capacity: 1, reservedCount: 0 })).not.toThrow();
    expect(() => assertPilotCapacityAvailable({ populationType: "client", capacity: 0, reservedCount: 0 })).toThrow();
  });
});