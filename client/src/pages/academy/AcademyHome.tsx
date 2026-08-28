import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  GraduationCap,
  BookOpen,
  Award,
  ChevronRight,
  CheckCircle2,
  Circle,
  Loader2,
  Lock,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

const PLATFORM_MASTERY_LESSONS = [
  { num: 1, title: "Your Profile & Nutrition Protocol", subtitle: "Setting up your dietary identity and health constraints" },
  { num: 2, title: "Meal Builders — Choosing the Right Tool", subtitle: "Every meal creation tool and when to reach for it" },
  { num: 3, title: "Weekly Planning", subtitle: "Building consistent habits with the Meal Planner" },
  { num: 4, title: "Shopping & Your Grocery Scope", subtitle: "Smart Grocery List, Grocery Coach, Product Scan, and Fridge Rescue" },
  { num: 5, title: "Eating Away From Home", subtitle: "Restaurant Guide, Fast Food Guide, and Find Meals Near Me" },
  { num: 6, title: "Biometrics & Tracking", subtitle: "Logging progress and reading your data" },
  { num: 7, title: "Specialized Health & Performance Systems", subtitle: "Clinical programs, performance nutrition, and the protocol hierarchy" },
  { num: 8, title: "AI Adaptation & Transparency", subtitle: "What the AI knows, what it estimates, and your boundaries" },
  { num: 9, title: "Marketing & Brand Standards", subtitle: "Approved language, prohibited claims, social media rules, and referral tools" },
];

const BECOME_CERTIFIED = [
  { icon: "🎓", label: "Platform Mastery", desc: "9 modules · Workflow exercises · Quiz", route: "/academy/platform-mastery/lesson/lesson-01" },
  { icon: "📈", label: "Marketing & Coaching", desc: "5 lessons · Coaching philosophy · Quiz", route: "/business-center/affiliate/marketing/certification" },
  { icon: "🩺", label: "ProCare Certification", desc: "3 training videos · Final assessment", route: null },
];

const SPECIALIZE = [
  { icon: "🩺", label: "Diabetes Nutrition" },
  { icon: "💉", label: "GLP-1 Support" },
  { icon: "👩", label: "Women's Health" },
  { icon: "🏋️", label: "Performance Nutrition" },
  { icon: "🎗️", label: "Oncology Support" },
  { icon: "➕", label: "More coming" },
];

interface AcademyStatus {
  enrolled: boolean;
  isCertificationTrack: boolean;
  certStatus: string;
  progress: Record<string, { status: string; score: number | null }>;
  certificateNumber: string | null;
}

