function cleanDiet(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Resolve the one primary diet selected for this creator request.
 * Explicit hub overrides take precedence over builder-local selections.
 * Multiple dietary tags are not collapsed into a fake primary diet.
 */
export function resolveRequestDietOverride(
  explicitOverride: unknown,
  selectedDiet: unknown,
): string | null {
  const explicit = cleanDiet(explicitOverride);
  if (explicit) return explicit;

  const selected = cleanDiet(selectedDiet);
  if (selected) return selected;

  if (Array.isArray(selectedDiet) && selectedDiet.length === 1) {
    return cleanDiet(selectedDiet[0]);
  }

  return null;
}