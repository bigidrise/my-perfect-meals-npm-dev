import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { PillButton } from "@/components/ui/pill-button";
import { motion } from "framer-motion";
import {
  Loader2, Trophy, Users, ClipboardList, GraduationCap,
  Briefcase, ArrowRight, TrendingUp, Star,
} from "lucide-react";

interface CertStatus {
  status: "not_started" | "in_progress" | "completed";
  completedAt?: string | null;
}

interface DashboardState {
  phase1: CertStatus;
  phase2: CertStatus;
  personalOnboardingDone: boolean;
  loading: boolean;
}

export default function ProfessionalDashboard() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [state, setState] = useState<DashboardState>({
    phase1: { status: "not_started" },
    phase2: { status: "not_started" },
    personalOnboardingDone: false,
    loading: true,
  });

  useEffect(() => {
    const msg = sessionStorage.getItem("mpm.launchpad.redirectMsg");
    if (msg) sessionStorage.removeItem("mpm.launchpad.redirectMsg");
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!user.professionalRole) {
      setLocation("/dashboard");
      return;
    }

    // Admins bypass all certification gates
    if (user.isAdmin) {
      setState({
        phase1: { status: "completed", completedAt: new Date().toISOString() },
        phase2: { status: "completed", completedAt: new Date().toISOString() },
        personalOnboardingDone: true,
        loading: false,
      });
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

        setState({
          phase1,
          phase2,
          personalOnboardingDone: !!user.onboardingCompletedAt,
          loading: false,
        });
      } catch {
        setState((s) => ({ ...s, loading: false }));
      }
    })();
  }, [user]);

  if (state.loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  const phase1Complete = state.phase1.status === "completed";
  const phase2Complete = state.phase2.status === "completed";
  const isCertified = phase1Complete && phase2Complete;

  if (!isCertified) {
    return <ResumeCertification
      user={user}
      phase1={state.phase1}
      phase2={state.phase2}
      personalDone={state.personalOnboardingDone}
      onContinue={() => setLocation("/professional-onboarding-bridge")}
    />;
  }

  return <CertifiedDashboard user={user} onEnterStudio={() => {
    localStorage.setItem("mpm_active_space", "workspace");
    const route = user?.professionalRole === "physician" ? "/pro/physician-clients" : "/pro/clients";
    setLocation(route);
  }} />;
}

