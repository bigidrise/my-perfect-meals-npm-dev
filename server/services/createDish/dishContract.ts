import type { CreateDishIntent } from "../../../shared/createDishIngredientExpansion";
import type { DishAdaptationDirective } from "../dishAdaptation/types";
import type { FoodMeaningV1 } from "../../../shared/foodMeaning";

/**
 * Server-owned culinary contract. These are identity requirements, not evidence
 * of safety: the protocol and human-food validators still decide compliance.
 */
export interface CreateDishContract {
  requestedDish: string;
  definingIngredient: string;
  ingredientId: string;
  namedFamily: "salad" | "wrap" | null;
  namedCore: string | null;
  leafVessel: boolean;
  physicalForm: string | null;
  permittedFormFamilies?: Array<"bowl" | "wrap">;
  definingComponents: string[];
  adaptableComponents: string[];
  conflicts: DishAdaptationDirective["conflicts"];
  cuisine: string | null;
  conceptKind?: FoodMeaningV1["concept"]["kind"];
}

const normalize = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");

export function resolveCreateDishContract(
  intent: CreateDishIntent,
  directive?: DishAdaptationDirective | null,
  meaning?: FoodMeaningV1 | null,
): CreateDishContract {
  const requestedDish = intent.originalText.trim();
  const canonical = normalize(intent.ingredient.canonicalName);
  const request = normalize(requestedDish);
  // A named composition is more specific than its broad family. Prefer the
  // validated semantic dish when available, but do not mistake an ordinary
  // catalog ingredient ("Potato") for the entire requested dish.
  const subject = intent.ingredient.category === "prepared-dish"
    ? canonical
    : request;
  const match = subject.match(/\b([a-z]+)\s+(salads?|wraps?)\b/);
  const namedFamily = match
    ? match[2].startsWith("salad") ? "salad" : "wrap"
    : null;
  const namedCore = match?.[1] ?? null;
  // Lettuce leaves are the structural wrap, not an ingredient called
  // "lettuce wrap". Other named wraps retain their usual filling + vessel.
  const leafVessel = namedFamily === "wrap" && namedCore === "lettuce";
  return {
    requestedDish,
    definingIngredient: intent.ingredient.canonicalName,
    ingredientId: intent.ingredient.canonicalId,
    namedFamily,
    namedCore,
    leafVessel,
    physicalForm: directive?.dishForm ?? null,
    permittedFormFamilies: directive?.permittedFormFamilies,
    definingComponents: directive?.definingComponents ?? [],
    adaptableComponents: directive?.adaptableComponents ?? [],
    conflicts: directive?.conflicts ?? [],
    cuisine: intent.cuisine ?? null,
    conceptKind: meaning?.concept.kind,
  };
}

export function buildCreateDishContractPrompt(contract: CreateDishContract): string {
  const named = contract.namedFamily
    ? `This is the named dish "${contract.requestedDish}", not an arbitrary ${contract.namedFamily}. ` +
      (contract.leafVessel
        ? "Use actual lettuce leaves as the wrap vessel and put the filling inside them; a tortilla wrap with lettuce garnish is not a lettuce wrap."
        : contract.namedFamily === "salad"
          ? "Keep the named salad's defining core; do not impose a leafy-green or grain base unless that is part of the requested dish."
          : "Keep the named wrap's defining filling and enclosed presentation.")
    : `Preserve the requested dish "${contract.requestedDish}", not merely its broad family.`;
  return `[CREATE A DISH — RESOLVED DISH CONTRACT]
${named}
 ${contract.conceptKind === "prepared_dish"
   ? `Prepared dish identity: ${contract.requestedDish}. Its name is not itself an ingredient; preserve its defining composition and default form unless an authorized vessel adaptation is specified below.`
   : `Defining ingredient: ${contract.definingIngredient}.`}
${contract.physicalForm ? `Physical form: ${contract.physicalForm}.` : ""}
${contract.permittedFormFamilies?.length ? `When the person's resolved requirements require a different vessel, a ${contract.permittedFormFamilies.join(" or ")} is permitted only if the finished recipe still has the defining dish structure and passes every food protection. Do not change an explicitly selected form.` : ""}
${contract.definingComponents.length ? `Defining components: ${contract.definingComponents.join("; ")}.` : ""}
${contract.adaptableComponents.length ? `Adaptable components: ${contract.adaptableComponents.join("; ")}.` : ""}
${contract.cuisine ? `Use compatible ${contract.cuisine} seasonings and preparation without replacing the requested dish.` : ""}
Adapt incompatible components while preserving the requested dish. All allergies, avoidances, dietary, clinical, provider and final food validations remain authoritative.`;
}