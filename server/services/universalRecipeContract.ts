import { assertRecipeDraft, SafeRecipeGenerationError, safeRecipeText } from "../../shared/recipeDraftSafety";
export { assertRecipeDraft, SafeRecipeGenerationError, SAFE_RECIPE_FAILURE } from "../../shared/recipeDraftSafety";

/** Accept the existing labeled-text contract, never arbitrary prose or JSON.
 * Missing fields are rejected rather than reconstructed from private prompts.
 * Instruction format expansion deliberately belongs to a separate repair. */
export function parseUniversalRecipeResponse(text: unknown, refusal?: unknown) {
  if (typeof refusal === "string" && refusal.trim()) throw new SafeRecipeGenerationError("provider_refusal");
  if (typeof text !== "string" || !text.trim()) throw new SafeRecipeGenerationError("empty_response");
  if (!safeRecipeText(text)) throw new SafeRecipeGenerationError("provider_refusal");
  const lines = text.split("\n").filter(line => line.trim());
  const header = (line: string) => line.trim().replace(/^\*\*|\*\*$/g, "").replace(/\*\*/g, "");
  const nameLines = lines.filter(line => /^(?:meal name|name):\s*/i.test(header(line)));
  const descriptions = lines.filter(line => /^description:\s*/i.test(header(line)));
  if (!nameLines.length) throw new SafeRecipeGenerationError("missing_name");
  if (!descriptions.length) throw new SafeRecipeGenerationError("missing_description");
  if (nameLines.length !== 1 || descriptions.length !== 1) throw new SafeRecipeGenerationError("invalid_format");
  const name = header(nameLines[0]).replace(/^(?:meal name|name):\s*/i, "").trim();
  const description = header(descriptions[0]).replace(/^description:\s*/i, "").trim();
  const ingredientStart = lines.findIndex(line => /^ingredients?:\s*$/i.test(header(line)));
  const instructionStart = lines.findIndex(line => /^instructions?:\s*$/i.test(header(line)));
  const nutritionStart = lines.findIndex(line => /^(?:nutrition:|calories:)/i.test(header(line)));
  if (ingredientStart < 0) throw new SafeRecipeGenerationError("invalid_ingredients");
  if (instructionStart <= ingredientStart) throw new SafeRecipeGenerationError("missing_instructions");
  if (lines.indexOf(nameLines[0]) >= lines.indexOf(descriptions[0]) ||
    lines.indexOf(descriptions[0]) >= ingredientStart ||
    (nutritionStart >= 0 && nutritionStart <= instructionStart)) {
    throw new SafeRecipeGenerationError("invalid_format");
  }
  const ingredientLines = lines.slice(ingredientStart + 1, instructionStart)
    .filter(line => line.trim().startsWith("-") || line.trim().startsWith("•"));
  if (!ingredientLines.length || !ingredientLines.every(line => /^\s*[-•]\s+\S/.test(line))) {
    throw new SafeRecipeGenerationError("invalid_ingredients");
  }
  const instructionLines = lines.slice(instructionStart + 1, nutritionStart > instructionStart ? nutritionStart : undefined)
    .filter(line => /^\d+\./.test(line));
  if (!instructionLines.length || !instructionLines.every(line => /^\d+\.\s*\S/.test(line))) {
    throw new SafeRecipeGenerationError("missing_instructions");
  }
  assertRecipeDraft({
    name, description,
    ingredients: ingredientLines.map(line => ({ name: line.replace(/^\s*[-•]\s*/, "").trim() })),
    instructions: instructionLines.map(line => line.replace(/^\d+\.\s*/, "").trim()),
  });
  return { lines, name, description, ingredientLines, instructionLines, nutritionStart };
}
