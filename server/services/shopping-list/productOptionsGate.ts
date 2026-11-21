/**
 * Released structured shopping product selections are available in all runtimes.
 * Legacy opt-in configuration must not disable the matching persistence API.
 * This does not enable unrelated Development shopping-list behavior.
 */
export function shoppingProductOptionsServerEnabled(): boolean {
  return true;
}
