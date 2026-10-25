import { assertSupportedProductMedicalClaims, UnsupportedProductMedicalClaim } from "../services/productMedicalClaimPolicy";

test.each([
  "Avoid soy sauce during testosterone replacement therapy because of phytoestrogens.",
  "Soy sauce is contraindicated for TRT users.",
  "Phytoestrogens interfere with hormone therapy.",
  "This food lowers testosterone and should be restricted.",
  "There is no evidence for this, but soy must be avoided during TRT.",
])("rejects a new unsupported hormone food restriction: %s", text => {
  expect(() => assertSupportedProductMedicalClaims({ verdict: text })).toThrow(UnsupportedProductMedicalClaim);
});

test.each([
  "Soy contains phytoestrogens; check the label for a soy allergy.",
  "TRT does not require avoiding soy sauce.",
  "There is no evidence that TRT requires avoiding soy.",
  "Avoid soy because it conflicts with your recorded soy allergy.",
  "Check your carbohydrate serving size.",
])("does not invent a new restriction or suppress unrelated valid guidance: %s", text => {
  expect(() => assertSupportedProductMedicalClaims({ verdict: text })).not.toThrow();
});

test("inspects nested alternative reasons and decoder explanations, not just the headline", () => {
  expect(() => assertSupportedProductMedicalClaims({ betterAlternatives: [{ whyBetter: ["Avoid soy to prevent estrogen increases during TRT"] }] }))
    .toThrow(UnsupportedProductMedicalClaim);
  expect(() => assertSupportedProductMedicalClaims({ profileFactorsUsed: ["TRT"], ingredientConsiderations: ["Avoid soy because of your allergy"] }))
    .not.toThrow();
});
