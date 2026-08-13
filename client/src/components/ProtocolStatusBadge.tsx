/**
 * ProtocolStatusBadge
 *
 * Shows which nutrition overlays are currently active for the authenticated
 * user, driven entirely by the canonical server-resolved state — NOT by any
 * client-side check of selectedMealBuilder or local storage.
 *
 * This is the single source of truth for "is GLP-1 / Performance active
 * right now?" that Premier nurses and the internal QA team can glance at
 * from any food-generation surface.
 *
 * Zero renders when no protocol is active.
 */

import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

interface ActiveProtocolState {
  glp1Active: boolean;
  performanceActive: boolean;
  activationSources: string[];
}

interface ProtocolStatusBadgeProps {
  /** Additional Tailwind classes on the wrapper element */
  className?: string;
}

export default function ProtocolStatusBadge({ className = "" }: ProtocolStatusBadgeProps) {
  const { data } = useQuery<ActiveProtocolState>({
    queryKey: ["/api/nutrition/active-protocol"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/nutrition/active-protocol"), {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Protocol state unavailable");
      return res.json();
    },
    // Protocol state is stable within a session — refresh every 2 minutes
    staleTime: 120_000,
    retry: false,
  });

  if (!data?.glp1Active && !data?.performanceActive) return null;

  const both = data.glp1Active && data.performanceActive;
  const label = both
    ? "Performance + GLP-1 Support"
    : data.glp1Active
    ? "GLP-1 Support Active"
    : "Performance Active";

  // Orange for GLP-1 (matches the existing protocol badge palette in BuilderHeader)
  // Blue-green for Performance only
  const colorClass = data.glp1Active
    ? "bg-orange-500/15 border-orange-400/35 text-orange-300"
    : "bg-emerald-500/15 border-emerald-400/35 text-emerald-300";

  return (
    <div className={`flex justify-center ${className}`}>
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${colorClass}`}
        title={`Activation: ${data.activationSources.join(", ")}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse flex-shrink-0" />
        {label}
      </div>
    </div>
  );
}
