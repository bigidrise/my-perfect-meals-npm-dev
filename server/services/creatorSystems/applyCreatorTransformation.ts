// server/services/creatorSystems/applyCreatorTransformation.ts
// Phase 2.2 — prompt is built from structured config, not free text.
//
// CONTRACT:
//   - ONLY modifies: name, description, instructions
//   - NEVER touches: ingredients, macros, nutrition, servings, medicalBadges
//   - Fails back to base meal on any error
//   - Logs every application

import { chatJson } from "../../utils/openaiSafe";
import { type CreatorSystemConfig } from "./registry";

export type EngineType = "meal" | "dessert" | "beverage";

function buildCreatorPrompt(system: CreatorSystemConfig, baseMeal: any): string {
  const s = system.style;

  const techniqueBlock = s.techniques.length > 0
    ? `Use one of these techniques: ${s.techniques.join(", ")}.`
    : "";

  const flavorBlock = s.flavorProfiles.length > 0
    ? `Emphasize these flavor profiles: ${s.flavorProfiles.join(", ")}.`
    : "";

  const ingredientBlock = s.ingredientBias.length > 0
    ? `Prefer these ingredients where applicable: ${s.ingredientBias.join(", ")}.`
    : "";

  const namingBlock = [
    `Naming pattern: ${s.naming.pattern}.`,
    s.naming.includeSauce ? "Include a sauce, glaze, or finishing element in the dish name." : "Sauce in name is optional.",
    s.naming.maxLength ? `Keep name under ${s.naming.maxLength} characters.` : "",
  ].filter(Boolean).join(" ");

  const instructionLines = [
    s.instructionRules.requireHighHeatProtein ? "- MUST include a high-heat protein step (sear, char, or roast) with time and visual cue." : "",
    s.instructionRules.requireSauceBuild ? "- MUST include a sauce-building step (deglaze → reduce → emulsify/finish)." : "",
    s.instructionRules.requireLayering ? "- MUST show flavor layering sequence (aromatics → liquid → finish)." : "",
  ].filter(Boolean).join("\n");

  const forbidBlock = s.description.forbidWords.length > 0
    ? `Forbidden words in description: ${s.description.forbidWords.join(", ")}.`
    : "";

  return `You are transforming an existing meal into a ${system.type} system style.
Return a JSON object with exactly three keys: "name", "description", "instructions".
"instructions" must match the same format as in the original meal (array or string).

COOKING TECHNIQUES:
${techniqueBlock || "No specific technique required."}

FLAVOR PROFILE:
${flavorBlock || "No specific flavor profile required."}

INGREDIENT BIAS:
${ingredientBlock || "No ingredient bias."}

NAMING:
${namingBlock}

INSTRUCTIONS:
${instructionLines || "Standard instruction quality."}

DESCRIPTION:
- Tone: ${s.description.tone}
- Describe the cooking process and flavor result — not generic adjectives.
${forbidBlock}

HARD CONSTRAINTS (DO NOT VIOLATE):
- Do NOT change ingredients, quantities, units, macros, servings, or nutrition data.
- Return only the three fields: name, description, instructions.

ORIGINAL MEAL:
${JSON.stringify({ name: baseMeal.name, description: baseMeal.description, instructions: baseMeal.instructions ?? baseMeal.steps ?? [] })}`;
}

export async function applyCreatorTransformation(
  baseMeal: any,
  system: CreatorSystemConfig,
  engineType: EngineType
): Promise<any> {
  // Skip default system — no transformation needed
  if (!system || system.id === "default") return baseMeal;

  // Capability check — only apply where system supports it
  if (engineType === "meal" && !system.supports.meals) return baseMeal;
  if (engineType === "dessert" && !system.supports.desserts) return baseMeal;
  if (engineType === "beverage" && !system.supports.beverages) return baseMeal;

  try {
    const prompt = buildCreatorPrompt(system, baseMeal);

    const styled = await chatJson({ user: prompt });

    if (!styled || typeof styled !== "object") {
      console.warn(`[CreatorSystem] "${system.name}" returned invalid response — using base meal`);
      return baseMeal;
    }

    const result = {
      ...baseMeal,
      name: (styled.name && typeof styled.name === "string") ? styled.name : baseMeal.name,
      description: (styled.description && typeof styled.description === "string") ? styled.description : (baseMeal.description ?? ""),
      instructions: styled.instructions != null ? styled.instructions : (baseMeal.instructions ?? baseMeal.steps ?? []),
      creatorSystem: system.id,
    };

    console.log(`[CreatorSystem] Applied "${system.name}" transformation: "${baseMeal.name}" → "${result.name}"`);
    return result;

  } catch (err) {
    console.error(`[CreatorSystem] Transformation failed for "${system.name}" — returning base meal:`, err);
    return baseMeal;
  }
}
