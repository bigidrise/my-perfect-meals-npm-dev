// server/services/mealImageValidator.ts
// Post-generation vision validation layer (Task: recipe fidelity gate).
//
// CONTRACT: The canonical recipe ingredient list outranks the dish name,
// cuisine label, cultural convention, or model prior knowledge. A generated
// image is only accepted if it does not visibly contain a major ingredient
// absent from the recipe.
//
// Verdicts:
//   PASS    — no clearly visible major ingredient outside the recipe contract
//   FAIL    — a named offender was detected (reason carries the offender)
//   SKIPPED — validation could not run (no ingredients / vision error);
//             the image is still cached, but the row records SKIPPED so
//             unvalidated entries are auditable.

import OpenAI from "openai";
import crypto from "crypto";

export const VALIDATION_MODEL = "gpt-4o";

export type ValidationVerdict = "PASS" | "FAIL" | "SKIPPED";

export interface ValidationResult {
  verdict: ValidationVerdict;
  /** For FAIL: the detected offender, e.g. "hard-boiled egg visible". */
  reason: string | null;
  model: string;
}

/**
 * SHA-256 of the sorted, normalized ingredient list — the "recipe signature"
 * stored alongside a validated cache row. A cached image means "generated for
 * this recipe contract and passed fidelity validation."
 */
export function computeRecipeSignature(ingredients: string[]): string {
  const normalized = ingredients
    .map(i => i.toLowerCase().trim())
    .filter(Boolean)
    .sort()
    .join("|");
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

/**
 * The single narrow question sent to the vision model. Kept exported so the
 * regression suite can assert the contract framing.
 */
export function buildValidationPrompt(mealName: string, ingredients: string[], structuralIdentity?: string): string {
  const checkC = structuralIdentity
    ? `\nCHECK C — Wrong dish form: Even if the ingredients are approximately correct, is the food shown in the wrong structural form?\nRequired form: ${structuralIdentity}\nFor example: correct taco ingredients assembled as a salad bowl = FAIL. Three recognizable assembled tacos with tortilla shells and those ingredients = PASS even with minor variations.\nFlag Check C ONLY if the dish form is fundamentally and unmistakably wrong — not for minor plating or presentation differences.\n`
    : '';

  return `You are a recipe-fidelity inspector for food photography.

RECIPE CONTRACT for "${mealName}":
${ingredients.map(i => `- ${i}`).join("\n")}

The recipe ingredient list above is the ONLY source of truth. It outranks the dish name, cuisine label, cultural convention, and your prior knowledge of how this dish is traditionally made. Do NOT assume traditional ingredients belong in this dish.

QUESTION (answer this and nothing else): Does this image FAIL on any of the following checks?

CHECK A — Wrong ingredient: Does the image contain a clearly visible MAJOR ingredient that is NOT in the recipe contract above?
CHECK B — Wrong dish category: Does the image depict a completely different dish category than "${mealName}"? For example: a salad when the recipe is a cheesecake, a soup when the recipe is a sandwich, a green bowl of vegetables when the recipe is a dessert. Minor presentation differences are acceptable — only flag this if the dish category is fundamentally different.${checkC}
Respond with exactly one line:
PASS
or
FAIL: <specific reason — e.g. "hard-boiled egg visible" or "image shows a green salad, not assembled tacos" or "pasta served as a stir-fry bowl">

Only report MAJOR, clearly identifiable violations. For all three checks, only fail if the violation is unmistakably present. If you are not confident a violation exists, answer PASS.`;
}

/** Parse the model's one-line answer into a verdict. Exported for tests. */
export function parseValidationResponse(raw: string): { verdict: "PASS" | "FAIL"; reason: string | null } {
  const text = (raw || "").trim();
  const firstLine = text.split("\n")[0].trim();
  if (/^FAIL/i.test(firstLine)) {
    const reason = firstLine.replace(/^FAIL[:\s-]*/i, "").trim() || "unspecified offending ingredient detected";
    return { verdict: "FAIL", reason };
  }
  // Anything else (including PASS) is treated as PASS — the prompt instructs
  // the model to answer PASS when not confident.
  return { verdict: "PASS", reason: null };
}

/**
 * Vision call signature — injectable so the regression suite can script
 * model behavior without network access.
 */
export type VisionCaller = (imageUrl: string, prompt: string) => Promise<string>;

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const defaultVisionCaller: VisionCaller = async (imageUrl, prompt) => {
  const response = await getOpenAI().chat.completions.create({
    model: VALIDATION_MODEL,
    max_tokens: 60,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
        ],
      },
    ],
  });
  return response.choices?.[0]?.message?.content ?? "";
};

/**
 * Validate a generated image against the canonical recipe ingredient list.
 * Never throws — vision errors return SKIPPED so the pipeline decides policy.
 */
