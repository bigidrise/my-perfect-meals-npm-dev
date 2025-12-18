
import React from "react";
import { getBadgeIcon, getBadgeType } from "./BadgeRegistry";

interface BadgeIconProps {
  type: string;
  size?: number;
  variant?: "default" | "critical" | "positive" | "info" | "warning";
  className?: string;
}

const VARIANT_COLORS = {
  default: "text-white/70",
  critical: "text-red-400",
  positive: "text-emerald-400",
  info: "text-blue-400",
  warning: "text-amber-400"
};

export default function BadgeIcon({ 
  type, 
  size = 16,
  variant,
  className = "" 
}: BadgeIconProps) {
  const IconComponent = getBadgeIcon(type);
  
  // Auto-determine variant from registry if not specified
  const autoVariant = variant || (getBadgeType(type) === "critical" ? "critical" : "default");
  const colorClass = VARIANT_COLORS[autoVariant];

  return (
    <div className={`flex-shrink-0 ${className}`}>
      <IconComponent className={`${colorClass}`} size={size} strokeWidth={2} />
    </div>
  );
}
