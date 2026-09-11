export type CreateDishClassificationOutcome =
  | "ready"
  | "needs_clarification"
  | "unsupported";

export function normalizeCreateDishClassificationText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function shouldAcceptCreateDishClassification(input: {
  requestSource: string;
  currentVisibleValue: string;
  responseSubmittedText: string;
}): boolean {
  const requestSource = normalizeCreateDishClassificationText(input.requestSource);
  return (
    requestSource.length >= 3 &&
    requestSource === normalizeCreateDishClassificationText(input.currentVisibleValue) &&
    requestSource === normalizeCreateDishClassificationText(input.responseSubmittedText)
  );
}

export function getCreateDishClassificationOutcome(
  status: "recognized" | "clarification_required" | "clarification_recommended" | "unsupported",
): CreateDishClassificationOutcome {
  if (status === "unsupported") return "unsupported";
  if (status === "clarification_required") return "needs_clarification";
  return "ready";
}

export function canRenderCreateDishPreparation(input: {
  resultSource: string | null;
  classifiedValue: string;
  status: string | null;
}): boolean {
  return (
    (input.status === "recognized" || input.status === "clarification_recommended") &&
    normalizeCreateDishClassificationText(input.resultSource ?? "") ===
      normalizeCreateDishClassificationText(input.classifiedValue)
  );
}