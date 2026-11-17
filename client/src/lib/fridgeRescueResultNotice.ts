import {
  describeFridgeRescueShortfall,
  type FridgeRescueCompletion,
} from "@shared/fridgeRescueCompletion";

/** The visible count includes the final client-side diet protection. */
export function fridgeRescueResultNotice(
  visibleCount: number,
  completion?: FridgeRescueCompletion,
  clientFiltered = false,
): string | null {
  const requested = completion?.requestedCount ?? 3;
  const reasons = [...(completion?.reasonCodes ?? [])];
  if (clientFiltered) reasons.push("CLIENT_DIET_FILTERED");
  return describeFridgeRescueShortfall(visibleCount, requested, reasons);
}

export function restoredFridgeRescueNotice(
  savedNotice: string | null | undefined,
  visibleCount: number,
): string | null {
  // An explicit null means the saved result was complete (the user may since
  // have deleted a card). Old caches do not establish why choices were fewer.
  if (savedNotice !== undefined) return savedNotice;
  return visibleCount < 3
    ? `Restored ${visibleCount} saved choice${visibleCount === 1 ? "" : "s"}. This older saved result does not record why fewer than three choices were available.`
    : null;
}
