/**
 * BusinessSuiteGate
 * ─────────────────
 * Wraps any Business Suite page. Requires an active paid Pro (premium) or
 * Clinical (ultimate) subscription. Internal accounts (PAID_FULL, no
 * planLookupKey) and founders pass through immediately.
 *
 * When blocked, stores a return path in sessionStorage so that after
 * completing checkout the user lands directly back here.
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { isProOrAbove } from "@/lib/subscriptionCheck";
import { TierUpgradeModal } from "@/components/modals/TierUpgradeModal";

interface Props {
  children: React.ReactNode;
}

export function BusinessSuiteGate({ children }: Props) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [determined, setDetermined] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (loading) return;
    const hasAccess = isProOrAbove(user);
    setBlocked(!hasAccess);
    setDetermined(true);
  }, [user, loading]);

  // When blocked, store the current path so checkout returns here
  useEffect(() => {
    if (!determined || !blocked) return;
    const currentPath = window.location.pathname;
    sessionStorage.setItem("mpm_business_return", currentPath || "/business-center");
  }, [determined, blocked]);

  // Don't flash page content while checking
  if (!determined) return null;

  if (blocked) {
    return (
      <TierUpgradeModal
        open={true}
        onClose={() => setLocation("/pricing?plan=mpm_premium_monthly")}
        requiredTier="pro"
        featureName="Business Center"
      />
    );
  }

  return <>{children}</>;
}
