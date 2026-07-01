/**
 * MFA Helpers — TOTP (RFC 6238) + Backup Codes
 *
 * Uses otplib v12 ESM API: TOTP class with NobleCryptoPlugin + ScureBase32Plugin.
 * generate() and verify() are async in this version.
 * window:1 allows ±30s clock drift between server and authenticator app.
 *
 * Rules:
 *  - NEVER log the raw secret or backup codes.
 *  - NEVER transmit the stored secret to the client after initial setup.
 */

import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from "otplib";
import QRCode from "qrcode";
import crypto from "crypto";

const MFA_ISSUER = "MyPerfectMeals";

const totp = new TOTP({
  window: 1, // allow ±30s clock drift
  crypto: new NobleCryptoPlugin(),
  base32: new ScureBase32Plugin(),
});

// ─── TOTP ─────────────────────────────────────────────────────────────────────

export function generateTotpSecret(): string {
  return totp.generateSecret(20); // 160-bit base32 secret
}

export async function getTotpQrDataUri(secret: string, email: string): Promise<string> {
  const uri = totp.toURI({ label: email, issuer: MFA_ISSUER, secret });
  return QRCode.toDataURL(uri);
}

export async function verifyTotp(secret: string, token: string): Promise<boolean> {
  try {
    const result = await totp.verify(token.replace(/\s/g, ""), { secret });
    return result.valid === true;
  } catch {
    return false;
  }
}

// ─── Backup codes ─────────────────────────────────────────────────────────────

export function generateBackupCodes(): string[] {
  return Array.from({ length: 8 }, () =>
    crypto.randomBytes(5).toString("hex").toUpperCase()
  );
}

export function hashBackupCode(code: string): string {
  return crypto
    .createHash("sha256")
    .update(code.trim().toUpperCase().replace(/\s/g, ""))
    .digest("hex");
}

export function verifyAndConsumeBackupCode(
  hashedCodes: string[],
  input: string
): { valid: boolean; remaining: string[] } {
  const inputHash = hashBackupCode(input);
  const idx = hashedCodes.indexOf(inputHash);
  if (idx === -1) return { valid: false, remaining: hashedCodes };
  const remaining = [...hashedCodes];
  remaining.splice(idx, 1);
  return { valid: true, remaining };
}
