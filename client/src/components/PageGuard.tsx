import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { hasFeature, Entitlement } from "@/lib/entitlements";

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

  if (!user || !hasFeature(user, feature)) {
    return null;
  }

  return <>{children}</>;
}