function ResumeCertification({
  user,
  phase1,
  phase2,
  personalDone,
  onContinue,
}: {
  user: any;
  phase1: CertStatus;
  phase2: CertStatus;
  personalDone: boolean;
  onContinue: () => void;
}) {
  const totalSteps = 3;
  const completedSteps =
    (personalDone ? 1 : 0) +
    (phase1.status === "completed" ? 1 : 0) +
    (phase2.status === "completed" ? 1 : 0);
  const pct = Math.round((completedSteps / totalSteps) * 100);

  const firstName = (user?.name || user?.email || "").split(" ")[0] || "Professional";

  const currentLesson =
    !personalDone
      ? "Personal Profile Setup"
      : phase1.status !== "completed"
        ? "Phase 1 — Platform Fundamentals"
        : "Phase 2 — Business & ProCare Success";

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 text-white flex flex-col">
      <div className="flex-1 px-4 pt-16 pb-32 max-w-lg mx-auto w-full">
        <motion.div className="text-center mb-8" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-white/50 text-sm mb-1">Welcome back{firstName ? `, ${firstName}` : ""}.</p>
          <h1 className="text-2xl font-black mb-2">Professional Certification</h1>

          {/* Progress bar */}
          <div className="mx-auto max-w-xs mb-2">
            <div className="flex justify-between text-xs text-white/50 mb-1">
              <span>{pct}% Complete</span>
              <span>Step {completedSteps} of {totalSteps}</span>
            </div>
            <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-white/40 mt-2">
            Current: <span className="text-orange-300 font-medium">{currentLesson}</span>
          </p>
        </motion.div>

        <motion.div className="space-y-3 mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <StepRow
            number="1"
            label="Personal Profile"
            sublabel="Experience MPM as a user"
            done={personalDone}
            inProgress={!personalDone}
          />
          <StepRow
            number="2"
            label="Phase 1 — Platform Fundamentals"
            sublabel="Master every platform feature"
            done={phase1.status === "completed"}
            inProgress={phase1.status === "in_progress" && personalDone}
            locked={!personalDone && phase1.status !== "completed"}
          />
          <StepRow
            number="3"
            label="Phase 2 — Business & ProCare Success"
            sublabel="Build and grow your practice"
            done={phase2.status === "completed"}
            inProgress={phase2.status === "in_progress" && phase1.status === "completed"}
            locked={phase1.status !== "completed"}
          />
        </motion.div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
        <button
          onClick={onContinue}
          className="w-full h-14 font-bold rounded-2xl bg-orange-600 text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          Continue Certification
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function StepRow({
  number, label, sublabel, done, inProgress, locked,
}: {
  number: string;
  label: string;
  sublabel: string;
  done?: boolean;
  inProgress?: boolean;
  locked?: boolean;
}) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
      done ? "bg-emerald-900/10 border-emerald-500/30" :
      inProgress ? "bg-orange-900/10 border-orange-500/30" :
      locked ? "bg-white/[0.02] border-white/5 opacity-50" :
      "bg-black/20 border-white/10"
    }`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-black ${
        done ? "bg-emerald-500/20 text-emerald-400" :
        inProgress ? "bg-orange-500/20 text-orange-400" :
        "bg-white/10 text-white/30"
      }`}>
        {done ? "✓" : number}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${locked ? "text-white/30" : "text-white"}`}>{label}</p>
        <p className={`text-xs mt-0.5 ${locked ? "text-white/20" : "text-white/50"}`}>{sublabel}</p>
      </div>
      {inProgress && (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20">
          In Progress
        </span>
      )}
    </div>
  );
}

function CertifiedDashboard({ user, onEnterStudio }: { user: any; onEnterStudio: () => void }) {
  const [, setLocation] = useLocation();
  const firstName = (user?.name || user?.email || "").split(" ")[0] || "Professional";

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 text-white overflow-y-auto pb-36"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="px-4 pt-14 max-w-lg mx-auto">
        <motion.div className="flex items-center gap-3 mb-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="w-12 h-12 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <p className="text-white/50 text-xs">Welcome back, {firstName}</p>
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-black">Professional Dashboard</h1>
              <Star className="w-3.5 h-3.5 text-orange-400 fill-orange-400" />
            </div>
            <p className="text-[10px] text-emerald-400 font-semibold">Certified My Perfect Meals Professional</p>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {[
            { icon: Users, label: "Client Studio", sub: "Manage clients & meal plans", route: user?.professionalRole === "physician" ? "/pro/physician-clients" : "/pro/clients", accent: "bg-orange-500/20", iconColor: "text-orange-400" },
            { icon: Briefcase, label: "Business Suite", sub: "Affiliate, Academy, Partners", route: "/business-center", accent: "bg-blue-500/20", iconColor: "text-blue-400" },
            { icon: GraduationCap, label: "Certifications", sub: "View & expand your training", route: "/business-center/academy", accent: "bg-emerald-500/20", iconColor: "text-emerald-400" },
            { icon: TrendingUp, label: "Affiliate Program", sub: "Earn 25% per referral", route: "/business-center/affiliate", accent: "bg-amber-500/20", iconColor: "text-amber-400" },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.button
                key={i}
                onClick={() => setLocation(item.route)}
                className="text-left p-4 rounded-2xl bg-black/30 border border-white/10 active:scale-[0.97] transition-transform"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.06 }}
              >
                <div className={`w-9 h-9 rounded-xl ${item.accent} flex items-center justify-center mb-2`}>
                  <Icon className={`w-5 h-5 ${item.iconColor}`} />
                </div>
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="text-xs text-white/50 mt-0.5 leading-snug">{item.sub}</p>
              </motion.button>
            );
          })}
        </div>

        <motion.div
          className="p-4 rounded-2xl bg-black/30 border border-orange-500/20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <p className="text-xs font-semibold text-orange-400 mb-2">Quick Links</p>
          <div className="space-y-2">
            {[
              { label: "📋 Questionnaires", route: user?.professionalRole === "physician" ? "/pro/physician-clients" : "/pro/clients" },
              { label: "📊 Business Center", route: "/business-center" },
              { label: "🎓 My Certifications", route: "/business-center/academy" },
              { label: "💰 Affiliate Dashboard", route: "/business-center/affiliate/dashboard" },
            ].map((link, i) => (
              <button
                key={i}
                onClick={() => setLocation(link.route)}
                className="w-full text-left px-3 py-2 rounded-xl bg-white/5 text-sm text-white/70 active:scale-[0.98] transition-transform"
              >
                {link.label}
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
        <button
          onClick={onEnterStudio}
          className="w-full h-14 font-bold rounded-2xl bg-orange-600 text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          Enter Client Studio
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}
