export const AUTHENTICATED_BUSINESS_WORKSPACE_ROUTES = [
  "/business-dashboard",
  "/business/dashboard",
  "/business-organizations",
  "/org-success-center",
] as const;

export function isInAuthenticatedBusinessWorkspace(path: string): boolean {
  return (
    AUTHENTICATED_BUSINESS_WORKSPACE_ROUTES.some((route) => path === route) ||
    path.startsWith("/business-center")
  );
}