export default function AcademyHome() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [status, setStatus] = useState<AcademyStatus | null>(null);
  const [marketingCertStatus, setMarketingCertStatus] = useState<string>("not_started");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      apiRequest("/api/academy/platform-mastery/status"),
      apiRequest("/api/certifications/marketing_coaching/progress").catch(() => null),
    ])
      .then(([acad, mkt]) => {
        setStatus(acad as AcademyStatus);
        setMarketingCertStatus((mkt as any)?.status ?? "not_started");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const completedLessons = PLATFORM_MASTERY_LESSONS.filter((l) => {
    const id = `lesson-0${l.num}`;
    return status?.progress?.[id]?.status === "completed";
  }).length;

  const allDone = completedLessons === PLATFORM_MASTERY_LESSONS.length;
  const isPlatformCertified = status?.certStatus === "completed";
  // Finishing all required lessons unlocks the next certification in both
  // Learning Mode and Certification Mode. Claiming the named Platform Mastery
  // certificate remains a separate action with its own quiz requirements.
  const hasCompletedPlatformRequirement = isPlatformCertified || allDone;
  // Keep legacy alias for backward compat within this file
  const isCertified = isPlatformCertified;
  const isMarketingCertified = marketingCertStatus === "completed";
  // Core certified = Platform Mastery + Marketing & Coaching complete
  const isCoreCertified = isPlatformCertified && isMarketingCertified;
  // ProCare workspace: they already have a professional account set up
  const hasProCareWorkspace =
    user?.professionalRole === "trainer" || user?.professionalRole === "physician";
  // ProCare eligible: server-confirmed active ProCare subscription (not inferred from cert)
  const proCareEligible = user?.proCareEligible ?? false;

  function getNextCertificationStep(): { route: string; label: string } {
    if (!isMarketingCertified) {
      return {
        route: "/business-center/affiliate/marketing/certification",
        label: "Continue to Marketing & Coaching",
      };
    }
    return {
      route: "/procare-training",
      label: "Continue to ProCare Certification",
    };
  }

  const nextLesson = PLATFORM_MASTERY_LESSONS.find((l) => {
    const id = `lesson-0${l.num}`;
    return status?.progress?.[id]?.status !== "completed";
  });

  function getLessonStatus(num: number) {
    const id = `lesson-0${num}`;
    return status?.progress?.[id]?.status ?? "not_started";
  }

  // In cert mode, a lesson is locked if the prior lesson is not completed yet.
  // Lesson 1 is always accessible. Learning mode: never locked.
  function isLessonLocked(num: number): boolean {
    if (!status?.isCertificationTrack) return false;
    if (num === 1) return false;
    const priorId = `lesson-0${num - 1}`;
    return status?.progress?.[priorId]?.status !== "completed";
  }

  // ── State-aware CTA for the Become Certified section ──────────────────────
  function renderCertificationCTA() {
    if (loading) return null;

    // State 5: Both done + ProCare workspace already exists
    if (isCoreCertified && hasProCareWorkspace) {
      return (
        <button
          onClick={() => setLocation("/procare-welcome")}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-600 text-white font-semibold text-sm active:scale-[0.98] transition-transform"
        >
          <GraduationCap className="h-4 w-4" />
          Open ProCare
          <ChevronRight className="h-4 w-4 opacity-70" />
        </button>
      );
    }

    // State 4: Both done, no ProCare workspace — offer ProCare as optional advanced path
    if (isCoreCertified) {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
            <Sparkles className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-300">My Perfect Meals Certified</p>
              <p className="text-xs text-emerald-300/60 mt-0.5">Core certification complete — you're all set.</p>
            </div>
          </div>
          <button
            onClick={() => setLocation("/procare-welcome")}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 border border-white/15 text-white font-semibold text-sm active:scale-[0.98] transition-transform"
          >
            <GraduationCap className="h-4 w-4 text-orange-400" />
            Continue to ProCare Certification
            <ChevronRight className="h-4 w-4 opacity-50" />
          </button>
        </div>
      );
    }

    // State 3: Platform done, marketing not done → Continue Certification
    if (hasCompletedPlatformRequirement && !isMarketingCertified) {
      return (
        <button
          onClick={() => setLocation("/business-center/affiliate/marketing/certification")}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-600 text-white font-semibold text-sm active:scale-[0.98] transition-transform"
        >
          <GraduationCap className="h-4 w-4" />
          Continue Certification
          <ChevronRight className="h-4 w-4 opacity-70" />
        </button>
      );
    }

    // State 1 & 2: Nothing done or in progress → Start Certification Path
    return (
      <button
        onClick={() => setLocation("/academy/platform-mastery/lesson/lesson-01")}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 border border-white/15 text-white font-semibold text-sm active:scale-[0.98] transition-transform"
      >
        <GraduationCap className="h-4 w-4 text-orange-400" />
        {isPlatformCertified ? "Continue Certification" : "Start Certification Path"}
        <ChevronRight className="h-4 w-4 opacity-50" />
      </button>
    );
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
            onClick={() => setLocation("/more")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 text-white text-xs font-semibold active:scale-[0.95] transition-transform"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-base font-bold text-white">My Perfect Meals Academy</h1>
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
              My Perfect Meals Academy
            </h2>
            <p className="text-orange-400 text-sm font-medium mt-1">
              Learn. Practice. Certify.
            </p>
          </div>
          <p className="text-white/55 text-sm leading-relaxed max-w-sm mx-auto">
            The Academy is where you learn the platform, complete hands-on
            exercises, and — if you choose — earn a certification.
          </p>
        </motion.div>

        {/* ── SECTION 1: LEARN ── */}
        <motion.div
          className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="px-5 pt-5 pb-4 border-b border-white/8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-1">
                  Learn
                </p>
                <h3 className="text-base font-bold text-white">
                  Platform Mastery
                </h3>
                <p className="text-xs text-white/50 mt-1">
                  Open to everyone · Learning Mode does not issue a certificate
                </p>
              </div>
              {loading ? (
                <Loader2 className="h-4 w-4 text-orange-400 animate-spin mt-1 flex-shrink-0" />
              ) : (
                <div className="px-2.5 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 flex-shrink-0">
                  <span className="text-orange-300 text-xs font-semibold">
                    {isCertified ? "Certified" : `${completedLessons}/${PLATFORM_MASTERY_LESSONS.length} modules`}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Lesson list */}
          <div className="divide-y divide-white/5">
            {PLATFORM_MASTERY_LESSONS.map((lesson, i) => {
              const lessonStatus = loading ? "not_started" : getLessonStatus(lesson.num);
              const done = lessonStatus === "completed";
              const inProgress = lessonStatus === "in_progress";
              const locked = !loading && isLessonLocked(lesson.num);

              return (
                <motion.button
                  key={lesson.num}
                  className={`w-full text-left px-5 py-3.5 flex items-center gap-3 transition-colors ${locked ? "opacity-45 cursor-default" : "active:bg-white/5"}`}
                  onClick={() => {
                    if (locked) return;
                    setLocation(`/academy/platform-mastery/lesson/lesson-0${lesson.num}`);
                  }}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: locked ? 0.45 : 1, x: 0 }}
                  transition={{ delay: 0.12 + i * 0.04 }}
                >
                  {locked ? (
                    <Lock className="h-5 w-5 text-white/20 flex-shrink-0" />
                  ) : done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                  ) : inProgress ? (
                    <div className="h-5 w-5 rounded-full border-2 border-orange-400 bg-orange-400/20 flex-shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-white/15 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-white/25 flex-shrink-0">
                        {String(lesson.num).padStart(2, "0")}
                      </span>
                      <span
                        className={`text-sm font-semibold leading-snug ${done ? "text-white/50" : locked ? "text-white/40" : "text-white"}`}
                      >
                        {lesson.title}
                      </span>
                    </div>
                    <p className="text-xs text-white/35 mt-0.5 ml-6">
                      {lesson.subtitle}
                    </p>
                  </div>
                  {locked ? (
                    <span className="text-[10px] text-white/25 font-medium flex-shrink-0">
                      Locked
                    </span>
                  ) : (
                    <ChevronRight className="h-4 w-4 text-white/20 flex-shrink-0" />
                  )}
                </motion.button>
              );
            })}
          </div>

          <div className="px-5 py-4 bg-black/20 border-t border-white/5">
            {isCertified ? (
              <button
                onClick={() => setLocation("/academy/platform-mastery/complete")}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-semibold text-sm active:scale-[0.98] transition-transform"
              >
                <Award className="h-4 w-4" />
                View Your Certificate
              </button>
            ) : allDone && status?.isCertificationTrack ? (
              <button
                onClick={() => setLocation("/academy/platform-mastery")}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-orange-600 text-white font-semibold text-sm active:scale-[0.98] transition-transform"
              >
                <Award className="h-4 w-4" />
                Claim Your Certificate
                <ChevronRight className="h-4 w-4 opacity-70" />
              </button>
            ) : allDone && !status?.isCertificationTrack ? (
              <button
                onClick={() => setLocation(getNextCertificationStep().route)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 border border-white/15 text-white font-semibold text-sm active:scale-[0.98] transition-transform"
              >
                <GraduationCap className="h-4 w-4 text-orange-400" />
                {getNextCertificationStep().label}
                <ChevronRight className="h-4 w-4 opacity-50" />
              </button>
            ) : null}
          </div>
        </motion.div>

        {/* ── SECTION 2: BECOME CERTIFIED ── */}
        <motion.div
          className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
        >
          <div className="px-5 pt-5 pb-4 border-b border-white/8">
            <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-1">
              Become Certified
            </p>
            <h3 className="text-base font-bold text-white">
              Certification Path
            </h3>
            <p className="text-xs text-white/50 mt-1">
              For coaches, trainers, healthcare professionals, and partners
            </p>
          </div>

          <div className="px-5 py-4 space-y-3">
            {BECOME_CERTIFIED.map((item, i) => {
              // Per-item completion & lock state
              const itemDone =
                i === 0 ? hasCompletedPlatformRequirement :
                i === 1 ? isMarketingCertified :
                false; // ProCare cert tracked separately; show as optional
              const locked =
                i === 1 ? !hasCompletedPlatformRequirement :
                i === 2 ? !isMarketingCertified :
                false;
              const noRoute = item.route === null;
              const isClickable = !loading && !locked && !noRoute;

              const inner = (
                <>
                  <span className="text-lg leading-none mt-0.5 flex-shrink-0">
                    {item.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${locked ? "text-white/40" : "text-white"}`}>
                      {item.label}
                      {i === 2 && (
                        <span className="ml-2 text-[10px] font-normal text-white/30 uppercase tracking-wider">
                          optional
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-white/45 mt-0.5">{item.desc}</p>
                  </div>
                  {itemDone ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : locked ? (
                    <Lock className="h-4 w-4 text-white/20 flex-shrink-0 mt-0.5" />
                  ) : noRoute ? (
                    <Lock className="h-4 w-4 text-white/20 flex-shrink-0 mt-0.5" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-orange-400/60 flex-shrink-0 mt-0.5" />
                  )}
                </>
              );

              const sharedClass = `flex items-start gap-3 p-3.5 rounded-xl border ${
                i === 0
                  ? hasCompletedPlatformRequirement
                    ? "bg-emerald-500/10 border-emerald-500/20"
                    : "bg-orange-500/10 border-orange-500/25"
                  : i === 1
                  ? isMarketingCertified
                    ? "bg-emerald-500/10 border-emerald-500/20"
                    : locked
                    ? "bg-white/[0.02] border-white/6 opacity-45"
                    : "bg-orange-500/10 border-orange-500/25"
                  : "bg-white/[0.03] border-white/8 opacity-50"
              }`;

              return isClickable ? (
                <motion.button
                  key={i}
                  className={`w-full text-left ${sharedClass} active:scale-[0.98] transition-transform`}
                  onClick={() => setLocation(item.route!)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.22 + i * 0.05 }}
                >
                  {inner}
                </motion.button>
              ) : (
                <motion.div
                  key={i}
                  className={sharedClass}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.22 + i * 0.05 }}
                >
                  {inner}
                </motion.div>
              );
            })}
          </div>

          {/* Two-tier note */}
          <div className="px-5 pb-4 pt-1">
            <div className="p-3.5 rounded-xl bg-orange-500/8 border border-orange-500/15">
              {isCoreCertified ? (
                <p className="text-xs text-emerald-200/70 leading-relaxed text-center">
                  <span className="font-semibold text-emerald-300">My Perfect Meals Certified ✓</span>
                  {"  "}—{"  "}
                  ProCare is an advanced optional path for professionals who manage clients.
                </p>
              ) : (
                <p className="text-xs text-orange-200/70 leading-relaxed text-center">
                  <span className="font-semibold text-orange-300">Platform Mastery + Marketing & Coaching</span>
                  {" "}earns your core certification. ProCare is optional, for client-facing professionals.
                </p>
              )}
            </div>
          </div>

          <div className="px-5 pb-4">
            {renderCertificationCTA()}
          </div>
        </motion.div>

        {/* ── SECTION 3: SPECIALIZE ── */}
        <motion.div
          className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26 }}
        >
          <div className="px-5 pt-5 pb-4 border-b border-white/8">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-white/35 uppercase tracking-widest mb-1">
                  Specialize
                </p>
                <h3 className="text-base font-bold text-white">
                  Specialty Certifications
                </h3>
                <p className="text-xs text-white/50 mt-1">
                  Deep clinical specializations — each adds a new designation to your profile
                </p>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 flex-shrink-0">
                <span className="text-white/50 text-xs font-semibold">
                  Coming Soon
                </span>
              </div>
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="grid grid-cols-2 gap-2">
              {SPECIALIZE.map((spec, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/8 opacity-50"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 0.5, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.04 }}
                >
                  <span className="text-base leading-none">{spec.icon}</span>
                  <p className="text-xs font-medium text-white/60 leading-tight">
                    {spec.label}
                  </p>
                  <Lock className="h-3 w-3 text-white/20 ml-auto shrink-0" />
                </motion.div>
              ))}
            </div>
            <p className="text-center text-white/25 text-xs mt-4 leading-relaxed">
              Specialty certifications unlock as each program is released.
              Platform Mastery must be complete first.
            </p>
          </div>
        </motion.div>

        {/* Philosophy note */}
        <motion.div
          className="p-4 rounded-2xl bg-orange-500/8 border border-orange-500/20"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.36 }}
        >
          <p className="text-xs text-orange-200/75 leading-relaxed text-center">
            After you earn your certification, everything stays accessible. Come back
            to any lesson anytime — no retest, no penalty. As the platform grows, the
            Academy grows with it.
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
