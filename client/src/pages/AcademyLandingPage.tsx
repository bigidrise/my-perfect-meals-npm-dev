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
  Bell,
  X,
  Megaphone,
  Target,
  TrendingUp,
  MessageSquare,
  BarChart2,
  Repeat,
  PlayCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import type { AcademyProgression } from "@shared/academyProgression";

function certBadge(score: number | null | undefined) {
  if (score == null) return null;
  if (score >= 95) return { label: "Master Professional", icon: "🥇", color: "text-amber-400 border-amber-400/40 bg-amber-400/10" };
  if (score >= 90) return { label: "Advanced Professional", icon: "🥈", color: "text-slate-200 border-slate-400/40 bg-slate-400/10" };
  return { label: "Certified Professional", icon: "🥉", color: "text-orange-400 border-orange-500/40 bg-orange-500/10" };
}

const PLATFORM_MASTERY_LESSONS = [
  {
    number: "01",
    title: "Your Profile Is Your Protocol",
    description: "How onboarding shapes every meal, macro target, and recommendation — and why a complete profile is the most important step.",
    icon: BookOpen,
  },
  {
    number: "02",
    title: "Meal Builders — Choosing the Right Tool",
    description: "Every meal creation tool on the platform — Create a Dish, Chef's Kitchen, Snack Creator, Beverage Creator, Craving Creator, Recipe Maker, Fridge Rescue, and more — with a scenario matrix for choosing the right tool.",
    icon: LayoutDashboard,
  },
  {
    number: "03",
    title: "Planning Your Week",
    description: "How to populate the weekly board, use the Remaining Macros bar, apply Duplicate and Replace, and build a realistic meal plan you will actually follow.",
    icon: ChefHat,
  },
  {
    number: "04",
    title: "Shopping & Your Grocery Scope",
    description: "Smart Grocery List, Grocery Coach, Product Scan (Ingredient Intelligence), and Fridge Rescue — getting your plan from the board to your kitchen.",
    icon: Leaf,
  },
  {
    number: "05",
    title: "Eating Away From Home",
    description: "Restaurant Guide, Fast Food Guide, and Find Meals Near Me — using your profile when you're not cooking at home.",
    icon: MoreHorizontal,
  },
  {
    number: "06",
    title: "Biometrics & Progress Tracking",
    description: "Logging biometric data, reading your trends, and using My Hub to monitor progress and keep your profile current.",
    icon: BarChart2,
  },
  {
    number: "07",
    title: "Specialized Health & Performance Systems",
    description: "Clinical and performance programs — GlucoseGuard, GLP-1 tolerance, Anti-Inflammatory Protocol, Oncology Support, and Performance Nutrition — plus how the protocol priority hierarchy resolves competing programs.",
    icon: Users,
  },
  {
    number: "08",
    title: "AI Adaptation & Your Boundaries",
    description: "How the protocol hierarchy works, what the AI guarantees vs. estimates, macro truth enforcement, and where you remain in control.",
    icon: Star,
  },
  {
    number: "09",
    title: "Marketing & Brand Standards",
    description: "Approved descriptions, prohibited claims, required disclaimers, social media compliance rules, and how the Partner Center referral tools work.",
    icon: Megaphone,
  },
];

const MARKETING_COACHING_MODULES = [
  {
    icon: Megaphone,
    title: "Building Your Brand",
    description: "How to position yourself as a nutrition professional and create a consistent presence clients trust.",
  },
  {
    icon: Target,
    title: "Finding Your Clients",
    description: "Lead generation strategies for coaches and healthcare professionals — organic, referral, and digital.",
  },
  {
    icon: MessageSquare,
    title: "Sales & Discovery Calls",
    description: "Turning interested prospects into enrolled clients with confidence and without pressure.",
  },
  {
    icon: TrendingUp,
    title: "Pricing & Packaging",
    description: "Structuring your services so clients understand the value — and you get paid what you're worth.",
  },
  {
    icon: BarChart2,
    title: "Results That Market Themselves",
    description: "Using client outcomes, before/afters, and testimonials ethically and effectively.",
  },
  {
    icon: Repeat,
    title: "Client Retention",
    description: "Long-term relationship strategies that keep clients engaged, accountable, and referring others.",
  },
];

type MarketingStatus = "unknown" | "waitlisted" | "in_progress" | "completed";

type LessonStatus = "not_started" | "in_progress" | "completed" | "quiz_failed";

