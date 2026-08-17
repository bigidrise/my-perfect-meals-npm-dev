/**
 * GenerationFailureBanner
 *
 * Persistent inline failure banner for all meal/drink generation surfaces.
 * Replaces the disappearing "Generation Failed / Please try again." toast
 * with an actionable explanation and a Try Again button.
 *
 * UX rules enforced here:
 *   • Always shown as a persistent inline element — never a disappearing toast.
 *   • Try Again preserves the original dish request and current temporary diet.
 *   • "exhausted_retries" NEVER tells the user to adjust dietary settings;
 *     it suggests rephrasing instead.
 *   • Safety/allergy blocks use SafetyGuardBanner, not this component.
 */

import { RotateCcw } from "lucide-react";

export type GenerationFailureType =
  | "technical_error"      // network / 500 — something broke on our end
  | "dietary_rejection"    // meal failed guardrail validation
  | "no_results"           // generation returned 0 results
  | "exhausted_retries";   // all retry attempts failed

export interface GenerationFailureState {
  show: boolean;
  message: string;
  suggestedActions?: string[];
}

export const HIDDEN_FAILURE: GenerationFailureState = { show: false, message: "" };

/** Returns the correct user-facing copy for each failure taxonomy type. */
export function buildFailureMessage(
  type: GenerationFailureType,
  context?: { diet?: string; dish?: string },
): { message: string; suggestedActions: string[] } {
  const dish = context?.dish ? `"${context.dish}"` : "this dish";
  const diet = context?.diet ?? "your dietary requirements";

  switch (type) {
    case "technical_error":
      return {
        message: "Something went wrong on our end. Please try again.",
        suggestedActions: [],
      };
    case "dietary_rejection":
      return {
        message: `We couldn't create a ${dish} that passed ${diet} this time. Your settings were protected, so we didn't show you a recipe that didn't qualify. Try Again and we'll generate a different version.`,
        suggestedActions: [
          "Try Again to generate a different version",
          "Rephrase your request — for example, name a specific style or cooking method",
        ],
      };
    case "no_results":
      return {
        message: `We couldn't find any options for ${dish} right now. Try rephrasing or adding a little more detail.`,
        suggestedActions: [
          "Describe the dish differently — add a cuisine style or cooking method",
          "Simplify the request to a more familiar dish name",
        ],
      };
    case "exhausted_retries":
      return {
        // NOTE: Do NOT suggest adjusting dietary settings — that subtly
        // encourages users to loosen medical or ethical constraints because
        // the AI failed, not because of an actual conflict.
        message: `We tried several versions and couldn't create a match for ${dish} this time. Try Again or describe the dish a little differently.`,
        suggestedActions: [
          "Try Again — we'll generate a fresh version",
          "Describe the dish differently or add more detail",
        ],
      };
  }
}

interface GenerationFailureBannerProps {
  message: string;
  suggestedActions?: string[];
  onRetry: () => void;
  onDismiss: () => void;
  isRetrying?: boolean;
}

export function GenerationFailureBanner({
  message,
  suggestedActions,
  onRetry,
  onDismiss,
  isRetrying = false,
}: GenerationFailureBannerProps) {
  return (
    <div className="mt-3 rounded-lg border border-orange-500/40 bg-orange-950/50 px-4 py-3 flex flex-col gap-2">
      <div className="flex items-start gap-2">
        <span className="text-orange-400 mt-0.5 shrink-0" aria-hidden="true">⚠️</span>
        <p className="text-sm text-orange-200 leading-snug">{message}</p>
      </div>

      {suggestedActions && suggestedActions.length > 0 && (
        <ul className="pl-1 space-y-1" aria-label="Suggestions">
          {suggestedActions.map((action, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-orange-100/80">
              <span className="shrink-0 mt-px text-orange-400" aria-hidden="true">→</span>
              {action}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button
          onClick={onRetry}
          disabled={isRetrying}
          aria-label="Try again"
          className="flex-1 py-1.5 rounded-md bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          Try Again
        </button>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white/70 text-xs transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
