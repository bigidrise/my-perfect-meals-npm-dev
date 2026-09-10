import {
  MAX_ORGANIZATION_INVITATION_BATCH,
  reviewOrganizationInvitationRecipients,
} from "../services/organizationInvitationBatchService";

describe("organization invitation batch review", () => {
  it("normalizes recipients and preserves optional names", () => {
    const result = reviewOrganizationInvitationRecipients([
      { email: "  Patient@Example.COM ", firstName: " Jamie ", lastName: " Smith " },
    ]);
    expect(result.counts).toEqual({ total: 1, valid: 1, duplicates: 0, existingMembers: 0, invalid: 0 });
    expect(result.valid[0]).toMatchObject({
      email: "patient@example.com",
      firstName: "Jamie",
      lastName: "Smith",
      displayName: "Jamie Smith",
      row: 1,
    });
  });

  it("separates invalid, duplicate, pending, and existing-member identities", () => {
    const result = reviewOrganizationInvitationRecipients([
      { email: "valid@example.com" },
      { email: "VALID@example.com" },
      { email: "not-an-email" },
      { email: "existing@example.com" },
      { email: "member@example.com" },
    ], ["existing@example.com"], ["member@example.com"]);
    expect(result.counts).toEqual({ total: 5, valid: 1, duplicates: 2, existingMembers: 1, invalid: 1 });
    expect(result.duplicates.map((entry) => entry.reason)).toEqual([
      "Duplicate within this batch.",
      "Already invited or enrolled in this pilot.",
    ]);
    expect(result.existingMembers[0].reason).toBe("Already an active member of this organization.");
  });

  it("rejects empty and oversized batches", () => {
    expect(() => reviewOrganizationInvitationRecipients([])).toThrow("Add at least one recipient.");
    expect(() => reviewOrganizationInvitationRecipients(
      Array.from({ length: MAX_ORGANIZATION_INVITATION_BATCH + 1 }, (_, index) => ({
        email: `patient-${index}@example.com`,
      })),
    )).toThrow(`at most ${MAX_ORGANIZATION_INVITATION_BATCH}`);
  });
});