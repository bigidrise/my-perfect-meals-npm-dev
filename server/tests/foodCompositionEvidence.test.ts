import { requiresVerifiedIngredientEvidence } from "../services/foodCompositionEvidence";
import { buildGuestEnvelope } from "../services/protocolEnvelope";

test("unknown product or venue ingredients fail closed only for established evidence-dependent safety profiles", () => {
  const envelope = buildGuestEnvelope();
  expect(requiresVerifiedIngredientEvidence(envelope)).toBe(false);
  envelope.medicalOptimization = ["cardiac-health", "kidney-disease", "liver-support"];
  expect(requiresVerifiedIngredientEvidence(envelope)).toBe(false);
  envelope.allergies = ["peanuts"];
  expect(requiresVerifiedIngredientEvidence(envelope)).toBe(true);
  envelope.allergies = [];
  envelope.alphaGalContext = { active: true } as any;
  expect(requiresVerifiedIngredientEvidence(envelope)).toBe(true);
  envelope.alphaGalContext = undefined;
  envelope.pregnancySupportContext = { active: true, stage: "trimester-2" } as any;
  expect(requiresVerifiedIngredientEvidence(envelope)).toBe(true);
  envelope.pregnancySupportContext = { active: true, stage: "postpartum" } as any;
  expect(requiresVerifiedIngredientEvidence(envelope)).toBe(false);
});