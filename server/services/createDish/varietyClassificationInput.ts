export function resolveVarietyClassificationInput(
  generationInput: string,
  cleanClassificationInput?: string,
): string {
  return cleanClassificationInput?.trim() || generationInput;
}