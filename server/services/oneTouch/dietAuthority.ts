import { deriveProcedureRules, type UserProtocolEnvelope } from "../protocolEnvelope";

// These are the mutable eating styles. Any other saved dietary protocol
// (religious, medical, specialty, or unknown) remains in force for this action.
const MUTABLE_STYLES = new Set([
  "omnivore", "vegan", "vegetarian", "pescatarian", "keto",
  "paleo", "carnivore", "mediterranean",
]);

export function mutableProfileStyles(envelope: UserProtocolEnvelope): string[] {
  return envelope.dietaryIdentity.filter((value) =>
    MUTABLE_STYLES.has(value.trim().toLowerCase()),
  );
}

export function withOneTouchDiet(
  envelope: UserProtocolEnvelope,
  diet: string | undefined | null,
): UserProtocolEnvelope {
  if (!diet) return envelope;
  const preserved = envelope.dietaryIdentity.filter((value) =>
    !MUTABLE_STYLES.has(value.trim().toLowerCase()),
  );
  const dietaryIdentity = [diet, ...preserved.filter((value) =>
    value.trim().toLowerCase() !== diet.trim().toLowerCase(),
  )];
  return {
    ...envelope,
    dietaryIdentity,
    procedural: deriveProcedureRules(dietaryIdentity),
  };
}