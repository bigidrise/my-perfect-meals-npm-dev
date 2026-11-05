/** Build-time Development gates; Production retains its existing behavior. */
export function isChefConversationReliabilityEnabled(): boolean {
  return import.meta.env.DEV;
}

export function isChefFeatureScreenContextEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_ASK_CHEF_FEATURE_INTELLIGENCE === "true";
}
