import type { CoachDestinationId } from "../../../shared/coaching/navigation";
import { namedNavigationDestinations } from "./verifiedNavigation";

/** Context lookup only, never consent recognition or a source of destinations. */
export const NAVIGATION_RECOVERY_WINDOW_MS = 6 * 60 * 60 * 1000;
export const NAVIGATION_RECOVERY_MESSAGE_LIMIT = 9;

export function isNavigationFailureComplaint(message: string): boolean {
  // A new request, rejection or change of destination must use normal handling.
  if (/\b(?:instead|rather|never mind|nevermind|cancel|don't want|do not want)\b/i.test(message)) return false;
  const failure = /\b(?:didn't|did not|haven't|have not|can't|cannot|couldn't|could not|won't|will not|not working|missing|failed|no button)\b/i.test(message);
  const handoff = /\b(?:open|opening|navigate|navigation|handoff|button|take me|send me|give me|give|gave|take|send)\b/i.test(message);
  return failure && handoff &&
    (namedNavigationDestinations(message).length > 0 ||
      /\b(?:you asked|i said yes|you offered|that feature|the feature|the button|handoff|navigation)\b/i.test(message));
}

export function complaintMatchesDestination(message: string, destinationId: CoachDestinationId): boolean {
  const names = namedNavigationDestinations(message);
  return isNavigationFailureComplaint(message) &&
    (names.length === 0 || (names.length === 1 && names[0] === destinationId));
}

/** Recognize a whole unusable closing, without stripping punctuation from replies. */
export function isNavigationClosingFiller(message: string): boolean {
  return /^[\s:!.,-]*(?:if you (?:need (?:any )?(?:further|more) (?:assistance|help)|have (?:any )?(?:other|more) questions)(?: or (?:have (?:any )?(?:other|more) questions|need (?:any )?(?:further|more) (?:assistance|help)))?[,]?\s*)?feel free to ask[.!:\s]*$/i.test(message) ||
    /^[\s:!.,-]*(?:you're welcome|happy to help|glad to help|take care)[.!:\s]*$/i.test(message);
}
