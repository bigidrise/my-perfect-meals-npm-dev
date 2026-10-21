import type { ProductCandidate, ProductEligibilityDecision } from "../../../shared/productCandidateContract";
import {
  canonicalShoppingIngredient, parseShoppingProductSelection,
  type ShoppingCatalogDecision, type ShoppingIngredientRequest,
} from "../../../shared/shoppingProductSelection";
import type { ShoppingIngredientMetadata } from "../../../shared/shoppingIngredientMetadata";
import type { ProductSubjectSnapshot } from "./subjectAuthority";
import { DEVELOPMENT_CATALOG_IDENTITY_POLICY } from "./ruleEvidenceRegistry";

/**
 * Projection only: never awards eligibility or installs product rules.
 * Explicit recipe qualifiers have no reviewed validator in the current registry.
 */
export function shoppingSelectionBridge(
  candidate: ProductCandidate,
  decision: ProductEligibilityDecision,
  subject: ProductSubjectSnapshot,
  unresolved: readonly { id: string; classification: string }[],
  input: ShoppingIngredientRequest,
): ShoppingCatalogDecision {
  const ingredient = canonicalShoppingIngredient(input);
  const explicit = ingredient.requirements.filter(r => r.origin !== "profile_guidance");
  if (explicit.length) return {
    eligible: false,
    reason: `No reviewed product-evidence rule verifies ${explicit.map(r => r.value).join(", ")} for this ingredient. Keep it generic and check the current label.`,
  };
  if (subject.status !== "resolved" || subject.subjectKind !== "account" ||
      decision.status !== "eligible" || decision.subjectId !== subject.subjectId ||
      decision.productKey !== candidate.identity.key ||
      decision.contextFingerprint !== subject.fingerprint ||
      decision.reasons.length || unresolved.some(r => r.classification !== "support_context")) {
    return { eligible: false, reason: "Current profile or product evidence still requires review. No shopping choice was approved; the ingredient is unchanged." };
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
    return { eligible: false, reason: "The catalog record cannot preserve sufficient structured product evidence. Keep this ingredient generic." };
  }
}
