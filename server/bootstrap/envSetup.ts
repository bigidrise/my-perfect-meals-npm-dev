/**
 * Shared Environment Bootstrap Module
 * 
 * This module MUST be imported at the top of both:
 * - server/index.ts (development)
 * - server/prod.ts (production)
 * 
 * It ensures environment variables are aliased consistently across all environments.
 * Any drift between dev and prod entrypoints caused the Jan 2026 fallback bug.
 */

// Alias VITE_OPENAI_API_KEY to OPENAI_API_KEY if the latter isn't set
// (VITE_ prefix is for client-side Vite builds, server code uses OPENAI_API_KEY)
if (!process.env.OPENAI_API_KEY && process.env.VITE_OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = process.env.VITE_OPENAI_API_KEY;
  console.log("✅ Aliased VITE_OPENAI_API_KEY to OPENAI_API_KEY");
}

// Boot-time health check logging
export function logBootStatus(environment: 'development' | 'production') {
  console.log("========================================");
  console.log(`[BOOT] My Perfect Meals - ${environment.charAt(0).toUpperCase() + environment.slice(1)} Server`);
  console.log("[BOOT] OpenAI enabled:", !!process.env.OPENAI_API_KEY);
  console.log("[BOOT] OpenAI key length:", process.env.OPENAI_API_KEY?.length || 0);
  console.log("[BOOT] Database URL present:", !!process.env.DATABASE_URL);
  console.log("[BOOT] S3 bucket:", process.env.S3_BUCKET_NAME || "NOT SET");
  console.log("[BOOT] AWS region:", process.env.AWS_REGION || "NOT SET");
  console.log("========================================");
  
  // Return status for programmatic checks
  return {
    openAI: !!process.env.OPENAI_API_KEY,
    openAIKeyLength: process.env.OPENAI_API_KEY?.length || 0,
    database: !!process.env.DATABASE_URL,
    s3Bucket: process.env.S3_BUCKET_NAME || null,
    awsRegion: process.env.AWS_REGION || null
  };
}

// Validate critical environment variables
export function validateCriticalEnv(): { valid: boolean; missing: string[] } {
  const critical = [
    { key: 'OPENAI_API_KEY', fallback: 'VITE_OPENAI_API_KEY' },
    { key: 'DATABASE_URL', fallback: null },
  ];
  
  const missing: string[] = [];
  
  for (const { key, fallback } of critical) {
    const hasKey = !!process.env[key];
    const hasFallback = fallback ? !!process.env[fallback] : false;
    
    if (!hasKey && !hasFallback) {
      missing.push(key);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing
  };
}
