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

  const needsOnboarding = useMemo(() => {
    if (!user || loading) return false;
    if (user.role === "admin") return false;
    if (user.id.startsWith("guest-")) return false;
    if (user.onboardingCompletedAt) return false;
    const hasActiveBoard = user.activeBoard || user.selectedMealBuilder;
    return !hasActiveBoard;
  }, [user, loading]);

  useEffect(() => {
    const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
    const hasChosenCoachMode = localStorage.getItem("coachMode") !== null;

    if (location.startsWith("/onboarding")) {
      return;
    }

    const publicRoutes = ["/welcome", "/auth", "/forgot-password", "/reset-password", "/guest-builder", "/guest-suite", "/guest", "/pricing", "/privacy", "/affiliates", "/founders"];
    const isPublicRoute = publicRoutes.some(route => location === route || location.startsWith(route + "/"));

    if (isAuthenticated && needsOnboarding && !isPublicRoute) {
      console.log("🚨 [AppRouter] User needs onboarding - forcing redirect to /onboarding/extended");
      setLocation("/onboarding/extended");
      return;
    }

    if (isAuthenticated && !hasChosenCoachMode && !isPublicRoute && !needsOnboarding) {
      setShowWelcomeGate(true);
      return;
    }

    if (location === "/") {
      if (!isAuthenticated) {
        setLocation("/welcome");
        return;
      }

      if (needsOnboarding) {
        setLocation("/onboarding/extended");
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
  }, [location, setLocation, needsOnboarding]);

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
