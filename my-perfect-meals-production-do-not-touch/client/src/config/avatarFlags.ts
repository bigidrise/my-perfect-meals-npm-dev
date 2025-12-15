
// Avatar system feature flags
export const AVATAR_FEATURES = {
  // Main avatar system
  AVATAR_ENABLED: false,
  
  // Voice features
  VOICE_ENABLED: false,
  ELEVENLABS_ENABLED: false,
  
  // Avatar interactions
  AVATAR_CHAT_ENABLED: false,
  AVATAR_SETTINGS_ENABLED: false,
  
  // Speech features
  SPEECH_TO_TEXT_ENABLED: false,
  TEXT_TO_SPEECH_ENABLED: false
} as const;

// Helper function to check if avatar features are enabled
export const isAvatarFeatureEnabled = (feature: keyof typeof AVATAR_FEATURES): boolean => {
  return AVATAR_FEATURES[feature];
};
