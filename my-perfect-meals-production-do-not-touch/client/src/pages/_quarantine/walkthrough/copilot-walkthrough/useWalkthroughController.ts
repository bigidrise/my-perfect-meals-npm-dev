import { useState, useEffect, useCallback, useRef } from "react";
import { walkthroughEngine } from "./WalkthroughScriptEngine";
import { getScript } from "./ScriptRegistry";
import type { WalkthroughState, WalkthroughEvent } from "./WalkthroughTypes";
import type { SpotlightStep } from "../SpotlightOverlay";

/**
 * React hook for controlling walkthroughs
 * Bridges the WalkthroughScriptEngine with UI components
 */
export function useWalkthroughController() {
  const [state, setState] = useState<WalkthroughState>(
    walkthroughEngine.getState()
  );
  const [currentSpotlightStep, setCurrentSpotlightStep] = useState<SpotlightStep | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Subscribe to engine events
  useEffect(() => {
    const handleEvent = (event: WalkthroughEvent) => {
      console.log("[useWalkthroughController] Event:", event);
      
      // Update state
      setState(walkthroughEngine.getState());

      // Update spotlight step only when step is ready (element found)
      if (event.type === "step_ready") {
        updateSpotlightStep();
      } else if (event.type === "started" || event.type === "step_changed") {
        // Clear spotlight until step_ready fires
        setCurrentSpotlightStep(null);
      } else if (event.type === "completed" || event.type === "cancelled") {
        setCurrentSpotlightStep(null);
      }
    };

    unsubscribeRef.current = walkthroughEngine.addEventListener(handleEvent);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // Update spotlight step from current engine step
  const updateSpotlightStep = useCallback(() => {
    const step = walkthroughEngine.getCurrentStep();
    
    if (!step) {
      setCurrentSpotlightStep(null);
      return;
    }

    // Convert engine step to SpotlightStep format
    const spotlightStep: SpotlightStep | null = step.target
      ? {
          target: step.target,
          instruction: step.description,
          action: step.waitForAction !== "none" && step.waitForAction !== "navigation"
            ? step.waitForAction
            : undefined,
        }
      : null;

    setCurrentSpotlightStep(spotlightStep);
  }, []);

  // Start a walkthrough by script ID
  const startWalkthrough = useCallback(async (scriptId: string) => {
    const script = getScript(scriptId);
    
    if (!script) {
      console.error(`[useWalkthroughController] Script not found: ${scriptId}`);
      return false;
    }

    await walkthroughEngine.start(script);
    updateSpotlightStep();
    return true;
  }, [updateSpotlightStep]);

  // Navigation controls
  const next = useCallback(() => walkthroughEngine.next(), []);
  const previous = useCallback(() => walkthroughEngine.previous(), []);
  const skip = useCallback(() => walkthroughEngine.skip(), []);
  const retry = useCallback(() => walkthroughEngine.retry(), []);
  const cancel = useCallback(() => walkthroughEngine.cancel(), []);

  return {
    state,
    currentSpotlightStep,
    startWalkthrough,
    next,
    previous,
    skip,
    retry,
    cancel,
  };
}
