import type { HealthProtocol } from "./healthProtocolState";

/**
 * Personal nutrition preferences, not diagnoses or clinician directives.
 * The DEV self-selectable list is deliberately narrower than the protocol
 * registry. Existing clinical conditions remain in the specialty controls;
 * the old anti-inflammatory preference remains separate until reconciliation.
 */
export const NUTRITION_SUPPORT_OPTIONS = [
  { protocol: "glp1", label: "GLP-1 Nutrition Support", description: "Apply GLP-1-oriented nutrition support to my food. This choice does not record medication use, change your Builder, or change meals yet." },
] as const satisfies readonly {
  protocol: HealthProtocol;
  label: string;
  description: string;
}[];

export function isSelfSelectableSupport(protocol: HealthProtocol): boolean {
  return NUTRITION_SUPPORT_OPTIONS.some((option) => option.protocol === protocol);
}