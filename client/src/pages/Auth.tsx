// client/src/pages/Auth.tsx
import { useState, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { login, signUp, getProCareSignupData, clearProCareSignupData } from "@/lib/auth";
import { Stethoscope } from "lucide-react";
import { WorkspaceChooser } from "@/components/WorkspaceChooser";

export default function Auth() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { setUser, refreshUser } = useAuth();
  const isProCare = useMemo(() => new URLSearchParams(search).get("procare") === "true", [search]);
  const urlMode = useMemo(() => new URLSearchParams(search).get("mode"), [search]);
  const [mode, setMode] = useState<"signup" | "login">(
    isProCare ? "signup" : urlMode === "signup" ? "signup" : "login"
  );
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showWorkspaceChooser, setShowWorkspaceChooser] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      let u;
      if (mode === "signup") {
        const procareData = isProCare ? getProCareSignupData() : null;
        u = await signUp(email.trim(), pwd, procareData);
        if (procareData) {
          clearProCareSignupData();
        }
      } else {
        u = await login(email.trim(), pwd);
      }
      setUser(u);
      
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("mpm.hasSeenWelcome", "true");

      const isProfessionalFromLogin = u?.isProCare && (u?.professionalRole === "trainer" || u?.professionalRole === "physician");
      const fullUser = await refreshUser();
      const isProfessionalFromRefresh = fullUser?.isProCare && (fullUser?.professionalRole === "trainer" || fullUser?.professionalRole === "physician");
      const isProfessional = isProfessionalFromLogin || isProfessionalFromRefresh;

      const hasStudioMembership = u?.studioMembership || fullUser?.studioMembership;

      const onboardingDone = fullUser?.onboardingCompletedAt;

      if (mode === "signup" && !isProfessional) {
        setLocation("/onboarding");
      } else if (isProfessional && mode === "login") {
        localStorage.removeItem("mpm_workspace_preference");
        setShowWorkspaceChooser(true);
      } else if (isProfessional && mode === "signup") {
        setShowWorkspaceChooser(true);
      } else if (!onboardingDone && !isProfessional) {
        setLocation("/onboarding");
      } else if (hasStudioMembership && mode === "login") {
        localStorage.setItem("coachMode", "self");
        setLocation("/dashboard");
      } else {
        if (!localStorage.getItem("coachMode")) {
          localStorage.setItem("coachMode", "self");
        }
        setLocation("/dashboard");
      }
    } catch (e: any) {
      setErr(e?.message || "Authentication failed.");
    }
  }

  if (showWorkspaceChooser) {
    return (
      <WorkspaceChooser
        onChoose={(choice: "personal" | "workspace") => {
          localStorage.setItem("coachMode", "self");
          if (choice === "workspace") {
            setLocation("/more");
          } else {
            setLocation("/dashboard");
          }
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-white bg-gradient-to-br from-neutral-700 via-black to-black">
      {/* Auth card (black glass) */}
      <div className="relative isolate w-full max-w-sm rounded-2xl p-6
                      bg-black/25 backdrop-blur-xl border border-white/10 shadow-xl">
        <span className="absolute inset-0 -z-0 pointer-events-none rounded-2xl
                         bg-gradient-to-br from-white/10 via-transparent to-transparent" />

        {/* ProCare Badge */}
        {isProCare && mode === "signup" && (
          <div className="relative z-10 mb-4 flex justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-900/40 rounded-full border border-blue-400/30">
              <Stethoscope className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-semibold text-blue-300">Professional Account</span>
            </div>
          </div>
        )}

        <h1 className="relative z-10 text-2xl font-bold mb-1">
          {mode === "signup"
            ? isProCare ? "Create Professional Account" : "Create Your Account"
            : "Welcome Back"}
        </h1>
        <p className="relative z-10 text-sm text-white/85 mb-6">
          {mode === "signup" && isProCare
            ? "Your professional credentials have been recorded."
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

          {err && <div className="text-sm text-red-300 mb-3">{err}</div>}

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
