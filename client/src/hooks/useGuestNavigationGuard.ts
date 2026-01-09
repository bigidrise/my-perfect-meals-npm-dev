import { useEffect } from "react";
import { useLocation } from "wouter";
import { isGuestMode } from "@/lib/guestMode";
import { getGuestNavigationOverride, type GuestSuitePage } from "@/lib/guestSuiteNavigator";

export function useGuestNavigationGuard(currentPage: GuestSuitePage) {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    if (!isGuestMode()) return;
    
    const handlePopState = () => {
      const override = getGuestNavigationOverride(currentPage);
      if (override) {
        window.history.pushState(null, "", window.location.pathname);
        setLocation(override);
      }
    };
    
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [currentPage, setLocation]);
}
