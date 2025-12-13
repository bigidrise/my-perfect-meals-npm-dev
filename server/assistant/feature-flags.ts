// Feature flags for gradual rollout of enhanced avatar capabilities
export const FeatureFlags = {
  // Enhanced Avatar Pipeline (flag-controlled)
  ENHANCED_AVATAR_ENABLED: process.env.NODE_ENV === "development" || process.env.ENHANCED_AVATAR_ENABLED === "true",
  
  // Individual capabilities (can be toggled independently)
  AVATAR_NAVIGATION: true,
  AVATAR_SMART_QA: true,
  AVATAR_PERSONALIZATION: true,
  AVATAR_ACCESSIBILITY: true,
  
  // Hormone & Life Stages (Beta - Doctor Review Required)
  // Set to false to hide from navigation until clinical review is complete
  HORMONE_LIFE_STAGES: process.env.NODE_ENV === "development" || process.env.FEATURE_HORMONE_LIFE_STAGES === "true",
} as const;