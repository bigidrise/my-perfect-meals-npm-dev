/**
 * useChefVoice - Hook for Chef voice narration
 * Routes through VoiceManager for branded voice only
 * 
 * @deprecated Use useVoice() from VoiceProvider instead for new code
 */

import { useCallback } from "react";
import { voiceManager } from "@/voice/VoiceManager";
import { LEGACY_CHEF_NARRATION_ENABLED } from "@shared/legacyNarration";

export function useChefVoice() {
  const speak = useCallback(async (text: string, onEnd?: () => void) => {
    if (!LEGACY_CHEF_NARRATION_ENABLED) {
      onEnd?.();
      return;
    }
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

  const preload = useCallback(async () => {
    if (!LEGACY_CHEF_NARRATION_ENABLED) return;
    await voiceManager.preload();
  }, []);

  return { speak, stop, preload };
}
