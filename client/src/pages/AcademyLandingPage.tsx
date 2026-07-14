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
  LayoutDashboard,
  ChefHat,
  Leaf,
  MoreHorizontal,
  Layers,
  Lock,
  Loader2,
  Star,
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

const PLATFORM_MASTERY_LESSONS = [
  {
    number: "01",
    title: "Getting Started",
    description: "What My Perfect Meals is, who it serves, and how to set up your profile so the platform personalizes intelligently from day one.",
    icon: BookOpen,
  },
  {
    number: "02",
    title: "Your Dashboard",
    description: "Reading your macro dashboard, understanding daily targets, and using the nutrition summary to make better food decisions throughout the day.",
    icon: LayoutDashboard,
  },
  {
    number: "03",
    title: "The Meal Builders",
    description: "Every creator tool — Create a Dish, Chef's Kitchen, Snack Creator, Beverage Creator, Fridge Rescue, Craving Creator, and Meal Planner.",
    icon: ChefHat,
  },
  {
    number: "04",
    title: "Lifestyle & Tracking",
    description: "Biometrics, meal logging, dietary preferences, medical guardrails, cultural identity, and how personalization adapts to your real life.",
    icon: Leaf,
  },
  {
    number: "05",
    title: "More Features",
    description: "Restaurant guide, Recipe Scan, Ingredient Intelligence, shopping lists, and the full breadth of tools beyond core meal generation.",
    icon: MoreHorizontal,
  },
  {
    number: "06",
    title: "The Hub",
    description: "Putting it all together — how the platform's features connect, daily routines that work, and how to get the most from every session.",
    icon: Layers,
  },
];

const CERTIFICATION_PATHS = [
  {
    icon: "🥉",
    label: "Platform Mastery",
    sublabel: "6 lessons · 80% to advance",
    available: true,
  },
  {
    icon: "📈",
    label: "Marketing & Coaching",
    sublabel: "Coming soon",
    available: false,
  },
  {
    icon: "🩺",
    label: "ProCare Certification",
    sublabel: "3 training videos",
    available: true,
  },
];

