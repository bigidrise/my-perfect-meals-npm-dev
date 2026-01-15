import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import WelcomeGate from "./WelcomeGate";
import { Route } from "wouter";

interface AppRouterProps {
  children: React.ReactNode;
}

export default function AppRouter({ children }: AppRouterProps) {
  const [location, setLocation] = useLocation();
  const [showWelcomeGate, setShowWelcomeGate] = useState(false);

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

  useEffect(() => {
    const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";
    const hasChosenCoachMode = localStorage.getItem("coachMode") !== null;

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

      // Authenticated and has chosen coach mode → go to dashboard
      setLocation("/dashboard");
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
      }, 100);
      return;
    }

    // Protect all routes except public pages
    const publicRoutes = ["/welcome", "/auth", "/forgot-password", "/reset-password"];
    if (!isAuthenticated && !publicRoutes.includes(location)) {
      setLocation("/welcome");
    }
  }, [location, setLocation]);

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