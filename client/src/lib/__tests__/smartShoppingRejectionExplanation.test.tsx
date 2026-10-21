/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import ShoppingProductPicker from "@/components/shopping/ShoppingProductPicker";
import { post } from "@/lib/api";
import { shoppingSelectionBridge } from "../../../../server/services/productDiscovery/shoppingSelectionBridge";
import type { ShoppingUnresolvedRequirement } from "../../../../server/services/productDiscovery/shoppingRejectionExplanation";
import type { ProductCandidate, ProductEligibilityDecision, ProductDecisionReason } from "@shared/productCandidateContract";
import type { ProductSubjectSnapshot } from "../../../../server/services/productDiscovery/subjectAuthority";

jest.mock("@/lib/api", () => ({ post: jest.fn() }));
jest.mock("@/components/ui/universal-modal", () => ({
  PickerModal: ({ open, children, footer }: any) => open
    ? <section role="dialog">{children}{footer}</section> : null,
}));

const subject = {
  subjectId: "synthetic-owner", subjectKind: "account", status: "resolved",
  fingerprint: "synthetic-context", allergies: ["SHELLFISH"],
  explicitAvoidances: ["quinoa", "pork"], dietaryIdentity: ["low_carb"],
} as ProductSubjectSnapshot;
const candidate: ProductCandidate = {
  identity: {
    key: "synthetic:cream-cheese", name: "Cream cheese", brand: "Synthetic brand",
    variant: "Original", match: "exact_variant",
    provenance: { source: "usda_branded", sourceRecordId: "synthetic-record",
      observedAt: "2026-10-20", identityKey: "synthetic:cream-cheese", exactVariantMatch: true },
  },
  facts: [
    { id: "ingredients", kind: "ingredients", statement: "Milk, cream",
      completeness: "complete", provenance: { source: "usda_branded", sourceRecordId: "synthetic-record",
        observedAt: "2026-10-20", identityKey: "synthetic:cream-cheese", exactVariantMatch: true } },
    { id: "nutrition", kind: "nutrition", statement: "Synthetic nutrition",
      completeness: "complete", provenance: { source: "usda_branded", sourceRecordId: "synthetic-record",
        observedAt: "2026-10-20", identityKey: "synthetic:cream-cheese", exactVariantMatch: true } },
  ],
};
const decision: ProductEligibilityDecision = {
  contractVersion: "product-candidate.v1", status: "needs_verification", presentation: "check_the_label",
  subjectId: subject.subjectId, contextFingerprint: subject.fingerprint,
  productKey: candidate.identity.key, evaluatedAt: "2026-10-21",
  reasons: [{ code: "context_unavailable", detail: "Current subject requirements could not be resolved." }],
  ranking: [], continueDiscovery: true,
};
const ingredient = { originalName: "Cream cheese", requirements: [] };
const policyReason = "No reviewed, rule-specific packaged-product evidence policy is available.";
const unresolved: ShoppingUnresolvedRequirement[] = ["allergy:shellfish", "explicit_avoidance:quinoa", "explicit_avoidance:pork"]
  .map(id => ({ id, classification: "hard", reason: policyReason }));
const policyMessage = "Reviewed checks aren't available for your allergy requirements (shellfish) and the foods you avoid (quinoa, pork). This does not mean the product contains a restricted ingredient.";
const evidenceMessage = "Nutrition information is missing or incomplete, so we can't check all of your requirements.";
const qualifierMessage = "We can't verify the requested ingredient requirement (low sodium) with the available product checks. Keep this ingredient generic.";
const evidenceReason: ProductDecisionReason = {
  code: "evidence_missing", requirementId: "clinical:internal-example",
  detail: "Required nutrition (sodium_mg_per_serving) evidence is incomplete or unavailable.",
};

