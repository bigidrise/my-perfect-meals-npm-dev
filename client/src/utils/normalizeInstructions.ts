// Normalize cooking instructions to a clean array of steps.
// Display-only — never mutates or persists source data.
export function normalizeInstructions(input: string | string[] | any[] | undefined | null): string[] {
  if (!input) return [];

  // Already an array — clean and return as-is
  if (Array.isArray(input)) {
    return input.map((s: any) => String(s).trim()).filter(Boolean);
  }

  const text = String(input).trim();
  if (!text) return [];

  // Priority 1: numbered steps (1., 2., Step 1:, Step 2:, etc.)
  const numberedSplit = text
    .split(/(?:^|\n|\s)(?:Step\s*\d+[:.]|\d+\.)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (numberedSplit.length > 1) return numberedSplit;

  // Priority 2: line breaks
  const lineSplit = text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (lineSplit.length > 1) return lineSplit;

  // Priority 3: smart sentence split (period/!/? followed by whitespace + capital letter)
  const sentenceSplit = text.split(/(?<=[.!?])\s+(?=[A-Z])/).map((s) => s.trim()).filter(Boolean);
  return sentenceSplit.length > 0 ? sentenceSplit : [text];
}
