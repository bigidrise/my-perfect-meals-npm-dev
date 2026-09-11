export function normalizeCreateDishRecognitionText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function resolveCreateDishRecognitionSource(
  visibleValue: string,
  mirroredValue: string,
): { sourceText: string; shouldMirror: boolean } {
  return {
    sourceText: normalizeCreateDishRecognitionText(visibleValue),
    shouldMirror: visibleValue !== mirroredValue,
  };
}

export function shouldApplyCreateDishRecognitionResult(input: {
  requestSource: string;
  currentVisibleValue: string;
  responseSubmittedText: string;
}): boolean {
  const requestSource = normalizeCreateDishRecognitionText(input.requestSource);
  return (
    requestSource.length >= 3 &&
    requestSource === normalizeCreateDishRecognitionText(input.currentVisibleValue) &&
    requestSource === normalizeCreateDishRecognitionText(input.responseSubmittedText)
  );
}

export function canRenderCreateDishPreparation(input: {
  resultSource: string | null;
  currentVisibleValue: string;
  status: string | null;
}): boolean {
  return (
    input.status !== null &&
    input.status !== "unsupported" &&
    normalizeCreateDishRecognitionText(input.resultSource ?? "") ===
      normalizeCreateDishRecognitionText(input.currentVisibleValue)
  );
}