import * as React from "react";
import { cn } from "@/lib/utils";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  fixed?: boolean;
};

export function GlassHeader({ fixed = true, className, children, ...rest }: Props) {
  return (
    <div
      {...rest}
      className={cn(
        fixed && "fixed inset-x-0 top-0 z-50",
        "h-16 sm:h-20 mt-14",
        "bg-black/40 backdrop-blur-md border-b border-white/10",
        "flex items-center",
        className
      )}
      style={
        {
          // expose height as a CSS var for page padding
          ["--app-header-h" as any]: "80px",
        } as React.CSSProperties
      }
    >
      <div className="container mx-auto px-4 w-full mt-12">{children}</div>
    </div>
  );
}