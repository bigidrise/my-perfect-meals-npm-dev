import OpenAI from "openai";
import { z } from "zod";
import { classifyNutritionalRole } from "../groceryNutritionalRole";
import { evaluateLowCarbSourceEvidence, type ContextualSourceDecision } from "./lowCarbPolicy";
import type { HumanFoodCandidate } from "../../../shared/humanFoodValidation";

const decisionSchema = z.object({
  ingredient: z.string(),
  category: z.enum([
    "nonmaterial", "whole_plant_fat", "non_starchy_fibrous",
    "starchy_concentrated", "added_sugar", "unknown",
  ]),
  role: z.enum(["flavoring", "structural", "sweetener", "carbohydrate_source", "fat", "other"]),
  identity: z.enum(["single_source", "compound_or_packaged", "uncertain"]),
  reason: z.string().min(15).max(300),
});
const responseSchema = z.object({ decisions: z.array(decisionSchema).max(40) });

type RecipeIngredient = { name?: string; item?: string; quantity?: unknown; unit?: unknown };

function amountInTeaspoons(item: RecipeIngredient): number | null {
  const raw = String(item.quantity ?? "").trim();
  const fraction = /^(\d+)\s*\/\s*(\d+)$/.exec(raw);
  const quantity = fraction ? Number(fraction[1]) / Number(fraction[2]) : Number(raw);
  const unit = String(item.unit ?? "").toLowerCase().trim();
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (/^(tsp|teaspoons?)$/.test(unit)) return quantity;
  if (/^(ml|milliliters?)$/.test(unit)) return quantity / 5;
  return null;
}

/**
 * Resolve only names still unknown to the canonical source evaluator. Grocery
 * Coach's role knowledge provides a contextual cross-check; as in the Dish
 * Adaptation Layer, the model reasons about food, not safety permissions.
 * The returned decisions live only for this recipe operation.
 */
export async function resolveContextualFoodEvidence(
  candidate: HumanFoodCandidate,
): Promise<ContextualSourceDecision[]> {
  const baseline = evaluateLowCarbSourceEvidence(candidate.ingredients, candidate.nutrition);
  const unresolvedNames = [...new Set(baseline.ingredientEvidence
    .filter((entry) => entry.category === "unknown" &&
      entry.reason?.startsWith("This food is not covered by the current explicit source classifications."))
    .map((entry) => entry.ingredient))];
  if (!unresolvedNames.length || unresolvedNames.length > 20) return [];
  const items: RecipeIngredient[] = [];
  for (const item of candidate.ingredients ?? []) {
    if (typeof item === "object" && item !== null) items.push(item);
  }
  const knownRoleDecisions: ContextualSourceDecision[] = [];
  const unknown = unresolvedNames.filter((name) => {
    const item = items.find((value) => (value.name ?? value.item) === name);
    // A measured, tiny flavoring is not a material carbohydrate-source
    // allocation, regardless of whether the ingredient is in a name table.
    // Explicit sugar, sauce, blend, dairy and mixed-food categories were
    // excluded above and can never use this rule.
    if (item && classifyNutritionalRole(name) === "condiment" &&
        (amountInTeaspoons(item) ?? Infinity) <= 1 &&
        !/\b(sugar|syrup|sweeten|blend|mix|sauce|seasoning)\b/i.test(name)) {
      knownRoleDecisions.push({
        ingredient: name, category: "nonmaterial", role: "measured_flavoring",
        reason: "Measured condiment in a nonmaterial flavoring quantity.",
      });
      return false;
    }
    return true;
  });
  if (!unknown.length) return knownRoleDecisions;
  const questions = unknown.map((name) => {
    const item = items.find((value) => (value.name ?? value.item) === name);
    return { ingredient: name, quantity: item?.quantity, unit: item?.unit,
      groceryRole: classifyNutritionalRole(name) };
  });
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 1200,
      messages: [{
        role: "user",
        content: [
          "Analyze the culinary role and carbohydrate-source relevance of ONLY the listed unresolved ingredients in this one-serving recipe. Return JSON {decisions:[{ingredient,category,role,identity,reason}]}. Include each exact ingredient name once.",
          "category: nonmaterial | whole_plant_fat | non_starchy_fibrous | starchy_concentrated | added_sugar | unknown.",
          "role: flavoring | structural | sweetener | carbohydrate_source | fat | other. identity: single_source | compound_or_packaged | uncertain.",
          "Use nonmaterial ONLY for a genuinely tiny flavoring amount, never a sweetener or a structural ingredient. Judge the underlying food, not the preparation word: grinding a single-source food into flour or powder does not by itself turn it into grain starch. Unsweetened single-source plant powders may be non-starchy if their food identity actually supports that classification. Never invent packaged product contents, nutrient grams or source composition. Generic food labels, mixtures, sweeteners without supported identity, and uncertainty must be unknown. Identify concentrated starch and added sugar explicitly. Do not approve the recipe or judge allergens. A single recipe cannot prove a daily 70/30 allocation.",
          JSON.stringify({ dish: candidate.name, description: candidate.description,
            ingredients: questions, instructions: candidate.instructions }),
        ].join("\n"),
      }],
    });
    const parsed = responseSchema.parse(JSON.parse(response.choices[0]?.message?.content ?? ""));
    if (parsed.decisions.length !== questions.length ||
        new Set(parsed.decisions.map((d) => d.ingredient)).size !== questions.length ||
        parsed.decisions.some((d) => !unknown.includes(d.ingredient))) return knownRoleDecisions;
    return [...knownRoleDecisions, ...parsed.decisions.flatMap((decision): ContextualSourceDecision[] => {
      const item = items.find((value) => (value.name ?? value.item) === decision.ingredient);
      const groceryRole = classifyNutritionalRole(decision.ingredient);
      // A model cannot certify a packaged mixture. Conservative grocery-role
      // checks also prevent an unfamiliar sweetener/condiment being promoted
      // into a harmless source just by fluent prose.
      if (decision.category === "unknown" || decision.identity !== "single_source" ||
          /\b(assorted|mixed|mix|blend|packaged|premade|commercial|brand|flavored|filling)\b/i.test(decision.ingredient)) return [];
      if (decision.role === "sweetener" && decision.category !== "added_sugar") return [];
      if (decision.category === "nonmaterial") {
        if (decision.role !== "flavoring" || groceryRole !== "condiment" ||
            item === undefined || (amountInTeaspoons(item) ?? Infinity) > 2 ||
            /\b(sugar|syrup|sweeten|blend|mix|sauce|seasoning)\b/i.test(decision.ingredient)) return [];
      } else if (decision.category === "whole_plant_fat") {
        if (groceryRole !== "healthy_fat") return [];
      } else if (decision.category === "non_starchy_fibrous") {
        if (!["fibrous_vegetable", "other"].includes(groceryRole) ||
            decision.role === "sweetener") return [];
      } else if (decision.category === "starchy_concentrated") {
        // Never turn an identified starch into a source-compatible pass.
      } else if (decision.category !== "added_sugar") {
        return [];
      }
      return [{ ingredient: decision.ingredient, category: decision.category,
        role: decision.role, reason: decision.reason }];
    })];
  } catch {
    // Provider/schema failures leave material evidence unresolved; no bypass.
    console.warn("[CreatorMenu] Contextual food evidence unavailable", { reason: "provider_or_schema" });
    return knownRoleDecisions;
  }
}