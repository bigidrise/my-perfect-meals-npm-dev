import { forwardRef, ButtonHTMLAttributes, useCallback, useRef, CSSProperties } from "react";
import { cn } from "@/lib/utils";

const BASE_STYLES = "!min-h-0 !min-w-0 inline-flex items-center justify-center px-4 py-[2px] min-w-[44px] rounded-full text-[9px] font-semibold uppercase tracking-wide transition-transform duration-100 ease-out whitespace-nowrap select-none touch-manipulation active:scale-95";

const INACTIVE_STYLES = "bg-yellow-500/20 text-white/90 active:bg-yellow-500/50 border border-yellow-400/70 active:border-yellow-400/90 shadow-[0_0_6px_rgba(234,179,8,0.25)] active:shadow-[0_0_12px_rgba(234,179,8,0.5)] animate-pill-pulse";

const ACTIVE_STYLES = "bg-emerald-600/80 text-white active:bg-emerald-500/80 border border-emerald-400/60 active:border-emerald-300/80 animate-pulse-glow-green";

const ACTIVE_AMBER_STYLES = "bg-amber-600/80 text-white active:bg-amber-500/80 border border-amber-400/60 active:border-amber-300/80 animate-pulse-glow-amber";

export const PILL_BUTTON_STYLES = `${BASE_STYLES} ${INACTIVE_STYLES}`;

export type PillButtonVariant = "emerald" | "amber";
export type PillButtonGlow = "yellow" | "emerald" | "sky" | "amber" | "rose" | "violet";

const GLOW_VARS: Record<PillButtonGlow, {
  borderLow: string;
  borderHigh: string;
  glowSoft: string;
  glowStrong: string;
}> = {
  yellow: {
    borderLow: "rgba(250, 204, 21, 0.4)",
    borderHigh: "rgba(250, 204, 21, 0.9)",
    glowSoft: "rgba(234, 179, 8, 0.2)",
    glowStrong: "rgba(234, 179, 8, 0.5)",
  },
  emerald: {
    borderLow: "rgba(52, 211, 153, 0.5)",
    borderHigh: "rgba(110, 231, 183, 0.9)",
    glowSoft: "rgba(52, 211, 153, 0.15)",
    glowStrong: "rgba(52, 211, 153, 0.4)",
  },
  sky: {
    borderLow: "rgba(56, 189, 248, 0.5)",
    borderHigh: "rgba(125, 211, 252, 0.9)",
    glowSoft: "rgba(14, 165, 233, 0.15)",
    glowStrong: "rgba(14, 165, 233, 0.4)",
  },
  amber: {
    borderLow: "rgba(245, 158, 11, 0.5)",
    borderHigh: "rgba(251, 191, 36, 0.9)",
    glowSoft: "rgba(245, 158, 11, 0.15)",
    glowStrong: "rgba(245, 158, 11, 0.4)",
  },
  rose: {
    borderLow: "rgba(251, 113, 133, 0.5)",
    borderHigh: "rgba(253, 164, 175, 0.9)",
    glowSoft: "rgba(244, 63, 94, 0.15)",
    glowStrong: "rgba(244, 63, 94, 0.4)",
  },
  violet: {
    borderLow: "rgba(167, 139, 250, 0.5)",
    borderHigh: "rgba(196, 181, 253, 0.9)",
    glowSoft: "rgba(139, 92, 246, 0.15)",
    glowStrong: "rgba(139, 92, 246, 0.4)",
  },
};

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  active?: boolean;
  variant?: PillButtonVariant;
  debounceMs?: number;
  glow?: PillButtonGlow;
}

export const PillButton = forwardRef<HTMLButtonElement, PillButtonProps>(
  ({ children, className, active = false, variant = "emerald", debounceMs = 300, onClick, glow, style, ...props }, ref) => {
    const lastClickRef = useRef<number>(0);

    const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
      const now = Date.now();
      if (now - lastClickRef.current < debounceMs) {
        e.preventDefault();
        return;
      }
      lastClickRef.current = now;
      onClick?.(e);
    }, [onClick, debounceMs]);

    const getActiveStyles = () => {
      if (!active) return INACTIVE_STYLES;
      return variant === "amber" ? ACTIVE_AMBER_STYLES : ACTIVE_STYLES;
    };

    const glowStyle: CSSProperties = glow && glow !== "yellow"
      ? {
          "--pill-border-low": GLOW_VARS[glow].borderLow,
          "--pill-border-high": GLOW_VARS[glow].borderHigh,
          "--pill-glow-soft": GLOW_VARS[glow].glowSoft,
          "--pill-glow-strong": GLOW_VARS[glow].glowStrong,
        } as CSSProperties
      : {};

    return (
      <button
        ref={ref}
        className={cn(BASE_STYLES, getActiveStyles(), className)}
        onClick={handleClick}
        style={{ ...glowStyle, ...style }}
        {...props}
      >
        {children}
      </button>
    );
  }
);

PillButton.displayName = "PillButton";

export default PillButton;
