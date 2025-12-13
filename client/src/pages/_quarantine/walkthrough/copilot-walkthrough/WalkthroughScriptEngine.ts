import { waitForElement, waitForNavigationReady } from "../WalkthroughEngine";
import type {
  WalkthroughScript,
  WalkthroughScriptStep,
  WalkthroughState,
  WalkthroughEvent,
  WalkthroughEventType,
} from "./WalkthroughTypes";

type WalkthroughEventListener = (event: WalkthroughEvent) => void;
type EngineStatus = "idle" | "starting" | "active" | "cancelling";
type StateSubscriber = () => void;

export class WalkthroughScriptEngine {
  private script: WalkthroughScript | null = null;
  private currentStepIndex: number = 0;
  private listeners: WalkthroughEventListener[] = [];
  private stateSubscribers: Set<StateSubscriber> = new Set();
  private actionListener: ((e: Event) => void) | null = null;
  private currentElement: Element | null = null;
  private eventElement: Element | null = null; // Separate tracking for waitForEvent target
  private status: EngineStatus = "idle";
  private cachedSnapshot: WalkthroughState | null = null;

  /**
   * Set status and notify state subscribers
   */
  private setStatus(newStatus: EngineStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.invalidateSnapshot();
      this.notifyStateSubscribers();
    }
  }

  /**
   * Invalidate cached snapshot (called when state changes)
   */
  private invalidateSnapshot(): void {
    this.cachedSnapshot = null;
  }

  /**
   * Notify all state subscribers of a state change
   */
  private notifyStateSubscribers(): void {
    this.stateSubscribers.forEach(subscriber => subscriber());
  }

  /**
   * Subscribe to state changes (for useSyncExternalStore)
   * Returns unsubscribe function
   */
  subscribe(callback: StateSubscriber): () => void {
    this.stateSubscribers.add(callback);
    return () => {
      this.stateSubscribers.delete(callback);
    };
  }

  /**
   * Get snapshot of current state (for useSyncExternalStore)
   * Returns cached snapshot to avoid infinite loops
   */
  getSnapshot(): WalkthroughState {
    if (!this.cachedSnapshot) {
      this.cachedSnapshot = this.getState();
    }
    return this.cachedSnapshot;
  }

  /**
   * Start a walkthrough script
   */
  async start(script: WalkthroughScript): Promise<void> {
    if (this.status !== "idle") {
      console.warn(`[WalkthroughScriptEngine] Cannot start - engine status is ${this.status}`);
      return;
    }

    this.setStatus("starting");
    this.script = script;
    this.currentStepIndex = 0;
    this.invalidateSnapshot();

    this.emitEvent({
      type: "started",
      scriptId: script.id,
      stepIndex: 0,
    });

    this.setStatus("active");
    await this.executeCurrentStep();
  }

  /**
   * Move to the next step
   */
  async next(): Promise<void> {
    if (!this.script || this.status !== "active") {
      console.warn("[WalkthroughScriptEngine] Cannot advance - no active walkthrough");
      return;
    }

    this.cleanupCurrentStep();

    if (this.currentStepIndex < this.script.steps.length - 1) {
      this.currentStepIndex++;
      this.invalidateSnapshot();
      this.emitEvent({
        type: "step_changed",
        scriptId: this.script.id,
        stepIndex: this.currentStepIndex,
      });
      await this.executeCurrentStep();
    } else {
      this.complete();
    }
  }

  /**
   * Move to the previous step
   */
  async previous(): Promise<void> {
    if (!this.script || this.status !== "active") {
      console.warn("[WalkthroughScriptEngine] Cannot go back - no active walkthrough");
      return;
    }

    this.cleanupCurrentStep();

    if (this.currentStepIndex > 0) {
      this.currentStepIndex--;
      this.invalidateSnapshot();
      this.emitEvent({
        type: "step_changed",
        scriptId: this.script.id,
        stepIndex: this.currentStepIndex,
      });
      await this.executeCurrentStep();
    }
  }

  /**
   * Skip the current step
   */
  async skip(): Promise<void> {
    if (!this.script || this.status !== "active") return;
    await this.next();
  }

  /**
   * Retry the current step
   */
  async retry(): Promise<void> {
    if (!this.script || this.status !== "active") return;

    this.cleanupCurrentStep();
    await this.executeCurrentStep();
  }

  /**
   * Cancel the walkthrough
   */
  async cancel(): Promise<void> {
    if (!this.script || this.status === "idle" || this.status === "cancelling") return;

    this.setStatus("cancelling");
    const scriptId = this.script.id;
    this.cleanupCurrentStep();
    this.reset();

    this.emitEvent({
      type: "cancelled",
      scriptId,
    });
  }

  /**
   * Complete the walkthrough
   */
  private complete(): void {
    if (!this.script) return;

    const scriptId = this.script.id;
    this.cleanupCurrentStep();
    this.reset();

    this.emitEvent({
      type: "completed",
      scriptId,
    });
  }

  /**
   * Get current walkthrough state
   */
  getState(): WalkthroughState {
    return {
      isActive: this.status === "active" || this.status === "starting",
      scriptId: this.script?.id || null,
      currentStepIndex: this.currentStepIndex,
      totalSteps: this.script?.steps.length || 0,
      canGoNext: this.currentStepIndex < (this.script?.steps.length || 0) - 1,
      canGoPrevious: this.currentStepIndex > 0,
    };
  }

  /**
   * Get current step with resolved target selector
   */
  getCurrentStep(): WalkthroughScriptStep | null {
    if (!this.script || this.status === "idle") return null;
    const step = this.script.steps[this.currentStepIndex];
    if (!step) return null;
    
    // Return step with resolved target selector
    // Convert targetTestId to CSS selector if needed
    const targetSelector = step.targetTestId
      ? `[data-testid="${step.targetTestId}"]`
      : step.target;
    
    return {
      ...step,
      target: targetSelector,
    };
  }

  /**
   * Subscribe to walkthrough events
   */
  addEventListener(listener: WalkthroughEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Execute the current step
   */
  private async executeCurrentStep(): Promise<void> {
    const step = this.getCurrentStep();
    if (!step) {
      this.emitError("No step to execute");
      return;
    }

    // Handle navigation requirement
    if (step.navigationPath) {
      try {
        await waitForNavigationReady(step.navigationPath, 5000);
      } catch (error) {
        console.warn(
          `[WalkthroughScriptEngine] Navigation timeout to ${step.navigationPath}`,
          error
        );
        this.emitError(`Navigation to ${step.navigationPath} failed`);
        return;
      }
    }

    // Resolve target selector (supports both legacy and new patterns)
    const targetSelector = step.targetTestId
      ? `[data-testid="${step.targetTestId}"]`
      : step.target;

    // Handle target element
    if (targetSelector) {
      const element = await waitForElement(targetSelector, {
        timeout: 5000,
        retryInterval: 100,
      });

      if (!element) {
        console.warn(
          `[WalkthroughScriptEngine] Element not found: ${targetSelector}`
        );
        this.emitError(`Target element not found: ${targetSelector}`);
        return;
      }

      this.currentElement = element;

      // Emit step_ready event now that element is found
      this.emitEvent({
        type: "step_ready",
        scriptId: this.script!.id,
        stepIndex: this.currentStepIndex,
      });

      // Setup action listener for auto-advance
      // Support both legacy waitForAction and new waitForEvent patterns
      if (step.waitForEvent) {
        // New pattern: wait for specific event on specific element
        const eventTargetSelector = `[data-testid="${step.waitForEvent.testId}"]`;
        const foundEventElement = await waitForElement(eventTargetSelector, {
          timeout: 5000,
          retryInterval: 100,
        });
        if (foundEventElement) {
          this.eventElement = foundEventElement; // Track event element separately
          this.setupActionListener(foundEventElement, step.waitForEvent.event);
        }
      } else if (step.waitForAction && step.waitForAction !== "none") {
        // Legacy pattern: wait for action on current element
        this.setupActionListener(element, step.waitForAction);
      }
    }

    // Speak instruction if voice is enabled (placeholder for future integration)
    if (step.speak) {
      // TODO: Integrate with ElevenLabs voice system
      console.log(`[WalkthroughScriptEngine] Voice: ${step.speak}`);
    }
  }

  /**
   * Setup action listener for auto-advance
   */
  private setupActionListener(element: Element, actionType: string): void {
    this.actionListener = () => {
      setTimeout(() => {
        this.next();
      }, 300); // Small delay for UX smoothness
    };

    element.addEventListener(actionType, this.actionListener);
  }

  /**
   * Cleanup current step (remove listeners, etc.)
   */
  private cleanupCurrentStep(): void {
    if (this.actionListener) {
      const step = this.getCurrentStep();
      // Handle both legacy waitForAction and new waitForEvent patterns
      if (step?.waitForEvent && this.eventElement) {
        // Remove from event element (not spotlight element)
        this.eventElement.removeEventListener(
          step.waitForEvent.event,
          this.actionListener
        );
      } else if (step?.waitForAction && this.currentElement) {
        // Remove from current element (legacy pattern)
        this.currentElement.removeEventListener(
          step.waitForAction,
          this.actionListener
        );
      }
    }

    this.actionListener = null;
    this.currentElement = null;
    this.eventElement = null;
  }

  /**
   * Reset engine state
   */
  private reset(): void {
    this.script = null;
    this.currentStepIndex = 0;
    this.invalidateSnapshot();
    this.setStatus("idle");
    this.currentElement = null;
    this.eventElement = null;
    this.actionListener = null;
  }

  /**
   * Emit an event to all listeners
   */
  private emitEvent(event: WalkthroughEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

  /**
   * Emit an error event
   */
  private emitError(error: string): void {
    if (!this.script) return;

    this.emitEvent({
      type: "error",
      scriptId: this.script.id,
      stepIndex: this.currentStepIndex,
      error,
    });
  }
}

// Global singleton instance
export const walkthroughEngine = new WalkthroughScriptEngine();

/**
 * Wait for the walkthrough engine to return to idle state
 * @param maxAttempts Maximum number of polling attempts (default: 10)
 * @param intervalMs Milliseconds between checks (default: 50)
 */
export async function waitForIdle(
  maxAttempts: number = 10,
  intervalMs: number = 50
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const state = walkthroughEngine.getState();
    if (!state.isActive) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  console.warn("[WalkthroughScriptEngine] waitForIdle timeout - engine still active");
  return false;
}
