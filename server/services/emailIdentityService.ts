import { db } from "../db";
import { users } from "@shared/schema";
import { sql } from "drizzle-orm";

export interface EmailIdentityCandidate {
  id: string;
  email: string;
}

export type EmailIdentityResolution =
  | { status: "not_found"; normalizedEmail: string; candidates: [] }
  | { status: "unique" | "legacy_exact"; normalizedEmail: string; user: EmailIdentityCandidate; candidates: EmailIdentityCandidate[] }
  | { status: "ambiguous"; normalizedEmail: string; candidates: EmailIdentityCandidate[] };

/**
 * Email delivery is case-insensitive, but legacy database rows may not be.
 * New account flows use this key to find candidates; mutations must still use
 * the returned primary key, never this normalized value.
 */
export function normalizeEmailIdentity(email: string): string {
  return email.trim().toLowerCase();
}

export function resolveEmailIdentity(
  candidates: EmailIdentityCandidate[],
  suppliedEmail: string,
): EmailIdentityResolution {
  const normalizedEmail = normalizeEmailIdentity(suppliedEmail);

  if (candidates.length === 0) {
    return { status: "not_found", normalizedEmail, candidates: [] };
  }

  if (candidates.length === 1) {
    return { status: "unique", normalizedEmail, user: candidates[0], candidates };
  }

  // A legacy duplicate can be selected only by its precise stored spelling.
  // This preserves access to each account without silently choosing the first
  // case-insensitive row.
  const exactMatches = candidates.filter((candidate) => candidate.email.trim() === suppliedEmail.trim());
  if (exactMatches.length === 1) {
    return {
      status: "legacy_exact",
      normalizedEmail,
      user: exactMatches[0],
      candidates,
    };
  }

  return { status: "ambiguous", normalizedEmail, candidates };
}

export async function findEmailIdentityCandidates(email: string): Promise<EmailIdentityCandidate[]> {
  const normalizedEmail = normalizeEmailIdentity(email);
  return db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(sql`LOWER(${users.email}) = ${normalizedEmail}`)
    .orderBy(users.id);
}

export async function resolveEmailIdentityForEmail(email: string): Promise<EmailIdentityResolution> {
  const candidates = await findEmailIdentityCandidates(email);
  return resolveEmailIdentity(candidates, email);
}

export async function resolveEmailIdentityForUser(
  userId: string,
): Promise<EmailIdentityResolution> {
  const userRows = await db
    .select({ email: users.email })
    .from(users)
    .where(sql`${users.id} = ${userId}`)
    .limit(1);

  if (!userRows[0]) {
    return { status: "not_found", normalizedEmail: "", candidates: [] };
  }

  return resolveEmailIdentityForEmail(userRows[0].email);
}