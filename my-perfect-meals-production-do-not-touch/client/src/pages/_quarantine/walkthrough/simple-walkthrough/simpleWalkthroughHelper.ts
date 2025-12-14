/**
 * Simple Walkthrough Helper
 * 
 * Provides standalone walkthrough functionality that works independently
 * of voice navigation, TTS, and the complex WalkthroughScriptEngine.
 * 
 * Usage:
 * ```ts
 * import { startSimpleWalkthrough } from './simpleWalkthroughHelper';
 * 
 * startSimpleWalkthrough('my-feature', [
 *   { selector: '#step-1', text: 'Click here first', showArrow: true },
 *   { selector: '.step-2', text: 'Then do this' },
 * ]);
 * ```
 */

interface SimpleStep {
  selector: string;
  text?: string;
  showArrow?: boolean;
}

type SimpleWalkthroughStarter = (scriptId: string, steps: SimpleStep[]) => void;
type FlowStarter = (flowId: string) => void;
type CopilotCloser = () => void;

let walkthroughStarter: SimpleWalkthroughStarter | null = null;
let flowStarter: FlowStarter | null = null;
let copilotCloser: CopilotCloser | null = null;

/**
 * Register the walkthrough starter function (called by SimpleWalkthroughProvider)
 */
export function registerSimpleWalkthroughStarter(starter: SimpleWalkthroughStarter) {
  walkthroughStarter = starter;
}

/**
 * Register the flow starter function (called by SimpleWalkthroughProvider)
 */
export function registerFlowStarter(starter: FlowStarter) {
  flowStarter = starter;
}

/**
 * Register the Copilot closer function (called by App.tsx or wherever CopilotProvider is set up)
 */
export function registerCopilotCloser(closer: CopilotCloser) {
  copilotCloser = closer;
}

/**
 * Start a simple walkthrough with the given steps
 * This function is completely independent of voice/TTS systems
 * Automatically closes the Copilot modal when walkthrough starts
 */
export function startSimpleWalkthrough(scriptId: string, steps: SimpleStep[]) {
  if (!walkthroughStarter) {
    console.warn('[SimpleWalkthrough] Starter not registered yet. Skipping walkthrough:', scriptId);
    return;
  }
  
  if (copilotCloser) {
    copilotCloser();
  }
  
  walkthroughStarter(scriptId, steps);
}

/**
 * Start a multi-page walkthrough flow
 * Automatically closes the Copilot modal and begins the flow sequence
 */
export function startSimpleWalkthroughFlow(flowId: string) {
  if (!flowStarter) {
    console.warn('[SimpleWalkthrough] Flow starter not registered yet. Skipping flow:', flowId);
    return;
  }
  
  if (copilotCloser) {
    copilotCloser();
  }
  
  flowStarter(flowId);
}

/**
 * Pre-defined walkthrough scripts
 * Add your walkthroughs here for easy reuse
 */
export const SIMPLE_WALKTHROUGHS = {
  'macro-calculator': [
    { selector: '[data-walkthrough="macro-input"]', text: 'Enter your details here', showArrow: true },
    { selector: '[data-walkthrough="calculate-button"]', text: 'Click to calculate your macros' },
    { selector: '[data-walkthrough="results"]', text: 'Your personalized results will appear here' },
  ],
  'meal-creator': [
    { selector: '[data-walkthrough="meal-type"]', text: 'Choose your meal type', showArrow: true },
    { selector: '[data-walkthrough="dietary-prefs"]', text: 'Set your dietary preferences' },
    { selector: '[data-walkthrough="generate"]', text: 'Generate your AI meal' },
  ],
} as const;
