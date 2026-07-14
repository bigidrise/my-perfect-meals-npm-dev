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
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);

  const [lessonStatuses, setLessonStatuses] = useState<LessonStatus[]>(
    Array(PLATFORM_MASTERY_LESSONS.length).fill("not_started")
  );
  const [lessonSlugs, setLessonSlugs] = useState<(string | null)[]>(
    Array(PLATFORM_MASTERY_LESSONS.length).fill(null)
  );
  const [lessonLoading, setLessonLoading] = useState(true);

  // Fetch per-lesson progress for all authenticated users
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [modulesRes, progressRes] = await Promise.allSettled([
          apiRequest("/api/certifications/platform/modules"),
          apiRequest("/api/certifications/platform/progress"),
        ]);

        if (modulesRes.status === "fulfilled" && progressRes.status === "fulfilled") {
          const allModules: Array<{ slug: string; moduleType: string; sortOrder: number }> =
            (modulesRes.value as any)?.modules ?? [];
          const moduleProgress: Array<{ moduleId: string; status: string }> =
            (progressRes.value as any)?.moduleProgress ?? [];

          // Take lesson-content modules sorted by sortOrder.
          // Prefer video-type modules; if fewer than the expected lesson count
          // exist (e.g. modules are stored as "quiz" or mixed types), fall back
          // to every non-final-assessment module so progress is always shown.
          const sortedAll = allModules.sort((a, b) => a.sortOrder - b.sortOrder);
          const videoModules = sortedAll.filter((m) => m.moduleType === "video");
          const lessonModules =
            videoModules.length >= PLATFORM_MASTERY_LESSONS.length
              ? videoModules
              : sortedAll.filter((m) => m.moduleType !== "final_assessment");

          const progressMap = new Map(moduleProgress.map((p) => [p.moduleId, p.status as LessonStatus]));

          const statuses: LessonStatus[] = PLATFORM_MASTERY_LESSONS.map((_, i) => {
            const mod = lessonModules[i];
            if (!mod) return "not_started";
            return progressMap.get(mod.slug) ?? "not_started";
          });

          const slugs: (string | null)[] = PLATFORM_MASTERY_LESSONS.map((_, i) => {
            return videoModules[i]?.slug ?? null;
          });

          setLessonStatuses(statuses);
          setLessonSlugs(slugs);
        }
      } catch {
        // silently ignore — lessons will show as not_started
      } finally {
        setLessonLoading(false);
      }
    })();
  }, [user?.id]);

  useEffect(() => {
    if (!isProfessional) {
      setProgress((p) => ({ ...p, loading: false }));
      return;
    }
    (async () => {
      try {
        const [p1Res, p2Res, mcRes] = await Promise.allSettled([
          apiRequest("/api/certifications/platform/progress"),
          apiRequest("/api/certifications/procare_training/progress"),
          apiRequest("/api/certifications/marketing_coaching/progress"),
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
        const mcStatus: MarketingStatus =
          mcRes.status === "fulfilled"
            ? (((mcRes.value as any)?.certification?.status ?? "unknown") as MarketingStatus)
            : "unknown";
        setProgress({
          personalDone: !!user?.onboardingCompletedAt,
          phase1Done,
          phase1Score,
          phase2Done,
          marketingStatus: mcStatus,
          loading: false,
        });
      } catch {
        setProgress((p) => ({ ...p, loading: false }));
      }
    })();
  }, [isProfessional, user?.onboardingCompletedAt]);

  const hasAnyLessonProgress = lessonStatuses.some(
    (s) => s === "in_progress" || s === "completed"
  );

  const allRequired = progress.personalDone && progress.phase1Done && progress.phase2Done && progress.marketingStatus === "completed";
  const badge = allRequired ? certBadge(progress.phase1Score) : null;

  const marketingDone = progress.marketingStatus === "completed";
  const marketingInProgress = progress.marketingStatus === "in_progress";
  const marketingWaitlisted = progress.marketingStatus === "waitlisted";

  function marketingSublabel() {
    if (marketingDone) return "Completed";
    if (marketingInProgress) return "In progress";
    if (marketingWaitlisted) return "On the waitlist";
    return "Coming soon · Tap to learn more";
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
              const status = lessonStatuses[i];
              const slug = lessonSlugs[i];
              const isInProgress = !lessonLoading && status === "in_progress";
              const isCompleted = !lessonLoading && status === "completed";

              function handleLessonTap() {
                if (isInProgress && slug) {
                  setLocation(`/certifications/platform/video/${slug}`);
                } else {
                  setLocation(`/certifications/platform?lesson=${i + 1}`);
                }
              }

              return (
                <motion.button
                  key={lesson.number}
                  className={`w-full text-left px-5 py-3.5 flex items-start gap-3 transition-colors ${
                    isInProgress
                      ? "bg-orange-500/8 active:bg-orange-500/12"
                      : "active:bg-white/5"
                  }`}
                  onClick={handleLessonTap}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.14 + i * 0.05 }}
                >
                  <div className={`p-1.5 rounded-lg flex-shrink-0 mt-0.5 ${
                    isCompleted ? "bg-emerald-500/15" : isInProgress ? "bg-orange-500/20" : "bg-orange-500/15"
                  }`}>
                    <Icon className={`h-3.5 w-3.5 ${isCompleted ? "text-emerald-400" : "text-orange-400"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-white/25">{lesson.number}</span>
                      <span className="text-sm font-semibold text-white leading-snug">{lesson.title}</span>
                    </div>
                    <p className="text-xs text-white/45 mt-0.5 leading-relaxed">{lesson.description}</p>
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
                  <ChevronRight className={`h-4 w-4 flex-shrink-0 mt-1 ${isInProgress ? "text-orange-400/50" : "text-white/20"}`} />
                </motion.button>
              );
            })}
          </div>

          <div className="px-5 py-4 bg-orange-500/8 border-t border-orange-500/20">
            <button
              onClick={() => setLocation("/certifications/platform")}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-600 text-white font-semibold text-sm active:scale-[0.98] transition-transform"
            >
              <BookOpen className="h-4 w-4" />
              {hasAnyLessonProgress ? "Continue Learning" : "Start Learning"}
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
                  sublabel={marketingSublabel()}
                  done={marketingDone}
                  available={false}
                  waitlisted={marketingWaitlisted}
                  inProgress={marketingInProgress}
                  onComingSoon={() => setShowMarketingModal(true)}
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
  joining,
  onJoin,
  onClose,
}: {
  status: MarketingStatus;
  joining: boolean;
  onJoin: () => Promise<void>;
  onClose: () => void;
}) {
  const isWaitlisted = status === "waitlisted";
  const isDone = status === "completed";
  const isInProgress = status === "in_progress";

  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);

  useEffect(() => {
    apiRequest("/api/certifications/marketing_coaching/waitlist-count")
      .then((data: any) => setWaitlistCount(typeof data?.count === "number" ? data.count : null))
      .catch(() => {});
  }, []);

  async function handleJoin() {
    await onJoin();
    setWaitlistCount((c) => (c !== null ? c + 1 : 1));
  }

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
              <p className="text-xs text-orange-400 font-medium">Certification · Coming Soon</p>
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

          {/* Timeline */}
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/8 space-y-3">
            <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">Timeline</p>
            <div className="space-y-2.5">
              {[
                { label: "Curriculum finalized", status: "done" },
                { label: "Video production", status: "active" },
                { label: "Quiz & assessment authoring", status: "upcoming" },
                { label: "Beta cohort access", status: "upcoming" },
                { label: "Open enrollment", status: "upcoming" },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      step.status === "done"
                        ? "bg-emerald-400"
                        : step.status === "active"
                        ? "bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.6)]"
                        : "bg-white/15"
                    }`}
                  />
                  <p
                    className={`text-xs leading-snug ${
                      step.status === "done"
                        ? "text-emerald-300/80"
                        : step.status === "active"
                        ? "text-orange-300 font-medium"
                        : "text-white/30"
                    }`}
                  >
                    {step.label}
                    {step.status === "active" && (
                      <span className="ml-1.5 text-orange-400/60 font-normal">· In progress</span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          {!isDone && !isInProgress && (
            <div className="space-y-2">
              {isWaitlisted ? (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-900/20 border border-emerald-500/25">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-300">You're on the waitlist</p>
                    <p className="text-xs text-emerald-400/60 mt-0.5">
                      We'll notify you the moment enrollment opens.
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-orange-600 text-white font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-60"
                >
                  {joining ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Bell className="h-4 w-4" />
                  )}
                  Notify me when available
                </button>
              )}
              {waitlistCount !== null && waitlistCount > 0 && (
                <p className="text-center text-orange-400/70 text-xs font-medium">
                  {waitlistCount} {waitlistCount === 1 ? "professional" : "professionals"} waiting
                </p>
              )}
              <p className="text-center text-white/25 text-xs">
                No spam. One notification when enrollment opens.
              </p>
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
