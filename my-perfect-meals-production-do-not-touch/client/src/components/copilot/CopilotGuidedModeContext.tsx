import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

const GUIDED_MODE_KEY = 'copilot_guided_mode';

interface CopilotGuidedModeContextValue {
  isGuidedModeEnabled: boolean;
  enableGuidedMode: () => void;
  disableGuidedMode: () => void;
  toggleGuidedMode: () => void;
}

const CopilotGuidedModeContext = createContext<CopilotGuidedModeContextValue | null>(null);

function getStoredGuidedMode(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const saved = localStorage.getItem(GUIDED_MODE_KEY);
    if (saved === null) return true;
    return saved === 'true';
  } catch {
    return true;
  }
}

function setStoredGuidedMode(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GUIDED_MODE_KEY, enabled ? 'true' : 'false');
  } catch {
    console.warn('Failed to persist guided mode preference');
  }
}

export function CopilotGuidedModeProvider({ children }: { children: React.ReactNode }) {
  const [isGuidedModeEnabled, setIsGuidedModeEnabled] = useState<boolean>(true);

  useEffect(() => {
    setIsGuidedModeEnabled(getStoredGuidedMode());
  }, []);

  const enableGuidedMode = useCallback(() => {
    setIsGuidedModeEnabled(true);
    setStoredGuidedMode(true);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('copilot-guided-mode-changed', { detail: { enabled: true } }));
    }
  }, []);

  const disableGuidedMode = useCallback(() => {
    setIsGuidedModeEnabled(false);
    setStoredGuidedMode(false);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('copilot-guided-mode-changed', { detail: { enabled: false } }));
    }
  }, []);

  const toggleGuidedMode = useCallback(() => {
    if (isGuidedModeEnabled) {
      disableGuidedMode();
    } else {
      enableGuidedMode();
    }
  }, [isGuidedModeEnabled, enableGuidedMode, disableGuidedMode]);

  return (
    <CopilotGuidedModeContext.Provider
      value={{
        isGuidedModeEnabled,
        enableGuidedMode,
        disableGuidedMode,
        toggleGuidedMode,
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
