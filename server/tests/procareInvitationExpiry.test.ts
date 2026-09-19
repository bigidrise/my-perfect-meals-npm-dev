import {
  createProCareInvitationExpiry,
  PROCARE_INVITATION_VALIDITY_DAYS,
} from "../lib/procareInvitationExpiry";

describe("ProCare invitation expiry", () => {
  it("keeps care-team and Studio invitations valid for 14 days", () => {
    const createdAt = new Date("2026-09-18T12:00:00.000Z");
    const expiresAt = createProCareInvitationExpiry(createdAt);

    expect(PROCARE_INVITATION_VALIDITY_DAYS).toBe(14);
    expect(expiresAt.toISOString()).toBe("2026-10-02T12:00:00.000Z");
    expect(createdAt.toISOString()).toBe("2026-09-18T12:00:00.000Z");
  });
});