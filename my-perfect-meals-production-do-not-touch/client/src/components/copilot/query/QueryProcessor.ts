/**
 * QueryProcessor Utilities - Helper functions for dual input system
 * 
 * This module provides utility functions for voice/text input processing.
 * All actual query processing routes through existing Phase B pipeline (CopilotCommandRegistry)
 * to preserve locked logic for hubs, Spotlight, NL engine, etc.
 */

/**
 * Check if query is likely mis-transcribed (for voice fallback)
 */
export function isLikelyMisheard(transcript: string, confidence?: number): boolean {
  // Empty or very short transcripts
  if (!transcript || transcript.trim().length < 2) {
    return true;
  }
  
  // Low confidence score from Whisper
  if (confidence !== undefined && confidence < 0.5) {
    return true;
  }
  
  // Contains only gibberish characters
  const hasOnlyNonAlpha = !/[a-zA-Z]/.test(transcript);
  if (hasOnlyNonAlpha) {
    return true;
  }
  
  return false;
}
