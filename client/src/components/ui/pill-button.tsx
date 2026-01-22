import { forwardRef, ButtonHTMLAttributes, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

const BASE_STYLES = "!min-h-0 !min-w-0 inline-flex items-center justify-center px-4 py-[2px] min-w-[44px] rounded-full text-[9px] font-semibold uppercase tracking-wide transition-transform duration-100 ease-out whitespace-nowrap select-none touch-manipulation active:scale-95";

const INACTIVE_STYLES = "bg-yellow-500/20 text-white/90 hover:bg-yellow-500/30 active:bg-yellow-500/50 border border-yellow-400/40 active:border-yellow-400/70 active:shadow-[0_0_12px_rgba(234,179,8,0.4)]";

const ACTIVE_STYLES = "bg-emerald-600/80 text-white hover:bg-emerald-600/90 active:bg-emerald-500/80 border border-emerald-400/60 active:border-emerald-300/80 animate-pulse-glow-green";

export const PILL_BUTTON_STYLES = `${BASE_STYLES} ${INACTIVE_STYLES}`;

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  active?: boolean;
  debounceMs?: number;
}

export const PillButton = forwardRef<HTMLButtonElement, PillButtonProps>(
  ({ children, className, active = false, debounceMs = 300, onClick, ...props }, ref) => {
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

    return (
      <button
        ref={ref}
        className={cn(
          BASE_STYLES,
          active ? ACTIVE_STYLES : INACTIVE_STYLES,
          className
        )}
        onClick={handleClick}
        {...props}
      >
        {children}
      </button>
    );
  }
);

PillButton.displayName = "PillButton";

export default PillButton;
