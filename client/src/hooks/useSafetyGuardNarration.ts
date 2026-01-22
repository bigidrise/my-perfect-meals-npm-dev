import { useCallback } from 'react';
import { useCopilot } from '@/components/copilot/CopilotContext';
import { SAFETY_GUARD_SCRIPTS, SafetyGuardScript } from '@/components/copilot/scripts/safetyGuardScripts';

type SafetyGuardScriptId = keyof typeof SAFETY_GUARD_SCRIPTS;

export function useSafetyGuardNarration() {
  const { setLastResponse, open, isOpen } = useCopilot();

  const narrate = useCallback((scriptId: SafetyGuardScriptId) => {
    const script = SAFETY_GUARD_SCRIPTS[scriptId];
    if (!script) {
      console.warn(`SafetyGuard script not found: ${scriptId}`);
      return;
    }

    if (!isOpen) {
      open();
    }

    setTimeout(() => {
      setLastResponse({
        title: script.title,
        description: script.spokenText,
        spokenText: script.spokenText,
        autoClose: true,
      });
    }, 300);
  }, [setLastResponse, open, isOpen]);

  const narrateBlockedAllergy = useCallback(() => narrate('blocked_allergy'), [narrate]);
  const narrateOverrideTapped = useCallback(() => narrate('override_tapped'), [narrate]);
  const narratePinAccepted = useCallback(() => narrate('pin_accepted'), [narrate]);
  const narratePinIncorrect = useCallback(() => narrate('pin_incorrect'), [narrate]);
  const narrateGenerationComplete = useCallback(() => narrate('generation_complete'), [narrate]);
  const narratePremadeBlocked = useCallback(() => narrate('premade_blocked'), [narrate]);

  return {
    narrate,
    narrateBlockedAllergy,
    narrateOverrideTapped,
    narratePinAccepted,
    narratePinIncorrect,
    narrateGenerationComplete,
    narratePremadeBlocked,
  };
}
