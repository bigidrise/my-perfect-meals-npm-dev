/**
 * Simple helper to dispatch walkthrough completion events.
 * These events are listened to by FlowOrchestrator to advance flows.
 */

/**
 * Dispatch a walkthrough completion event
 */
export function dispatchWalkthroughCompletion(eventName: string) {
  console.log("[SimpleWalkthrough] Dispatching completion:", eventName);
  window.dispatchEvent(new CustomEvent(eventName));
}
