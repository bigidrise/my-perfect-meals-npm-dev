import React from "react";
import { useOrg } from "@/contexts/OrgContext";
import type { OrgFeatureFlags } from "@/contexts/OrgContext";

type OrgFeatureGateProps = {
  flag: keyof OrgFeatureFlags;
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

export function OrgFeatureGate({ flag, children, fallback = null }: OrgFeatureGateProps) {
  const { hasFlag } = useOrg();
  return hasFlag(flag) ? <>{children}</> : <>{fallback}</>;
}
