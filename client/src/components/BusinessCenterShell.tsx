import React from "react";

export const BC_GRADIENT = "from-black/80 via-orange-900/60 to-black/80";

export const BC_CARD = "bg-white border border-gray-200 shadow-sm rounded-2xl";
export const BC_CARD_ACCENT = "bg-white border border-orange-200 shadow-sm rounded-2xl";
export const BC_CARD_HIGHLIGHT = "bg-white border border-orange-300 shadow-sm rounded-2xl";

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