interface CertProgress {
  personalDone: boolean;
  phase1Done: boolean;
  phase1Score: number | null;
  phase2Done: boolean;
  marketingStatus: MarketingStatus;
  loading: boolean;
}

export default function AcademyLandingPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const isProfessional = !!(user?.professionalRole || user?.isProCare);

  const [progress, setProgress] = useState<CertProgress>({
    personalDone: false,
    phase1Done: false,
    phase1Score: null,
    phase2Done: false,
    marketingStatus: "unknown",
    loading: true,
  });

  const [showMarketingModal, setShowMarketingModal] = useState(false);
  const [academyProgression, setAcademyProgression] =
    useState<AcademyProgression | null>(null);
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);

  const [lessonStatuses, setLessonStatuses] = useState<LessonStatus[]>(
    Array(PLATFORM_MASTERY_LESSONS.length).fill("not_started")
  );
  const [lessonLoading, setLessonLoading] = useState(true);

  useEffect(() => {
    document.title = "MPM Academy | My Perfect Meals";
    return () => { document.title = "My Perfect Meals"; };
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const d = await apiRequest("/api/academy/platform-mastery/status");
        const prog = (d as any).progress ?? {};
        const statuses: LessonStatus[] = PLATFORM_MASTERY_LESSONS.map((_, i) => {
          return (prog[`lesson-0${i + 1}`]?.status as LessonStatus) ?? "not_started";
        });
        setLessonStatuses(statuses);
      } catch {
        // silently ignore — lessons will show as not_started
      } finally {
        setLessonLoading(false);
      }
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!user) {
      setProgress((p) => ({ ...p, loading: false }));
      return;
    }
    (async () => {
      try {
        const [progressionRes, mcRes] = await Promise.allSettled([
          apiRequest("/api/certifications/academy-progression"),
          apiRequest("/api/certifications/marketing_coaching/progress"),
        ]);

        const resolved =
          progressionRes.status === "fulfilled"
            ? (progressionRes.value as AcademyProgression)
            : null;
        setAcademyProgression(resolved);
        const mcStatus: MarketingStatus =
          mcRes.status === "fulfilled"
            ? (((mcRes.value as any)?.certification?.status ?? "unknown") as MarketingStatus)
            : "unknown";
        setProgress({
          personalDone: !!user?.onboardingCompletedAt,
          phase1Done: resolved?.phase1.complete ?? false,
          phase1Score: null,
          phase2Done: resolved?.proCare.complete ?? false,
          marketingStatus: mcStatus,
          loading: false,
        });
      } catch {
        setProgress((p) => ({ ...p, loading: false }));
      }
    })();
  }, [user?.id, user?.onboardingCompletedAt]);

  const hasAnyLessonProgress = lessonStatuses.some(
    (s) => s === "in_progress" || s === "completed"
  );

  const allRequired =
    academyProgression?.specialist.complete === true ||
    academyProgression?.specialist.eligible === true;
  const badge = allRequired ? certBadge(progress.phase1Score) : null;

  const marketingDone = progress.marketingStatus === "completed";
  const marketingInProgress = progress.marketingStatus === "in_progress";
  const marketingWaitlisted = progress.marketingStatus === "waitlisted";

  function getContinueLearningDestination(): { route: string; label: string } {
    const nextLessonIndex = lessonStatuses.findIndex((s) => s !== "completed");
    if (nextLessonIndex !== -1) {
      return {
        route: `/academy/platform-mastery/lesson/lesson-0${nextLessonIndex + 1}`,
        label: hasAnyLessonProgress ? "Continue Learning" : "Start Learning",
      };
    }

    if (academyProgression) {
      return {
        route: academyProgression.nextStep.route,
        label: academyProgression.nextStep.label,
      };
    }

    return { route: "/academy", label: "View Academy Progress" };
  }

  function marketingSublabel() {
    if (marketingDone) return "Completed";
    if (marketingInProgress) return "In progress · Tap to continue";
    return "6 modules · 80% quiz score required";
  }

  async function handleJoinWaitlist() {
    if (joiningWaitlist || marketingWaitlisted || marketingDone || marketingInProgress) return;
    setJoiningWaitlist(true);
    try {
      await apiRequest("/api/certifications/marketing_coaching/waitlist", {
        method: "POST",
      });
      setProgress((p) => ({ ...p, marketingStatus: "waitlisted" }));
    } catch {
      // non-fatal — optimistically update anyway
      setProgress((p) => ({ ...p, marketingStatus: "waitlisted" }));
    } finally {
      setJoiningWaitlist(false);
    }
  }

  return (
    <motion.div
      className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} pb-28`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header — mobile only; desktop uses DesktopLayout shell header */}
      {!isDesktop && (
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
      )}

      <div
        className="px-4 max-w-2xl mx-auto space-y-5"
        style={{ paddingTop: isDesktop ? "1rem" : "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
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
                <span className="text-orange-300 text-xs font-semibold">{PLATFORM_MASTERY_LESSONS.length} modules</span>
              </div>
            </div>
          </div>

          <div className="divide-y divide-white/5">
            {(() => {
              const firstIncomplete = !lessonLoading
                ? lessonStatuses.findIndex((s) => s !== "completed")
                : -1;
              return PLATFORM_MASTERY_LESSONS.map((lesson, i) => {
                const Icon = lesson.icon;
                const status = lessonStatuses[i];
                const isInProgress = !lessonLoading && status === "in_progress";
                const isCompleted = !lessonLoading && status === "completed";
                const isNextUp = !isCompleted && !isInProgress && i === firstIncomplete;

                function handleLessonTap() {
                  setLocation(`/academy/platform-mastery/lesson/lesson-0${i + 1}`);
                }

                return (
                  <motion.button
                    key={lesson.number}
                    className={`w-full text-left px-5 py-3.5 flex items-start gap-3 transition-colors ${
                      isInProgress || isNextUp
                        ? "bg-orange-500/8 active:bg-orange-500/12"
                        : "active:bg-white/5"
                    }`}
                    onClick={handleLessonTap}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.14 + i * 0.05 }}
                  >
                    <div className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${
                      isCompleted ? "bg-emerald-500/15" : isInProgress || isNextUp ? "bg-orange-500/20" : "bg-orange-500/15"
                    }`}>
                      <Icon className={`h-3.5 w-3.5 ${isCompleted ? "text-emerald-400" : "text-orange-400"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono ${isCompleted ? "text-emerald-500/50" : "text-white/25"}`}>
                          {lesson.number}
                        </span>
                        <span className={`text-sm font-semibold leading-snug ${isCompleted ? "text-white/50" : "text-white"}`}>
                          {lesson.title}
                        </span>
                        {isNextUp && (
                          <span className="text-[10px] font-semibold text-orange-400 bg-orange-500/15 px-1.5 py-0.5 rounded-full leading-none">
                            Next up
                          </span>
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 leading-relaxed ${isCompleted ? "text-white/30" : "text-white/45"}`}>
                        {lesson.description}
                      </p>
                      {isInProgress && (
                        <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold text-orange-300">
                          <PlayCircle className="h-3 w-3" />
                          Resume lesson
                        </span>
                      )}
                    </div>
                    {isCompleted && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    )}
                    {isInProgress && (
                      <PlayCircle className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />
                    )}
                    <ChevronRight className={`h-4 w-4 flex-shrink-0 mt-1 ${isInProgress || isNextUp ? "text-orange-400/50" : "text-white/20"}`} />
                  </motion.button>
                );
              });
            })()}
          </div>

          <div className="px-5 py-4 bg-orange-500/8 border-t border-orange-500/20">
            <button
              onClick={() => setLocation(getContinueLearningDestination().route)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-600 text-white font-semibold text-sm active:scale-[0.98] transition-transform"
            >
              <BookOpen className="h-4 w-4" />
              {getContinueLearningDestination().label}
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
                  sublabel={`${PLATFORM_MASTERY_LESSONS.length} modules · 80% quiz score required`}
                  done={progress.phase1Done}
                  score={progress.phase1Score}
                  available
                  onGo={() => setLocation("/academy/platform-mastery")}
                />
                <CertPathRow
                  icon="📈"
                  label="Marketing & Coaching"
                  sublabel={marketingSublabel()}
                  done={marketingDone}
                  available
                  inProgress={marketingInProgress}
                  onGo={() => setLocation("/business-center/affiliate/marketing/certification")}
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
              {[
                { icon: "🩺", label: "Diabetes Nutrition" },
                { icon: "💉", label: "GLP-1 Support" },
                { icon: "👩‍⚕️", label: "Women's Health" },
                { icon: "🏋️", label: "Performance Nutrition" },
                { icon: "🎗️", label: "Oncology Support" },
                { icon: "👶", label: "Pediatrics" },
              ].map((topic, i) => (
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

      {/* Marketing & Coaching modal */}
      <AnimatePresence>
        {showMarketingModal && (
          <MarketingCoachingModal
            status={progress.marketingStatus}
            joining={joiningWaitlist}
            onJoin={handleJoinWaitlist}
            onClose={() => setShowMarketingModal(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function MarketingCoachingModal({
  status,
  onJoin,
  onClose,
}: {
  status: MarketingStatus;
  joining?: boolean;
  onJoin: () => Promise<void>;
  onClose: () => void;
}) {
  const isDone = status === "completed";
  const isInProgress = status === "in_progress";

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl bg-[#111] border-t border-white/10 overflow-hidden max-h-[90vh] flex flex-col"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full bg-white/15" />
        </div>

        {/* Header */}
        <div className="px-5 pt-3 pb-4 flex items-start justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/25 flex items-center justify-center text-xl flex-shrink-0">
              📈
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Marketing & Coaching</h2>
              <p className="text-xs text-orange-400 font-medium">Certification · 6 Modules</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/8 text-white/50 active:bg-white/15 flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 pb-6 space-y-5">
          <p className="text-sm text-white/60 leading-relaxed">
            This certification teaches you how to grow your practice, attract aligned clients, and
            turn your clinical expertise into a sustainable coaching business — all while using
            My Perfect Meals as the engine.
          </p>

          {/* Curriculum preview */}
          <div>
            <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-3">
              What's Inside (6 Modules)
            </p>
            <div className="space-y-2">
              {MARKETING_COACHING_MODULES.map((mod, i) => {
                const Icon = mod.icon;
                return (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/8"
                  >
                    <div className="p-1.5 rounded-lg bg-orange-500/15 flex-shrink-0 mt-0.5">
                      <Icon className="h-3.5 w-3.5 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white leading-snug">{mod.title}</p>
                      <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{mod.description}</p>
                    </div>
                    <Lock className="h-3.5 w-3.5 text-white/15 flex-shrink-0 mt-1" />
                  </div>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          {!isDone && (
            <button
              onClick={() => { onClose(); onJoin(); }}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-orange-600 text-white font-semibold text-sm active:scale-[0.98] transition-transform"
            >
              {isInProgress ? "Continue Certification" : "Start Certification"}
              <ChevronRight className="h-4 w-4 opacity-70" />
            </button>
          )}
          {isDone && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-900/20 border border-emerald-500/25">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
              <p className="text-sm font-semibold text-emerald-300">Certification complete</p>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

function CertPathRow({
  icon,
  label,
  sublabel,
  done,
  score,
  available,
  waitlisted,
  inProgress,
  onGo,
  onComingSoon,
}: {
  icon: string;
  label: string;
  sublabel: string;
  done: boolean;
  score?: number | null;
  available: boolean;
  waitlisted?: boolean;
  inProgress?: boolean;
  onGo?: () => void;
  onComingSoon?: () => void;
}) {
  const badge = done && score != null ? certBadge(score) : null;
  const isTappable = (available && !done && !!onGo) || (!available && !!onComingSoon);

  function handleClick() {
    if (done) return;
    if (available && onGo) { onGo(); return; }
    if (!available && onComingSoon) { onComingSoon(); return; }
  }

  return (
    <button
      onClick={isTappable ? handleClick : undefined}
      disabled={!isTappable}
      className={`w-full flex items-center gap-3 text-left transition-opacity ${isTappable ? "active:opacity-70" : ""} ${!available && !onComingSoon ? "opacity-40 cursor-default" : ""}`}
    >
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.06] border border-white/10 text-base">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${done ? "text-white" : available ? "text-white/80" : waitlisted ? "text-white/70" : "text-white/45"}`}>
          {label}
        </p>
        <p className={`text-xs leading-snug ${waitlisted ? "text-orange-400/70" : "text-white/40"}`}>{sublabel}</p>
      </div>
      {done ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
      ) : inProgress ? (
        <Circle className="w-5 h-5 text-orange-400/60 shrink-0" />
      ) : waitlisted ? (
        <Bell className="w-4 h-4 text-orange-400/60 shrink-0" />
      ) : available ? (
        <Circle className="w-5 h-5 text-white/20 shrink-0" />
      ) : (
        <ChevronRight className="w-4 h-4 text-white/20 shrink-0" />
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
