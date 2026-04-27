// server/services/creatorSystems/applyCreatorTransformation.ts
// Centralized 2-pass creator transformation.
// Called AFTER any engine generates a base meal — never inside generation prompts.
//
// CONTRACT:
//   - ONLY modifies: name, description, instructions
//   - NEVER touches: ingredients, macros, nutrition, servings, medicalBadges, or any other field
//   - If the transformation fails for any reason, the original base meal is returned unchanged
//   - Capability check is enforced here (system.supports) — routes don't need to check

import { chatJson } from "../../utils/openaiSafe";
import { type CreatorSystem } from "./registry";

export type EngineType = "meal" | "dessert" | "beverage";

export async function applyCreatorTransformation(
  baseMeal: any,
  system: CreatorSystem,
  engineType: EngineType
): Promise<any> {
  // 1. Skip default system — no style to apply
  if (system.id === "default" || !system.stylePrompt) {
    return baseMeal;
  }

  // 2. Capability check — only apply where the system supports it
  if (engineType === "meal" && !system.supports.meals) return baseMeal;
  if (engineType === "dessert" && !system.supports.desserts) return baseMeal;
  if (engineType === "beverage" && !system.supports.beverages) return baseMeal;

  try {
    const baseName = baseMeal.name || "";
    const baseDescription = baseMeal.description || "";
    const baseInstructions = baseMeal.instructions ?? baseMeal.steps ?? [];

    const systemPrompt = `You are a culinary style editor. Your ONLY job is to restyle a meal's name, description, and instructions according to a creator's rules.

STRICT RULES:
- Return ONLY a JSON object with three keys: "name", "description", "instructions"
- "instructions" must match the same format as the input (array of strings, array of objects, or plain string — match exactly)
- Do NOT change ingredients, amounts, units, macros, servings, or any nutritional data
- Do NOT add ingredients not already present in the meal
- Apply the creator rules to elevate technique language, naming precision, and description quality`;

    const userPrompt = `CREATOR SYSTEM RULES:
${system.stylePrompt}

BASE MEAL TO RESTYLE:
Name: ${baseName}
Description: ${baseDescription}
Instructions: ${JSON.stringify(baseInstructions)}

Return JSON with exactly these keys: { "name": string, "description": string, "instructions": <same format as input> }`;

    const styled = await chatJson({ system: systemPrompt, user: userPrompt });

    // Validate we got real values back before applying
    if (!styled || typeof styled !== "object") {
      console.warn(`[CreatorSystem] ${system.name} returned invalid response — using base meal`);
      return baseMeal;
    }

    const result = {
      ...baseMeal,
      name: (styled.name && typeof styled.name === "string") ? styled.name : baseName,
      description: (styled.description && typeof styled.description === "string") ? styled.description : baseDescription,
      instructions: (styled.instructions != null) ? styled.instructions : baseInstructions,
    };

    console.log(`[CreatorSystem] Applied "${system.name}" transformation: "${baseName}" → "${result.name}"`);
    return result;

  } catch (err) {
    console.error(`[CreatorSystem] Transformation failed for "${system.name}" — returning base meal:`, err);
    return baseMeal;
  }
}
