import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  GraduationCap,
  Users,
  CheckCircle2,
  Circle,
  ChevronRight,
  BookOpen,
  TrendingUp,
  Brain,
  Utensils,
  HeartHandshake,
  Lock,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";

function certBadge(score: number | null | undefined) {
  if (score == null) return null;
  if (score >= 95) return { label: "Master Professional", icon: "🥇", color: "text-amber-400 border-amber-400/40 bg-amber-400/10" };
  if (score >= 90) return { label: "Advanced Professional", icon: "🥈", color: "text-slate-200 border-slate-400/40 bg-slate-400/10" };
  return { label: "Certified Professional", icon: "🥉", color: "text-orange-400 border-orange-500/40 bg-orange-500/10" };
}

const ADVANCED_CERTS = [
  { icon: "🩺", label: "Diabetes Specialist" },
  { icon: "💉", label: "GLP-1 Coaching" },
  { icon: "👩‍⚕️", label: "Women's Health" },
  { icon: "👶", label: "Pediatrics" },
  { icon: "🏋️", label: "Sports Performance" },
  { icon: "🎗️", label: "Oncology Support" },
];

const PHASE1_MODULES = [
  {
    number: "01",
    title: "What is My Perfect Meals?",
    description:
      "The history, mission, and vision — who MPM serves and why it exists differently from every other nutrition tool.",
    icon: BookOpen,
  },
  {
    number: "02",
    title: "How the Platform Works",
    description:
      "Every feature, every builder, navigation, the dashboard, macro calculator, restaurant guide, Recipe Scan, Ingredient Intelligence, Fridge Rescue, and more.",
    icon: Utensils,
  },
  {
    number: "03",
    title: "Adaptive Nutrition",
    description:
      "Why My Perfect Meals personalizes differently than generic AI tools — medical guardrails, dietary identity, cultural preferences, and behavioral context.",
    icon: Brain,
  },
  {
    number: "04",
    title: "How to Market My Perfect Meals",
    description:
      "What to say, what not to say, how to explain the AI, personalization, restaurants, and Recipe Scan — without making weight-loss claims or medical promises.",
    icon: TrendingUp,
  },
  {
    number: "05",
    title: "Behavior, Psychology, and Working With People",
    description:
      "Client communication, behavior change, habit formation, and how to help people actually use the platform in their real lives.",
    icon: HeartHandshake,
  },
];

const PHASE2_TOPICS = [
  "Inviting and managing clients",
  "Care Team setup and collaboration",
  "Client Portal and client view",
  "Client folders and organization",
  "Biometrics tracking and review",
  "Provider Notes and documentation",
  "Dashboard and workflow overview",
];

interface CertProgress {
  personalDone: boolean;
  phase1Done: boolean;
  phase1Score: number | null;
  phase2Done: boolean;
  loading: boolean;
}

