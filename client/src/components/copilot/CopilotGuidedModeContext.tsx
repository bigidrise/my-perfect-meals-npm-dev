import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

const AUTOPLAY_KEY = 'copilot_autoplay_enabled';
const LEGACY_KEY = 'copilot_guided_mode';

interface CopilotGuidedModeContextValue {
  isAutoplayEnabled: boolean;
  enableAutoplay: () => void;
  disableAutoplay: () => void;
  toggleAutoplay: () => void;
  isGuidedModeEnabled: boolean;
  enableGuidedMode: () => void;
  disableGuidedMode: () => void;
  toggleGuidedMode: () => void;
}

const CopilotGuidedModeContext = createContext<CopilotGuidedModeContextValue | null>(null);

function getStoredAutoplay(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const saved = localStorage.getItem(AUTOPLAY_KEY);
    if (saved !== null) {
      return saved === 'true';
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy !== null) {
      const value = legacy === 'true';
      localStorage.setItem(AUTOPLAY_KEY, legacy);
      return value;
    }
    return true;
  } catch {
    return true;
  }
}

function setStoredAutoplay(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AUTOPLAY_KEY, enabled ? 'true' : 'false');
    localStorage.setItem(LEGACY_KEY, enabled ? 'true' : 'false');
  } catch {
    console.warn('Failed to persist autoplay preference');
  }
}

export function CopilotGuidedModeProvider({ children }: { children: React.ReactNode }) {
  const [isAutoplayEnabled, setIsAutoplayEnabled] = useState<boolean>(true);

  useEffect(() => {
    setIsAutoplayEnabled(getStoredAutoplay());
  }, []);

  const enableAutoplay = useCallback(() => {
    setIsAutoplayEnabled(true);
    setStoredAutoplay(true);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('copilot-autoplay-changed', { detail: { enabled: true } }));
      window.dispatchEvent(new CustomEvent('copilot-guided-mode-changed', { detail: { enabled: true } }));
    }
  }, []);

  const disableAutoplay = useCallback(() => {
    setIsAutoplayEnabled(false);
    setStoredAutoplay(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('copilot-autoplay-changed', { detail: { enabled: false } }));
      window.dispatchEvent(new CustomEvent('copilot-guided-mode-changed', { detail: { enabled: false } }));
    }
  }, []);

  const toggleAutoplay = useCallback(() => {
    if (isAutoplayEnabled) {
      disableAutoplay();
    } else {
      enableAutoplay();
    }
  }, [isAutoplayEnabled, enableAutoplay, disableAutoplay]);

  return (
    <CopilotGuidedModeContext.Provider
      value={{
        isAutoplayEnabled,
        enableAutoplay,
        disableAutoplay,
        toggleAutoplay,
        isGuidedModeEnabled: isAutoplayEnabled,
        enableGuidedMode: enableAutoplay,
        disableGuidedMode: disableAutoplay,
        toggleGuidedMode: toggleAutoplay,
      }}
    >
      {children}
    </CopilotGuidedModeContext.Provider>
  );
}

export function useCopilotGuidedMode() {
  const context = useContext(CopilotGuidedModeContext);
  if (!context) {
    throw new Error("useCopilotGuidedMode must be used within CopilotGuidedModeProvider");
  }
  return context;
}
