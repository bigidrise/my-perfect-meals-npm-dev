import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  Loader2,
  X,
  GraduationCap,
  RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

const LESSONS = [
  { id: "lesson-01", num: 1, title: "Your Profile & Nutrition Protocol", subtitle: "Setting up your dietary identity and health constraints" },
  { id: "lesson-02", num: 2, title: "Meal Builders — Choosing the Right Tool", subtitle: "Every meal creation tool and when to reach for it" },
  { id: "lesson-03", num: 3, title: "Weekly Planning", subtitle: "Building consistent habits with the Meal Planner" },
  { id: "lesson-04", num: 4, title: "Shopping & Your Grocery Scope", subtitle: "Smart Grocery List, Grocery Coach, Smart Scan, and Fridge Rescue" },
  { id: "lesson-05", num: 5, title: "Eating Away From Home", subtitle: "Restaurant Guide, Fast Food Guide, and Find Meals Near Me" },
  { id: "lesson-06", num: 6, title: "Biometrics & Tracking", subtitle: "Logging progress and reading your data" },
  { id: "lesson-07", num: 7, title: "Specialized Health & Performance Systems", subtitle: "Clinical programs, performance nutrition, and the protocol hierarchy" },
  { id: "lesson-08", num: 8, title: "AI Adaptation & Transparency", subtitle: "What the AI knows, what it estimates, and your boundaries" },
  { id: "lesson-09", num: 9, title: "Marketing & Brand Standards", subtitle: "Approved language, prohibited claims, social media rules, and referral tools" },
];

interface AcademyStatus {
  enrolled: boolean;
  isCertificationTrack: boolean;
  certStatus: string;
  certificateNumber: string | null;
  certificateName: string | null;
  completedAt: string | null;
  progress: Record<string, { status: string; score: number | null }>;
}

function getLessonStatus(progress: Record<string, { status: string; score: number | null }> | undefined, lessonId: string) {
  return progress?.[lessonId]?.status ?? "not_started";
}



