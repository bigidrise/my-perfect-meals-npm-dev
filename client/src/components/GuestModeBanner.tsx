// client/src/components/GuestModeBanner.tsx
// Apple App Review Compliant: Clear messaging that progress won't be saved

import { useLocation } from "wouter";
import { AlertCircle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isGuestMode, getGuestGenerationsRemaining, endGuestSession } from "@/lib/guestMode";

interface GuestModeBannerProps {
  variant?: "minimal" | "full";
  showCreateAccount?: boolean;
}

export function GuestModeBanner({ variant = "minimal", showCreateAccount = true }: GuestModeBannerProps) {
  const [, setLocation] = useLocation();

  if (!isGuestMode()) {
    return null;
  }

  const remaining = getGuestGenerationsRemaining();

  const handleCreateAccount = () => {
    endGuestSession();
    setLocation("/auth");
  };

  if (variant === "minimal") {
    return (
      <div className="bg-amber-900/30 border border-amber-500/30 rounded-xl px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <span className="text-amber-200 text-sm">
            Guest Mode — progress not saved
          </span>
        </div>
        {showCreateAccount && (
          <Button
            onClick={handleCreateAccount}
            size="sm"
            className="bg-amber-600/50 hover:bg-amber-600 text-white text-xs px-3 py-1 h-7"
          >
            <UserPlus className="h-3 w-3 mr-1" />
            Sign Up
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-amber-900/40 to-orange-900/40 border border-amber-500/30 rounded-2xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-amber-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-amber-200 font-semibold text-sm">Guest Mode (Preview)</h3>
          <p className="text-amber-100/70 text-xs mt-1">
            You can build one full day of meals to see how the app works. 
            {remaining > 0 && (
              <span className="text-amber-300 font-medium"> {remaining} meal{remaining !== 1 ? 's' : ''} remaining.</span>
            )}
          </p>
        </div>
      </div>

      {showCreateAccount && (
        <Button
          onClick={handleCreateAccount}
          className="w-full bg-gradient-to-r from-lime-600 to-emerald-600 hover:from-lime-500 hover:to-emerald-500 text-white"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Create Account to Save & Continue
        </Button>
      )}
    </div>
  );
}

export default GuestModeBanner;
