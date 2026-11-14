export type PreviousMenuChoicesAvailability = "compatible" | "stale" | "none" | "unavailable";

/** Availability is server-verified for this subject, occasion and food context. */
export function menuFailureMessage(error: string, availability?: PreviousMenuChoicesAvailability): string {
  const notice = availability === "compatible"
    ? "Your existing compatible choices are still available."
    : availability === "stale"
      ? "Previously saved choices are withheld because their food context is no longer current. Create new choices to continue."
      : availability === "unavailable" ? "Previous choices could not be verified for this request."
      : availability === "none" ? "No previous choices are available." : "";
  return [error, notice].filter(Boolean).join(" ");
}
