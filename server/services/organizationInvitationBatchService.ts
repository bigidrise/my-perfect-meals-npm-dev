import { normalizeEmailIdentity } from "./emailIdentityService";

export const MAX_ORGANIZATION_INVITATION_BATCH = 300;

export interface OrganizationInvitationRecipientInput {
  email?: unknown;
  firstName?: unknown;
  lastName?: unknown;
}

export interface ReviewedOrganizationInvitationRecipient {
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  row: number;
}

export interface InvalidOrganizationInvitationRecipient {
  row: number;
  email: string;
  reason: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned ? cleaned.slice(0, 100) : null;
}

export function reviewOrganizationInvitationRecipients(
  recipients: unknown,
  existingEmails: Iterable<string> = [],
  existingMemberEmails: Iterable<string> = [],
) {
  if (!Array.isArray(recipients)) {
    throw new Error("Recipients must be an array.");
  }
  if (recipients.length === 0) {
    throw new Error("Add at least one recipient.");
  }
  if (recipients.length > MAX_ORGANIZATION_INVITATION_BATCH) {
    throw new Error(`A batch may contain at most ${MAX_ORGANIZATION_INVITATION_BATCH} recipients.`);
  }

  const existing = new Set(Array.from(existingEmails, normalizeEmailIdentity));
  const existingMembers = new Set(Array.from(existingMemberEmails, normalizeEmailIdentity));
  const seen = new Set<string>();
  const valid: ReviewedOrganizationInvitationRecipient[] = [];
  const duplicates: InvalidOrganizationInvitationRecipient[] = [];
  const members: InvalidOrganizationInvitationRecipient[] = [];
  const invalid: InvalidOrganizationInvitationRecipient[] = [];

  recipients.forEach((raw, index) => {
    const row = index + 1;
    const record = raw && typeof raw === "object"
      ? raw as OrganizationInvitationRecipientInput
      : {};
    const suppliedEmail = typeof record.email === "string" ? record.email.trim() : "";
    const email = normalizeEmailIdentity(suppliedEmail);
    if (!EMAIL_PATTERN.test(email)) {
      invalid.push({ row, email: suppliedEmail, reason: "Enter a valid email address." });
      return;
    }
    if (seen.has(email)) {
      duplicates.push({ row, email, reason: "Duplicate within this batch." });
      return;
    }
    seen.add(email);
    if (existingMembers.has(email)) {
      members.push({ row, email, reason: "Already an active member of this organization." });
      return;
    }
    if (existing.has(email)) {
      duplicates.push({ row, email, reason: "Already invited or enrolled in this pilot." });
      return;
    }
    const firstName = cleanName(record.firstName);
    const lastName = cleanName(record.lastName);
    valid.push({
      email,
      firstName,
      lastName,
      displayName: [firstName, lastName].filter(Boolean).join(" ") || null,
      row,
    });
  });

  return {
    total: recipients.length,
    valid,
    duplicates,
    existingMembers: members,
    invalid,
    counts: {
      total: recipients.length,
      valid: valid.length,
      duplicates: duplicates.length,
      existingMembers: members.length,
      invalid: invalid.length,
    },
  };
}