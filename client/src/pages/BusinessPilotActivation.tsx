import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthHeaders } from "@/lib/auth";
import { IS_DEVELOPMENT } from "@/lib/developmentAuthRoutes";
import DevelopmentBusinessPilotActivation from "@/components/business/DevelopmentBusinessPilotActivation";

const KEY = "mpm.founderBusinessPilotToken";
export default function BusinessPilotActivation() {
  return IS_DEVELOPMENT ? <DevelopmentBusinessPilotActivation /> : <ExistingBusinessPilotActivation />;
}

function ExistingBusinessPilotActivation() {
  const { user, refreshUser } = useAuth();
  const [, navigate] = useLocation();
  const [token] = useState(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (value) {
      sessionStorage.setItem(KEY, value);
      window.history.replaceState({}, "", window.location.pathname);
    }
    return value ?? sessionStorage.getItem(KEY);
  });
  const [error, setError] = useState("");
  const [details, setDetails] = useState<any>(null);
  const [activated, setActivated] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true;
    if (!token) { setError("Invitation token is missing."); return; }
    fetch("/api/business/pilot-activation/inspect", {
      headers: { "x-business-pilot-token": token },
      cache: "no-store",
    }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not inspect invitation.");
      if (current) setDetails(data);
    }).catch(error => { if (current) setError(error.message); });
    return () => { current = false; };
  }, [token]);
  async function activate() {
    if (!user) {
      navigate("/auth?returnTo=%2Factivate%2Fbusiness-pilot");
      return;
    }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/business/pilot-activation/claim", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not activate invitation.");
      await refreshUser();
      setDetails(data); setActivated(true);
      sessionStorage.removeItem(KEY);
    } catch (error: any) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-gray-950 p-6 text-white">
    <section className="mx-auto max-w-lg space-y-5 rounded-2xl border border-orange-500/30 p-6">
      <h1 className="text-2xl font-bold">Your 30-Day Business Pilot</h1>
      <p>Complimentary personal Clinical access. No payment method or subscription is required to activate.</p>
      <p>The organization you create through More → Start Your Organization shares this pilot's original expiration. Creating it later does not start another free month.</p>
      <p className="text-sm text-white/70">Professional setup, credential requirements and patient consent remain separate. Clinical access alone does not authorize viewing patient records.</p>
      {details?.endsAt && <p>Pilot ends {new Date(details.endsAt).toLocaleString()}.</p>}
      {error && <p role="alert" className="text-red-300">{error}</p>}
      {activated ? <button className="w-full rounded-xl bg-orange-600 p-3" onClick={() => navigate(user?.onboardingCompletedAt ? "/more" : "/onboarding")}>Continue to My Perfect Meals</button>
        : <button disabled={busy || !details || (!details.available && !details.activated)}
          className="w-full rounded-xl bg-orange-600 p-3 disabled:opacity-50"
          onClick={activate}>{busy ? "Activating…" : user ? "Activate My Complimentary Pilot" : "Register or Sign In"}</button>}
      <p className="text-sm text-white/60">At expiry you choose whether to continue. An Organization subscription and a personal Clinical subscription are different purchases. No automatic charge.</p>
    </section>
  </main>;
}
