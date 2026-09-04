import crypto from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { users } from "@shared/schema";
import { db } from "../db";

export const BEARER_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function isBearerTokenFresh(
  createdAt: Date | null | undefined,
  now = new Date(),
): boolean {
  return (
    createdAt instanceof Date &&
    Number.isFinite(createdAt.getTime()) &&
    createdAt.getTime() > now.getTime() - BEARER_TOKEN_MAX_AGE_MS
  );
}

export async function findUserByValidAuthToken(
  token: string,
  now = new Date(),
) {
  if (!token) return null;
  const cutoff = new Date(now.getTime() - BEARER_TOKEN_MAX_AGE_MS);
  const [user] = await db
    .select()
    .from(users)
    .where(and(
      eq(users.authToken, token),
      gt(users.authTokenCreatedAt, cutoff),
    ))
    .limit(1);
  return user ?? null;
}

export async function rotateAuthToken(
  userId: string,
  options: { mfaVerified?: boolean } = {},
) {
  const authToken = crypto.randomBytes(32).toString("hex");
  const authTokenCreatedAt = new Date();
  const authTokenMfaVerifiedAt = options.mfaVerified ? authTokenCreatedAt : null;
  await db
    .update(users)
    .set({ authToken, authTokenCreatedAt, authTokenMfaVerifiedAt })
    .where(eq(users.id, userId));
  return { authToken, authTokenCreatedAt, authTokenMfaVerifiedAt };
}

export async function revokeAuthToken(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ authToken: null, authTokenCreatedAt: null, authTokenMfaVerifiedAt: null })
    .where(eq(users.id, userId));
}