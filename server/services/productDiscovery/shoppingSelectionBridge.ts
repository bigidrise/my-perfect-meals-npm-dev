import type { ProductCandidate, ProductEligibilityDecision } from "../../../shared/productCandidateContract";
import {
  canonicalShoppingIngredient, parseShoppingProductSelection,
  type ShoppingCatalogDecision, type ShoppingIngredientRequest,
} from "../../../shared/shoppingProductSelection";
import type { ShoppingIngredientMetadata } from "../../../shared/shoppingIngredientMetadata";
import type { ProductSubjectSnapshot } from "./subjectAuthority";
import { DEVELOPMENT_CATALOG_IDENTITY_POLICY } from "./ruleEvidenceRegistry";
import { shoppingRejectionExplanation, type ShoppingUnresolvedRequirement } from "./shoppingRejectionExplanation";

/**
 * Projection only: never awards eligibility or installs product rules.
 * Explicit recipe qualifiers have no reviewed validator in the current registry.
 */
export function shoppingSelectionBridge(
  candidate: ProductCandidate,
  decision: ProductEligibilityDecision,
  subject: ProductSubjectSnapshot,
  unresolved: readonly ShoppingUnresolvedRequirement[],
  input: ShoppingIngredientRequest,
): ShoppingCatalogDecision {
  const ingredient = canonicalShoppingIngredient(input);
  const explicit = ingredient.requirements.filter(r => r.origin !== "profile_guidance");
  if (explicit.length) return {
    eligible: false,
    reason: `We can't verify the requested ingredient requirement (${explicit.map(r => r.value).join(", ")}) with the available product checks. Keep this ingredient generic.`,
  };
  if (subject.status !== "resolved" || subject.subjectKind !== "account" ||
      decision.status !== "eligible" || decision.subjectId !== subject.subjectId ||
      decision.productKey !== candidate.identity.key ||
      decision.contextFingerprint !== subject.fingerprint ||
      decision.reasons.length || unresolved.some(r => r.classification !== "support_context")) {
    const contextMatches = subject.status === "resolved" && subject.subjectKind === "account" &&
      decision.subjectId === subject.subjectId && decision.productKey === candidate.identity.key &&
      decision.contextFingerprint === subject.fingerprint;
    return { eligible: false, reason: contextMatches
      ? shoppingRejectionExplanation(decision, subject, unresolved)
      : "Your current food profile could not be confirmed for this product. Your ingredient is unchanged." };
  }
  const provenance = (source: ProductCandidate["identity"]["provenance"]) => ({
    source: source.source, sourceRecordId: source.sourceRecordId,
    ...(source.observedAt ? { observedAt: source.observedAt } : {}),
    ...(source.retrievedAt ? { retrievedAt: source.retrievedAt } : {}),
  });
  const evidence: NonNullable<ShoppingIngredientMetadata["selectedProduct"]>["evidence"] =
    candidate.facts.map(fact => ({
      kind: fact.kind === "processing" ? "other" : fact.kind,
      statement: fact.statement,
      ...(fact.target ? { target: fact.target } : {}),
      ...(fact.nutritionMeasurement ? { measurement: { ...fact.nutritionMeasurement } } : {}),
      provenance: provenance(fact.provenance),
    }));
  try {
    const selection = parseShoppingProductSelection({
      ingredient,
      product: {
        productKey: candidate.identity.key, name: candidate.identity.name,
        brand: candidate.identity.brand, variant: candidate.identity.variant,
        ...(candidate.identity.barcode ? { upc: candidate.identity.barcode } : {}),
        ...(candidate.identity.packageSize ? { packageDescription: candidate.identity.packageSize } : {}),
        ...(candidate.identity.servingDescription ? { servingDescription: candidate.identity.servingDescription } : {}),
        source: provenance(candidate.identity.provenance),
        // Preserve exact source fields not modeled by the narrow storage projection.
        sourcePayloadJson: JSON.stringify({ identity: candidate.identity, facts: candidate.facts, decision,
          policyVersion: DEVELOPMENT_CATALOG_IDENTITY_POLICY.version }),
        evidence,
        assessment: {
          status: "eligible_at_evaluation", unresolvedRequirements: [],
          reasons: ["Evidence-supported catalog choice at evaluation, not current-package or permanent medical clearance."],
          evaluatedAt: decision.evaluatedAt,
          policyVersion: DEVELOPMENT_CATALOG_IDENTITY_POLICY.version,
          subjectReference: decision.subjectId, contextReference: decision.contextFingerprint,
        },
      },
    });
    return { eligible: true, selection };
  } catch {
    // Oversized/malformed source records cannot be silently trimmed into approvals.
    return { eligible: false, reason: "This product's information can't be saved reliably. Keep this ingredient generic." };
  }
}