export async function validateImageAgainstRecipe(
  imageUrl: string,
  mealName: string,
  ingredients: string[],
  opts?: { visionCaller?: VisionCaller; timeoutMs?: number; structuralIdentity?: string }
): Promise<ValidationResult> {
  const cleanIngredients = ingredients.map(i => (i || "").trim()).filter(Boolean);
  if (cleanIngredients.length === 0) {
    // No recipe contract to validate against — cannot assert fidelity.
    return { verdict: "SKIPPED", reason: "no ingredients provided", model: VALIDATION_MODEL };
  }

  const prompt = buildValidationPrompt(mealName, cleanIngredients, opts?.structuralIdentity);
  const caller = opts?.visionCaller ?? defaultVisionCaller;
  const timeoutMs = opts?.timeoutMs ?? 20000;

  try {
    const raw = await Promise.race([
      caller(imageUrl, prompt),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error(`vision validation timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
    const parsed = parseValidationResponse(raw);
    return { verdict: parsed.verdict, reason: parsed.reason, model: VALIDATION_MODEL };
  } catch (err: any) {
    return {
      verdict: "SKIPPED",
      reason: `vision validation error: ${err?.message?.substring(0, 120) ?? "unknown"}`,
      model: VALIDATION_MODEL,
    };
  }
}

/**
 * Build the strengthened retry prompt after a FAIL — names the specific
 * detected offender and reasserts the recipe contract over tradition.
 */
export function buildRetryExclusionAddendum(mealName: string, failReason: string, structuralIdentity?: string): string {
  // Infer the specific dish form for a positive target instruction.
  // This prevents the retry from generating a random unrelated food.
  const lower = mealName.toLowerCase();
  let positiveTarget = `a clearly recognizable plated dish of "${mealName}"`;
  if (/cheesecake|cake|tart|torte|soufflé|soufflé|crumble|brownie|pudding|mousse|flan|tiramisu|panna cotta|gelato|ice cream|sorbet|macaroon|macaron|profiterole|eclair|creme brulee/i.test(lower)) {
    positiveTarget = `a clearly recognizable dessert — specifically "${mealName}" with its characteristic structure (e.g., for cheesecake: a creamy filling on a crust or in a glass, topped with strawberry or fruit)`;
  } else if (/smoothie|shake|milkshake|juice|latte|coffee|tea|cocktail|mocktail|beverage|drink|lemonade|soda/i.test(lower)) {
    positiveTarget = `a clearly recognizable drink — specifically "${mealName}" in a glass or cup`;
  } else if (/soup|stew|chowder|bisque|broth/i.test(lower)) {
    positiveTarget = `a clearly recognizable bowl of soup — specifically "${mealName}"`;
  } else if (/salad/i.test(lower)) {
    positiveTarget = `a clearly recognizable salad — specifically "${mealName}"`;
  } else if (/\btaco(s)?\b/i.test(lower)) {
    positiveTarget = `two or three clearly recognizable assembled tacos with visible tortilla shells folded around filling — specifically "${mealName}"`;
  } else if (/burrito/i.test(lower)) {
    positiveTarget = `a clearly recognizable rolled burrito with a flour tortilla sealed around the filling — specifically "${mealName}"`;
  } else if (/quesadilla/i.test(lower)) {
    positiveTarget = `a clearly recognizable flat quesadilla cut into wedges with visible melted filling — specifically "${mealName}"`;
  } else if (/sandwich|burger|wrap|hot dog/i.test(lower)) {
    positiveTarget = `a clearly recognizable handheld item — specifically "${mealName}"`;
  } else if (/pizza/i.test(lower)) {
    positiveTarget = `a clearly recognizable pizza — specifically "${mealName}"`;
  } else if (/pasta|noodle|spaghetti|fettuccine|penne|linguine|ramen|pho/i.test(lower)) {
    positiveTarget = `a clearly recognizable pasta or noodle dish with noodles coated in sauce — specifically "${mealName}"`;
  }

  const structuralRequirement = structuralIdentity
    ? `\nSTRUCTURAL REQUIREMENT — this image MUST show:\n${structuralIdentity}\nThis structural form cannot be relaxed regardless of the filling ingredients.\n`
    : '';

  return `

CORRECTION FOR PREVIOUS ATTEMPT — the previous image violated the recipe.
VIOLATION DETECTED: ${failReason}.

POSITIVE TARGET (this is what the image MUST show):
Generate ${positiveTarget}.${structuralRequirement}
The image must be unmistakably recognizable as this dish — not a salad, not a bowl of raw ingredients, not an unrelated food.

NEGATIVE CONSTRAINT: The specific violation from the previous attempt (${failReason}) must not appear.
Follow ONLY the recipe contract ingredients listed above. Nothing else may be visible.
If it is impossible to depict "${mealName}" without the excluded element, use the closest visually appropriate substitute from the recipe contract.`;
}
