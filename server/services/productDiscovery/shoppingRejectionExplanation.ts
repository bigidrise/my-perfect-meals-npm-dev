import type { ProductEligibilityDecision } from "../../../shared/productCandidateContract";
import type { ProductSubjectSnapshot } from "./subjectAuthority";

export interface ShoppingUnresolvedRequirement {
  id: string;
  classification: string;
  reason?: string;
}

/** Member copy only. Never changes a decision or forwards internal IDs/details. */
export function shoppingRejectionExplanation(
  decision: ProductEligibilityDecision,
  subject: ProductSubjectSnapshot,
  unresolved: readonly ShoppingUnresolvedRequirement[],
): string {
  const messages = new Set<string>();
  const missingPolicies = new Map<string, Set<string>>();
  for (const issue of unresolved) {
    if (issue.classification === "support_context") continue;
    if (issue.reason === "No reviewed, rule-specific packaged-product evidence policy is available.") {
      const groups = [
        ["allergy", subject.allergies, "your allergy requirements"],
        ["explicit_avoidance", subject.explicitAvoidances, "the foods you avoid"],
        ["dietary_identity", subject.dietaryIdentity, "your dietary requirements"],
      ] as const;
      const group = groups.find(([prefix]) => issue.id.startsWith(`${prefix}:`));
      if (group) {
        const [prefix, values, label] = group;
        const value = values?.find(value =>
          `${prefix}:${value.trim().toLowerCase().replace(/\s+/g, " ")}` === issue.id);
        const display = value?.trim().toLowerCase().replace(/_/g, " ");
        const names = missingPolicies.get(label) ?? new Set<string>();
        if (display) names.add(display);
        missingPolicies.set(label, names);
      } else {
        missingPolicies.set("your food requirements", new Set());
      }
    } else if (issue.id === "identity:freshness") {
      messages.add("We couldn't confirm that this product's catalog information is up to date.");
    } else if (issue.classification === "authority") {
      messages.add("Your current food profile could not be confirmed for this product.");
    } else {
      messages.add("The guidance needed to check this product against your health requirements could not be confirmed.");
    }
  }
  if (missingPolicies.size) {
    const labels = [...missingPolicies].map(([label, names]) =>
      `${label}${names.size ? ` (${[...names].join(", ")})` : ""}`);
    messages.add(`Reviewed checks aren't available for ${labels.join(" and ")}. This does not mean the product contains a restricted ingredient.`);
  }
  for (const reason of decision.reasons) {
    switch (reason.code) {
      case "identity_unverified":
        messages.add("We couldn't confirm the exact product and variant from current catalog information.");
        break;
      case "hard_conflict":
        messages.add("Available product information shows a conflict with your food requirements.");
        break;
      case "evidence_missing": {
        const fields: Record<string, string> = {
          ingredients: "Ingredient information",
          nutrition: "Nutrition information",
          declared_allergens: "Allergen information",
          precautionary_allergens: "Allergen cross-contact information",
          certification: "Certification information",
        };
        const kind = /^Required ([a-z_]+)(?: \(| evidence)/.exec(reason.detail)?.[1];
        messages.add(`${(kind && fields[kind]) || "Product information"} is missing or incomplete, so we can't check all of your requirements.`);
        break;
      }
      case "assessment_missing":
        messages.add("Checks for your food requirements are incomplete for this product.");
        break;
      // The unresolved requirements above explain context_unavailable more precisely.
    }
  }
  return [...messages].join(" ") || "Your food requirements could not be confirmed for this product.";
}
