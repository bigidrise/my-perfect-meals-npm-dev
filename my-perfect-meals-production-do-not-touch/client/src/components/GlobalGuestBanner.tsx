// client/src/components/GlobalGuestBanner.tsx
// Apple App Review Compliant: Global banner for guest mode messaging

import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { GuestModeBanner } from "@/components/GuestModeBanner";
import { isGuestMode } from "@/lib/guestMode";

// Pages where the banner should NOT show (already has its own UI)
const EXCLUDED_ROUTES = [
  "/welcome",
  "/auth",
  "/guest-builder",
  "/forgot-password",
  "/reset-password",
  "/onboarding",
  "/pricing",
];

export function GlobalGuestBanner() {
  const [location] = useLocation();
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    setIsGuest(isGuestMode());
  }, [location]);

  // Don't show on excluded routes
  if (EXCLUDED_ROUTES.some(route => location.startsWith(route))) {
    return null;
  }

  // Don't show if not in guest mode
  if (!isGuest) {
    return null;
  }

  return (
    <div 
      className="fixed left-4 right-4 z-40"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 4rem)" }}
    >
      <GuestModeBanner variant="minimal" showCreateAccount={true} />
    </div>
  );
}

export default GlobalGuestBanner;
