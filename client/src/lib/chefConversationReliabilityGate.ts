/** Approved message reliability is not an experimental build feature. */
export function isChefConversationReliabilityEnabled(): boolean {
  return true;
}

export function isChefFeatureScreenContextEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_ASK_CHEF_FEATURE_INTELLIGENCE === "true";
}
