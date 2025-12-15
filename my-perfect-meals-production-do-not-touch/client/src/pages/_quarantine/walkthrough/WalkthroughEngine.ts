import { WalkthroughStep } from "@/lib/knowledge/WalkthroughRegistry";
import { WalkthroughStep as ContextWalkthroughStep } from "./CopilotContext";
import { SpotlightStep } from "./SpotlightOverlay";

/**
 * Convert WalkthroughRegistry step or Context step to SpotlightStep format
 */
export function convertToSpotlightStep(
  step: WalkthroughStep | ContextWalkthroughStep
): SpotlightStep | null {
  if (!step.targetId) return null;

  // Determine action type from target element
  // Default to "click" for buttons, "input" for inputs, etc.
  const action = determineActionType(step.targetId);

  return {
    target: `[data-walkthrough-target="${step.targetId}"]`,
    instruction: step.text,
    action,
  };
}

/**
 * Determine action type from target ID
 */
function determineActionType(
  targetId: string
): "click" | "input" | "change" | "blur" | undefined {
  // Common patterns for action detection
  if (
    targetId.includes("button") ||
    targetId.includes("btn") ||
    targetId.includes("tap")
  ) {
    return "click";
  }

  if (targetId.includes("input") || targetId.includes("field")) {
    return "input";
  }

  if (
    targetId.includes("selector") ||
    targetId.includes("dropdown") ||
    targetId.includes("toggle")
  ) {
    return "change";
  }

  // Default to click for safety (most common action)
  return "click";
}

/**
 * Wait for navigation to complete
 */
export function waitForNavigationReady(
  targetPath: string,
  timeout = 3000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkReady = () => {
      if (window.location.pathname === targetPath) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error("Navigation timeout"));
      } else {
        requestAnimationFrame(checkReady);
      }
    };

    checkReady();
  });
}

/**
 * Wait for element to exist in DOM with retry
 */
export function waitForElement(
  selector: string,
  { timeout = 5000, retryInterval = 100 } = {}
): Promise<Element | null> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    const checkElement = () => {
      const element = document.querySelector(selector);

      if (element) {
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        resolve(null); // Graceful failure
      } else {
        setTimeout(checkElement, retryInterval);
      }
    };

    checkElement();
  });
}

/**
 * Debounce function to prevent rapid repeated calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}
