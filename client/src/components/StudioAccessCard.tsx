import { useEffect, useState } from "react";
import { BriefcaseBusiness } from "lucide-react";
import type { StudioAccessStatus } from "@shared/studioAccess";
import { GlassCard, GlassCardContent } from "@/components/glass/GlassCard";
import { getAuthHeaders } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";
import { formatPaidThrough } from "./OrganizationAccessCard";

function statusCopy(access: StudioAccessStatus): { label: string; description: string } {
  switch (access.state) {
    case "inactive":
      return { label: "Not active", description: "You don't currently have Studio professional access." };
    case "setup_available":
      return { label: "Ready to set up", description: "Your professional access is available, but Studio hasn't been set up yet." };
    case "managed_access":
      return {
        label: "Managed access",
        description: access.studioReady
          ? "Your Studio access is managed by My Perfect Meals."
          : "Your access is managed by My Perfect Meals. Complete any required professional setup before opening Studio.",
      };
    case "needs_review":
      return { label: "Needs review", description: "We can't verify your Studio access right now. Please contact support before making changes." };
    case "active":
      if (access.billing?.state === "ending" && access.billing.paidThrough) {
        const ending = `Your personal professional plan is ending ${formatPaidThrough(access.billing.paidThrough)}.`;
        return access.sources.length === 1
          ? { label: `Ending ${formatPaidThrough(access.billing.paidThrough)}`,
              description: access.studioReady
                ? `${ending} Studio access remains available through that date.`
                : `${ending} Professional setup is still required before opening Studio.` }
          : { label: "Active", description: `${ending} Other access sources may continue afterward.` };
      }
      if (access.billing?.state === "expired") {
        return access.sources.length === 1
          ? { label: "Needs review", description: "Your personal professional subscription has ended, but Studio still appears active. Please contact support." }
          : { label: "Active", description: "Your personal professional subscription has ended. Other access sources may still apply." };
      }
      if (!access.studioReady) {
        return { label: "Active", description: access.billing?.state === "needs_review"
          ? "Complete any required training before opening Studio. Billing details could not be verified."
          : "Your professional access is active. Complete any required training before opening Studio." };
      }
      if (access.sources.length > 1) {
        return { label: "Active", description: access.billing?.state === "needs_review"
          ? "Your Studio has more than one access source; personal billing details could not be verified."
          : "Your Studio access has more than one source." };
      }
      if (access.sources.includes("sponsored")) {
        return { label: "Active", description: "Your Studio professional access is provided by an organization." };
      }
      if (access.sources.includes("pilot")) {
        return { label: "Active", description: "You have temporary Studio professional access." };
      }
      if (access.billing?.state === "needs_review") {
        return { label: "Active", description: "Your professional access is active, but a billing end date has not been verified. No renewal change has been made." };
      }
      return { label: "Active", description: "Your Studio professional access is provided through your personal plan." };
  }
}

export function StudioAccessCard({ userId }: { userId: string | undefined }) {
  const [access, setAccess] = useState<StudioAccessStatus | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAccess(null);
    setError(false);
    if (!userId) return () => { cancelled = true; };

    void (async () => {
      try {
        const response = await fetch(apiUrl("/api/business/workspace/studio-access"), {
          credentials: "include",
          cache: "no-store",
          headers: getAuthHeaders(),
        });
        if (!response.ok) throw new Error("Studio access unavailable");
        const payload = await response.json();
        if (!payload.studioAccess || !Array.isArray(payload.studioAccess.sources) ||
            !["inactive", "setup_available", "active", "managed_access", "needs_review"].includes(payload.studioAccess.state)) {
          throw new Error("Invalid Studio access response");
        }
        if (!cancelled) setAccess(payload.studioAccess);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const copy = access ? statusCopy(access) : null;
  return (
    <GlassCard className="border border-orange-400/30" data-testid="studio-access-card">
      <GlassCardContent className="space-y-2 p-5">
        <div className="flex items-center gap-2">
          <BriefcaseBusiness className="h-5 w-5 text-orange-400" aria-hidden="true" />
          <h2 className="text-lg font-bold text-white">Studio Access</h2>
        </div>
        <p className="text-sm font-semibold text-orange-200" role="status">
          {error ? "Unable to check access" : copy?.label ?? "Checking access…"}
        </p>
        <p className="text-sm text-white/70">
          {error
            ? "We couldn't check Studio access right now. Please try again later."
            : copy?.description ?? "Checking your professional access."}
        </p>
        {access?.ownsOrganization && access.state !== "inactive" && (
          <p className="text-xs text-white/60">You have organization responsibilities that require a separate review before leaving Studio.</p>
        )}
        <p className="text-xs text-white/55">Your personal My Perfect Meals account is separate from Studio.</p>
      </GlassCardContent>
    </GlassCard>
  );
}