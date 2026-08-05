/**
 * ProActionLock
 * ─────────────
 * Wraps any operational Business Center section or button group.
 * Free users see the children dimmed with a "Pro Required" overlay.
 * Pro users (premium, ultimate, or internal PAID_FULL) pass through unmodified.
 *
 * On click the overlay sends the user to /pricing with their current path
 * stored in sessionStorage so CheckoutSuccess can return them here after payment.
 */
import { Lock } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { isProOrAbove } from "@/lib/subscriptionCheck";
import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
  /** Short phrase describing what the feature does, e.g. "access your referral tools". */
  feature?: string;
  className?: string;
}

export function ProActionLock({ children, feature, className }: Props) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const hasAccess = isProOrAbove(user);

  if (hasAccess) return <>{children}</>;

  const handleUpgrade = () => {
    sessionStorage.setItem("mpm_business_return", window.location.pathname);
    setLocation("/pricing?plan=mpm_premium_monthly");
  };

  return (
    <div className={cn("relative", className)}>
      {/* Dimmed, non-interactive preview of the content */}
      <div
        className="opacity-20 pointer-events-none select-none"
        aria-hidden="true"
      >
        {children}
      </div>

      {/* Lock overlay */}
      <button
        onClick={handleUpgrade}
        className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 bg-black/60 rounded-2xl w-full text-left"
        aria-label="Upgrade to Pro to unlock this feature"
      >
        <div className="h-12 w-12 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
          <Lock className="h-5 w-5 text-orange-400" />
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-white">Pro Required</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-[220px] mx-auto">
            Upgrade to Pro to{" "}
            {feature ?? "activate and manage this business feature"}.
          </p>
        </div>
        <span className="flex items-center gap-2 px-5 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold">
          Upgrade to Pro →
        </span>
      </button>
    </div>
  );
}
