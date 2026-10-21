import { shoppingSelectionBridge } from "../services/productDiscovery/shoppingSelectionBridge";
import { canonicalShoppingIngredient, parseShoppingProductSelection } from "../../shared/shoppingProductSelection";
import { requireProAccess } from "../middleware/requireProAccess";
import type { ProductCandidate, ProductEligibilityDecision } from "../../shared/productCandidateContract";
import type { ProductSubjectSnapshot } from "../services/productDiscovery/subjectAuthority";

const subject = { subjectId: "synthetic-owner", subjectKind: "account", status: "resolved",
  fingerprint: "synthetic-context" } as ProductSubjectSnapshot;
const candidate: ProductCandidate = {
  identity: {
    key: "synthetic:package:a", name: "Pasta sauce", brand: "Synthetic Brand", variant: "Original",
    barcode: "000000000001", packageSize: "12 oz", servingDescription: "60 g", match: "exact_variant",
    provenance: { source: "usda_branded", sourceRecordId: "synthetic-a", observedAt: "2026-10-20",
      retrievedAt: "2026-10-21", market: "US", identityKey: "synthetic:package:a",
      barcode: "000000000001", exactVariantMatch: true },
  },
  facts: [],
};
candidate.facts = [
  { id: "ingredients", kind: "ingredients", statement: "Tomatoes, water", completeness: "complete",
    provenance: { ...candidate.identity.provenance, observedAt: "2026-09-01" } },
  { id: "sodium", kind: "nutrition", target: "sodium_mg_per_serving", statement: "100 mg sodium per 60 g",
    completeness: "complete", nutritionMeasurement: { value: 100, unit: "mg", basis: "per_serving", servingSize: "60 g" },
    provenance: { ...candidate.identity.provenance, observedAt: "2026-09-02" } },
];
const decision: ProductEligibilityDecision = {
  contractVersion: "product-candidate.v1", status: "eligible", presentation: "recommended_for_you",
  subjectId: subject.subjectId, contextFingerprint: subject.fingerprint,
  productKey: candidate.identity.key, evaluatedAt: "2026-10-21", reasons: [], ranking: [], continueDiscovery: false,
};
const ingredient = { originalName: "Pasta sauce", requirements: [] };

test("projects existing eligible evidence without inventing facts or dates", () => {
  const result = shoppingSelectionBridge(candidate, decision, subject, [], ingredient);
  expect(result.eligible).toBe(true);
  const selection = parseShoppingProductSelection(result.selection);
  expect(selection.product).toMatchObject({
    productKey: candidate.identity.key, variant: "Original", upc: "000000000001",
    packageDescription: "12 oz", servingDescription: "60 g",
    source: { observedAt: "2026-10-20", retrievedAt: "2026-10-21" },
    assessment: { status: "eligible_at_evaluation", subjectReference: "synthetic-owner",
      contextReference: "synthetic-context", evaluatedAt: "2026-10-21" },
  });
  expect(selection.product.retailQuantity).toBeUndefined();
  expect(selection.product.evidence[0].provenance.observedAt).toBe("2026-09-01");
  expect(selection.product.evidence[1].measurement).toEqual(candidate.facts[1].nutritionMeasurement);
  expect(JSON.parse(selection.product.sourcePayloadJson!).identity.provenance.market).toBe("US");
});

test.each(["low-sodium soy sauce", "reduced-sugar jam", "gluten-free bread", "vegan cream cheese"])(
  "search words never establish explicit qualifier evidence: %s", originalName => {
    const result = shoppingSelectionBridge(candidate, decision, subject, [], { originalName, requirements: [] });
    expect(result).toMatchObject({ eligible: false, reason: expect.stringContaining("We can't verify the requested ingredient requirement") });
    expect(result.selection).toBeUndefined();
    expect(canonicalShoppingIngredient({ originalName, requirements: [] }).requirements.length).toBeGreaterThan(0);
  },
);

test("explicit request requirements remain blocking even when absent from the name", () => {
  expect(shoppingSelectionBridge(candidate, decision, subject, [], {
    originalName: "Pasta sauce", requirements: [{ value: "reduced sugar", origin: "explicit_request" }],
  }).eligible).toBe(false);
});

test.each(["needs_verification", "rejected"] as const)("never upgrades %s into a selectable option", status => {
  expect(shoppingSelectionBridge(candidate, { ...decision, status }, subject, [], ingredient).eligible).toBe(false);
});
test("unresolved clinical authority blocks even an otherwise eligible catalog result", () => {
  expect(shoppingSelectionBridge(candidate, decision, subject,
    [{ id: "clinical:synthetic", classification: "hard" }], ingredient).eligible).toBe(false);
});
test("wrong subject/context and incomplete evidence do not become choices", () => {
  expect(shoppingSelectionBridge(candidate, { ...decision, subjectId: "other" }, subject, [], ingredient).eligible).toBe(false);
  expect(shoppingSelectionBridge(candidate, { ...decision, contextFingerprint: "stale" }, subject, [], ingredient).eligible).toBe(false);
  expect(shoppingSelectionBridge({ ...candidate, facts: [] }, decision, subject, [], ingredient).eligible).toBe(false);
});
test("unknown package/serving/UPC data is not manufactured", () => {
  const identity = { ...candidate.identity, barcode: undefined, packageSize: undefined, servingDescription: undefined };
  const selection = shoppingSelectionBridge({ ...candidate, identity }, decision, subject, [], ingredient).selection!;
  expect(selection.product.upc).toBeUndefined();
  expect(selection.product.packageDescription).toBeUndefined();
  expect(selection.product.servingDescription).toBeUndefined();
});
test("review-only assessment cannot pass the client selection parser", () => {
  const selection = shoppingSelectionBridge(candidate, decision, subject, [], ingredient).selection!;
  expect(() => parseShoppingProductSelection({
    ...selection, product: { ...selection.product, assessment: { ...selection.product.assessment, status: "review_required" } },
  })).toThrow();
});

test("Pro middleware still rejects Essential access and allows actual Pro access", () => {
  // Module-local policy is resolved at import; isolate only this middleware.
  const previous = process.env.BILLING_ENFORCED;
  process.env.BILLING_ENFORCED = "true";
  try {
    jest.isolateModules(() => {
      const { requireProAccess: guard } = require("../middleware/requireProAccess") as { requireProAccess: typeof requireProAccess };
      const next = jest.fn();
      const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      guard({ authUser: { accessTier: "PAID_FULL", planLookupKey: "mpm_basic_monthly" } } as any, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
      guard({ authUser: { accessTier: "PAID_FULL", planLookupKey: "mpm_premium_monthly" } } as any, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      guard({} as any, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  } finally {
    if (previous === undefined) delete process.env.BILLING_ENFORCED; else process.env.BILLING_ENFORCED = previous;
  }
});
