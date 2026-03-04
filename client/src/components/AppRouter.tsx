import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import WelcomeGate from "./WelcomeGate";
import { Route } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { isGuestMode, isGuestAllowedRoute } from "@/lib/guestMode";
import { hasActivePaidSubscription } from "@/lib/subscriptionCheck";

interface AppRouterProps {
  children: React.ReactNode;
}

const PROFESSIONAL_ROUTE_PREFIXES = [
  "/care-team",
  "/pro-portal",
  "/pro/",
];

function isInProfessionalWorkspace(path: string): boolean {
  return PROFESSIONAL_ROUTE_PREFIXES.some(prefix => path.startsWith(prefix));
}

function hasMacroProfile(user: any): boolean {
  if (user?.age && user?.height && user?.weight) return true;
  try {
    const s = localStorage.getItem("macro_calculator_settings");
    if (!s) return false;
    const p = JSON.parse(s);
    return !!(p.age && (p.heightFt || p.heightCm) && (p.weightLbs || p.weightKg));
  } catch {
    return false;
  }
}

function isProfessional(user: any): boolean {
  return user?.professionalRole === "trainer" || user?.professionalRole === "physician";
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

  const isAppleReviewMode = useMemo(() => {
    return localStorage.getItem("appleReviewFullAccess") === "true";
  }, []);

  const needsOnboarding = useMemo(() => {
    if (isAppleReviewMode) return false;
    if (loading) return null;
    if (!user) return false;
    if (user.role === "admin") return false;
    if (user.id.startsWith("guest-")) return false;
    if (isProfessional(user)) return false;
    if (user.studioMembership) return false;
    if (!hasActivePaidSubscription(user)) return false;
    return !user.onboardingCompletedAt;
  }, [user, loading, isAppleReviewMode]);

  const isPaidUser = useMemo(() => {
    if (!user) return false;
    return hasActivePaidSubscription(user);
  }, [user]);

  function getPersonalDestination(): string {
    if (hasMacroProfile(user)) return "/dashboard";
    return "/macro-counter";
  }

  useEffect(() => {
    const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
    const welcomeGateDoneThisSession = sessionStorage.getItem("mpm.welcomeGateDone") === "true";
    const skipWelcomeGate = localStorage.getItem("mpm.skipWelcomeGate") === "true";

    if (location.startsWith("/onboarding") || location.startsWith("/macro-counter")) {
      return;
    }

    const publicRoutes = ["/welcome", "/auth", "/forgot-password", "/reset-password", "/guest-builder", "/guest-suite", "/guest", "/pricing", "/privacy", "/affiliates", "/founders", "/procare-welcome", "/procare-identity", "/procare-attestation", "/consumer-welcome", "/more"];
    const isPublicRoute = publicRoutes.some(route => location === route || location.startsWith(route + "/"));

    if (loading && isAuthenticated && !isPublicRoute) {
      return;
    }

    if (isAuthenticated && needsOnboarding === true && !isPublicRoute) {
      console.log("[AppRouter] Paid user needs onboarding — redirecting to /onboarding");
      setLocation("/onboarding");
      return;
    }

    const inProWorkspace = isInProfessionalWorkspace(location) || localStorage.getItem("mpm_active_space") === "workspace";
    if (
      isAuthenticated &&
      !isPublicRoute &&
      !inProWorkspace &&
      !isAppleReviewMode &&
      !welcomeGateDoneThisSession &&
      !skipWelcomeGate &&
      needsOnboarding === false &&
      !loading
    ) {
      setShowWelcomeGate(true);
      return;
    }

    if (location === "/") {
      if (!isAuthenticated) {
        setLocation("/welcome");
        return;
      }

      if (needsOnboarding === null) {
        return;
      }

      if (needsOnboarding === true) {
        setLocation("/onboarding");
        return;
      }

      const destination = getPersonalDestination();
      setLocation(destination);
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
  }, [location, setLocation, needsOnboarding, loading, isPaidUser, isAppleReviewMode]);

  if (showWelcomeGate) {
    return (
      <WelcomeGate
        onComplete={() => {
          setShowWelcomeGate(false);
          const destination = getPersonalDestination();
          setLocation(destination);
        }}
      />
    );
  }

  return <>{children}</>;
}
