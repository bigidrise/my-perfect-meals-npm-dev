/**
 * BusinessSuiteGate
 * ─────────────────
 * Wraps any Business Suite page. If the current user is on a Free or Essential
 * plan, the page content is NOT rendered — only the upgrade modal is shown.
 * Pro (premium) and Clinical (ultimate) users, plus internal accounts
 * (PAID_FULL with no planLookupKey), pass through immediately.
 */
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getTierForLookupKey } from "@shared/planFeatures";
import { TierUpgradeModal } from "@/components/modals/TierUpgradeModal";

interface Props {
  children: React.ReactNode;
}

export function BusinessSuiteGate({ children }: Props) {
  const { user, isLoading } = useAuth();
  const [determined, setDetermined] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    const tier = getTierForLookupKey(user?.planLookupKey);
    const isPro = tier === "premium" || tier === "ultimate";
    // Internal / founder accounts have PAID_FULL but no planLookupKey
    const isInternal = user?.accessTier === "PAID_FULL" && !user?.planLookupKey;

    setBlocked(!isPro && !isInternal);
    setDetermined(true);
  }, [user, isLoading]);

  // Don't flash page content while checking
  if (!determined) return null;

  if (blocked) {
    return (
      <TierUpgradeModal
        open={true}
        onClose={() => {}}
        requiredTier="pro"
        featureName="Business Suite"
      />
    );
  }

  return <>{children}</>;
}
