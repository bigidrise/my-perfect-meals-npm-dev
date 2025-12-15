
import React from "react";
import { CheckCircle, AlertTriangle, Info, Shield, Sparkles } from "lucide-react";
import BadgeDot from "./BadgeDot";

export type BadgeVariant = "safe" | "warning" | "alert" | "info" | "neutral" | "medical" | "premium";

export interface Badge {
  id?: string;
  label: string;
  description?: string;
  variant?: BadgeVariant;
  icon?: "check" | "warning" | "info" | "shield" | "sparkles" | "none";
}

interface BadgeSystemProps {
  badges: Badge[];
  className?: string;
  layout?: "row" | "grid" | "stack";
  showIcons?: boolean;
  showDots?: boolean;
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  safe: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/20 dark:text-green-300",
  warning: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/20 dark:text-yellow-300",
  alert: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/20 dark:text-red-300 animate-pulse",
  info: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/20 dark:text-blue-300",
  neutral: "bg-white/10 text-white/80 border-white/20",
  medical: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/20 dark:text-amber-300",
  premium: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/20 dark:text-purple-300"
};

const ICONS = {
  check: <CheckCircle className="w-3 h-3" />,
  warning: <AlertTriangle className="w-3 h-3" />,
  info: <Info className="w-3 h-3" />,
  shield: <Shield className="w-3 h-3" />,
  sparkles: <Sparkles className="w-3 h-3" />,
  none: null
};

export default function BadgeSystem({ 
  badges, 
  className = "",
  layout = "row",
  showIcons = true,
  showDots = false
}: BadgeSystemProps) {
  if (!badges || badges.length === 0) return null;

  const layoutClass = {
    row: "flex flex-wrap gap-2",
    grid: "grid grid-cols-2 gap-2",
    stack: "flex flex-col gap-2"
  }[layout];

  return (
    <div className={`${layoutClass} ${className}`}>
      {badges.map((badge, index) => {
        const variant = badge.variant || "neutral";
        const styles = VARIANT_STYLES[variant];
        const icon = badge.icon !== "none" && showIcons 
          ? ICONS[badge.icon || "info"]
          : null;

        return (
          <div
            key={badge.id || index}
            className="group relative"
          >
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full border transition-all cursor-help ${styles}`}
              title={badge.description || badge.label}
            >
              {showDots && <BadgeDot variant={variant} />}
              {icon}
              {badge.label}
            </span>

            {/* Tooltip on hover */}
            {badge.description && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                <div className="relative">
                  {badge.description}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
