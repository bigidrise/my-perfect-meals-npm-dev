/** Display-only mapping of the compliance engine's fixed messages, never arbitrary authored advice. */
const OPPORTUNITIES = new Set([
  "Use My Perfect Meals to start tracking your nutrition.",
  "Start logging your meals to activate your Nutrition Activity Summary.",
  "Log dinner more consistently to complete your daily nutrition picture.",
  "Log lunch more consistently to complete your daily nutrition picture.",
  "Log breakfast to track your full day of nutrition.",
  "Focus on meeting your daily protein target more consistently.",
  "Use My Perfect Meals more consistently when making food decisions.",
  "Keep building on your consistent nutrition habits.",
]);

export function localizeComplianceOpportunity(message: string, translate: (key: string) => string): string {
  return OPPORTUNITIES.has(message) ? translate(message) : message;
}
