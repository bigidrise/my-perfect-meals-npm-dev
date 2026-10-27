/** Source-preserving formatting only. Never supplies missing cooking directions. */
export function normalizeRecipeInstructions(input: unknown, depth = 0): string[] {
  if (depth > 4) return [];
  if (Array.isArray(input)) {
    if (!input.length) return [];
    const steps: string[] = [];
    for (const row of input) {
      let value: unknown = row;
      if (row && typeof row === "object" && !Array.isArray(row)) {
        value = [row.text, row.instruction, row.description, row.step]
          .find(candidate => typeof candidate === "string" && candidate.trim());
      }
      if (typeof value !== "string") return [];
      const normalized = normalizeRecipeInstructions(value, depth + 1);
      if (!normalized.length) return [];
      steps.push(...normalized);
    }
    return steps;
  }
  if (typeof input !== "string" || !input.trim()) return [];
  const text = input.trim();
  if (text.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(text);
      return Array.isArray(parsed) ? normalizeRecipeInstructions(parsed, depth + 1) : [];
    } catch { return []; }
  }
  const lines = text
    .replace(/\r\n?/g, "\n")
    .replace(/\s+(?=(?:Step\s+)?\d+[.)]\s+\p{L})/giu, "\n")
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !/^(?:cooking\s*instructions?|instructions?|directions|preparation steps)\s*:?\s*$/i.test(line));
  const marker = /^(?:(?:step\s+)?\d+[.):]\s*|[-*•]\s+)/i;
  const hasMarkers = lines.some(line => marker.test(line));
  const steps: string[] = [];
  for (const line of lines) {
    const marked = marker.test(line);
    const value = line.replace(marker, "").trim();
    // Empty list entries indicate an incomplete draft, not a step to discard.
    if (!value) return [];
    if (hasMarkers && !marked && steps.length) steps[steps.length - 1] += ` ${value}`;
    else steps.push(value);
  }
  return steps;
}

/** Reject legacy invented directions and status text masquerading as a recipe. */
export function hasGenuineRecipeInstructions(steps: string[]): boolean {
  if (!steps.length || steps.some(step => !/\p{L}/u.test(step) ||
    /^(?:\[.*\]|null|undefined|none|n\/a|step\s*\d*|instructions?)\.?$/i.test(step) ||
    /^(?:No (?:cooking |preparation )?(?:instructions|steps)\b|(?:Cooking |Preparation )?(?:instructions|steps) (?:are )?(?:not available|unavailable|missing|pending|not provided)\b)/i.test(step) ||
    /^(?:We couldn't prepare a complete recipe|This course needs reliable nutrition|Recipe unavailable|Please try again)/i.test(step))) return false;
  // Also recognize the old invented template when cached as one paragraph.
  const remainder = steps.join(" ").replace(
    /(?:Prepare all ingredients according to (?:the )?recipe|Cook using appropriate methods(?: for each ingredient)?|Season to taste and serve hot)[.!]?/gi, "",
  );
  return /\p{L}/u.test(remainder);
}
