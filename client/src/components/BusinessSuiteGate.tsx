/**
 * BusinessSuiteGate
 * ─────────────────
 * Ensures the user is authenticated before rendering any Business Center page.
 * Unauthenticated users are handled by AppRouter — this gate only guards
 * against the user object being absent after a race condition on mount.
 *
 * Browsing is open to all authenticated users (Free, Pro, or higher).
 * Individual operational actions inside Business Center pages use
 * <ProActionLock> to enforce paid Pro access at the action level.
 */
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  children: React.ReactNode;
}

export function BusinessSuiteGate({ children }: Props) {
  const { user, loading } = useAuth();

  // Wait for auth to resolve; AppRouter handles redirecting unauthenticated users
  if (loading) return null;
  if (!user) return null;

  return <>{children}</>;
}
