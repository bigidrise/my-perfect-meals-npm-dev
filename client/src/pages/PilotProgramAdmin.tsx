import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";

function parseParticipants(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const angle = line.match(/^(.*?)\s*<([^>]+)>$/);
    if (angle) return { name: angle[1].trim() || undefined, email: angle[2].trim() };
    const comma = line.split(",").map((item) => item.trim());
    if (comma.length > 1 && comma[1].includes("@")) return { name: comma[0] || undefined, email: comma[1] };
    return { email: line };
  });
}

export default function PilotProgramAdmin() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [championEmail, setChampionEmail] = useState("");
  const [authorizationOrganization, setAuthorizationOrganization] = useState("");
  const [authorizationDuration, setAuthorizationDuration] = useState(30);
  const [professionalCapacity, setProfessionalCapacity] = useState(4);
  const [clientCapacity, setClientCapacity] = useState(100);
  const [authorizations, setAuthorizations] = useState<any[]>([]);
  const [authorizationError, setAuthorizationError] = useState("");
  const [authorizing, setAuthorizing] = useState(false);
  const [loadingAuthorizations, setLoadingAuthorizations] = useState(true);
  const [organizationName, setOrganizationName] = useState("");
  const [programName, setProgramName] = useState("");
  const [durationDays, setDurationDays] = useState(30);
  const [participantText, setParticipantText] = useState("");
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const participants = useMemo(() => parseParticipants(participantText), [participantText]);

  const loadAuthorizations = async () => {
    setLoadingAuthorizations(true);
    try {
      const response = await apiRequest("/api/business/pilot-authorizations");
      setAuthorizations(response.authorizations || []);
    } catch (reason: any) {
      setAuthorizationError(reason.message || "Could not load organization pilots");
    } finally {
      setLoadingAuthorizations(false);
    }
  };

  useEffect(() => {
    if (user?.isAdmin) void loadAuthorizations();
  }, [user?.isAdmin]);

  if (!user?.isAdmin) {
    return <div className="p-8 text-white">Administrator access is required.</div>;
  }

  const authorizeOrganization = async () => {
    setAuthorizing(true);
    setAuthorizationError("");
    try {
      await apiRequest("/api/business/pilot-authorizations", {
        method: "POST",
        body: JSON.stringify({
          championEmail,
          organizationName: authorizationOrganization,
          durationDays: authorizationDuration,
          professionalCapacity,
          clientCapacity,
        }),
      });
      setChampionEmail("");
      setAuthorizationOrganization("");
      await loadAuthorizations();
    } catch (reason: any) {
      setAuthorizationError(reason.message || "Could not authorize organization pilot");
    } finally {
      setAuthorizing(false);
    }
  };

  const revokeAuthorization = async (authorization: any) => {
    if (!window.confirm(`Revoke the unused pilot authorization for ${authorization.organizationName}?`)) return;
    setAuthorizationError("");
    try {
      await apiRequest(`/api/business/pilot-authorizations/${authorization.id}/revoke`, {
        method: "POST",
        body: JSON.stringify({ reason: "Revoked from Organization Pilots admin screen" }),
      });
      await loadAuthorizations();
    } catch (reason: any) {
      setAuthorizationError(reason.message || "Could not revoke organization pilot");
    }
  };

  const provision = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await apiRequest("/api/trial/admin/pilot-programs", {
        method: "POST",
        body: JSON.stringify({ organizationName, programName, durationDays, participants }),
      });
      setResult(response);
    } catch (reason: any) {
      setError(reason.message || "Pilot provisioning failed");
    } finally {
      setSaving(false);
    }
  };

  const startPilot = async () => {
    if (!result?.program?.id) return;
    setStarting(true);
    setError("");
    try {
      const started = await apiRequest(`/api/trial/admin/pilot-programs/${result.program.id}/start`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setResult({ ...result, program: started.program });
    } catch (reason: any) {
      setError(reason.message || "Pilot start failed");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <button type="button" onClick={() => setLocation("/admin")} className="mb-5 text-sm text-white/55 hover:text-white">
          ← Admin Dashboard
        </button>
        <p className="text-sm font-semibold uppercase tracking-wider text-violet-300">Pilot administration</p>
        <h1 className="mt-2 text-3xl font-bold">Organization Pilots</h1>
        <p className="mt-2 text-white/65">Authorize organizations first, then manage participants after the organization is set up.</p>

        <section className="mt-7 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-6">
          <h2 className="text-xl font-bold">Authorize New Pilot</h2>
          <p className="mt-1 text-sm text-white/60">One authorization creates one free organization. Issue separate authorizations for separate organizations.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Input type="email" placeholder="Contact email" value={championEmail} onChange={(e) => setChampionEmail(e.target.value)} />
            <Input placeholder="Organization name" value={authorizationOrganization} onChange={(e) => setAuthorizationOrganization(e.target.value)} />
            <label className="text-xs text-white/60">
              Pilot length in days
              <Input className="mt-1" type="number" min={1} max={365} value={authorizationDuration} onChange={(e) => setAuthorizationDuration(Number(e.target.value))} />
            </label>
            <label className="text-xs text-white/60">
              Professional seats
              <Input className="mt-1" type="number" min={1} max={1000} value={professionalCapacity} onChange={(e) => setProfessionalCapacity(Number(e.target.value))} />
            </label>
            <label className="text-xs text-white/60">
              Client capacity
              <Input className="mt-1" type="number" min={0} max={100000} value={clientCapacity} onChange={(e) => setClientCapacity(Number(e.target.value))} />
            </label>
          </div>
          {authorizationError && <p className="mt-4 text-sm text-red-300">{authorizationError}</p>}
          <Button
            className="mt-5 bg-amber-500 text-black hover:bg-amber-400"
            disabled={authorizing || !championEmail.trim() || !authorizationOrganization.trim()}
            onClick={authorizeOrganization}
          >
            {authorizing ? "Authorizing…" : "Authorize Pilot"}
          </Button>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="font-semibold">Organization authorizations</h2>
          {loadingAuthorizations ? (
            <p className="mt-3 text-sm text-white/50">Loading…</p>
          ) : authorizations.length === 0 ? (
            <p className="mt-3 text-sm text-white/50">No organization pilots have been authorized.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {authorizations.map((authorization) => (
                <div key={authorization.id} className="rounded-xl border border-white/10 bg-black/25 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">{authorization.organizationName}</p>
                      <p className="mt-1 text-sm text-white/55">{authorization.championEmail}</p>
                      <p className="mt-1 text-xs text-white/40">
                        {authorization.durationDays} days · {authorization.professionalCapacity} professional seats · {authorization.clientCapacity} clients
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-semibold capitalize text-white/70">
                      {authorization.status}
                    </span>
                  </div>
                  {authorization.status === "approved" && !authorization.businessId && (
                    <button type="button" onClick={() => revokeAuthorization(authorization)} className="mt-3 text-xs font-semibold text-red-300 hover:text-red-200">
                      Revoke unused authorization
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <h2 className="mt-10 text-xl font-bold">Add pilot participants</h2>
        <p className="mt-1 text-sm text-white/65">Provision accounts and secure activation links without starting the pilot clock.</p>
        <div className="mt-7 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-6">
          <Input placeholder="Organization, e.g. Premier Health" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
          <Input placeholder="Program name, e.g. Premier Health 30-Day Pilot" value={programName} onChange={(e) => setProgramName(e.target.value)} />
          <Input type="number" min={1} max={365} value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} />
          <textarea
            className="min-h-56 rounded-md border border-white/15 bg-black/30 p-3 text-sm"
            placeholder={"One participant per line:\nAllison Pate <apate@example.com>\nTory Langhammer, tlanghammer@example.com\nspugh@example.com"}
            value={participantText}
            onChange={(e) => setParticipantText(e.target.value)}
          />
          <p className="text-sm text-white/60">{participants.length} participant{participants.length === 1 ? "" : "s"} ready</p>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <Button
            className="bg-violet-600 hover:bg-violet-500"
            disabled={saving || !organizationName || !programName || participants.length === 0}
            onClick={provision}
          >
            {saving ? "Provisioning…" : "Provision participants"}
          </Button>
        </div>
        {result?.participants && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="font-semibold">Provisioning results</h2>
            <p className="mt-2 text-sm text-white/65">
              Program status: <strong>{result.program?.status || "preparing"}</strong>
              {result.program?.pilotStartAt && ` · ends ${new Date(result.program.pilotEndAt).toLocaleDateString()}`}
            </p>
            {result.program?.status === "preparing" && (
              <Button className="mt-4 bg-emerald-600 hover:bg-emerald-500" disabled={starting} onClick={startPilot}>
                {starting ? "Starting…" : "Start 30-Day Pilot"}
              </Button>
            )}
            <ul className="mt-3 space-y-2 text-sm">
              {result.participants.map((item: any) => (
                <li key={item.email} className="flex justify-between gap-4">
                  <span>{item.email}</span>
                  <span className={item.status === "failed" ? "text-red-300" : "text-emerald-300"}>
                    {item.status}{item.emailSent === false ? " · email not sent" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}