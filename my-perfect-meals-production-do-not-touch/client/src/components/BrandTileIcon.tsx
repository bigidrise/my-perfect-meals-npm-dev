
import { ReactNode } from "react";

/**
 * Wrap Lucide icons to enforce orange→black gradient appearance.
 * Icons render white on top of a gradient disk for visual consistency.
 */
export default function BrandTileIcon({ children }: { children: ReactNode }) {
  return (
    <div className="relative inline-flex items-center justify-center">
      {/* Gradient disk behind the icon */}
      <span className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-500 to-black opacity-100 scale-110" />
      {/* Icon foreground kept white for clarity */}
      <span className="relative text-white">
        {children}
      </span>
    </div>
  );
}
