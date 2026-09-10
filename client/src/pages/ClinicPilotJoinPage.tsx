import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl } from "@/lib/resolveApiBase";
import { apiRequest } from "@/lib/queryClient";

type LinkInfo = { pilotName: string; status: string; expiresAt: string | null; available: boolean };

export default function ClinicPilotJoinPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [token] = useState(() => {
    const fragmentToken = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (fragmentToken) {
      sessionStorage.setItem("mpm.clinicPilotToken", fragmentToken);
      window.history.replaceState(null, "", "/join/clinic");
      return fragmentToken;
    }
    return sessionStorage.getItem("mpm.clinicPilotToken") ?? "";
  });
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [message, setMessage] = useState(
    token ? "Checking your clinic invitation…" : "This clinic invitation is unavailable.",
  );

  useEffect(() => {
    if (!token) return;
    fetch(apiUrl("/api/clinic-pilot/inspect"), {
      headers: { "x-clinic-enrollment-token": token },
    })
      .then(async r => {
        if (!r.ok) throw new Error("This clinic invitation is unavailable.");
        return r.json();
      })
      .then(setInfo)
      .catch(e => setMessage(e.message));
  }, [token]);

  useEffect(() => {
    if (!user || !info?.available || !token) return;
    setMessage("Enrolling you in your clinic access…");
    apiRequest("/api/clinic-pilot/enroll", {
      method: "POST",
      body: JSON.stringify({ token }),
    }).then(() => {
      sessionStorage.removeItem("mpm.clinicPilotToken");
      setMessage("Your 30-day clinic access is ready.");
      setLocation(user.onboardingCompletedAt ? "/dashboard" : "/onboarding");
    }).catch(() => setMessage("Enrollment could not be completed."));
  }, [user, info, token, setLocation]);

  if (!info) return <main className="min-h-screen bg-background p-8 text-center"><p>{message}</p></main>;
  if (!user) return <main className="min-h-screen bg-background p-8 text-center space-y-5">
    <h1 className="text-2xl font-semibold">Your clinic nutrition access</h1>
    <p>Join your clinic’s pilot for 30 days of access to My Perfect Meals.</p>
    {!info.available && <p className="text-muted-foreground">This invitation is no longer available.</p>}
    {info.available && <button className="rounded bg-primary px-5 py-3 text-primary-foreground" onClick={() => {
      sessionStorage.setItem("mpm.clinicPilotToken", token);
      setLocation("/auth?clinicPilot=1");
    }}>Sign in or create your account</button>}
  </main>;
  return <main className="min-h-screen bg-background p-8 text-center"><h1 className="text-2xl font-semibold">Clinic access</h1><p>{message}</p></main>;
}