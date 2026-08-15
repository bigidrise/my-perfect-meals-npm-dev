import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "../db";
import { users, safetyOverrideAuditLogs } from "@shared/schema";
import { eq } from "drizzle-orm";

const SALT_ROUNDS = 12;
const OVERRIDE_TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const MAX_PIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface TokenData {
  userId: string; 
  expiresAt: number; 
  allergen: string;
  mealRequest: string;
}

interface AllergyEditTokenData {
  userId: string;
  expiresAt: number;
}

interface RateLimitData {
  attempts: number;
  lockedUntil: number | null;
}

const activeOverrideTokens: Record<string, TokenData> = {};
// Tokens that have been claimed by a request but not yet committed or rolled back.
// A claimed token is removed from activeOverrideTokens, so a concurrent request
// that arrives while the audit insert is in flight will see no token and be rejected.
const reservedOverrideTokens: Record<string, TokenData> = {};
const activeAllergyEditTokens: Record<string, AllergyEditTokenData> = {};
const pinRateLimits: Record<string, RateLimitData> = {};

setInterval(() => {
  const now = Date.now();
  Object.keys(activeOverrideTokens).forEach((token) => {
    if (activeOverrideTokens[token].expiresAt < now) {
      delete activeOverrideTokens[token];
    }
  });
  // Reserved tokens that were never committed or rolled back (e.g. server crashed
  // mid-insert) should also be reaped once they expire.
  Object.keys(reservedOverrideTokens).forEach((token) => {
    if (reservedOverrideTokens[token].expiresAt < now) {
      delete reservedOverrideTokens[token];
    }
  });
  Object.keys(activeAllergyEditTokens).forEach((token) => {
    if (activeAllergyEditTokens[token].expiresAt < now) {
      delete activeAllergyEditTokens[token];
    }
  });
  Object.keys(pinRateLimits).forEach((userId) => {
    const data = pinRateLimits[userId];
    if (data.lockedUntil && data.lockedUntil < now) {
      delete pinRateLimits[userId];
    }
  });
}, 60 * 1000);

function checkRateLimit(userId: string): { allowed: boolean; waitTime?: number } {
  const data = pinRateLimits[userId];
  if (!data) return { allowed: true };
  
  const now = Date.now();
  if (data.lockedUntil && data.lockedUntil > now) {
    return { allowed: false, waitTime: Math.ceil((data.lockedUntil - now) / 1000) };
  }
  
  return { allowed: true };
}

