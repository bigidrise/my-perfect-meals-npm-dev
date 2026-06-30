import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, Circle, Lock, Star, GraduationCap, Monitor, Rocket, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { PillButton } from "@/components/ui/pill-button";

interface CertStatus {
  status: "not_started" | "in_progress" | "completed";
  completedAt?: string | null;
}

interface LaunchpadState {
  phase1: CertStatus;
  phase2: CertStatus;
  loading: boolean;
}

export default function ProLaunchpad() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [state, setState] = useState<LaunchpadState>({
    phase1: { status: "not_started" },
    phase2: { status: "not_started" },
    loading: true,
  });
  const [redirectMsg, setRedirectMsg] = useState<string | null>(null);

  useEffect(() => {
    const msg = sessionStorage.getItem("mpm.launchpad.redirectMsg");
    if (msg) {
      setRedirectMsg(msg);
      sessionStorage.removeItem("mpm.launchpad.redirectMsg");
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    // Non-professional users should not see the launchpad
    if (user.professionalRole === undefined || user.professionalRole === null) {
      setLocation("/dashboard");
      return;
    }
    (async () => {
      try {
        const [phase1Res, phase2Res] = await Promise.allSettled([
          apiRequest("/api/certifications/platform/progress"),
          apiRequest("/api/certifications/procare_training/progress"),
        ]);

        const phase1: CertStatus =
          phase1Res.status === "fulfilled"
            ? {
                status:
                  (phase1Res.value as any)?.certification?.status === "completed"
                    ? "completed"
                    : (phase1Res.value as any)?.certification?.status === "in_progress"
                      ? "in_progress"
                      : "not_started",
                completedAt: (phase1Res.value as any)?.certification?.completedAt ?? null,
              }
            : { status: "not_started" };

        const phase2: CertStatus =
          phase2Res.status === "fulfilled"
            ? {
                status:
                  (phase2Res.value as any)?.certification?.status === "completed"
                    ? "completed"
                    : (phase2Res.value as any)?.certification?.status === "in_progress"
                      ? "in_progress"
                      : "not_started",
                completedAt: (phase2Res.value as any)?.certification?.completedAt ?? null,
              }
            : { status: "not_started" };

        setState({ phase1, phase2, loading: false });
      } catch {
        setState((s) => ({ ...s, loading: false }));
      }
    })();
  }, [user]);

  const phase1Complete = state.phase1.status === "completed";
  const phase2Complete = state.phase2.status === "completed";
  const studioUnlocked = phase1Complete && phase2Complete;

  const handleEnterStudio = () => {
    const route =
      user?.professionalRole === "physician" ? "/pro/physician-clients" : "/pro/clients";
    localStorage.setItem("mpm_active_space", "workspace");
    setLocation(route);
  };

  const handlePersonalOnboarding = () => {
    if (!user?.onboardingCompletedAt) {
      setLocation("/onboarding");
    } else {
      setLocation("/dashboard");
    }
  };

  if (state.loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 text-white">
      <div className="px-4 pt-12 pb-32 max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/20 rounded-full border border-orange-500/30 mb-4">
            <Rocket className="h-4 w-4 text-orange-400" />
            <span className="text-sm font-medium text-orange-300">Professional Launchpad</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Welcome to ProCare</h1>
          <p className="text-white/60 text-sm leading-relaxed max-w-xs mx-auto">
            Complete each step below to unlock your full ProCare Studio and start managing clients.
          </p>
        </div>

        {redirectMsg && (
          <div className="mb-6 p-4 rounded-xl border border-orange-400/30 bg-orange-900/20">
            <p className="text-sm text-orange-300 text-center">{redirectMsg}</p>
          </div>
        )}

        <div className="space-y-3 mb-8">
          <LaunchpadStep
            icon={<CheckCircle2 className="w-5 h-5" />}
            emoji="✅"
            title="Professional account created"
            description="Your ProCare account is active."
            state="complete"
          />

          <LaunchpadStep
            icon={<Star className="w-5 h-5" />}
            emoji="⭐"
            title="Activate your personal account"
            description="Strongly recommended — experience the app just like your clients."
            state={user?.onboardingCompletedAt ? "complete" : "available"}
            badge="Optional"
            cta={user?.onboardingCompletedAt ? undefined : "Set Up Personal Profile"}
            onCta={handlePersonalOnboarding}
          />

          <LaunchpadStep
            icon={<GraduationCap className="w-5 h-5" />}
            emoji="🎓"
            title="Complete the My Perfect Meals Academy — Phase 1"
            description="Learn the platform, earn your certification. Required to access the Studio."
            state={
              phase1Complete ? "complete" : state.phase1.status === "in_progress" ? "in_progress" : "available"
            }
            cta={phase1Complete ? undefined : state.phase1.status === "in_progress" ? "Continue Academy" : "Start Academy"}
            onCta={() => setLocation("/learning")}
          />

          <LaunchpadStep
            icon={<Monitor className="w-5 h-5" />}
            emoji="🖥"
            title="Complete ProCare Training — Phase 2"
            description="Required for professionals managing clients through ProCare. Unlocks after Phase 1."
            state={
              phase2Complete
                ? "complete"
                : phase1Complete
                  ? state.phase2.status === "in_progress"
                    ? "in_progress"
                    : "available"
                  : "locked"
            }
            cta={
              phase1Complete && !phase2Complete
                ? state.phase2.status === "in_progress"
                  ? "Continue Training"
                  : "Coming Soon"
                : undefined
            }
            onCta={phase1Complete && !phase2Complete ? () => setLocation("/learning") : undefined}
          />

          <LaunchpadStep
            icon={<Rocket className="w-5 h-5" />}
            emoji="🔓"
            title="Access your ProCare Studio"
            description="Manage clients, build meal plans, and run your professional practice."
            state={studioUnlocked ? "available" : "locked"}
            cta={studioUnlocked ? "Enter Studio" : undefined}
            onCta={studioUnlocked ? handleEnterStudio : undefined}
            highlight={studioUnlocked}
          />
        </div>

        {phase1Complete && (
          <div className="p-4 rounded-xl bg-emerald-900/20 border border-emerald-400/20 text-center">
            <p className="text-sm text-emerald-300 font-medium">
              🎉 Phase 1 Academy complete!
            </p>
            <p className="text-xs text-white/50 mt-1">
              Complete Phase 2 ProCare Training to unlock client management.
            </p>
          </div>
        )}

        {studioUnlocked && (
          <div className="p-4 rounded-xl bg-orange-900/20 border border-orange-400/20 text-center mt-3">
            <p className="text-sm text-orange-300 font-medium">
              🚀 You're fully certified — Studio access is unlocked!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

type StepState = "complete" | "in_progress" | "available" | "locked";

interface LaunchpadStepProps {
  icon: React.ReactNode;
  emoji: string;
  title: string;
  description: string;
  state: StepState;
  badge?: string;
  cta?: string;
  onCta?: () => void;
  highlight?: boolean;
}

function LaunchpadStep({
  emoji,
  title,
  description,
  state,
  badge,
  cta,
  onCta,
  highlight,
}: LaunchpadStepProps) {
  const isLocked = state === "locked";
  const isComplete = state === "complete";
  const isInProgress = state === "in_progress";

  const borderColor = highlight
    ? "border-orange-500/50"
    : isComplete
      ? "border-emerald-500/30"
      : isLocked
        ? "border-white/5"
        : "border-white/10";

  const bgColor = highlight
    ? "bg-orange-900/20"
    : isComplete
      ? "bg-emerald-900/10"
      : isLocked
        ? "bg-white/[0.02]"
        : "bg-white/5";

  return (
    <div className={`p-4 rounded-xl border ${borderColor} ${bgColor} transition-all`}>
      <div className="flex items-start gap-3">
        <div className="text-xl shrink-0 mt-0.5">{emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className={`text-sm font-semibold ${isLocked ? "text-white/30" : "text-white"}`}>
              {title}
            </p>
            {badge && (
              <span className="text-[9px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-white/10 text-white/50 border border-white/10">
                {badge}
              </span>
            )}
            {isComplete && (
              <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-400">
                <CheckCircle2 className="w-3 h-3" /> Done
              </span>
            )}
            {isInProgress && (
              <span className="text-[9px] font-semibold uppercase tracking-wide text-orange-400">
                In Progress
              </span>
            )}
            {isLocked && (
              <Lock className="w-3 h-3 text-white/20" />
            )}
          </div>
          <p className={`text-xs leading-relaxed mb-2 ${isLocked ? "text-white/20" : "text-white/50"}`}>
            {description}
          </p>
          {cta && onCta && !isLocked && (
            <PillButton
              onClick={onCta}
              variant={highlight ? "amber" : isComplete ? "emerald" : "emerald"}
              active={highlight || isComplete}
              className="text-[10px] px-3 py-1"
            >
              {cta}
            </PillButton>
          )}
        </div>
      </div>
    </div>
  );
}
