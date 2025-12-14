import React from "react";
import { Settings } from "lucide-react";

interface HubControlIconProps {
  size?: "sm" | "md" | "lg";
}

export function HubControlIcon({ size = "md" }: HubControlIconProps) {
  const wrapperSize =
    size === "sm" ? "h-8 w-8" : size === "lg" ? "h-14 w-14" : "h-11 w-11";
  const iconSize =
    size === "sm" ? "h-4 w-4" : size === "lg" ? "h-7 w-7" : "h-5 w-5";

  return (
    <div
      className={[
        wrapperSize,
        "rounded-full",
        "bg-white/5",
        "border",
        "border-white/15",
        "backdrop-blur-lg",
        "flex",
        "items-center",
        "justify-center",
        "shadow-[0_0_20px_rgba(0,0,0,0.65)]",
      ].join(" ")}
    >
      <Settings className={`${iconSize} text-white/90`} strokeWidth={1.9} />
    </div>
  );
}
