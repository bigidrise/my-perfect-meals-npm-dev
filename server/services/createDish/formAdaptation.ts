import type { DishAdaptationDirective } from "../dishAdaptation/types";
import type { CreateDishContract } from "./dishContract";

/**
 * A vessel is a changeable serving component, not a license to turn any named
 * food into a bowl. This authority comes from the resolved subject diet and
 * the server's dish decomposition, never from a generated title.
 */
export function authorizeCreateDishFormAdaptation(
  contract: CreateDishContract,
  directive: DishAdaptationDirective | null,
  effectiveDiet: readonly string[],
  explicitlySelectedForm: boolean,
): { contract: CreateDishContract; directive: DishAdaptationDirective | null } {
  const lowCarb = effectiveDiet.some(diet => /^(?:low[_ -]?carb|keto(?:genic)?)$/i.test(diet.trim()));
  const vessel = /\b(?:buns?|breads?|rolls?|tortillas?|wraps?|pitas?|flatbreads?)\b/i;
  const handheldForm = /\b(?:sandwich|wrap|bread|bun|roll|pita|flatbread)\b/i.test(contract.physicalForm ?? "");
  const decomposedVessel = contract.definingComponents.some(part => vessel.test(part)) ||
    contract.adaptableComponents.some(part => vessel.test(part));
  // An explicitly requested bread/vessel or form remains authoritative.
  const requestedVessel = vessel.test(contract.requestedDish);
  if (!lowCarb || !directive || !handheldForm || !decomposedVessel || requestedVessel || explicitlySelectedForm) {
    return { contract, directive };
  }
  const permittedFormFamilies = ["bowl", "wrap"] as Array<"bowl" | "wrap">;
  return {
    contract: { ...contract, permittedFormFamilies },
    directive: { ...directive, permittedFormFamilies },
  };
}