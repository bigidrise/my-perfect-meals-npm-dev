import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, ReactNode } from "react";

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  variant?: "glass" | "plain";
}

export function GlassButton({ icon, variant = "glass", className, children, ...props }: GlassButtonProps) {
  const baseStyles = "inline-flex items-center gap-2 rounded-xl px-4 py-2 font-semibold transition-all duration-300 touch-manipulation select-none";
  const variantStyles = variant === "glass"
    ? "bg-black/20 backdrop-blur-md border border-white/20 text-white shadow-lg hover:bg-black/30 active:bg-black/40 active:scale-[0.98]"
    : "bg-transparent backdrop-blur-none border border-transparent text-white shadow-none hover:bg-white/10 active:bg-white/20 active:scale-[0.98]";

  return (
    <button
      {...props}
      className={cn(baseStyles, variantStyles, className)}
    >
      {icon}
      {children}
    </button>
  );
}