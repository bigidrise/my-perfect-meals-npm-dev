
// Server-side avatar feature flags
export const SERVER_AVATAR_FEATURES = {
  // Voice processing
  VOICE_TRANSCRIPTION_ENABLED: false,
  VOICE_COMMAND_PARSING_ENABLED: false,
  
  // ElevenLabs integration
  ELEVENLABS_API_ENABLED: false,
  
  // Avatar chat
  AVATAR_ASSISTANT_ENABLED: false,
  
  // Avatar context
  AVATAR_CONTEXT_ENABLED: false
} as const;

// Helper function to check server avatar features
export const isServerAvatarFeatureEnabled = (feature: keyof typeof SERVER_AVATAR_FEATURES): boolean => {
  return SERVER_AVATAR_FEATURES[feature];
};
