/**
 * Normalize a newly generated recipe at the model boundary. Existing saved
 * recipes can still carry legacy strings; do not rewrite stored history.
 */
export function parseGeneratedRecipeSteps(value: unknown): string[] {
  const splitNumbered = (text: string): string[] => text
    .split(/(?:^|\n|\s)(?:Step\s*\d+[:.]|\d+[.)])\s*/i)
    .map((step) => step.trim())
    .filter(Boolean);

  const values = Array.isArray(value) ? value : [value];
  if (!values.length || values.some((entry) => typeof entry !== "string" || !entry.trim())) {
    throw new Error("Generated recipe is missing cooking steps");
  }
  const steps = values.flatMap((entry) => {
    const text = (entry as string).trim();
    const numbered = splitNumbered(text);
    if (numbered.length > 1) return numbered;
    return text.split(/\n+|(?<=[.!?])\s+(?=[A-Z])/).map((step) => step.trim()).filter(Boolean);
  }).map((step) => step.replace(/^(?:Step\s*\d+[:.]|\d+[.)])\s*/i, "").trim())
    .filter(Boolean);

  if (!steps.length) {
    throw new Error("Generated recipe is missing cooking steps");
  }
  return steps;
}