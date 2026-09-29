import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import type { OrganizationAccessEntry, OrganizationAccessStatus } from "@shared/serviceBilling";
import { GlassCard, GlassCardContent } from "@/components/glass/GlassCard";
import { getAuthHeaders } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/universal-modal";

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
        ? "Temporary Organization access · no paid Organization renewal to cancel"
        : entry.accessSource === "arrangement"
          ? "Organization access is provided by an arrangement · no self-service renewal to cancel"
          : "Access is provided by the Organization · only its paying owner can end a verified subscription";
    case "not_active": return "Not active";
    default: return "Billing details need review · no renewal change is available until the paid-through date is verified";
  }
}

export function OrganizationAccessCard({ userId }: { userId: string | undefined }) {
  const [status, setStatus] = useState<OrganizationAccessStatus | null>(null);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyBusinessId, setBusyBusinessId] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState<OrganizationAccessEntry | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<OrganizationAccessEntry | null>(null);

  async function loadStatus(): Promise<OrganizationAccessStatus> {
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
    return body.organizationAccess;
  }

  useEffect(() => {
    let cancelled = false;
    setStatus(null);
    setError(false);
    if (!userId) return () => { cancelled = true; };
    void (async () => {
      try {
        const fresh = await loadStatus();
        if (!cancelled) setStatus(fresh);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  async function changeRenewal(entry: OrganizationAccessEntry, action: "end" | "keep") {
    if (busyBusinessId || !entry.businessId || !entry.canManageRenewal) return;
    setBusyBusinessId(entry.businessId);
    setActionError(null);
    setConfirmEnd(null);
    try {
      const response = await fetch(apiUrl(
        `/api/business/workspace/organization-access/${encodeURIComponent(entry.businessId)}/${action}`,
      ), {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "We couldn't confirm the Organization renewal change.");
      }
      setStatus(await loadStatus());
    } catch (err) {
      setActionError(err instanceof Error
        ? err.message : "We couldn't confirm the Organization renewal change.");
      try { setStatus(await loadStatus()); } catch { setError(true); }
    } finally {
      setBusyBusinessId(null);
    }
  }

  async function reconnect(entry: OrganizationAccessEntry) {
    if (busyBusinessId || !entry.businessId || !entry.canReconnect) return;
    setBusyBusinessId(entry.businessId);
    setActionError(null);
    try {
      const response = await fetch(apiUrl("/api/stripe/checkout/business"), {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: entry.businessId, seats: 1 }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || typeof body?.url !== "string") {
        throw new Error(body?.error || "We couldn't start Organization reconnection.");
      }
      window.location.assign(body.url);
    } catch (err) {
      setActionError(err instanceof Error
        ? err.message : "We couldn't start Organization reconnection.");
      setBusyBusinessId(null);
    }
  }

  async function changeAttachment(entry: OrganizationAccessEntry, action: "disconnect" | "reconnect") {
    if (busyBusinessId || !entry.addonBusinessId ||
        (action === "disconnect" ? !entry.canDisconnectAddon : !entry.canReconnectAddon)) return;
    setBusyBusinessId(entry.addonBusinessId);
    setActionError(null);
    setConfirmDisconnect(null);
    try {
      const response = await fetch(apiUrl(
        `/api/business/workspace/organization-access/${encodeURIComponent(entry.addonBusinessId)}/addon/${action}`,
      ), {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error || "We couldn't change the Organization connection.");
      }
      await loadStatus();
      // Re-read the workspace chooser and all location selections from the server.
      window.location.reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "We couldn't change the Organization connection.");
      try { setStatus(await loadStatus()); } catch { setError(true); }
      setBusyBusinessId(null);
    }
  }

  return (
    <>
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
              <li key={`${organization.name}-${index}`} className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-sm font-semibold text-white">{organization.name}</p>
                <p className={`text-xs ${organization.canReconnectAddon ? "text-red-200" : "text-white/70"}`}>
                  {organization.canReconnectAddon
                    ? `Owner workspace disconnected · ${organizationCopy(organization)} · billing and other members are unchanged`
                    : organizationCopy(organization)}
                </p>
                {(organization.canDisconnectAddon || organization.canReconnectAddon) && (
                  <p className="text-xs font-semibold text-white/80">Your workspace connection</p>
                )}
                {organization.canDisconnectAddon && organization.addonBusinessId && (
                  <Button type="button" disabled={busyBusinessId !== null}
                    className="h-11 w-full border border-white/70 bg-black px-5 font-semibold text-white hover:bg-zinc-900 focus-visible:ring-white sm:w-auto"
                    onClick={() => setConfirmDisconnect(organization)}
                    data-testid="disconnect-organization-addon">
                    Disconnect Organization
                  </Button>
                )}
                {organization.canReconnectAddon && organization.addonBusinessId && (
                  <Button type="button" disabled={busyBusinessId !== null}
                    className="h-11 w-full border border-white/70 bg-black px-5 font-semibold text-white hover:bg-zinc-900 focus-visible:ring-white sm:w-auto"
                    onClick={() => void changeAttachment(organization, "reconnect")}
                    data-testid="reconnect-organization-addon">
                    {busyBusinessId === organization.addonBusinessId ? "Checking…" : "Reconnect Organization"}
                  </Button>
                )}
                {(organization.canManageRenewal || organization.canReconnect) && (
                  <p className="text-xs font-semibold text-white/80">Subscription and renewal</p>
                )}
                {organization.canManageRenewal && organization.businessId &&
                  organization.state === "active" && organization.paidThrough && (
                  <Button type="button" variant="outline" disabled={busyBusinessId !== null}
                    onClick={() => setConfirmEnd(organization)}
                    data-testid="end-organization-access">
                    End Organization
                  </Button>
                )}
                {organization.canManageRenewal && organization.businessId &&
                  organization.state === "ending" && organization.paidThrough && (
                  <Button type="button" variant="outline" disabled={busyBusinessId !== null}
                    onClick={() => void changeRenewal(organization, "keep")}
                    data-testid="keep-organization">
                    {busyBusinessId === organization.businessId ? "Checking…" : "Keep Organization"}
                  </Button>
                )}
                {organization.canReconnect && organization.businessId && organization.state === "expired" && (
                  <Button type="button" variant="outline" disabled={busyBusinessId !== null}
                    onClick={() => void reconnect(organization)}
                    data-testid="reconnect-organization">
                    {busyBusinessId === organization.businessId ? "Checking…" : "Restart Organization Subscription"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {actionError && <p role="alert" className="text-sm text-red-300">{actionError}</p>}
        <p className="text-xs text-white/55">Organization access is separate from your personal My Perfect Meals account.</p>
      </GlassCardContent>
    </GlassCard>
    <ConfirmationModal
      open={confirmDisconnect !== null}
      onOpenChange={(open) => { if (!busyBusinessId && !open) setConfirmDisconnect(null); }}
      className="border border-white/25 bg-black/90 text-white shadow-2xl backdrop-blur-xl"
      title="Disconnect Organization workspace?"
      description={<span className="text-white/85">This hides your Organization workspace from your account. It does not end renewal or close the Organization for anyone else.</span>}
      footer={
        <>
          <Button type="button" disabled={busyBusinessId !== null}
            className="h-11 w-full border border-green-500 bg-green-700 px-4 font-semibold text-white hover:bg-green-800 hover:text-white focus-visible:ring-green-400 sm:w-auto"
            onClick={() => setConfirmDisconnect(null)}>Keep Connected</Button>
          <Button type="button" disabled={busyBusinessId !== null}
            className="h-11 w-full border border-red-500 bg-red-700 px-4 font-semibold text-white hover:bg-red-800 hover:text-white focus-visible:ring-red-400 sm:w-auto"
            onClick={() => confirmDisconnect && void changeAttachment(confirmDisconnect, "disconnect")}
            data-testid="confirm-disconnect-organization">Disconnect Organization</Button>
        </>
      }
    >
      <p className="text-sm text-white/80">
        The same Business, Locations, members, clients, history, and billing remain unchanged.
        Staff and clients retain their access. You remain the owner and can reconnect from More.
      </p>
    </ConfirmationModal>
    <ConfirmationModal
      open={confirmEnd !== null}
      onOpenChange={(open) => { if (!busyBusinessId && !open) setConfirmEnd(null); }}
      title="End Organization renewal?"
      description="This stops renewal for this Organization subscription, not your personal My Perfect Meals account."
      footer={
        <>
          <Button type="button" variant="outline" disabled={busyBusinessId !== null}
            onClick={() => setConfirmEnd(null)}>
            Keep Organization
          </Button>
          <Button type="button" disabled={busyBusinessId !== null || !confirmEnd}
            onClick={() => confirmEnd && void changeRenewal(confirmEnd, "end")}
            data-testid="confirm-end-organization">
            {busyBusinessId ? "Checking…" : "Confirm End Organization"}
          </Button>
        </>
      }
    >
      <ul className="list-disc space-y-2 pl-5 text-sm text-white/80">
        <li>Renewal stops at the end of the current paid Organization period.</li>
        <li>Organization access remains available through {confirmEnd?.paidThrough
          ? formatPaidThrough(confirmEnd.paidThrough) : "the verified paid-through date"}.</li>
        <li>Your personal My Perfect Meals account and subscription stay independent.</li>
        <li>The Organization and its data remain available for reconnection after expiration.</li>
      </ul>
    </ConfirmationModal>
    </>
  );
}