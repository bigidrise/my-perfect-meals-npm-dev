/** Read-only, account-bound knowledge projection. It grants no feature access. */
export interface ChefKnowledgeAccess {
  organizationAdmin: boolean;
  professional: boolean;
}

export async function loadChefKnowledgeAccess(
  userId: string, professionalRole?: string | null, sessionMfaVerified?: boolean,
): Promise<ChefKnowledgeAccess> {
  const [organizationAdmin, professional] = await Promise.all([
    (async () => {
      try {
        const { discoverAuthorizedWorkspaces } = await import("../organizationWorkspaceService");
        const workspaces = await discoverAuthorizedWorkspaces(userId);
        return workspaces.some(workspace =>
          ["owner", "admin"].includes(workspace.role) && workspace.locations.length > 0);
      } catch {
        // No inferred membership and no workspace selection/persistence.
        return false;
      }
    })(),
    (async () => {
      if (!professionalRole) return false;
      try {
        const { getProfessionalIdentityReadiness } = await import("../professionalIdentityReadiness");
        const readiness = await getProfessionalIdentityReadiness(userId, sessionMfaVerified);
        return readiness.accountPrerequisitesReady;
      } catch {
        return false;
      }
    })(),
  ]);
  return { organizationAdmin, professional };
}
