import { useEffect, useState } from "react";
import { BriefcaseBusiness } from "lucide-react";
import type { StudioAccessStatus } from "@shared/studioAccess";
import { GlassCard, GlassCardContent } from "@/components/glass/GlassCard";
import { getAuthHeaders } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";
import { formatPaidThrough } from "./OrganizationAccessCard";
import { ConfirmationModal } from "@/components/ui/universal-modal";
import { Button } from "@/components/ui/button";

function statusCopy(access: StudioAccessStatus): { label: string; description: string } {
  switch (access.state) {
    case "inactive":
      if (access.billing?.state === "expired") {
        return { label: "Inactive", description: "Your Studio subscription has expired. Your personal My Perfect Meals account and Studio history remain intact." };
      }
      if (access.billing?.state === "needs_review") {
        return { label: "Needs review", description: "Your previous professional billing identity could not be verified. Please contact support." };
      }
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
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [busy, setBusy] = useState(false);

  async function loadAccess(): Promise<StudioAccessStatus> {
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
    return payload.studioAccess;
  }

  useEffect(() => {
    let cancelled = false;
    setAccess(null);
    setError(false);
    setActionError(null);
    setConfirmEnd(false);
    if (!userId) return () => { cancelled = true; };

    void (async () => {
      try {
        const fresh = await loadAccess();
        if (!cancelled) setAccess(fresh);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  async function changeRenewal(action: "end" | "keep") {
    if (busy || !userId || !access?.canManageRenewal) return;
    setBusy(true);
    setActionError(null);
    setConfirmEnd(false);
    try {
      const response = await fetch(apiUrl(`/api/business/workspace/studio-access/${action}`), {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "We couldn't confirm the Studio renewal change.");
      }
      // The server's verified status is authoritative; never optimistically
      // flip the button or show a paid-through date from local state.
      setAccess(await loadAccess());
      setError(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "We couldn't confirm the Studio renewal change.");
      try { setAccess(await loadAccess()); } catch { setError(true); }
    } finally {
      setBusy(false);
    }
  }

  const copy = access ? statusCopy(access) : null;
  const billing = access?.billing;
  const canEnd = access?.canManageRenewal === true && access.state === "active" &&
    billing?.state === "active" && !!billing.paidThrough;
  const canKeep = access?.canManageRenewal === true && access.state === "active" &&
    billing?.state === "ending" && !!billing.paidThrough;
  return (
    <>
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
        {canEnd && (
          <Button type="button" variant="outline" disabled={busy}
            onClick={() => setConfirmEnd(true)} data-testid="end-studio-access">
            End Studio Access
          </Button>
        )}
        {canKeep && (
          <Button type="button" variant="outline" disabled={busy}
            onClick={() => void changeRenewal("keep")} data-testid="keep-studio">
            {busy ? "Checking…" : "Keep Studio"}
          </Button>
        )}
        {actionError && <p role="alert" className="text-sm text-red-300">{actionError}</p>}
        {access?.ownsOrganization && access.state !== "inactive" && (
          <p className="text-xs text-white/60">You have organization responsibilities that require a separate review before leaving Studio.</p>
        )}
        <p className="text-xs text-white/55">Your personal My Perfect Meals account is separate from Studio.</p>
      </GlassCardContent>
    </GlassCard>
    <ConfirmationModal
      open={confirmEnd}
      onOpenChange={(open) => { if (!busy) setConfirmEnd(open); }}
      title="End Studio Access?"
      description="This stops Studio renewal, not your personal My Perfect Meals account."
      footer={
        <>
          <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmEnd(false)}>
            Keep Studio
          </Button>
          <Button type="button" disabled={busy} onClick={() => void changeRenewal("end")}
            data-testid="confirm-end-studio">
            {busy ? "Checking…" : "Confirm End Studio Access"}
          </Button>
        </>
      }
    >
      <ul className="list-disc space-y-2 pl-5 text-sm text-white/80">
        <li>Studio renewal will stop at the end of your current paid period.</li>
        <li>Studio remains available through {billing?.paidThrough ? formatPaidThrough(billing.paidThrough) : "the verified paid-through date"}.</li>
        <li>Your personal My Perfect Meals account stays active.</li>
        <li>Your Studio data and history are not deleted. You can choose Keep Studio before expiration.</li>
      </ul>
    </ConfirmationModal>
    </>
  );
}