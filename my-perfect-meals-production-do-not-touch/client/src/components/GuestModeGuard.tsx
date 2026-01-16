// client/src/components/GuestModeGuard.tsx
// Apple App Review Compliant: Wraps pages with guest mode checks and banners

import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, UserPlus, ArrowLeft } from "lucide-react";
import { GuestModeBanner } from "@/components/GuestModeBanner";
import { 
  isGuestMode, 
  endGuestSession,
  requiresAccount,
  canGuestGenerate,
  getGuestGenerationsRemaining
} from "@/lib/guestMode";
import { useAuth } from "@/contexts/AuthContext";

interface GuestModeGuardProps {
  children: ReactNode;
  showBanner?: boolean;
  requireAuth?: boolean;
  bannerVariant?: "minimal" | "full";
}

export function GuestModeGuard({ 
  children, 
  showBanner = true,
  requireAuth = false,
  bannerVariant = "minimal"
}: GuestModeGuardProps) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    setIsGuest(isGuestMode());
  }, [location]);

  // If user is authenticated, just render children (no guest mode)
  if (user) {
    return <>{children}</>;
  }

  // If this route requires auth and user is guest, show account required screen
  if (requireAuth && isGuest) {
    return <AccountRequiredScreen />;
  }

  // If guest mode is active and current route requires account, redirect
  if (isGuest && requiresAccount(location)) {
    return <AccountRequiredScreen />;
  }

  // If guest mode is active, show banner + children
  if (isGuest && showBanner) {
    return (
      <div className="relative">
        <div className="fixed left-4 right-4 z-40" style={{ top: "calc(env(safe-area-inset-top, 0px) + 4.5rem)" }}>
          <GuestModeBanner variant={bannerVariant} />
        </div>
        <div style={{ paddingTop: bannerVariant === "full" ? "120px" : "60px" }}>
          {children}
        </div>
      </div>
    );
  }

  // Normal render
  return <>{children}</>;
}

function AccountRequiredScreen() {
  const [, setLocation] = useLocation();

  const handleCreateAccount = () => {
    endGuestSession();
    setLocation("/auth");
  };

  const handleGoBack = () => {
    setLocation("/guest-builder");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black text-white flex items-center justify-center p-6"
    >
      <Card className="max-w-md w-full bg-zinc-900/80 border border-white/10">
        <CardContent className="p-8 text-center space-y-6">
          <div className="w-16 h-16 mx-auto bg-orange-500/20 rounded-full flex items-center justify-center">
            <Lock className="w-8 h-8 text-orange-400" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white">Account Required</h2>
            <p className="text-white/70 text-sm">
              This feature requires an account to save your data and personalize your experience.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleCreateAccount}
              className="w-full bg-gradient-to-r from-lime-600 to-emerald-600 hover:from-lime-500 hover:to-emerald-500 text-white"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Create Free Account
            </Button>

            <Button
              onClick={handleGoBack}
              variant="ghost"
              className="w-full text-white/60 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Guest Builder
            </Button>
          </div>

          <p className="text-white/40 text-xs">
            Already have an account?{" "}
            <button 
              onClick={() => {
                endGuestSession();
                setLocation("/auth");
              }}
              className="text-lime-400 underline hover:text-lime-300"
            >
              Sign in
            </button>
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Hook to check if generation limit is reached
export function useGuestGenerationLimit() {
  const isGuest = isGuestMode();
  const canGenerate = canGuestGenerate();
  const remaining = getGuestGenerationsRemaining();

  return {
    isGuest,
    canGenerate: isGuest ? canGenerate : true,
    remaining: isGuest ? remaining : Infinity,
    isLimitReached: isGuest && !canGenerate,
  };
}

export default GuestModeGuard;
