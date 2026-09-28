import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import type { OrganizationAccessEntry, OrganizationAccessStatus } from "@shared/serviceBilling";
import { GlassCard, GlassCardContent } from "@/components/glass/GlassCard";
import { getAuthHeaders } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";

export function formatPaidThrough(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "an unverified date";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

function organizationCopy(entry: OrganizationAccessEntry): string {
  switch (entry.state) {
    case "active": return "Active paid Organization access";
    case "ending":
      return entry.paidThrough
        ? `Ending ${formatPaidThrough(entry.paidThrough)} · access remains available until then`
        : "Billing date needs review";
    case "expired": return "Paid Organization access has expired";
    case "managed_access":
      return entry.accessSource === "pilot"
        ? "Temporary Organization access"
        : "Organization-provided access";
    case "not_active": return "Not active";
    default: return "Billing details need review · no paid-through date verified";
  }
}

export function OrganizationAccessCard({ userId }: { userId: string | undefined }) {
  const [status, setStatus] = useState<OrganizationAccessStatus | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus(null);
    setError(false);
    if (!userId) return () => { cancelled = true; };
    void (async () => {
      try {
        const response = await fetch(apiUrl("/api/business/workspace/organization-access"), {
          credentials: "include",
          cache: "no-store",
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error("Organization access unavailable");
        const body = await response.json();
        if (!Array.isArray(body?.organizationAccess?.organizations)) {
          throw new Error("Invalid Organization access response");
        }
        if (!cancelled) setStatus(body.organizationAccess);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <GlassCard className="border border-blue-400/30" data-testid="organization-access-card">
      <GlassCardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-400" aria-hidden="true" />
          <h2 className="text-lg font-bold text-white">Organization Access</h2>
        </div>
        {error ? (
          <p className="text-sm text-white/70" role="status">Unable to check Organization access right now. Please try again later.</p>
        ) : !status ? (
          <p className="text-sm text-white/70" role="status">Checking Organization access…</p>
        ) : status.organizations.length === 0 ? (
          <p className="text-sm text-white/70" role="status">No Organization workspace is attached to this account.</p>
        ) : (
          <ul className="space-y-2">
            {status.organizations.map((organization, index) => (
              <li key={`${organization.name}-${index}`} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-sm font-semibold text-white">{organization.name}</p>
                <p className="text-xs text-white/70">{organizationCopy(organization)}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-white/55">Organization access is separate from your personal My Perfect Meals account.</p>
      </GlassCardContent>
    </GlassCard>
  );
}