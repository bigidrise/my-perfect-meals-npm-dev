import type { HealthProtocol } from "./healthProtocolState";

/**
 * Personal nutrition preferences, not diagnoses or clinician directives.
 * The DEV self-selectable list is deliberately narrower than the protocol
 * registry. Existing clinical conditions remain in the specialty controls;
 * the old anti-inflammatory preference remains separate until reconciliation.
 */
export const NUTRITION_SUPPORT_OPTIONS = [
  { protocol: "glp1", label: "GLP-1 Nutrition Support", description: "Apply GLP-1-oriented nutrition support to my food in Development. This does not record medication use or change your Builder." },
] as const satisfies readonly {
  protocol: HealthProtocol;
  label: string;
  description: string;
}[];

export function isSelfSelectableSupport(protocol: HealthProtocol): boolean {
  return protocol === "anti_inflammatory" || NUTRITION_SUPPORT_OPTIONS.some((option) => option.protocol === protocol);
}