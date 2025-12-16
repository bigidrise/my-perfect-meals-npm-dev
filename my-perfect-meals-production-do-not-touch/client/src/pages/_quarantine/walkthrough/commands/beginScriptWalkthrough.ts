import { walkthroughEngine, waitForIdle } from "../walkthrough/WalkthroughScriptEngine";
import { getScript, hasScript } from "../walkthrough/ScriptRegistry";
import type { KnowledgeResponse } from "../CopilotContext";
import type { WalkthroughEvent } from "../walkthrough/WalkthroughTypes";

/**
 * Phase C.1: Begin a script-based walkthrough with event streaming
 * Accepts a responseCallback to stream lifecycle events to CopilotContext
 */
export async function beginScriptWalkthrough(
  scriptId: string,
  responseCallback?: (response: KnowledgeResponse) => void
): Promise<{ success: boolean; response: KnowledgeResponse }> {
  console.log(`[beginScriptWalkthrough] Starting: ${scriptId}`);

  // Check if script exists
  if (!hasScript(scriptId)) {
    console.error(`[beginScriptWalkthrough] Script not found: ${scriptId}`);
    const errorResponse: KnowledgeResponse = {
      title: "Walkthrough Not Available",
      description: "This feature doesn't have a guided walkthrough yet.",
      type: "knowledge",
    };
    return {
      success: false,
      response: errorResponse,
    };
  }

  const script = getScript(scriptId);
  if (!script) {
    console.error(`[beginScriptWalkthrough] Failed to get script: ${scriptId}`);
    const errorResponse: KnowledgeResponse = {
      title: "Error",
      description: "Could not load walkthrough script.",
      type: "knowledge",
    };
    return {
      success: false,
      response: errorResponse,
    };
  }

  // Phase C.1: Check if UI is ready for dormant scripts
  if (script.uiReady === false) {
    console.log(`[beginScriptWalkthrough] Script dormant (UI not ready): ${scriptId}`);
    const notReadyResponse: KnowledgeResponse = {
      title: "Walkthrough Not Ready",
      description: "This walkthrough requires UI updates that are still in progress. Please check back soon!",
      type: "knowledge",
    };
    return {
      success: false,
      response: notReadyResponse,
    };
  }

  // Cancel any active walkthrough and wait for idle state
  const currentState = walkthroughEngine.getState();
  if (currentState.isActive) {
    console.log(
      `[beginScriptWalkthrough] Canceling active walkthrough: ${currentState.scriptId}`
    );
    await walkthroughEngine.cancel();
    const isIdle = await waitForIdle();

    if (!isIdle) {
      console.error(
        "[beginScriptWalkthrough] Engine failed to reach idle state"
      );
      const errorResponse: KnowledgeResponse = {
        title: "Error",
        description: "Could not start walkthrough. Please try again.",
        type: "knowledge",
      };
      return {
        success: false,
        response: errorResponse,
      };
    }
  }

  // Subscribe to engine lifecycle events to stream updates
  const eventListener = (event: WalkthroughEvent) => {
    if (!responseCallback) return;

    const currentStep = walkthroughEngine.getCurrentStep();
    const state = walkthroughEngine.getState();

    switch (event.type) {
      case "started":
      case "step_changed":
        // Stream KnowledgeResponse update for current step
        const updateResponse: KnowledgeResponse = {
          title: script.title,
          description: `Step ${state.currentStepIndex + 1} of ${state.totalSteps}`,
          type: "walkthrough",
          steps: script.steps.map((step) => ({
            text: step.message || step.description || "",
            targetId: step.targetTestId ? `[data-testid="${step.targetTestId}"]` : step.target,
          })),
          spokenText: currentStep?.speak || currentStep?.message || currentStep?.description,
        };
        responseCallback(updateResponse);
        break;

      case "completed":
        // Send completion response
        const completionResponse: KnowledgeResponse = {
          title: "Walkthrough Complete!",
          description: `You've completed the ${script.title} walkthrough.`,
          type: "knowledge",
        };
        responseCallback(completionResponse);
        break;

      case "cancelled":
        // Send cancellation response
        const cancelResponse: KnowledgeResponse = {
          title: "Walkthrough Cancelled",
          description: "The walkthrough has been stopped.",
          type: "knowledge",
        };
        responseCallback(cancelResponse);
        break;

      case "error":
        // Send error response
        const errorResponse: KnowledgeResponse = {
          title: "Walkthrough Error",
          description: event.error || "An error occurred during the walkthrough.",
          type: "knowledge",
        };
        responseCallback(errorResponse);
        break;
    }
  };

  // Add listener
  const removeListener = walkthroughEngine.addEventListener(eventListener);

  // Auto-remove listener after completion or cancellation
  let removeAutoListener: (() => void) | null = null;
  const autoRemoveListener = (event: WalkthroughEvent) => {
    if (event.type === "completed" || event.type === "cancelled") {
      removeListener();
      if (removeAutoListener) {
        removeAutoListener();
        removeAutoListener = null;
      }
    }
  };
  removeAutoListener = walkthroughEngine.addEventListener(autoRemoveListener);

  // Start the walkthrough engine
  try {
    await walkthroughEngine.start(script);

    // Build initial KnowledgeResponse
    const initialResponse: KnowledgeResponse = {
      title: script.title,
      description: "Follow these steps to learn this feature.",
      type: "walkthrough",
      steps: script.steps.map((step) => ({
        text: step.message || step.description || "",
        targetId: step.targetTestId ? `[data-testid="${step.targetTestId}"]` : step.target,
      })),
      spokenText: script.steps[0]?.speak || script.steps[0]?.message || script.steps[0]?.description,
    };

    console.log(`[beginScriptWalkthrough] Started successfully: ${script.title}`);
    return {
      success: true,
      response: initialResponse,
    };
  } catch (error) {
    console.error("[beginScriptWalkthrough] Failed to start engine:", error);
    removeListener();
    if (removeAutoListener) {
      removeAutoListener();
    }
    const errorResponse: KnowledgeResponse = {
      title: "Error",
      description: "Failed to start walkthrough. Please try again.",
      type: "knowledge",
    };
    return {
      success: false,
      response: errorResponse,
    };
  }
}

export default beginScriptWalkthrough;
