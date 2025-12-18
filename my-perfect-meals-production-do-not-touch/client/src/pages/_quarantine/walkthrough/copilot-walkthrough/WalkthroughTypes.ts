export type WalkthroughActionType = "click" | "input" | "change" | "blur" | "navigation" | "none";

export interface WalkthroughWaitForEvent {
  testId: string;
  event: string;
}

export interface WalkthroughScriptStep {
  id: string;
  // Legacy selector pattern (Phase C.1)
  target?: string;
  description: string; // REQUIRED for backward compatibility with Phase B scripts
  // New targetTestId pattern (Meal Builder scripts)
  targetTestId?: string;
  message?: string; // Optional override for new meal builder scripts
  spotlight?: boolean;
  end?: boolean;
  // Voice narration
  speak?: string;
  // Legacy wait pattern
  waitForAction?: WalkthroughActionType;
  // New event-driven wait pattern
  waitForEvent?: WalkthroughWaitForEvent;
  // Navigation
  navigationPath?: string;
}

export interface WalkthroughScript {
  id: string;
  featureId?: string; // Optional feature ID for meal builder scripts
  title: string;
  steps: WalkthroughScriptStep[];
  uiReady?: boolean; // Phase C.1: If false, script is dormant until UI implements required data-testid attributes
}

export interface WalkthroughState {
  isActive: boolean;
  scriptId: string | null;
  currentStepIndex: number;
  totalSteps: number;
  canGoNext: boolean;
  canGoPrevious: boolean;
}

export type WalkthroughEventType = 
  | "started"
  | "step_changed"
  | "step_ready"
  | "completed"
  | "cancelled"
  | "error";

export interface WalkthroughEvent {
  type: WalkthroughEventType;
  scriptId: string;
  stepIndex?: number;
  error?: string;
}
