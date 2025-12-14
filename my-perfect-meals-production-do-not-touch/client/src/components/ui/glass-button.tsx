import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GlassButtonProps extends React.ComponentProps<typeof Button> {
  icon?: React.ReactNode;
}

export function GlassButton({ icon, children, className, ...props }: GlassButtonProps) {
  return (
    <Button
      {...props}
      className={cn(
        "bg-black/40 text-white border border-white/20 backdrop-blur-sm",
        "hover:bg-black/60 hover:text-white transition-colors",
        "rounded-xl shadow-md flex items-center gap-2",
        className
      )}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      {children}
    </Button>
  );
}