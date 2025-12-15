import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from "react";

export type CopilotMode = "idle" | "listening" | "thinking";

export type CopilotPersona =
  | "default"
  | "diabetic"
  | "glp1"
  | "athlete"
  | "family"
  | "kids";

export interface CopilotContextInfo {
  screenId?: string; // e.g. "WEEKLY_BOARD", "FRIDGE_RESCUE"
  tags?: string[]; // e.g. ["dinner", "one-pan", "busy"]
  persona?: CopilotPersona;
}

export type CopilotAction =
  | { type: "navigate"; to: string }
  | { type: "open-modal"; id: string }
  | { type: "run-command"; id: string }
  | { type: "custom"; payload: unknown };

export interface CopilotSuggestion {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  badge?: string;
  action: CopilotAction;
  emphasis?: "low" | "medium" | "high";
}

export interface KnowledgeResponse {
  title: string;
  description: string;
  howTo?: string[];
  tips?: string[];
  type?: "knowledge" | "walkthrough";
  steps?: WalkthroughStep[];
  spokenText?: string;
  autoClose?: boolean; // If true, CopilotSheet closes when audio finishes
}

export interface WalkthroughStep {
  text: string;
  targetId?: string;
}

interface CopilotState {
  isOpen: boolean;
  mode: CopilotMode;
  contextInfo: CopilotContextInfo;
  suggestions: CopilotSuggestion[];
  lastQuery: string;
  lastResponse: KnowledgeResponse | null;
  targetRegistry: Set<string>;
  needsRetry: boolean; // Voice fallback flag - shows text input when voice fails
}

interface CopilotContextValue extends CopilotState {
  open: () => void;
  close: () => void;
  toggle: () => void;
  setMode: (mode: CopilotMode) => void;
  setContextInfo: (info: Partial<CopilotContextInfo>) => void;
  setSuggestions: (suggestions: CopilotSuggestion[]) => void;
  runAction: (action: CopilotAction) => void;
  setLastQuery: (q: string) => void;
  setLastResponse: (response: KnowledgeResponse | null) => void;
  registerTarget: (id: string) => void;
  unregisterTarget: (id: string) => void;
  setNeedsRetry: (needs: boolean) => void; // Set voice fallback flag
  startWalkthrough: (scriptId: string) => Promise<void>; // Add startWalkthrough method
}

const CopilotContext = createContext<CopilotContextValue | null>(null);

export const useCopilot = (): CopilotContextValue => {
  const ctx = useContext(CopilotContext);
  if (!ctx) {
    throw new Error("useCopilot must be used within CopilotProvider");
  }
  return ctx;
};

interface CopilotProviderProps {
  children: ReactNode;
  onAction?: (action: CopilotAction) => void; // integrate with router, modals, etc.
}

export const CopilotProvider: React.FC<CopilotProviderProps> = ({
  children,
  onAction,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<CopilotMode>("idle");
  const [contextInfo, setContextInfoState] = useState<CopilotContextInfo>({
    persona: "default",
    tags: [],
  });
  const [suggestions, setSuggestions] = useState<CopilotSuggestion[]>([]);
  const [lastQuery, setLastQuery] = useState("");
  const [lastResponse, setLastResponse] = useState<KnowledgeResponse | null>(null);
  const [targetRegistry, setTargetRegistry] = useState<Set<string>>(new Set());
  const [needsRetry, setNeedsRetry] = useState(false);

  const openCopilot = useCallback(() => setIsOpen(true), []); // Renamed from open to avoid conflict with openCopilot
  const close = useCallback(() => {
    setIsOpen(false);
    setMode("idle");
  }, []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const setContextInfo = useCallback((info: Partial<CopilotContextInfo>) => {
    setContextInfoState((prev) => ({
      ...prev,
      ...info,
      tags: info.tags ?? prev.tags,
    }));
  }, []);

  const registerTarget = useCallback((id: string) => {
    setTargetRegistry((prev) => new Set(prev).add(id));
  }, []);

  const unregisterTarget = useCallback((id: string) => {
    setTargetRegistry((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const runAction = useCallback(
    (action: CopilotAction) => {
      if (onAction) {
        onAction(action);
        return;
      }

      // Default no-op implementations, you wire this into router/modals
      switch (action.type) {
        case "navigate":
          console.warn("[Copilot] navigate ->", action.to);
          break;
        case "open-modal":
          console.warn("[Copilot] open-modal ->", action.id);
          break;
        case "run-command":
          console.warn("[Copilot] run-command ->", action.id);
          break;
        case "custom":
          console.warn("[Copilot] custom action ->", action.payload);
          break;
      }
    },
    [onAction],
  );

  // Walkthrough system has been quarantined - this is now a no-op
  // Users should use Quick Tour buttons instead
  const startWalkthrough = useCallback(async (_scriptId: string) => {
    console.log("Walkthrough system quarantined - use Quick Tour buttons instead");
  }, []);

  const value = useMemo<CopilotContextValue>(
    () => ({
      isOpen,
      mode,
      contextInfo,
      suggestions,
      lastQuery,
      lastResponse,
      targetRegistry,
      needsRetry,
      open: openCopilot, // Use openCopilot here
      close,
      toggle,
      setMode,
      setContextInfo,
      setSuggestions,
      runAction,
      setLastQuery,
      setLastResponse,
      registerTarget,
      unregisterTarget,
      setNeedsRetry,
      startWalkthrough, // Include startWalkthrough in the context value
    }),
    [
      isOpen,
      mode,
      contextInfo,
      suggestions,
      lastQuery,
      lastResponse,
      targetRegistry,
      needsRetry,
      openCopilot, // Include openCopilot in dependencies
      close,
      toggle,
      setContextInfo,
      runAction,
      registerTarget,
      unregisterTarget,
      startWalkthrough, // Include startWalkthrough in dependencies
    ],
  );

  return (
    <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>
  );
};