// client/src/pages/Auth.tsx
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { login, signUp } from "@/lib/auth";
import { Eye, EyeOff } from "lucide-react";

export default function Auth() {
  const [, setLocation] = useLocation();
  const { setUser } = useAuth();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      const u = await (mode === "signup" 
        ? signUp(email.trim(), pwd) 
        : login(email.trim(), pwd));
      setUser(u);
      
      // Mark as authenticated
      localStorage.setItem("isAuthenticated", "true");
      localStorage.setItem("mpm.hasSeenWelcome", "true");
      
      // After successful auth, go to root which will show WelcomeGate
      // (unless they've already chosen a coach mode)
      const coachMode = localStorage.getItem("coachMode");
      if (coachMode) {
        setLocation("/dashboard");
      } else {
        setLocation("/");
      }
    } catch (e: any) {
      setErr(e?.message || "Authentication failed.");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-white bg-gradient-to-br from-neutral-700 via-black to-black">
      {/* Auth card (black glass) */}
      <div className="relative isolate w-full max-w-sm rounded-2xl p-6
                      bg-black/25 backdrop-blur-xl border border-white/10 shadow-xl">
        <span className="absolute inset-0 -z-0 pointer-events-none rounded-2xl
                         bg-gradient-to-br from-white/10 via-transparent to-transparent" />

        <h1 className="relative z-10 text-2xl font-bold mb-1">
          {mode === "signup" ? "Create your account" : "Welcome back"}
        </h1>
        <p className="relative z-10 text-sm text-white/85 mb-6">
          Use email + password. OAuth can come later.
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
          <div className="relative mb-2">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="w-full p-3 pr-12 rounded-xl
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
            <button
              type="button"
              onTouchStart={() => setShowPassword(true)}
              onTouchEnd={() => setShowPassword(false)}
              onTouchCancel={() => setShowPassword(false)}
              onMouseDown={() => setShowPassword(true)}
              onMouseUp={() => setShowPassword(false)}
              onMouseLeave={() => setShowPassword(false)}
              onContextMenu={(e) => e.preventDefault()}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white p-2 select-none"
              style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}
              aria-label="Hold to show password"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>

          {mode === "login" && (
            <div className="text-right mb-3">
              <button
                type="button"
                onClick={() => setLocation("/forgot-password")}
                className="text-xs text-indigo-300 hover:text-indigo-200 underline"
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
                       text-white shadow-md hover:bg-black/50 transition"
          >
            <span className="absolute inset-0 -z-0 pointer-events-none rounded-xl
                             My biometrics-gradient-to-r from-white/10 via-transparent to-transparent" />
            <span className="relative z-10">
              {mode === "signup" ? "Sign Up" : "Log In"}
            </span>
          </button>
        </form>

        <div className="relative z-10 mt-4 text-sm text-center text-white/85">
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button
                className="underline text-indigo-300 hover:text-indigo-200"
                onClick={() => setMode("login")}
              >
                Log in
              </button>
            </>
          ) : (
            <>
              New here?{" "}
              <button
                className="underline text-indigo-300 hover:text-indigo-200"
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