export default function AcademyLandingPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isProfessional = !!(user?.professionalRole || user?.isProCare);

  const [progress, setProgress] = useState<CertProgress>({
    personalDone: false,
    phase1Done: false,
    phase1Score: null,
    phase2Done: false,
    loading: true,
  });

  useEffect(() => {
    if (!isProfessional) {
      setProgress((p) => ({ ...p, loading: false }));
      return;
    }
    (async () => {
      try {
        const [p1Res, p2Res] = await Promise.allSettled([
          apiRequest("/api/certifications/platform/progress"),
          apiRequest("/api/certifications/procare_training/progress"),
        ]);
        const phase1Done =
          p1Res.status === "fulfilled" &&
          (p1Res.value as any)?.certification?.status === "completed";
        const phase1Score =
          p1Res.status === "fulfilled"
            ? ((p1Res.value as any)?.certification?.score ?? null)
            : null;
        const phase2Done =
          p2Res.status === "fulfilled" &&
          (p2Res.value as any)?.certification?.status === "completed";
        setProgress({
          personalDone: !!user?.onboardingCompletedAt,
          phase1Done,
          phase1Score,
          phase2Done,
          loading: false,
        });
      } catch {
        setProgress((p) => ({ ...p, loading: false }));
      }
    })();
  }, [isProfessional, user?.onboardingCompletedAt]);

  const allRequired = progress.personalDone && progress.phase1Done && progress.phase2Done;
  const badge = allRequired ? certBadge(progress.phase1Score) : null;

  return (
    <motion.div
      className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} pb-28`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div
        className={`fixed top-0 left-0 right-0 z-50 ${BC_HEADER}`}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => setLocation("/business-center/partners")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
          >
            <ArrowLeft className="h-4 w-4" />
            Partner Programs
          </button>
          <h1 className="text-lg font-bold text-white">Professional Learning Center</h1>
        </div>
      </div>

      <div
        className="px-4 max-w-2xl mx-auto space-y-5"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        {/* Hero */}
        <motion.div
          className="text-center py-4 space-y-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="flex justify-center">
            <div className="p-4 rounded-2xl bg-orange-500/15 border border-orange-500/25">
              <GraduationCap className="h-10 w-10 text-orange-400" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white leading-tight">
              Professional Learning Center
            </h2>
            <p className="text-orange-400 text-sm font-medium mt-1">
              Certify. Specialize. Keep Growing.
            </p>
          </div>
          <p className="text-white/60 text-sm leading-relaxed max-w-sm mx-auto">
            Every certification you earn is permanently recorded and builds toward a professional
            credential that grows with the platform.
          </p>
        </motion.div>

        {/* Required — with live status for professionals */}
        <motion.div
          className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="px-5 pt-5 pb-4 border-b border-white/8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-1">
                  Required
                </p>
                <h3 className="text-base font-bold text-white">Foundational Certifications</h3>
                <p className="text-xs text-white/50 mt-1">Required for all ProCare professionals</p>
              </div>
              {allRequired && badge && (
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold flex-shrink-0 ${badge.color}`}>
                  <span>{badge.icon}</span>
                  <span className="hidden sm:inline">{badge.label}</span>
                </div>
              )}
            </div>
          </div>

          <div className="px-5 py-4 space-y-3">
            {progress.loading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
              </div>
            ) : (
              <>
                <RequiredRow
                  label="Personal Experience"
                  sublabel="Complete your own My Perfect Meals profile"
                  done={progress.personalDone}
                  onGo={isProfessional ? () => setLocation("/onboarding") : undefined}
                />
                <RequiredRow
                  label="Phase 1 — Platform Fundamentals"
                  sublabel="Master every feature of the platform"
                  done={progress.phase1Done}
                  score={progress.phase1Score}
                  onGo={() => setLocation("/certifications/platform")}
                />
                <RequiredRow
                  label="Phase 2 — Business & ProCare Success"
                  sublabel="Build and grow your professional practice"
                  done={progress.phase2Done}
                  onGo={() => setLocation("/procare-training")}
                />
              </>
            )}
          </div>

          {!progress.loading && !allRequired && (
            <div className="px-5 pb-4">
              <button
                onClick={() => setLocation("/professional-onboarding-bridge")}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-600 text-white font-semibold text-sm active:scale-[0.98] transition-transform"
              >
                Continue Certification
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {!progress.loading && allRequired && (
            <div className="px-5 pb-4 pt-1 bg-emerald-900/10 border-t border-emerald-500/20">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                <p className="text-sm font-semibold text-emerald-300">
                  All required certifications complete
                </p>
              </div>
            </div>
          )}
        </motion.div>

        {/* Advanced */}
        <motion.div
          className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
        >
          <div className="px-5 pt-5 pb-4 border-b border-white/8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-1">
                  Advanced
                </p>
                <h3 className="text-base font-bold text-white">Specialty Certifications</h3>
                <p className="text-xs text-white/50 mt-1">
                  Deep clinical specializations — each adds a new designation to your profile
                </p>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 flex-shrink-0">
                <span className="text-white/50 text-xs font-semibold">Coming Soon</span>
              </div>
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="grid grid-cols-2 gap-2">
              {ADVANCED_CERTS.map((cert, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/8 opacity-50"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 0.5, y: 0 }}
                  transition={{ delay: 0.22 + i * 0.04 }}
                >
                  <span className="text-base">{cert.icon}</span>
                  <p className="text-xs font-medium text-white/60 leading-tight">{cert.label}</p>
                  <Lock className="h-3 w-3 text-white/20 ml-auto shrink-0" />
                </motion.div>
              ))}
            </div>
            <p className="text-center text-white/25 text-xs mt-4 leading-relaxed">
              Advanced certifications will unlock as each specialty program is released.
              Required certifications must be complete first.
            </p>
          </div>
        </motion.div>

        {/* Phase 1 curriculum detail */}
        <motion.div
          className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
        >
          <div className="px-5 pt-5 pb-4 border-b border-white/8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-1">
                  Phase 1 Curriculum
                </p>
                <h3 className="text-base font-bold text-white">Platform Fundamentals</h3>
                <p className="text-xs text-white/50 mt-1">Required for all partners and professionals</p>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 flex-shrink-0">
                <span className="text-orange-300 text-xs font-semibold">5 modules</span>
              </div>
            </div>
          </div>

          <div className="divide-y divide-white/5">
            {PHASE1_MODULES.map((mod, i) => {
              const Icon = mod.icon;
              return (
                <motion.div
                  key={mod.number}
                  className="px-5 py-3.5 flex items-start gap-3"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.32 + i * 0.05 }}
                >
                  <div className="p-1.5 rounded-lg bg-orange-500/15 flex-shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5 text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-white/25">{mod.number}</span>
                      <span className="text-sm font-semibold text-white leading-snug">{mod.title}</span>
                    </div>
                    <p className="text-xs text-white/45 mt-0.5 leading-relaxed">{mod.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="px-5 py-4 bg-orange-500/10 border-t border-orange-500/20">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-orange-400 flex-shrink-0" />
              <p className="text-sm font-semibold text-orange-300">
                Complete Phase 1 → Earn your MPM Certification
              </p>
            </div>
          </div>
        </motion.div>

        {/* Phase 2 curriculum detail */}
        <motion.div
          className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
        >
          <div className="px-5 pt-5 pb-4 border-b border-white/8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-1">
                  Phase 2 Curriculum
                </p>
                <h3 className="text-base font-bold text-white">Business & ProCare Success</h3>
                <p className="text-xs text-white/50 mt-1">
                  Only for professionals managing clients through ProCare
                </p>
              </div>
            </div>
          </div>

          <div className="px-5 py-4 space-y-2">
            <p className="text-xs text-white/50 leading-relaxed mb-3">
              Physicians, dietitians, coaches, trainers, nurse practitioners, health coaches, and
              any professional using ProCare to manage clients complete this before going live.
            </p>
            {PHASE2_TOPICS.map((topic, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-white/30 flex-shrink-0" />
                <span className="text-sm text-white/70">{topic}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Philosophy */}
        <motion.div
          className="p-4 rounded-2xl bg-orange-500/8 border border-orange-500/20"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.44 }}
        >
          <div className="flex items-start gap-2.5">
            <Users className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-orange-200/80 leading-relaxed">
              After you earn your certification, everything stays accessible. Come back to any lesson
              anytime — no retest, no penalty. As the platform grows, the Learning Center grows with it.
            </p>
          </div>
        </motion.div>

        {/* CTA */}
        {!progress.loading && !allRequired && (
          <motion.div
            className="space-y-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.48 }}
          >
            <button
              onClick={() => setLocation("/professional-onboarding-bridge")}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-orange-600 active:bg-orange-700 active:scale-[0.98] transition-all duration-150 font-semibold text-white text-sm"
            >
              <GraduationCap className="h-5 w-5" />
              Continue Certification
              <ChevronRight className="h-4 w-4 opacity-70" />
            </button>
            <p className="text-center text-white/30 text-xs pb-2">
              Already certified? Your progress and certificate are saved automatically.
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function RequiredRow({
  label,
  sublabel,
  done,
  score,
  onGo,
}: {
  label: string;
  sublabel: string;
  done: boolean;
  score?: number | null;
  onGo?: () => void;
}) {
  const badge = done && score != null ? certBadge(score) : null;

  return (
    <button
      onClick={done ? undefined : onGo}
      className={`w-full flex items-center gap-3 text-left transition-opacity ${!done && onGo ? "active:opacity-70" : ""}`}
    >
      {done ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
      ) : (
        <Circle className="w-5 h-5 text-white/20 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${done ? "text-white" : "text-white/60"}`}>{label}</p>
        <p className="text-xs text-white/40 leading-snug">{sublabel}</p>
      </div>
      {badge && (
        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold flex-shrink-0 ${badge.color}`}>
          <span>{badge.icon}</span>
          <span className="hidden sm:inline">{badge.label}</span>
        </div>
      )}
      {!done && onGo && (
        <ChevronRight className="w-4 h-4 text-white/20 shrink-0" />
      )}
    </button>
  );
}