test.each([
  { name: "missing reviewed profile policies", expected: policyMessage, unresolved, reasons: decision.reasons, ingredient },
  { name: "missing product evidence", expected: evidenceMessage, unresolved: [], reasons: [evidenceReason], ingredient },
  { name: "unsupported explicit qualifier", expected: qualifierMessage, unresolved: [], reasons: decision.reasons,
    ingredient: { originalName: "low-sodium cream cheese", requirements: [] } },
])("$name: actual bridge explanation displays without approving or saving a product", async testCase => {
  const before = JSON.stringify({ candidate, decision, subject, ingredient: testCase.ingredient, unresolved: testCase.unresolved });
  const shoppingSelection = shoppingSelectionBridge(candidate, { ...decision, reasons: testCase.reasons },
    subject, testCase.unresolved, testCase.ingredient);
  expect(shoppingSelection).toEqual({ eligible: false, reason: testCase.expected });
  (post as jest.Mock).mockResolvedValue({
    catalogMatches: [{
      productKey: candidate.identity.key, name: candidate.identity.name, brand: candidate.identity.brand,
      evidenceStatus: "needs_verification", recommendationStatus: "profile_matched_pick",
      verificationMessage: "This appears to fit.", shoppingSelection,
    }],
  });
  const onCommit = jest.fn();
  render(<ShoppingProductPicker open onOpenChange={jest.fn()} ingredient={testCase.ingredient}
    quantityLabel="2 tbsp" sessionKey="synthetic-owner:synthetic-context"
    currentSelection={null} onCommit={onCommit} />);
  expect(await screen.findByText(testCase.expected)).toBeInTheDocument();
  const explanation = screen.getByRole("list", { name: "Why other catalog options are unavailable" });
  expect(explanation.textContent).not.toMatch(/allergy:|explicit_avoidance:|clinical:|sodium_mg_per_serving|context_unavailable|evidence_missing|rule-specific|fingerprint/);
  expect(screen.queryByText("This appears to fit.")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Choose for shopping" })).not.toBeInTheDocument();
  expect(onCommit).not.toHaveBeenCalled();
  expect(post).toHaveBeenCalledTimes(1);
  expect(JSON.stringify({ candidate, decision, subject, ingredient: testCase.ingredient, unresolved: testCase.unresolved })).toBe(before);
});

test("missing policies and product evidence both remain explained", () => {
  const result = shoppingSelectionBridge(candidate, { ...decision, reasons: [evidenceReason] }, subject, unresolved, ingredient);
  expect(result.reason).toContain(policyMessage);
  expect(result.reason).toContain(evidenceMessage);
  expect(result.eligible).toBe(false);
  expect(result.selection).toBeUndefined();
});

test.each([
  ["ingredients", "Ingredient information"],
  ["declared_allergens", "Allergen information"],
  ["precautionary_allergens", "Allergen cross-contact information"],
  ["certification", "Certification information"],
])("missing %s evidence uses member-friendly wording", (kind, label) => {
  const result = shoppingSelectionBridge(candidate, {
    ...decision, reasons: [{ ...evidenceReason, detail: `Required ${kind} evidence is incomplete or unavailable.` }],
  }, subject, [], ingredient);
  expect(result.reason).toBe(`${label} is missing or incomplete, so we can't check all of your requirements.`);
});

test.each([
  ["identity_unverified", "We couldn't confirm the exact product and variant from current catalog information."],
  ["assessment_missing", "Checks for your food requirements are incomplete for this product."],
  ["hard_conflict", "Available product information shows a conflict with your food requirements."],
] as const)("%s stays distinct without forwarding diagnostic details", (code, expected) => {
  const result = shoppingSelectionBridge(candidate, {
    ...decision, status: code === "hard_conflict" ? "rejected" : "needs_verification",
    reasons: [{ code, detail: "internal_diagnostic:do-not-display" }],
  }, subject, [], ingredient);
  expect(result).toEqual({ eligible: false, reason: expected });
});

test("unknown requirements and unresolved clinical authority never leak their identifiers", () => {
  for (const issue of [
    { id: "internal:unknown", classification: "hard", reason: policyReason },
    { id: "clinical:internal-condition", classification: "hard", reason: "Current subject authority or hazard-specific packaged-product policy is not established." },
    { id: "subject:internal-mismatch", classification: "authority", reason: "internal-source" },
  ]) {
    const result = shoppingSelectionBridge(candidate, decision, subject, [issue], ingredient);
    expect(result.eligible).toBe(false);
    expect(result.reason).not.toMatch(/internal|clinical:|subject:|authority|hazard-specific/);
    expect(result.reason).not.toContain("shows a conflict");
  }
});

test("stale account context is not described as missing package evidence", () => {
  const result = shoppingSelectionBridge(candidate, { ...decision, contextFingerprint: "stale" }, subject, unresolved, ingredient);
  expect(result).toEqual({ eligible: false,
    reason: "Your current food profile could not be confirmed for this product. Your ingredient is unchanged." });
});

test("support-only context still does not block an eligible selection", () => {
  const result = shoppingSelectionBridge(candidate, {
    ...decision, status: "eligible", reasons: [], presentation: "recommended_for_you",
  }, subject, [{ id: "support:internal-context", classification: "support_context" }], ingredient);
  expect(result.eligible).toBe(true);
  expect(result.reason).toBeUndefined();
});