const SPECIALIZE_TOPICS = [
  { icon: "🩺", label: "Diabetes Nutrition" },
  { icon: "💉", label: "GLP-1 Support" },
  { icon: "👩‍⚕️", label: "Women's Health" },
  { icon: "🏋️", label: "Performance Nutrition" },
  { icon: "🎗️", label: "Oncology Support" },
  { icon: "👶", label: "Pediatrics" },
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
          <h1 className="text-lg font-bold text-white">MPM Academy</h1>
        </div>
      </div>

      <div
        className="px-4 max-w-2xl mx-auto space-y-5"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        <button
          onClick={() => setLocation("/business-center/partners")}
          className="flex items-center gap-1.5 text-orange-400 text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Partner Programs
        </button>

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
              My Perfect Meals Academy
            </h2>
            <p className="text-orange-400 text-sm font-medium mt-1">
              Learn. Become Certified. Specialize.
            </p>
          </div>
          <p className="text-white/55 text-sm leading-relaxed max-w-sm mx-auto">
            One lesson. One source of truth. The difference between a casual learner and a
            certification candidate is the enrollment record — not the content.
          </p>
        </motion.div>

        {/* ── LEARN ── */}
        <motion.div
          className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="px-5 pt-5 pb-4 border-b border-white/8">
            <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-1">
              Learn
            </p>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white">Platform Mastery</h3>
                <p className="text-xs text-white/50 mt-1">
                  Open to everyone · No certification required
                </p>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 flex-shrink-0">
                <span className="text-orange-300 text-xs font-semibold">6 lessons</span>
              </div>
            </div>
          </div>

          <div className="divide-y divide-white/5">
            {PLATFORM_MASTERY_LESSONS.map((lesson, i) => {
              const Icon = lesson.icon;
              return (
                <motion.div
                  key={lesson.number}
                  className="px-5 py-3.5 flex items-start gap-3"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.14 + i * 0.05 }}
                >
                  <div className="p-1.5 rounded-lg bg-orange-500/15 flex-shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5 text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-white/25">{lesson.number}</span>
                      <span className="text-sm font-semibold text-white leading-snug">{lesson.title}</span>
                    </div>
                    <p className="text-xs text-white/45 mt-0.5 leading-relaxed">{lesson.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="px-5 py-4 bg-orange-500/8 border-t border-orange-500/20">
            <button
              onClick={() => setLocation("/certifications/platform")}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-600 text-white font-semibold text-sm active:scale-[0.98] transition-transform"
            >
              <BookOpen className="h-4 w-4" />
              Start Learning
              <ChevronRight className="h-4 w-4 opacity-70" />
            </button>
            <p className="text-center text-white/30 text-xs mt-2">
              Platform exercises included · Optional quiz after each lesson
            </p>
          </div>
        </motion.div>

        {/* ── BECOME CERTIFIED ── */}
        <motion.div
          className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.46 }}
        >
          <div className="px-5 pt-5 pb-4 border-b border-white/8">
            <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-1">
              Become Certified
            </p>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white">Certification Path</h3>
                <p className="text-xs text-white/50 mt-1">
                  For coaches, trainers, healthcare professionals, and partners
                </p>
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
                <CertPathRow
                  icon="🥉"
                  label="Platform Mastery"
                  sublabel="6 lessons · 80% quiz score required"
                  done={progress.phase1Done}
                  score={progress.phase1Score}
                  available
                  onGo={() => setLocation("/certifications/platform")}
                />
                <CertPathRow
                  icon="📈"
                  label="Marketing & Coaching"
                  sublabel="Coming soon"
                  done={false}
                  available={false}
                />
                <CertPathRow
                  icon="🩺"
                  label="ProCare Certification"
                  sublabel="3 training videos"
                  done={progress.phase2Done}
                  available
                  onGo={() => setLocation("/procare-training")}
                />
              </>
            )}
          </div>

          {!progress.loading && (
            <div className="px-5 pb-4 pt-2 border-t border-white/8 space-y-3">
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/8">
                <p className="text-xs text-white/50 leading-relaxed text-center">
                  Complete all three to earn:{" "}
                  <span className="text-orange-300 font-semibold">
                    Certified My Perfect Meals Professional
                  </span>
                </p>
              </div>
              {!allRequired ? (
                <button
                  onClick={() => setLocation("/professional-onboarding-bridge")}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-600 text-white font-semibold text-sm active:scale-[0.98] transition-transform"
                >
                  <Star className="h-4 w-4" />
                  Start Certification Path
                  <ChevronRight className="h-4 w-4 opacity-70" />
                </button>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-900/20 border border-emerald-500/25">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  <p className="text-sm font-semibold text-emerald-300">
                    All certifications complete
                  </p>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* ── SPECIALIZE ── */}
        <motion.div
          className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.56 }}
        >
          <div className="px-5 pt-5 pb-4 border-b border-white/8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-1">
                  Specialize
                </p>
                <h3 className="text-base font-bold text-white">Clinical Deep Dives</h3>
                <p className="text-xs text-white/50 mt-1">
                  Earn a specialty designation for each clinical area you master
                </p>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 flex-shrink-0">
                <span className="text-white/50 text-xs font-semibold">Coming Soon</span>
              </div>
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="grid grid-cols-2 gap-2">
              {SPECIALIZE_TOPICS.map((topic, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/8 opacity-50"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 0.5, y: 0 }}
                  transition={{ delay: 0.6 + i * 0.04 }}
                >
                  <span className="text-base">{topic.icon}</span>
                  <p className="text-xs font-medium text-white/60 leading-tight">{topic.label}</p>
                  <Lock className="h-3 w-3 text-white/20 ml-auto shrink-0" />
                </motion.div>
              ))}
            </div>
            <p className="text-center text-white/25 text-xs mt-4 leading-relaxed">
              Specialty certifications unlock as each clinical program is released.
              Foundational certification must be complete first.
            </p>
          </div>
        </motion.div>

        {/* Philosophy note */}
        <motion.div
          className="p-4 rounded-2xl bg-orange-500/8 border border-orange-500/20"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.68 }}
        >
          <div className="flex items-start gap-2.5">
            <Users className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-orange-200/80 leading-relaxed">
              After you earn your certification, everything stays accessible. Come back to any lesson
              anytime — no retest, no penalty. As the platform grows, the Academy grows with it.
            </p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function CertPathRow({
  icon,
  label,
  sublabel,
  done,
  score,
  available,
  onGo,
}: {
  icon: string;
  label: string;
  sublabel: string;
  done: boolean;
  score?: number | null;
  available: boolean;
  onGo?: () => void;
}) {
  const badge = done && score != null ? certBadge(score) : null;

  return (
    <button
      onClick={available && !done && onGo ? onGo : undefined}
      disabled={!available}
      className={`w-full flex items-center gap-3 text-left transition-opacity ${available && !done && onGo ? "active:opacity-70" : ""} ${!available ? "opacity-40 cursor-default" : ""}`}
    >
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.06] border border-white/10 text-base">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${done ? "text-white" : available ? "text-white/80" : "text-white/40"}`}>
          {label}
        </p>
        <p className="text-xs text-white/40 leading-snug">{sublabel}</p>
      </div>
      {done ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
      ) : available ? (
        <Circle className="w-5 h-5 text-white/20 shrink-0" />
      ) : (
        <Lock className="w-4 h-4 text-white/15 shrink-0" />
      )}
      {badge && (
        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold flex-shrink-0 ${badge.color}`}>
          <span>{badge.icon}</span>
          <span className="hidden sm:inline">{badge.label}</span>
        </div>
      )}
      {available && !done && onGo && (
        <ChevronRight className="w-4 h-4 text-white/20 shrink-0" />
      )}
    </button>
  );
}
