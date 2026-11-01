/** Separate from the page so rendered-interface tests can supply either mode. */
export function isChefConversationEnabled(): boolean {
  return import.meta.env.DEV;
}
