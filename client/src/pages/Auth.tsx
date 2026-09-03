import { useState, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { login, signUp, getProCareSignupData, getAuthHeaders } from "@/lib/auth";
import type { User } from "@/lib/auth";
import { Stethoscope } from "lucide-react";
import { WorkspaceChooser } from "@/components/WorkspaceChooser";
import { hasActivePaidSubscription, isProOrAbove } from "@/lib/subscriptionCheck";
import { MfaChallengeModal } from "@/components/MfaChallengeModal";
import { createProfessionalLegalRecoveryUrl } from "@/lib/professionalLegalRecovery";

export default function Auth() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { user, setUser, refreshUser } = useAuth();
  const isProCare = useMemo(() => new URLSearchParams(search).get("procare") === "true", [search]);
  const urlMode = useMemo(() => new URLSearchParams(search).get("mode"), [search]);
  const urlRole = useMemo(() => new URLSearchParams(search).get("role") as "trainer" | "physician" | "business" | null, [search]);
  // Invitation token carried from a team-member invite email.  When present this
  // signup is always business-intent; the token is auto-accepted after auth.
  const urlInvite = useMemo(() => new URLSearchParams(search).get("invite"), [search]);
  const pilotAuthorizationToken = useMemo(
    () => new URLSearchParams(search).get("pilotAuthorization"),
    [search],
  );
  // returnTo is set by /join/studio (and similar pages) when redirecting an
  // unauthenticated user to login. Only same-origin paths are honoured.
  const urlReturnTo = useMemo(() => {
    const p = new URLSearchParams(search).get("returnTo");
    return p && p.startsWith("/") && !p.startsWith("//") ? p : null;
  }, [search]);
  const isIdleTimeout = useMemo(() => new URLSearchParams(search).get("reason") === "idle_timeout", [search]);
  const signupSource = useMemo(() => {
    const p = new URLSearchParams(search);
    return p.get("source") || p.get("ref") || null;
  }, [search]);
  const [mode, setMode] = useState<"signup" | "login">(
    isProCare || urlRole || urlInvite || pilotAuthorizationToken ? "signup" : urlMode === "signup" ? "signup" : "login"
  );
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loginFailCount, setLoginFailCount] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showWorkspaceChooser, setShowWorkspaceChooser] = useState(false);
  const [showMfaChallenge, setShowMfaChallenge] = useState(false);

  async function acceptInviteToken(token: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`/api/business/invite/${token}/accept`, {
        method: "POST",
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error };
      return { ok: true };
    } catch {
      return { ok: false, error: "Could not auto-accept invitation." };
    }
  }

  async function claimPilotAuthorization(token: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch("/api/business/pilot-authorizations/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data.error };
      return { ok: true };
    } catch {
      return { ok: false, error: "Could not claim the organizational authorization." };
    }
  }

  async function hasOrganizationWorkspace(): Promise<boolean> {
    try {
      const res = await fetch("/api/business/workspaces", {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) return false;
      const data = await res.json();
      return Array.isArray(data.workspaces) && data.workspaces.length > 0;
    } catch {
      return false;
    }
  }

  async function proceedAfterLogin(
    u: User,
    options: { professionalSetupPending?: boolean } = {},
  ) {
    setUser(u);
    localStorage.setItem("isAuthenticated", "true");
    sessionStorage.removeItem("mpm.welcomeGateDone");

    // If an invite token is present, auto-accept it now that the user is
    // authenticated.  On success we always route to the business dashboard,
    // regardless of whether this was a fresh signup or an existing-user login.
    if (urlInvite) {
      const result = await acceptInviteToken(urlInvite);
      if (!result.ok) {
        // Show the error and stay on the auth page so the user can resolve it
        // (e.g. wrong email address — they need to log in with the right account).
        setErr(result.error || "Could not accept invitation. Please try again.");
        return;
      }
      // Refresh session so the business membership is visible immediately
      try { await refreshUser(); } catch { /* non-fatal */ }
      setLocation("/business-dashboard");
      return;
    }
    if (pilotAuthorizationToken) {
      const result = await claimPilotAuthorization(pilotAuthorizationToken);
      if (!result.ok) {
        setErr(result.error || "Could not claim the organizational authorization.");
        return;
      }
      try { await refreshUser(); } catch { /* non-fatal */ }
      setLocation("/business/setup?pilot=1");
      return;
    }

    if (options.professionalSetupPending) {
      try { await refreshUser(); } catch { /* non-fatal */ }
      setLocation(createProfessionalLegalRecoveryUrl(
        urlReturnTo || "/professional-dashboard",
        "professional-workspace",
      ));
      return;
    }

    // If a returnTo path was preserved (e.g. /join/studio after a ProCare invite
    // deep-link redirected an unauthenticated user to login), send them there now.
    if (urlReturnTo) {
      try { await refreshUser(); } catch { /* non-fatal */ }
      setLocation(urlReturnTo);
      return;
    }

    const isProfessionalFromLogin = u?.isProCare && (u?.professionalRole === "trainer" || u?.professionalRole === "physician");
    const fullUser = await refreshUser();
    const isProfessionalFromRefresh = fullUser?.isProCare && (fullUser?.professionalRole === "trainer" || fullUser?.professionalRole === "physician");
    const isProfessional = isProfessionalFromLogin || isProfessionalFromRefresh;
    const organizationWorkspaceAvailable = mode === "login"
      ? await hasOrganizationWorkspace()
      : false;
    const onboardingDone = fullUser?.onboardingCompletedAt;

    const isBusinessUser = fullUser?.professionalRole === "business";

    if (isBusinessUser && mode === "signup") {
      // New business signups go directly to org setup + seat purchase
      setLocation("/business/setup");
    } else if (isBusinessUser && mode === "login") {
      // Returning business logins: check payment status before routing.
      // pending_billing → owner abandoned Stripe checkout, send them back to finish.
      // active / any other status → straight to their dashboard.
      try {
        const statusRes = await fetch("/api/business/check-status", {
          credentials: "include",
          headers: getAuthHeaders(),
        });
        if (statusRes.ok) {
          const { exists, status } = await statusRes.json();
          if (!exists || status === "pending_billing") {
            setLocation("/business/setup");
          } else {
            setLocation("/business-dashboard");
          }
        } else {
          // Fallback: if the check fails, assume they're set up
          setLocation("/business-dashboard");
        }
      } catch {
        setLocation("/business-dashboard");
      }
    } else if ((isProfessional || organizationWorkspaceAvailable) && mode === "login") {
      localStorage.removeItem("mpm_workspace_preference");
      setShowWorkspaceChooser(true);
    } else if (mode === "signup" && urlRole === "business") {
      // Fallback (should be caught above by isBusinessUser, but kept for safety)
      setLocation("/business/setup");
    } else if (mode === "signup" && urlRole === "trainer") {
      setLocation("/trainer-welcome");
    } else if (mode === "signup" && urlRole === "physician") {
      setLocation("/physician-welcome");
    } else if (mode === "signup") {
      setLocation("/consumer-welcome");
    } else if (hasActivePaidSubscription(fullUser) && !onboardingDone) {
      setLocation("/onboarding");
    } else {
      const pendingPlan = sessionStorage.getItem("mpm_pending_plan");
      if (pendingPlan) {
        sessionStorage.removeItem("mpm_pending_plan");
        setLocation(`/pricing?plan=${pendingPlan}`);
      } else {
        setLocation("/");
      }
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      let u: User;
      if (mode === "signup") {
        let procareData = isProCare ? getProCareSignupData() : null;
        // Treat invite-link signups as business signups so the account is
        // created with professionalRole="business" from the start and the
        // invite auto-accept succeeds immediately after (email must match).
        const isBusinessSignup = urlRole === "business" || !!urlInvite || !!pilotAuthorizationToken;
        if (!procareData && urlRole && urlRole !== "business") {
          procareData = {
            professionalRole: urlRole,
            professionalCategory: "certified",
            attestationText: "Direct signup via welcome flow",
            attestedAt: new Date().toISOString(),
            procareEntryPath: urlRole,
          };
        }
        const professionalSetupPending = !!procareData && !isBusinessSignup;
        u = await signUp(
          email.trim(),
          pwd,
          procareData,
          isBusinessSignup,
          signupSource,
          urlInvite,
          pilotAuthorizationToken,
        );
        await proceedAfterLogin(u, { professionalSetupPending });
        return;
      } else {
        const loginResult = await login(email.trim(), pwd);
        if ("mfaRequired" in loginResult && loginResult.mfaRequired) {
          setShowMfaChallenge(true);
          return;
        }
        u = loginResult as User;
      }
      await proceedAfterLogin(u);
    } catch (e: any) {
      const msg: string = e?.message || "Authentication failed.";
      setErr(msg);
      if (mode === "login" && (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("incorrect") || msg.toLowerCase().includes("password"))) {
        setLoginFailCount((n) => n + 1);
      }
    }
  }

  if (showMfaChallenge) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-white bg-gradient-to-br from-neutral-700 via-black to-black">
        <MfaChallengeModal
          onSuccess={async (u: User) => {
            setShowMfaChallenge(false);
            try {
              await proceedAfterLogin(u);
            } catch (e: any) {
              setErr(e?.message || "Login failed.");
              setShowMfaChallenge(false);
            }
          }}
          onCancel={() => setShowMfaChallenge(false)}
        />
      </div>
    );
  }

  if (showWorkspaceChooser) {
    const isPhysician = user?.professionalRole === "physician";
    const workspaceRoute = isPhysician ? "/care-team/physician" : "/care-team/trainer";
    return (
      <WorkspaceChooser
        onChoose={(choice: "personal" | "workspace") => {
          if (choice === "workspace") {
            localStorage.setItem("mpm_active_space", "workspace");
            setLocation(workspaceRoute);
          } else {
            localStorage.setItem("mpm_active_space", "personal");
            const hasPersonalSetup = user?.onboardingCompletedAt;
            if (!hasPersonalSetup) {
              setLocation("/consumer-welcome");
            } else {
              setLocation("/");
            }
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-white bg-gradient-to-br from-neutral-700 via-black to-black">
      <div className="relative isolate w-full max-w-sm rounded-2xl p-6
                      bg-black/25 backdrop-blur-xl border border-white/10 shadow-xl">
        <span className="absolute inset-0 -z-0 pointer-events-none rounded-2xl
                         bg-gradient-to-br from-white/10 via-transparent to-transparent" />

        {isIdleTimeout && (
          <div className="relative z-10 mb-4 flex items-start gap-2 rounded-xl bg-orange-600/15 border border-orange-500/30 px-3 py-2.5">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-orange-200">
              You were signed out after a period of inactivity. Please sign in again to continue.
            </p>
          </div>
        )}

        {urlInvite && (
          <div className="relative z-10 mb-4 flex justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-900/40 rounded-full border border-blue-400/30">
              <Stethoscope className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold text-blue-300">Team Invitation</span>
            </div>
          </div>
        )}

        {!urlInvite && (isProCare || urlRole) && mode === "signup" && (
          <div className="relative z-10 mb-4 flex justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-900/40 rounded-full border border-blue-400/30">
              <Stethoscope className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold text-blue-300">
                {urlRole === "trainer" ? "Trainer Account" : urlRole === "physician" ? "Physician Account" : urlRole === "business" ? "Business Account" : "Professional Account"}
              </span>
            </div>
          </div>
        )}

        <h1 className="relative z-10 text-2xl font-bold mb-1">
          {urlInvite
            ? mode === "signup" ? "Join Your Team" : "Sign In to Accept Invite"
            : mode === "signup"
            ? urlRole === "trainer" ? "Create Trainer Account"
            : urlRole === "physician" ? "Create Physician Account"
            : urlRole === "business" ? "Create Business Account"
            : isProCare ? "Create Professional Account"
            : "Create Your Account"
            : "Welcome Back"}
        </h1>
        <p className="relative z-10 text-sm text-white/85 mb-6">
          {urlInvite
            ? mode === "signup"
              ? "Create an account with the email address that received the invite to join your team."
              : "Sign in with the email address that received the invite."
            : mode === "signup" && (isProCare || urlRole)
            ? "Enter your email and a password to get started."
            : mode === "signup"
            ? "Enter your email and a password to get started."
            : "Sign in with your email and password."}
        </p>

        <form onSubmit={onSubmit} className="relative z-10">
          <input
            type="email"
            placeholder="Email"
            className="w-full p-3 mb-3 rounded-xl
                       bg-white/10 border border-white/20
                       text-white placeholder-white/60
                       focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="space-y-2 mb-2">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="w-full h-12 px-3 rounded-xl
                         bg-white/10 border border-white/20
                         text-white placeholder-white/60
                         focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30"
              required
              minLength={6}
              autoCorrect="off"
              autoCapitalize="off"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-white/80 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="h-4 w-4 rounded border-white/30 bg-white/10 text-orange-500 focus:ring-orange-500/50"
              />
              Show password
            </label>
          </div>

          {mode === "login" && (
            <div className="text-right mb-3">
              <button
                type="button"
                onClick={() => setLocation("/forgot-password")}
                className="text-xs text-indigo-300 underline active:scale-[0.98]"
                data-testid="link-forgot-password"
              >
                Forgot password?
              </button>
            </div>
          )}

          {err && (
            <div className="text-sm text-red-300 mb-3">
              {err}
              {mode === "login" && loginFailCount >= 1 && (
                <span>
                  {" "}
                  <button
                    type="button"
                    onClick={() => setLocation("/forgot-password")}
                    className="underline text-orange-300 font-medium"
                  >
                    Reset your password?
                  </button>
                </span>
              )}
            </div>
          )}

          <button
            className="relative isolate w-full p-3 rounded-xl
                       bg-black/40 backdrop-blur-md border border-white/10
                       text-white shadow-md active:scale-[0.98] transition"
          >
            <span className="absolute inset-0 -z-0 pointer-events-none rounded-xl
                             bg-gradient-to-r from-white/10 via-transparent to-transparent" />
            <span className="relative z-10">
              {mode === "signup" ? "Create Account" : "Sign In"}
            </span>
          </button>
        </form>

        <div className="relative z-10 mt-4 text-sm text-center text-white/85">
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button
                className="underline text-indigo-300 active:scale-[0.98]"
                onClick={() => setMode("login")}
              >
                Log in
              </button>
            </>
          ) : (
            <>
              New here?{" "}
              <button
                className="underline text-indigo-300 active:scale-[0.98]"
                onClick={() => setMode("signup")}
              >
                Create account
              </button>
            </>
          )}
        </div>

      </div>

    </div>
  );
}
