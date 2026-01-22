/**
 * useChefVoice - Hook for Chef voice narration
 * Routes through VoiceManager for branded voice only
 * 
 * @deprecated Use useVoice() from VoiceProvider instead for new code
 */

import { useCallback } from "react";
import { voiceManager } from "@/voice/VoiceManager";

export function useChefVoice() {
  const speak = useCallback(async (text: string, onEnd?: () => void) => {
    if (!text) {
      onEnd?.();
      return;
    }

    const result = await voiceManager.speak(text, onEnd);
    if (result.status === 'not_ready') {
      console.log('[useChefVoice] Voice not ready, attempting preload...');
      await voiceManager.preload();
      await voiceManager.speak(text, onEnd);
    }
  }, []);

  const stop = useCallback(() => {
    voiceManager.stop();
  }, []);

  return { speak, stop };
}
