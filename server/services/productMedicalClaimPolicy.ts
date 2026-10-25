/**
 * No reviewed sex-hormone food-prohibition rule is registered here.
 * A therapy/condition label or phytoestrogen mechanism alone is not authority
 * to prohibit a food. Fail the NEW result rather than editing its grade or
 * removing an isolated sentence while retaining a potentially affected grade.
 * Historical snapshots and deterministic allergy/medication rules are untouched.
 */
export class UnsupportedProductMedicalClaim extends Error {
  constructor() { super("Generated food restriction requires reviewed medical evidence."); }
}

export const PRODUCT_MEDICAL_CLAIM_POLICY = "sex-hormone-food-restrictions-evidence-required";

export function assertSupportedProductMedicalClaims(result: unknown): void {
  const hormone = /\b(?:testosterone|estrogen|oestrogen|estradiol|trt|phytoestrogen\w*|hormonal|hormone(?:s|\s+(?:therapy|replacement|balance|levels|optimization))?)\b/i;
  const assertedRestriction = /\b(?:avoid\w*|prohibit\w*|contraindicat\w*|unsafe|must\s+not|should\s+not|cannot|can't|restrict\w*|interfer\w*|disrupt\w*|lower\w*|reduc\w*|increase\w*|raise\w*|worsen\w*|harm\w*|negative|adverse)\b/i;
  const qualified = /\b(?:does\s+not|do\s+not|doesn't|don't)\s+(?:require|mean|need|establish|justify|support)\b|\bno\s+(?:need|evidence|established\s+(?:need|restriction))\b|\bnot\s+(?:prohibited|contraindicated)\b/i;
  const inspect = (value: unknown) => {
    if (typeof value === "string") {
      // Keep contrary assertions after "but/however" separate from a disclaimer.
      for (const sentence of value.split(/[.!?;\n]|\bbut\b|\bhowever\b/i)) {
        if (hormone.test(sentence) && assertedRestriction.test(sentence) && !qualified.test(sentence)) {
          throw new UnsupportedProductMedicalClaim();
        }
      }
    } else if (Array.isArray(value)) {
      value.forEach(inspect);
    } else if (value && typeof value === "object") {
      // Inspect each assertion; unrelated allergy and profile labels do not
      // combine into a false hormone restriction across different fields.
      Object.values(value).forEach(inspect);
    }
  };
  inspect(result);
}
