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
      "/admin-moderation",
      "/alcohol/lean-and-social"
    ];
    
    return !hideOnRoutes.some(route => location.startsWith(route));
  }, [location]);

  // Check if user needs onboarding repair (authenticated but missing activeBoard)
  const needsOnboardingRepair = useMemo(() => {
    if (!user || loading) return false;
    if (user.role === "admin") return false;
    const hasActiveBoard = user.activeBoard || user.selectedMealBuilder;
    return !hasActiveBoard;
  }, [user, loading]);

  useEffect(() => {
    const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
    const hasChosenCoachMode = localStorage.getItem("coachMode") !== null;

    // Onboarding routes should never trigger redirects
    if (location.startsWith("/onboarding")) {
      return;
    }

    // Handle root path "/"
    if (location === "/") {
      if (!isAuthenticated) {
        // Not signed in → redirect to Welcome page (sign in/create account)
        setLocation("/welcome");
        return;
      }

      if (!hasChosenCoachMode) {
        // Authenticated but hasn't chosen coach mode → show WelcomeGate
        setShowWelcomeGate(true);
        return;
      }

      // Repair redirect: if user needs onboarding, redirect there
      if (needsOnboardingRepair) {
        setLocation("/onboarding/extended?repair=1");
        return;
      }

      // Authenticated and has chosen coach mode → go to dashboard
      setLocation("/dashboard");
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
      }, 100);
      return;
    }

    // Protect all routes except public pages
    const publicRoutes = ["/welcome", "/auth", "/forgot-password", "/reset-password", "/guest-builder", "/guest-suite", "/guest"];
    const isPublicRoute = publicRoutes.some(route => location === route || location.startsWith(route + "/"));
    
    // Allow guest mode to access guest-allowed routes
    const guestModeActive = isGuestMode();
    const guestCanAccess = guestModeActive && isGuestAllowedRoute(location);
    
    if (!isAuthenticated && !isPublicRoute && !guestCanAccess) {
      setLocation("/welcome");
    }
  }, [location, setLocation, needsOnboardingRepair]);

  // Show WelcomeGate modal
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

  // Show normal app
  return <>{children}</>;
}