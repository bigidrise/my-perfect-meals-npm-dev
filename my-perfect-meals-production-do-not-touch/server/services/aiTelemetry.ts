/**
 * AI Telemetry Service - Observability Layer for AI Meal Generation
 * 
 * Provides visibility into AI behavior without changing user-facing behavior:
 * - Raw GPT output logging (when AI_DEBUG=true)
 * - Fallback reason tagging with structured codes
 * - Debug metadata for development mode
 * 
 * Priority 1 & 4 of AI Stability Improvement Plan
 */

import crypto from "crypto";

// === CONFIGURATION ===
const AI_DEBUG = process.env.AI_DEBUG === "true" || process.env.NODE_ENV === "development";
const LOG_RAW_OUTPUT = process.env.LOG_RAW_OUTPUT === "true" || AI_DEBUG;

// === FALLBACK REASON CODES ===
export type FallbackReasonCode =
  | "parse_failed"              // GPT response couldn't be parsed
  | "parse_default_nutrition"   // Nutrition values fell back to defaults
  | "validator_reject"          // validateMealTypeRobust rejected the meal
  | "catalog_fallback"          // Fell back to catalog instead of AI
  | "carb_derived"              // Carbs derived from calculation, not from AI
  | "instruction_fallback"      // Instructions fell back to defaults
  | "image_generation_failed"   // DALL-E image generation failed
  | "api_rate_limit"            // OpenAI rate limit hit
  | "api_timeout"               // OpenAI request timed out
  | "api_error"                 // Generic OpenAI API error
  | "circuit_breaker_open"      // Circuit breaker prevented request
  | "empty_response"            // GPT returned empty/null content
  | "schema_validation_failed"  // Zod or other schema validation failed
  | "ingredient_parse_failed"   // Individual ingredient parsing failed
  | "no_catalog_match"          // No matching meal in catalog
  | "kid_meal_fallback"         // Fell back for kid-friendly meal
  | "glycemic_filter_fallback"; // Glycemic filtering reduced options

// === TELEMETRY SESSION ===
interface TelemetrySession {
  sessionId: string;
  source: string;
  startTime: Date;
  fallbackReasons: FallbackReasonCode[];
  rawOutputHash?: string;
  parseSuccess: boolean;
  validationSuccess: boolean;
  nutritionSource: "ai" | "derived" | "default";
  ingredientParseRate: number;
}

// In-memory session storage (last 100 sessions for debugging)
const sessions: Map<string, TelemetrySession> = new Map();
const MAX_SESSIONS = 100;

// === CORE FUNCTIONS ===

/**
 * Create a new telemetry session for tracking an AI generation request
 */
export function createSession(source: string): string {
  const sessionId = crypto.randomUUID().slice(0, 12);
  
  // Clean up old sessions if we have too many
  if (sessions.size >= MAX_SESSIONS) {
    const oldest = sessions.keys().next().value;
    if (oldest) sessions.delete(oldest);
  }
  
  sessions.set(sessionId, {
    sessionId,
    source,
    startTime: new Date(),
    fallbackReasons: [],
    parseSuccess: true,
    validationSuccess: true,
    nutritionSource: "ai",
    ingredientParseRate: 1.0,
  });
  
  if (AI_DEBUG) {
    console.log(`🔍 [AI_TELEMETRY] Session created: ${sessionId} | source: ${source}`);
  }
  
  return sessionId;
}

/**
 * Log raw GPT output for debugging
 * Only logs when AI_DEBUG=true to avoid noise
 */
export function logRawOutput(
  sessionId: string,
  rawOutput: string | null | undefined,
  context?: { prompt?: string; model?: string }
): void {
  const session = sessions.get(sessionId);
  
  if (!rawOutput) {
    tagFallback(sessionId, "empty_response", "GPT returned null/empty content");
    return;
  }
  
  // Store hash for correlation without storing full content
  const hash = crypto.createHash("md5").update(rawOutput).digest("hex").slice(0, 8);
  if (session) {
    session.rawOutputHash = hash;
  }
  
  if (LOG_RAW_OUTPUT) {
    console.log(`📝 [AI_TELEMETRY] Raw output [${sessionId}] hash=${hash}`);
    console.log(`📝 [AI_TELEMETRY] Model: ${context?.model || "unknown"}`);
    console.log(`📝 [AI_TELEMETRY] Output length: ${rawOutput.length} chars`);
    
    // In full debug mode, log first 500 chars of output
    if (AI_DEBUG) {
      const preview = rawOutput.length > 500 ? rawOutput.slice(0, 500) + "..." : rawOutput;
      console.log(`📝 [AI_TELEMETRY] Preview:\n${preview}`);
    }
  }
}

/**
 * Tag a fallback with a reason code for tracking
 * This is the key function for visibility - every fallback should be tagged
 */
export function tagFallback(
  sessionId: string,
  reason: FallbackReasonCode,
  details?: string
): void {
  const session = sessions.get(sessionId);
  
  if (session && !session.fallbackReasons.includes(reason)) {
    session.fallbackReasons.push(reason);
    
    // Update session flags based on reason
    if (reason === "parse_failed" || reason === "empty_response") {
      session.parseSuccess = false;
    }
    if (reason === "validator_reject") {
      session.validationSuccess = false;
    }
    if (reason === "parse_default_nutrition" || reason === "carb_derived") {
      session.nutritionSource = "derived";
    }
  }
  
  // Always log fallbacks - this is the key visibility we need
  console.warn(`⚠️ [AI_FALLBACK] [${sessionId}] reason=${reason}${details ? ` | ${details}` : ""}`);
}

