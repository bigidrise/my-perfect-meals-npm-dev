import type { UserProtocolEnvelope } from "./protocolEnvelope";

/**
 * Names, flavor notes, and restaurant menu listings are not complete ingredient
 * labels. These active profiles require verified ingredients before a product
 * or venue recommendation can be cleared.
 */
export function requiresVerifiedIngredientEvidence(envelope: UserProtocolEnvelope): boolean {
  const alphaGalMentioned = [
    ...envelope.dietaryIdentity,
    ...envelope.medicalHardLimits,
    ...envelope.medicalOptimization,
    ...(envelope.conditionGuidanceBlocks ?? []),
  ].some((value) => /alpha[\s-]*gal/i.test(value));
  const pregnancy = envelope.pregnancySupportContext;
  return Boolean(
    envelope.alphaGalContext?.active ||
    alphaGalMentioned ||
    envelope.allergies.length > 0 ||
    (pregnancy?.active && /^trimester-[123]$/.test(pregnancy.stage)),
  );
}