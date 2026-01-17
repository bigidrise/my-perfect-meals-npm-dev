import { forwardRef, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const PILL_BUTTON_STYLES = "!min-h-0 !min-w-0 inline-flex items-center justify-center px-4 py-[2px] min-w-[44px] rounded-full text-[9px] font-semibold uppercase tracking-wide transition-all duration-150 ease-out whitespace-nowrap bg-black/40 text-white/80 hover:bg-black/50 border border-white/20";

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

export const PillButton = forwardRef<HTMLButtonElement, PillButtonProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(PILL_BUTTON_STYLES, className)}
        {...props}
      >
        {children}
      </button>
    );
  }
);

PillButton.displayName = "PillButton";

export default PillButton;
