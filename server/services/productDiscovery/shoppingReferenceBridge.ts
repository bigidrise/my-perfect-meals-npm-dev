import type { ProductCandidate, ProductEligibilityDecision } from "../../../shared/productCandidateContract";
import {
  canonicalShoppingIngredient, parseShoppingProductReference,
  type ShoppingIngredientRequest, type ShoppingProductReference,
} from "../../../shared/shoppingProductSelection";
import type { ProductSubjectSnapshot } from "./subjectAuthority";
import { shoppingProductSnapshot } from "./shoppingSelectionBridge";
import { productIdentityMatchesPolicy } from "./evaluateProductCandidate";
import { DEVELOPMENT_CATALOG_IDENTITY_POLICY } from "./ruleEvidenceRegistry";

/** Intent only: retains uncertainty, never supplies missing policy or an eligible verdict. */
export function shoppingReferenceBridge(
  candidate: ProductCandidate, decision: ProductEligibilityDecision,
  subject: ProductSubjectSnapshot, input: ShoppingIngredientRequest, warning: string,
): ShoppingProductReference | null {
  if (subject.status !== "resolved" || subject.subjectKind !== "account" ||
    !productIdentityMatchesPolicy(candidate, decision.evaluatedAt,
      DEVELOPMENT_CATALOG_IDENTITY_POLICY.identityMaxAgeDays ?? -1) || decision.status === "rejected" ||
    decision.productKey !== candidate.identity.key || decision.subjectId !== subject.subjectId ||
    decision.contextFingerprint !== subject.fingerprint ||
    decision.reasons.some(reason => reason.code === "hard_conflict" || reason.code === "identity_unverified")) return null;
  try {
    return parseShoppingProductReference({
      ingredient: canonicalShoppingIngredient(input),
      product: {
        ...shoppingProductSnapshot(candidate, decision),
        selectionKind: "unverified_shopping_reference",
        assessment: {
          status: "review_required",
          unresolvedRequirements: [...new Set([
            warning, ...decision.reasons.map(reason => reason.detail),
            "Product suitability has not been verified. This is not medical or restricted-diet clearance.",
          ].filter(Boolean))],
          reasons: ["Customer-selected shopping intent only; no eligibility was granted."],
          evaluatedAt: decision.evaluatedAt, policyVersion: "shopping-reference-intent.v1",
          subjectReference: subject.subjectId, contextReference: subject.fingerprint,
        },
      },
    });
  } catch { return null; }
}
