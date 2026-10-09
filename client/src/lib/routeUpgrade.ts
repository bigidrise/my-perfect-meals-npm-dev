/**
 * Page-level paywalls render no protected content. Move to an accessible page
 * before opening their global modal so every dismissal leaves a usable page.
 * Action-level upgrade prompts deliberately do not use this helper.
 */
export function openRouteUpgrade(
  location: string,
  navigate: (path: string, options?: { replace?: boolean }) => void,
  showUpgrade: () => void,
): void {
  const destination = location.startsWith("/lifestyle/") ? "/lifestyle" : "/";
  navigate(destination, { replace: true });
  showUpgrade();
}
