import { useEffect } from "react";
import { useSimpleWalkthrough } from "./SimpleWalkthroughContext";
import { SimpleStepOverlay } from "./SimpleStepOverlay";
import { registerSimpleWalkthroughStarter, registerFlowStarter } from "./simpleWalkthroughHelper";

/**
 * SimpleWalkthroughManager
 * 
 * Manages the simple walkthrough overlay lifecycle.
 * Renders the overlay when a walkthrough is active.
 * Completely independent of voice/TTS systems.
 */
export function SimpleWalkthroughManager() {
  const { state, startWalkthrough, startFlow, nextStep } = useSimpleWalkthrough();

  useEffect(() => {
    registerSimpleWalkthroughStarter(startWalkthrough);
    registerFlowStarter(startFlow);
  }, [startWalkthrough, startFlow]);

  return (
    <>
      {state.isActive && state.currentStep && (
        <SimpleStepOverlay
          selector={state.currentStep.selector}
          text={state.currentStep.text}
          showArrow={state.currentStep.showArrow}
          onTap={nextStep}
        />
      )}
    </>
  );
}
