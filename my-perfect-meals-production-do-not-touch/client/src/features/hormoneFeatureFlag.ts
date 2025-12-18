/**
 * Hormone & Life Stages Feature Flag
 * 
 * Controls visibility of medical-grade Hormone & Life Stages presets
 * Beta feature requiring doctor review before public release
 * 
 * SAFE DEFAULT: Disabled (false) until explicitly enabled via environment variable
 * To enable: Set VITE_FEATURE_HORMONE_LIFE_STAGES=true in .env file
 */

// Feature flag with safe default (disabled)
// Only enabled when explicitly set via environment variable
export const HORMONE_LIFE_STAGES_ENABLED = 
  import.meta.env.VITE_FEATURE_HORMONE_LIFE_STAGES === "true";

// For explicit feature checks in components
export function isHormoneLifeStagesEnabled(): boolean {
  return HORMONE_LIFE_STAGES_ENABLED;
}
