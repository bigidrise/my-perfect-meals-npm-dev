import React from "react";
import { useOrg } from "@/contexts/OrgContext";

type OrgLogoProps = {
  className?: string;
  style?: React.CSSProperties;
};

export function OrgLogo({ className, style }: OrgLogoProps) {
  const { org } = useOrg();

  if (org.featureFlags.customBranding && org.logoUrl) {
    return (
      <img
        src={org.logoUrl}
        alt={org.appName}
        className={className}
        style={style}
      />
    );
  }

  return (
    <img
      src="/icons/MPMFlameChefLogo.png"
      alt="My Perfect Meals"
      className={className}
      style={style}
    />
  );
}
