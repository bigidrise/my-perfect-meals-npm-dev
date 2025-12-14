import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { hasFeature, Entitlement } from "@/lib/entitlements";
import { isOnTrial } from "@/lib/auth";

interface PageGuardProps {
  feature: Entitlement;
  children: React.ReactNode;
}

export function PageGuard({ feature, children }: PageGuardProps) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;
    
    if (!user) {
      setLocation("/welcome");
      return;
    }

    // During trial, user has full access to all features
    if (isOnTrial(user)) {
      return;
    }

    // After trial, check entitlements
    if (!hasFeature(user, feature)) {
      setLocation("/paywall");
    }
  }, [user, loading, feature, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  // During trial, allow access
  if (user && isOnTrial(user)) {
    return <>{children}</>;
  }

  if (!user || !hasFeature(user, feature)) {
    return null;
  }

  return <>{children}</>;
}
