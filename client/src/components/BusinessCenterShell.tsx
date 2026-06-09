import React from "react";

export const BC_GRADIENT = "from-black/80 via-orange-900/60 to-black/80";

export const BC_CARD = "bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl";
export const BC_CARD_ACCENT = "bg-black/50 backdrop-blur-md border border-orange-500/20 rounded-2xl";
export const BC_CARD_HIGHLIGHT = "bg-black/50 backdrop-blur-md border border-orange-500/30 rounded-2xl";

export const BC_HEADER = "fixed top-0 left-0 right-0 z-50 bg-black/55 backdrop-blur-md border-b border-white/10";

export function BusinessCenterShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} text-white ${className}`}
    >
      {children}
    </div>
  );
}
