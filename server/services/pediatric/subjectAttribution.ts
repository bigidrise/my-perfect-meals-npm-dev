import { createHmac, timingSafeEqual } from "node:crypto";

const VERSION = "v1";

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) throw new Error("SESSION_SECRET is required for pediatric subject attribution");
  return value;
}

function payload(actorUserId: string, childProfileId: string): string {
  return `${VERSION}:${actorUserId}:${childProfileId}`;
}

export function signPediatricSubject(
  actorUserId: string,
  childProfileId: string,
): string {
  return createHmac("sha256", secret())
    .update(payload(actorUserId, childProfileId))
    .digest("base64url");
}

export function verifyPediatricSubject(
  actorUserId: string,
  childProfileId: string,
  token: unknown,
): boolean {
  if (typeof token !== "string" || !token) return false;
  const expected = signPediatricSubject(actorUserId, childProfileId);
  const actualBuffer = Buffer.from(token);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer);
}