/**
 * Record ingredient parse success rate
 */
export function recordIngredientParseRate(
  sessionId: string,
  parsed: number,
  total: number
): void {
  const session = sessions.get(sessionId);
  const rate = total > 0 ? parsed / total : 1.0;
  
  if (session) {
    session.ingredientParseRate = rate;
  }
  
  if (rate < 1.0) {
    tagFallback(sessionId, "ingredient_parse_failed", `${parsed}/${total} ingredients parsed`);
  }
  
  if (AI_DEBUG) {
    console.log(`🧪 [AI_TELEMETRY] Ingredient parse rate: ${(rate * 100).toFixed(1)}% (${parsed}/${total})`);
  }
}

/**
 * Get session summary for debugging
 */
export function getSessionSummary(sessionId: string): TelemetrySession | undefined {
  return sessions.get(sessionId);
}

/**
 * Build debug metadata for meal responses (dev-only)
 * This is attached to meals in development to show exactly what happened
 */
export function buildDebugMetadata(sessionId: string): DebugMetadata | null {
  // Only return debug metadata in development
  if (process.env.NODE_ENV === "production" && !AI_DEBUG) {
    return null;
  }
  
  const session = sessions.get(sessionId);
  if (!session) {
    return {
      sessionId,
      fallbackReason: "unknown_session",
      source: "unknown",
      rawOutputHash: "n/a",
      timestamp: new Date().toISOString(),
    };
  }
  
  return {
    sessionId,
    fallbackReason: session.fallbackReasons.length > 0 
      ? session.fallbackReasons.join(",") 
      : null,
    source: session.source,
    rawOutputHash: session.rawOutputHash || "n/a",
    parseSuccess: session.parseSuccess,
    validationSuccess: session.validationSuccess,
    nutritionSource: session.nutritionSource,
    ingredientParseRate: session.ingredientParseRate,
    durationMs: Date.now() - session.startTime.getTime(),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Debug metadata type for meal responses
 */
export interface DebugMetadata {
  sessionId: string;
  fallbackReason: string | null;
  source: string;
  rawOutputHash: string;
  parseSuccess?: boolean;
  validationSuccess?: boolean;
  nutritionSource?: "ai" | "derived" | "default";
  ingredientParseRate?: number;
  durationMs?: number;
  timestamp: string;
}

/**
 * Close a session and log final summary
 */
export function closeSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  
  if (!session) return;
  
  const duration = Date.now() - session.startTime.getTime();
  const hadFallbacks = session.fallbackReasons.length > 0;
  
  if (AI_DEBUG || hadFallbacks) {
    console.log(`📊 [AI_TELEMETRY] Session closed: ${sessionId}`);
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Parse success: ${session.parseSuccess}`);
    console.log(`   Validation success: ${session.validationSuccess}`);
    console.log(`   Nutrition source: ${session.nutritionSource}`);
    console.log(`   Ingredient parse rate: ${(session.ingredientParseRate * 100).toFixed(1)}%`);
    if (hadFallbacks) {
      console.log(`   Fallback reasons: ${session.fallbackReasons.join(", ")}`);
    }
  }
}

// === AGGREGATE STATS ===

/**
 * Get aggregate statistics across recent sessions
 */
export function getAggregateStats(): {
  totalSessions: number;
  sessionsWithFallbacks: number;
  fallbackRate: number;
  topFallbackReasons: { reason: FallbackReasonCode; count: number }[];
  avgIngredientParseRate: number;
} {
  const allSessions = Array.from(sessions.values());
  const total = allSessions.length;
  
  if (total === 0) {
    return {
      totalSessions: 0,
      sessionsWithFallbacks: 0,
      fallbackRate: 0,
      topFallbackReasons: [],
      avgIngredientParseRate: 1.0,
    };
  }
  
  const withFallbacks = allSessions.filter(s => s.fallbackReasons.length > 0).length;
  
  // Count fallback reasons
  const reasonCounts = new Map<FallbackReasonCode, number>();
  for (const session of allSessions) {
    for (const reason of session.fallbackReasons) {
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    }
  }
  
  const topReasons = Array.from(reasonCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  const avgParseRate = allSessions.reduce((sum, s) => sum + s.ingredientParseRate, 0) / total;
  
  return {
    totalSessions: total,
    sessionsWithFallbacks: withFallbacks,
    fallbackRate: withFallbacks / total,
    topFallbackReasons: topReasons,
    avgIngredientParseRate: avgParseRate,
  };
}

/**
 * Log current aggregate stats (for periodic health checks)
 */
export function logHealthReport(): void {
  const stats = getAggregateStats();
  
  console.log(`\n📊 [AI_HEALTH_REPORT]`);
  console.log(`   Sessions tracked: ${stats.totalSessions}`);
  console.log(`   Fallback rate: ${(stats.fallbackRate * 100).toFixed(1)}%`);
  console.log(`   Avg ingredient parse rate: ${(stats.avgIngredientParseRate * 100).toFixed(1)}%`);
  
  if (stats.topFallbackReasons.length > 0) {
    console.log(`   Top fallback reasons:`);
    for (const { reason, count } of stats.topFallbackReasons) {
      console.log(`     - ${reason}: ${count} occurrences`);
    }
  }
  console.log();
}

// === EXPORTS ===
export default {
  createSession,
  logRawOutput,
  tagFallback,
  recordIngredientParseRate,
  getSessionSummary,
  buildDebugMetadata,
  closeSession,
  getAggregateStats,
  logHealthReport,
};
