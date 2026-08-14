/**
 * refinementToken.ts
 *
 * HMAC-SHA256 signed token for the refinement preview/confirm/restore flow.
 * No JWT library needed — we use Node's built-in crypto module.
 *
 * Token format:  base64url(JSON payload) + "." + base64url(HMAC-SHA256 signature)
 *
 * The secret is SESSION_SECRET. Any token tamper (payload mutation, wrong secret,
 * expired TTL) is rejected with a clear error.
 */

import { createHmac } from "crypto";

const SECRET = process.env.SESSION_SECRET ?? "mpm-session-secret-dev-only";

// ── Helpers ───────────────────────────────────────────────────────────────────

function toBase64Url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function fromBase64Url(s: string): Buffer {
  // Pad to multiple of 4
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") +
    "=".repeat((4 - (s.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function sign(payload: string): string {
  return toBase64Url(
    createHmac("sha256", SECRET).update(payload).digest(),
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Encode and sign a payload object into a token string. */
export function encodeToken<T extends object>(payload: T): string {
  const payloadStr = toBase64Url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig        = sign(payloadStr);
  return `${payloadStr}.${sig}`;
}

/**
 * Decode and verify a token string.
 * @throws Error with a user-safe message on any failure.
 */
export function decodeToken<T extends { exp: number }>(token: string): T {
  const parts = token.split(".");
  if (parts.length !== 2) {
    throw new Error("Invalid refinement token.");
  }
  const [payloadB64, sigB64] = parts;

  // Verify signature
  const expectedSig = sign(payloadB64);
  if (sigB64 !== expectedSig) {
    throw new Error("Refinement token signature invalid.");
  }

  // Decode payload
  let payload: T;
  try {
    payload = JSON.parse(fromBase64Url(payloadB64).toString("utf8")) as T;
  } catch {
    throw new Error("Refinement token payload could not be decoded.");
  }

  // Check expiry
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp < nowSec) {
    throw new Error("Refinement token has expired. Please preview again.");
  }

  return payload;
}

/** Unix timestamp (seconds) N minutes from now. */
export function expireInMinutes(minutes: number): number {
  return Math.floor(Date.now() / 1000) + minutes * 60;
}
