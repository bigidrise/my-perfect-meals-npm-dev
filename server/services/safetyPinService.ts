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
const activeAllergyEditTokens: Record<string, AllergyEditTokenData> = {};
const pinRateLimits: Record<string, RateLimitData> = {};

setInterval(() => {
  const now = Date.now();
  Object.keys(activeOverrideTokens).forEach((token) => {
    if (activeOverrideTokens[token].expiresAt < now) {
      delete activeOverrideTokens[token];
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

export function validateAndConsumeOverrideToken(
  token: string,
  userId: string
): OverrideTokenData | null {
  const data = activeOverrideTokens[token];
  
  if (!data) {
    return null;
  }

  if (data.userId !== userId) {
    return null;
  }

  if (data.expiresAt < Date.now()) {
    delete activeOverrideTokens[token];
    return null;
  }

  delete activeOverrideTokens[token];
  
  return {
    userId: data.userId,
    allergen: data.allergen,
    mealRequest: data.mealRequest
  };
}

export async function logSafetyOverride(
  userId: string,
  mealRequest: string,
  allergenTriggered: string,
  builderId?: string,
  overrideReason?: string
): Promise<void> {
  await db.insert(safetyOverrideAuditLogs).values({
    userId,
    mealRequest,
    allergenTriggered,
    safetyMode: "CUSTOM_AUTHENTICATED",
    builderId,
    overrideReason
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