export default function PlatformMasteryDashboard() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const [status, setStatus] = useState<AcademyStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const [showNameModal, setShowNameModal] = useState(false);
  const [certFirstName, setCertFirstName] = useState("");
  const [certLastName, setCertLastName] = useState("");
  const [nameSaving, setNameSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await apiRequest("/api/academy/platform-mastery/status");
      setStatus(d as AcademyStatus);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const prog = status?.progress ?? {};
  const completedCount = LESSONS.filter((l) => getLessonStatus(prog, l.id) === "completed").length;
  const allDone = completedCount === LESSONS.length;
  const allQuizzesPassed = LESSONS.every(
    (l) => prog[`${l.id}-quiz`]?.status === "completed"
  );
  const isCertified = status?.certStatus === "completed";
  const isCertTrack = status?.isCertificationTrack ?? false;
  const progressPct = Math.round((completedCount / LESSONS.length) * 100);

  const [switchingToCert, setSwitchingToCert] = useState(false);

  const handleSwitchToCertMode = async () => {
    setSwitchingToCert(true);
    try {
      await apiRequest("/api/academy/platform-mastery/enroll", {
        method: "POST",
        body: JSON.stringify({ isCertificationTrack: true }),
        headers: { "Content-Type": "application/json" },
      });
      await load();
      setShowNameModal(true);
    } catch {
      // silently fail — user can try again
    } finally {
      setSwitchingToCert(false);
    }
  };

  const handleCompleteWithName = async () => {
    const fullName = `${certFirstName.trim()} ${certLastName.trim()}`.trim();
    if (!fullName) return;
    setNameSaving(true);
    try {
      const json = await apiRequest("/api/academy/platform-mastery/complete", {
        method: "POST",
        body: JSON.stringify({ certificateName: fullName }),
        headers: { "Content-Type": "application/json" },
      });
      if ((json as { ok: boolean }).ok) {
        setShowNameModal(false);
        await load();
      }
    } catch {
    } finally {
      setNameSaving(false);
    }
  };

  return (
    <motion.div
      className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} pb-28`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div
        className="sticky top-0 z-10 bg-black/55 backdrop-blur-md border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => setLocation("/academy")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
          >
            <ArrowLeft className="h-4 w-4" />
            Academy
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white truncate">
              Platform Mastery
            </h1>
            <p className="text-xs text-white/45">
              {isCertTrack ? "Certification Mode" : "Learning Mode"}
            </p>
          </div>
          {isCertTrack && (
            <div className="px-2.5 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 flex-shrink-0">
              <span className="text-orange-300 text-[10px] font-bold uppercase tracking-wide">
                Cert Track
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 max-w-2xl mx-auto space-y-4 pt-5">
        {/* Certified banner */}
        {isCertified && (
          <motion.div
            className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Award className="h-6 w-6 text-emerald-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">
                Platform Mastery — Certified
              </p>
              <p className="text-xs text-white/50 font-mono">
                {status?.certificateNumber}
              </p>
            </div>
          </motion.div>
        )}

        {/* Progress bar */}
        <div className="p-4 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-white">Progress</span>
            {loading ? (
              <div className="h-4 w-10 rounded bg-white/10 animate-pulse" />
            ) : (
              <span className="text-sm font-bold text-orange-400">
                {progressPct}%
              </span>
            )}
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            {loading ? (
              <div className="h-full w-1/3 rounded-full bg-white/10 animate-pulse" />
            ) : (
              <motion.div
                className="h-full bg-orange-500 rounded-full"
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            )}
          </div>
          {!loading && (
            <p className="text-xs text-white/40">
              {completedCount} of {LESSONS.length} lessons complete
            </p>
          )}
        </div>

        {/* Lesson rows */}
        <div className="space-y-2">
          {LESSONS.map((lesson, idx) => {
            const lessonStatus = getLessonStatus(prog, lesson.id);
            const isCompleted = lessonStatus === "completed";
            const isInProgress = lessonStatus === "in_progress";

            // A lesson is accessible if it's the first, or if the previous lesson is completed
            const prevLesson = idx > 0 ? LESSONS[idx - 1] : null;
            const prevCompleted = !prevLesson || getLessonStatus(prog, prevLesson.id) === "completed";
            const isAccessible = prevCompleted || isCompleted || isInProgress;

            return (
              <motion.button
                key={lesson.id}
                className={`w-full text-left p-4 rounded-2xl border transition-colors ${
                  isCompleted
                    ? "bg-emerald-500/10 border-emerald-500/25"
                    : isInProgress
                    ? "bg-orange-500/10 border-orange-500/25"
                    : isAccessible
                    ? "bg-black/40 border-white/10 active:bg-white/5"
                    : "bg-black/20 border-white/5 opacity-50 cursor-not-allowed"
                }`}
                onClick={() => {
                  if (isAccessible) {
                    setLocation(`/academy/platform-mastery/lesson/${lesson.id}`);
                  }
                }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <div className="flex items-center gap-3">
                  {/* Status icon */}
                  <div className="flex-shrink-0">
                    {loading ? (
                      <div className="h-5 w-5 rounded-full bg-white/10 animate-pulse" />
                    ) : isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    ) : isInProgress ? (
                      <Clock className="h-5 w-5 text-orange-400" />
                    ) : (
                      <Circle className="h-5 w-5 text-white/25" />
                    )}
                  </div>

                  {/* Lesson info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-white/35 uppercase tracking-widest">
                        {lesson.num.toString().padStart(2, "0")}
                      </span>
                      {isInProgress && (
                        <span className="text-[9px] font-bold text-orange-400 uppercase tracking-wide bg-orange-500/15 px-1.5 py-0.5 rounded-full">
                          In Progress
                        </span>
                      )}
                    </div>
                    <p className={`text-sm font-semibold mt-0.5 ${isCompleted ? "text-emerald-300" : "text-white"}`}>
                      {lesson.title}
                    </p>
                    <p className="text-xs text-white/40 mt-0.5 leading-snug">
                      {lesson.subtitle}
                    </p>
                  </div>

                  {/* Chevron */}
                  {isAccessible && (
                    <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0" />
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Claim certificate button — cert track only, all lessons done */}
        {!loading && isCertTrack && allDone && !isCertified && (
          <motion.button
            className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform"
            onClick={() => setShowNameModal(true)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex items-center justify-center gap-2">
              <Award className="h-5 w-5" />
              Claim Your Certificate
            </div>
          </motion.button>
        )}

        {/* Learning Mode completion — all lessons done */}
        {!loading && !isCertTrack && allDone && !isCertified && (
          <motion.div
            className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="p-4 text-center space-y-1">
              <p className="text-sm font-semibold text-emerald-300">
                All Lessons Complete!
              </p>
              <p className="text-xs text-white/50 leading-relaxed">
                You finished Platform Mastery in Learning Mode.
                {allQuizzesPassed
                  ? " You've also passed all 9 quizzes — you're ready to claim your certificate."
                  : " Learning Mode does not issue a certificate. To earn one, switch to Certification Mode and pass each quiz at 80%."}
              </p>
            </div>
            {allQuizzesPassed && (
              <div className="px-4 pb-4">
                <button
                  onClick={handleSwitchToCertMode}
                  disabled={switchingToCert}
                  className="w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {switchingToCert ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {switchingToCert
                    ? "Switching…"
                    : "Switch to Certification Mode & Claim Certificate"}
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* Enrollment prompt for non-enrolled */}
        {!loading && !status?.enrolled && (
          <div className="p-4 rounded-2xl bg-orange-500/8 border border-orange-500/20 space-y-2">
            <p className="text-xs text-orange-200/70 leading-relaxed text-center">
              <span className="font-semibold text-orange-300">Learning Mode</span> — open access, optional quizzes, progress shown as Read / Completed. <span className="text-white/50">No certificate is issued.</span>
            </p>
            <p className="text-xs text-orange-200/70 leading-relaxed text-center">
              <span className="font-semibold text-orange-300">Certification Mode</span> — same lessons, quiz gate at 80%, certificate issued on completion.
            </p>
          </div>
        )}
      </div>

      {/* Name capture modal */}
      <AnimatePresence>
        {showNameModal && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center px-4 pb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowNameModal(false)}
            />
            <motion.div
              className="relative w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-3xl p-6 space-y-5"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
            >
              <button
                className="absolute top-4 right-4 p-1.5 rounded-xl bg-black/40 text-white/50 active:scale-95"
                onClick={() => setShowNameModal(false)}
              >
                <X className="h-4 w-4" />
              </button>
              <div>
                <h2 className="text-base font-bold text-white">
                  Before Your Certificate Is Issued
                </h2>
                <p className="text-xs text-white/50 mt-1 leading-relaxed">
                  Enter your full name exactly as you want it to appear on your certificate.
                </p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 font-medium">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={certFirstName}
                    onChange={(e) => setCertFirstName(e.target.value)}
                    placeholder="First name"
                    className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 font-medium">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={certLastName}
                    onChange={(e) => setCertLastName(e.target.value)}
                    placeholder="Last name"
                    className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50"
                    onKeyDown={(e) => {
                      if (
                        e.key === "Enter" &&
                        certFirstName.trim() &&
                        certLastName.trim()
                      )
                        handleCompleteWithName();
                    }}
                  />
                </div>
              </div>
              <button
                onClick={handleCompleteWithName}
                disabled={
                  !certFirstName.trim() || !certLastName.trim() || nameSaving
                }
                className="w-full p-3.5 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {nameSaving ? "Issuing Certificate…" : "Issue My Certificate"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