function recordFailedAttempt(userId: string): void {
  if (!pinRateLimits[userId]) {
    pinRateLimits[userId] = { attempts: 0, lockedUntil: null };
  }
  
  pinRateLimits[userId].attempts++;
  
  if (pinRateLimits[userId].attempts >= MAX_PIN_ATTEMPTS) {
    pinRateLimits[userId].lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
}

function clearRateLimit(userId: string): void {
  delete pinRateLimits[userId];
}

/**
 * Test-only: wipes all in-process token state to simulate a server restart.
 * Never call this in production code.
 * @internal
 */
export function _resetTokenStoreForTesting(): void {
  for (const k of Object.keys(activeOverrideTokens)) delete activeOverrideTokens[k];
  for (const k of Object.keys(reservedOverrideTokens)) delete reservedOverrideTokens[k];
  for (const k of Object.keys(activeAllergyEditTokens)) delete activeAllergyEditTokens[k];
}

export type SafetyMode = "STRICT" | "CUSTOM" | "CUSTOM_AUTHENTICATED";

export interface PinSetResult {
  success: boolean;
  error?: string;
}

export interface PinVerifyResult {
  success: boolean;
  overrideToken?: string;
  error?: string;
}

export interface OverrideTokenData {
  userId: string;
  allergen: string;
  mealRequest: string;
}

function validatePinFormat(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export async function hasUserSetPin(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ safetyPinHash: users.safetyPinHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  return !!(user?.safetyPinHash);
}

export async function setUserPin(userId: string, pin: string): Promise<PinSetResult> {
  if (!validatePinFormat(pin)) {
    return { success: false, error: "PIN must be exactly 4 digits" };
  }

  const hash = await bcrypt.hash(pin, SALT_ROUNDS);
  
  await db
    .update(users)
    .set({ 
      safetyPinHash: hash,
      safetyPinSetAt: new Date()
    })
    .where(eq(users.id, userId));

  return { success: true };
}

export async function changeUserPin(
  userId: string, 
  currentPin: string, 
  newPin: string
): Promise<PinSetResult> {
  if (!validatePinFormat(newPin)) {
    return { success: false, error: "New PIN must be exactly 4 digits" };
  }

  const [user] = await db
    .select({ safetyPinHash: users.safetyPinHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.safetyPinHash) {
    return { success: false, error: "No PIN set" };
  }

  const valid = await bcrypt.compare(currentPin, user.safetyPinHash);
  if (!valid) {
    return { success: false, error: "Current PIN is incorrect" };
  }

  const hash = await bcrypt.hash(newPin, SALT_ROUNDS);
  
  await db
    .update(users)
    .set({ 
      safetyPinHash: hash,
      safetyPinSetAt: new Date()
    })
    .where(eq(users.id, userId));

  return { success: true };
}

export async function removeUserPin(
  userId: string, 
  currentPin: string
): Promise<PinSetResult> {
  const [user] = await db
    .select({ safetyPinHash: users.safetyPinHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.safetyPinHash) {
    return { success: false, error: "No PIN set" };
  }

  const valid = await bcrypt.compare(currentPin, user.safetyPinHash);
  if (!valid) {
    return { success: false, error: "Current PIN is incorrect" };
  }

  await db
    .update(users)
    .set({ 
      safetyPinHash: null,
      safetyPinSetAt: null
    })
    .where(eq(users.id, userId));

  return { success: true };
}

export async function verifyPinAndIssueOverrideToken(
  userId: string,
  pin: string,
  allergen: string,
  mealRequest: string
): Promise<PinVerifyResult> {
  // Check rate limit first
  const rateCheck = checkRateLimit(userId);
  if (!rateCheck.allowed) {
    return { 
      success: false, 
      error: `Too many failed attempts. Please wait ${rateCheck.waitTime} seconds before trying again.` 
    };
  }

  const [user] = await db
    .select({ safetyPinHash: users.safetyPinHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.safetyPinHash) {
    return { success: false, error: "No Safety PIN set. Please set one in your profile." };
  }

  const valid = await bcrypt.compare(pin, user.safetyPinHash);
  if (!valid) {
    recordFailedAttempt(userId);
    return { success: false, error: "Incorrect PIN" };
  }

  // Success - clear rate limit counter
  clearRateLimit(userId);

  const overrideToken = crypto.randomBytes(32).toString("hex");
  
  activeOverrideTokens[overrideToken] = {
    userId,
    allergen,
    mealRequest,
    expiresAt: Date.now() + OVERRIDE_TOKEN_EXPIRY_MS
  };

  return { success: true, overrideToken };
}

/**
 * Atomically claim an override token for a single use.
 *
 * The token is immediately moved from activeOverrideTokens to
 * reservedOverrideTokens so any concurrent request that arrives while the
 * audit insert is in flight sees no active token and is rejected. This
 * preserves the one-time-token guarantee even under parallel requests.
 *
 * Returns the token data on success, or null if the token is invalid,
 * expired, belongs to a different user, or has already been claimed by
 * another concurrent request.
 *
 * After calling this:
 * - On audit success  → call commitOverrideToken(token) to permanently delete it.
 * - On audit failure  → call rollbackOverrideToken(token) to restore it so the
 *                       user can retry without re-entering their PIN.
 */
export function claimOverrideToken(
  token: string,
  userId: string
): OverrideTokenData | null {
  const data = activeOverrideTokens[token];

  if (!data) {
    return null; // unknown, already claimed, or already committed
  }

  if (data.userId !== userId) {
    return null;
  }

  if (data.expiresAt < Date.now()) {
    delete activeOverrideTokens[token];
    return null;
  }

  // Atomically move to reserved — any concurrent claimant now sees nothing.
  reservedOverrideTokens[token] = data;
  delete activeOverrideTokens[token];

  return {
    userId: data.userId,
    allergen: data.allergen,
    mealRequest: data.mealRequest
  };
}

/**
 * Permanently delete a claimed token after the audit insert has committed.
 * Must only be called after logSafetyOverride has succeeded.
 */
export function commitOverrideToken(token: string): void {
  delete reservedOverrideTokens[token];
}

/**
 * Restore a claimed token to the active pool after an audit insert failure,
 * allowing the user to retry without re-entering their PIN.
 * Must only be called from within a catch block after claimOverrideToken.
 */
export function rollbackOverrideToken(token: string): void {
  const data = reservedOverrideTokens[token];
  if (data) {
    // Only restore if the token hasn't expired while the insert was in flight.
    if (data.expiresAt >= Date.now()) {
      activeOverrideTokens[token] = data;
    }
    delete reservedOverrideTokens[token];
  }
}

/**
 * @deprecated Use claimOverrideToken + commitOverrideToken (and
 * rollbackOverrideToken on failure) so the token survives an audit insert
 * failure and concurrent requests cannot both authorize with the same token.
 */
export function validateAndConsumeOverrideToken(
  token: string,
  userId: string
): OverrideTokenData | null {
  const data = claimOverrideToken(token, userId);
  if (data) {
    commitOverrideToken(token);
  }
  return data;
}

export async function logSafetyOverride(
  userId: string,
  mealRequest: string,
  allergenTriggered: string,
  builderId?: string,
  overrideReason?: string,
  correlationId?: string
): Promise<void> {
  await db.insert(safetyOverrideAuditLogs).values({
    userId,
    mealRequest,
    allergenTriggered,
    safetyMode: "CUSTOM_AUTHENTICATED",
    builderId,
    overrideReason,
    correlationId
  });
}

const ALLERGY_EDIT_TOKEN_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

export async function createAllergyEditToken(
  userId: string,
  pin: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  const rateCheck = checkRateLimit(userId);
  if (!rateCheck.allowed) {
    return { success: false, error: `Too many attempts. Try again in ${rateCheck.waitTime} seconds.` };
  }

  const [user] = await db
    .select({ safetyPinHash: users.safetyPinHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.safetyPinHash) {
    return { success: false, error: "No Safety PIN set. Please set a PIN first." };
  }

  const valid = await bcrypt.compare(pin, user.safetyPinHash);
  if (!valid) {
    recordFailedAttempt(userId);
    return { success: false, error: "Incorrect PIN" };
  }

  clearRateLimit(userId);

  const token = crypto.randomBytes(32).toString("hex");
  activeAllergyEditTokens[token] = {
    userId,
    expiresAt: Date.now() + ALLERGY_EDIT_TOKEN_EXPIRY_MS
  };

  return { success: true, token };
}

export function validateAllergyEditToken(
  token: string,
  userId: string
): { valid: boolean; error?: string } {
  const tokenData = activeAllergyEditTokens[token];
  
  if (!tokenData) {
    return { valid: false, error: "Invalid or expired token" };
  }

  if (tokenData.userId !== userId) {
    return { valid: false, error: "Token does not match user" };
  }

  if (tokenData.expiresAt < Date.now()) {
    delete activeAllergyEditTokens[token];
    return { valid: false, error: "Token has expired" };
  }

  delete activeAllergyEditTokens[token];
  return { valid: true };
}

export function hasValidAllergyEditToken(userId: string): boolean {
  const now = Date.now();
  return Object.values(activeAllergyEditTokens).some(
    (tokenData) => tokenData.userId === userId && tokenData.expiresAt > now
  );
}
