import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import WelcomeGate from "./WelcomeGate";
import { Route } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { isGuestMode, isGuestAllowedRoute } from "@/lib/guestMode";

interface AppRouterProps {
  children: React.ReactNode;
}

export default function AppRouter({ children }: AppRouterProps) {
  const [location, setLocation] = useLocation();
  const [showWelcomeGate, setShowWelcomeGate] = useState(false);
  const { user, loading } = useAuth();

  const shouldShowBottomNav = useMemo(() => {
    const hideOnRoutes = [
      "/auth",
      "/welcome",
      "/onboarding",
      "/forgot-password",
      "/reset-password",
      "/checkout-success",
      "/pricing",
      "/paywall",
      "/affiliates",
      "/founders",
      "/privacy",
      "/admin-moderation"
    ];
    
    return !hideOnRoutes.some(route => location.startsWith(route));
  }, [location]);

  // Check for Apple Review Full Access mode - bypasses ALL onboarding/gates
  const isAppleReviewMode = useMemo(() => {
    return localStorage.getItem("appleReviewFullAccess") === "true";
  }, []);

  // Determine if user needs onboarding - returns null while loading (unknown state)
  // CRITICAL: onboardingCompletedAt is THE sole gate. activeBoard/selectedMealBuilder
  // may be pre-assigned by coaches before the user creates their account.
  const needsOnboarding = useMemo(() => {
    if (isAppleReviewMode) return false;
    if (loading) return null;
    if (!user) return false;
    if (user.role === "admin") return false;
    if (user.id.startsWith("guest-")) return false;
    if (user.professionalRole === "trainer" || user.professionalRole === "physician") return false;
    if (user.studioMembership) return false;
    return !user.onboardingCompletedAt;
  }, [user, loading, isAppleReviewMode]);

  useEffect(() => {
    const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
    const hasChosenCoachMode = localStorage.getItem("coachMode") !== null;

    if (location.startsWith("/onboarding")) {
      return;
    }

    const publicRoutes = ["/welcome", "/auth", "/forgot-password", "/reset-password", "/guest-builder", "/guest-suite", "/guest", "/pricing", "/privacy", "/affiliates", "/founders", "/procare-welcome", "/procare-identity", "/procare-attestation", "/consumer-welcome", "/more"];
    const isPublicRoute = publicRoutes.some(route => location === route || location.startsWith(route + "/"));

    // Don't make routing decisions while auth is loading - wait for user state
    if (loading && isAuthenticated && !isPublicRoute) {
      return; // Wait for auth to finish loading before routing
    }

    if (isAuthenticated && needsOnboarding === true && !isPublicRoute) {
      console.log("🚨 [AppRouter] User needs onboarding - forcing redirect to /onboarding");
      setLocation("/onboarding");
      return;
    }

    // Only show WelcomeGate when we KNOW user doesn't need onboarding (not loading)
    if (isAuthenticated && !hasChosenCoachMode && !isPublicRoute && needsOnboarding === false) {
      setShowWelcomeGate(true);
      return;
    }

    if (location === "/") {
      if (!isAuthenticated) {
        setLocation("/welcome");
        return;
      }

      // Wait for auth to finish loading before deciding where to route
      if (needsOnboarding === null) {
        return; // Still loading - don't route yet
      }

      if (needsOnboarding === true) {
        setLocation("/onboarding");
        return;
      }

      setLocation("/dashboard");
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
      }, 100);
      return;
    }
    
    const guestModeActive = isGuestMode();
    const guestCanAccess = guestModeActive && isGuestAllowedRoute(location);
    
    if (!isAuthenticated && !isPublicRoute && !guestCanAccess) {
      if (guestModeActive && isGuestAllowedRoute(window.location.pathname)) {
        setLocation("/guest-builder");
      } else {
        setLocation("/welcome");
      }
    }
  }, [location, setLocation, needsOnboarding, loading]);

  if (showWelcomeGate) {
    return (
      <WelcomeGate
        onComplete={() => {
          setShowWelcomeGate(false);
          setLocation("/dashboard");
        }}
      />
    );
  }

  return <>{children}</>;
}
