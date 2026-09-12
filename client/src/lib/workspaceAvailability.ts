import type { User } from "@/lib/auth";

export type SignInWorkspaceDecision = "personal" | "chooser";

export function hasStudioWorkspaceAccess(
  user: Pick<User, "isProCare" | "professionalRole"> | null | undefined,
): boolean {
  return Boolean(
    user?.isProCare &&
    (
      user.professionalRole === "trainer" ||
      user.professionalRole === "physician" ||
      user.professionalRole === "business"
    ),
  );
}

export function decideSignInWorkspace(
  user: Pick<User, "isProCare" | "professionalRole"> | null | undefined,
  organizationAvailable: boolean,
): SignInWorkspaceDecision {
  return organizationAvailable || hasStudioWorkspaceAccess(user)
    ? "chooser"
    : "personal";
}