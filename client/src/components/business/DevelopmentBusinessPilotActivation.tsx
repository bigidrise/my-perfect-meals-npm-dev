import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthHeaders } from "@/lib/auth";
import {
  businessPilotAuthDestination, captureBusinessPilotInvitation,
  clearBusinessPilotInvitation, clearBusinessPilotOrganizationEntry,
  startBusinessPilotOrganizationEntry,
} from "@/lib/businessPilotEntrance";

type InvitationDetails = { available?: boolean; activated?: boolean; endsAt?: string };

export default function DevelopmentBusinessPilotActivation() {
  const { user, loading, refreshUser } = useAuth();
  const [, navigate] = useLocation();
  const actor = useRef(user?.id);
  actor.current = user?.id;
  const [entrance] = useState(() => {
    try {
      return { token: captureBusinessPilotInvitation(sessionStorage, window.location, window.history), error: "" };
    } catch {
      return { token: null, error: "Unable to preserve this invitation. Check the link and allow session storage." };
    }
  });
  const [error, setError] = useState(entrance.error);
  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [activatedFor, setActivatedFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inspectVersion, setInspectVersion] = useState(0);
  const token = entrance.token;
  const activated = !!user && activatedFor === user.id;

  useEffect(() => {
    let current = true;
    if (activated) return;
    setDetails(null);
    if (!token || !user || loading) return;
    // The existing preview remains authenticated; anonymous visitors can choose
    // normal login/signup without first making this protected request.
    fetch("/api/business/pilot-activation/inspect", {
      credentials: "include", cache: "no-store",
      headers: { ...getAuthHeaders(), "x-business-pilot-token": token },
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not inspect invitation.");
      if (current) {
        setDetails(data);
        setError(!data.available && !data.activated
          ? "This invitation is expired or no longer available. No pilot was started." : "");
      }
    }).catch(error => { if (current) setError(error.message); });
    return () => { current = false; };
  }, [token, user?.id, loading, activated, inspectVersion]);

  async function activate() {
    if (!user || !token || busy) return;
    const userId = user.id;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/business/pilot-activation/claim", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (actor.current !== userId) return;
      if (!response.ok) throw new Error(data.error || "Could not activate invitation.");
      const endsAt = Date.parse(data.endsAt);
      if (!Number.isFinite(endsAt)) throw new Error("The pilot expiration could not be verified.");
      if (endsAt <= Date.now()) throw new Error("This pilot has ended. Its original expiration is unchanged.");
      const fresh = await refreshUser();
      if (actor.current !== userId) return;
      if (!fresh || fresh.id !== userId) throw new Error("Sign in again to confirm your activated access.");
      clearBusinessPilotInvitation(sessionStorage);
      setDetails(data); setActivatedFor(userId);
    } catch (error: any) {
      if (actor.current === userId) setError(error.message);
    } finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-gray-950 p-6 text-white">
    <section className="mx-auto max-w-lg space-y-5 rounded-2xl border border-orange-500/30 p-6">
      <h1 className="text-2xl font-bold">Your 30-Day Business Pilot</h1>
      <p>Use your existing account or create one here. Your complimentary Clinical access requires no payment.</p>
      <p>Your 30 days begin only when you successfully activate—not when you open this link or register.</p>
      <p className="text-sm text-white/70">Your Organization shares the original pilot expiration. Professional readiness, credentials, MFA and client consent remain separate.</p>
      {details?.endsAt && <p>Pilot ends {new Date(details.endsAt).toLocaleString()}.</p>}
      {(error || !token) && <p role="alert">{error || "Invitation token is missing. Open your original invitation link."}</p>}
      {loading ? <p role="status">Checking your sign-in…</p> : activated ? <>
        <button className="w-full rounded-xl bg-orange-600 p-3" onClick={() => {
          clearBusinessPilotOrganizationEntry(sessionStorage);
          navigate(user?.onboardingCompletedAt ? "/dashboard" : "/onboarding");
        }}>Personal Onboarding &amp; Explore My Perfect Meals</button>
        <button className="w-full rounded-xl bg-white/10 p-3" onClick={() => {
          startBusinessPilotOrganizationEntry(sessionStorage, user!.id);
          navigate("/more");
        }}>More → Start Your Organization</button>
      </> : !user ? <>
        <button disabled={!token} className="w-full rounded-xl bg-orange-600 p-3 disabled:opacity-50"
          onClick={() => navigate(businessPilotAuthDestination("login"))}>Sign In to My Existing Account</button>
        <button disabled={!token} className="w-full rounded-xl bg-white/10 p-3 disabled:opacity-50"
          onClick={() => navigate(businessPilotAuthDestination("signup"))}>Create an Account</button>
      </> : <>
        <p>Signed in as {user.email}. Use the email that received this invitation.</p>
        <button disabled={busy || !token || !details || (!details.available && !details.activated)}
          className="w-full rounded-xl bg-orange-600 p-3 disabled:opacity-50" onClick={activate}>
          {busy ? "Activating…" : "Activate My Complimentary Pilot"}
        </button>
        {error && <button disabled={busy} onClick={() => setInspectVersion(v => v + 1)}>Retry Invitation Check</button>}
        {error && <button onClick={() => navigate(businessPilotAuthDestination("login"))}>Sign In with the Invited Email</button>}
      </>}
      <p className="text-sm text-white/60">No automatic charge. Personal Clinical and Organization subscriptions remain separate purchases after the pilot.</p>
    </section>
  </main>;
}
