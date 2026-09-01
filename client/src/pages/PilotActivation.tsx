import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ActivationDetails {
  participantName: string | null;
  email: string;
  programName: string;
  organizationName: string;
  durationDays: number;
  requiresPasswordSetup: boolean;
}

export default function PilotActivation() {
  const [, setLocation] = useLocation();
  const token = useMemo(() => new URLSearchParams(window.location.search).get("token") ?? "", []);
  const [details, setDetails] = useState<ActivationDetails | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);
  const [pilotStarted, setPilotStarted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("This pilot activation link is invalid.");
      setLoading(false);
      return;
    }
    fetch(`/api/trial/pilot/activation?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "This activation link is invalid or expired.");
        setDetails(body);
      })
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [token]);

  const activate = async () => {
    setError("");
    if (details?.requiresPasswordSetup) {
      if (password.length < 12) return setError("Password must be at least 12 characters.");
      if (password !== confirmPassword) return setError("Passwords do not match.");
    }
    setActivating(true);
    try {
      const response = await fetch("/api/trial/pilot/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...(details?.requiresPasswordSetup ? { password } : {}) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Pilot activation failed.");
      setPilotStarted(Boolean(body.pilotStarted));
      setActivated(true);
    } catch (reason: any) {
      setError(reason.message);
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-black to-violet-950 px-5 py-12 text-white">
      <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-7 shadow-2xl backdrop-blur">
        {loading ? (
          <p className="text-center text-white/70">Loading your pilot invitation…</p>
        ) : activated ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold">Pilot access activated</h1>
            <p className="mt-3 text-white/75">
              {pilotStarted
                ? `The shared ${details?.durationDays}-day pilot is active now.`
                : "Your account is ready. The Pilot Champion will start the shared pilot window when the team is ready."}
            </p>
            <Button className="mt-7 w-full bg-violet-600 hover:bg-violet-500" onClick={() => setLocation("/auth")}>
              Sign in to My Perfect Meals
            </Button>
          </div>
        ) : error && !details ? (
          <div className="text-center">
            <h1 className="text-2xl font-bold">Activation link unavailable</h1>
            <p className="mt-3 text-red-300">{error}</p>
          </div>
        ) : details ? (
          <>
            <p className="text-sm font-semibold uppercase tracking-wider text-violet-300">{details.organizationName}</p>
            <h1 className="mt-2 text-3xl font-bold">{details.programName}</h1>
            <p className="mt-3 text-white/75">
              Hi {details.participantName || details.email}. Activate now to begin your full {details.durationDays}-day evaluation.
            </p>
            {details.requiresPasswordSetup && (
              <div className="mt-6 space-y-4">
                <Input
                  type="password"
                  placeholder="Choose a password (12+ characters)"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="border-white/15 bg-black/30 text-white"
                />
                <Input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="border-white/15 bg-black/30 text-white"
                />
              </div>
            )}
            {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
            <Button className="mt-6 w-full bg-violet-600 hover:bg-violet-500" disabled={activating} onClick={activate}>
              {activating ? "Activating…" : details.requiresPasswordSetup ? "Set password and activate" : "Activate pilot access"}
            </Button>
            <p className="mt-4 text-xs text-white/50">Your 30-day clock does not begin until activation succeeds.</p>
          </>
        ) : null}
      </div>
    </div>
  );
}