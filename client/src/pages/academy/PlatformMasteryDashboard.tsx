import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  Circle,
  ChevronRight,
  Lock,
  Loader2,
  X,
  GraduationCap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

const LESSONS = [
  { id: "lesson-01", num: 1, title: "Getting Started", subtitle: "Account setup and your profile" },
  { id: "lesson-02", num: 2, title: "Understanding Your Dashboard", subtitle: "Your daily starting point" },
  { id: "lesson-03", num: 3, title: "Builders: Creating Your Nutrition", subtitle: "Generating and managing meals" },
  { id: "lesson-04", num: 4, title: "Lifestyle: Everyday Nutrition for Real Life", subtitle: "Flexible tools for real situations" },
  { id: "lesson-05", num: 5, title: "Your Personal Toolbox", subtitle: "The More page and what's inside" },
  { id: "lesson-06", num: 6, title: "My Hub: Your Personal Control Center", subtitle: "Where to go when you need anything" },
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

function getQuizStatus(progress: Record<string, { status: string; score: number | null }> | undefined, lessonId: string) {
  const qid = `${lessonId}-quiz`;
  return {
    status: progress?.[qid]?.status ?? "not_started",
    score: progress?.[qid]?.score ?? null,
  };
}

function getExerciseStatus(progress: Record<string, { status: string; score: number | null }> | undefined, lessonId: string) {
  const eid = `${lessonId}-exercise`;
  return progress?.[eid]?.status ?? "not_started";
}

export default function PlatformMasteryDashboard() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const [status, setStatus] = useState<AcademyStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [certFirstName, setCertFirstName] = useState("");
  const [certLastName, setCertLastName] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  const dashPath = "/academy/platform-mastery";
  const prevLocationRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (prevLocationRef.current !== null && location === dashPath) {
      setLoading(true);
      load();
    }
    prevLocationRef.current = location;
  }, [location, load]);

  const prog = status?.progress ?? {};
  const completedCount = LESSONS.filter((l) => getLessonStatus(prog, l.id) === "completed").length;
  const allDone = completedCount === LESSONS.length;
  const isCertified = status?.certStatus === "completed";
  const isCertTrack = status?.isCertificationTrack ?? false;
  const progressPct = Math.round((completedCount / LESSONS.length) * 100);

  const continueLesson = LESSONS.find((l) => getLessonStatus(prog, l.id) !== "completed");

  const isLessonLocked = (idx: number) => {
    if (!isCertTrack) return false;
    if (idx === 0) return false;
    return getLessonStatus(prog, LESSONS[idx - 1].id) !== "completed";
  };

  const handleEnroll = async (certTrack: boolean) => {
    setEnrolling(true);
    try {
      await apiRequest("/api/academy/platform-mastery/enroll", {
        method: "POST",
        body: JSON.stringify({ isCertificationTrack: certTrack }),
        headers: { "Content-Type": "application/json" },
      });
      setShowEnrollModal(false);
      await load();
      if (certTrack && continueLesson) {
        setLocation(`/academy/platform-mastery/lesson/${continueLesson.id}`);
      } else if (!certTrack && continueLesson) {
        setLocation(`/academy/platform-mastery/lesson/${continueLesson.id}`);
      }
    } catch {
      setEnrolling(false);
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
              My Perfect Meals Basics
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
                My Perfect Meals Basics — Certified
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

        {/* Enrollment CTA / Continue button */}
        {!loading && !status?.enrolled && (
          <motion.div
            className="space-y-2"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <button
              onClick={() => setShowEnrollModal(true)}
              className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm flex items-center justify-between active:scale-[0.98] transition-transform"
            >
              <div className="flex flex-col items-start gap-0.5">
                <span className="text-xs text-orange-200 font-medium uppercase tracking-wide">
                  My Perfect Meals Basics
                </span>
                <span className="text-base font-bold text-white">
                  Start Learning
                </span>
              </div>
              <BookOpen className="h-6 w-6 text-white/80 flex-shrink-0" />
            </button>
          </motion.div>
        )}

        {!loading && status?.enrolled && !allDone && continueLesson && (
          <motion.button
            className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm flex items-center justify-between active:scale-[0.98] transition-transform"
            onClick={() =>
              setLocation(`/academy/platform-mastery/lesson/${continueLesson.id}`)
            }
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-xs text-orange-200 font-medium uppercase tracking-wide">
                Continue — Lesson {continueLesson.num}
              </span>
              <span className="text-base font-bold text-white">
                {continueLesson.title}
              </span>
            </div>
            <ChevronRight className="h-6 w-6 text-white/80 flex-shrink-0" />
          </motion.button>
        )}

        {/* Lesson list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {LESSONS.map((lesson, i) => {
              const lessonSt = getLessonStatus(prog, lesson.id);
              const quiz = getQuizStatus(prog, lesson.id);
              const exerciseSt = getExerciseStatus(prog, lesson.id);
              const done = lessonSt === "completed";
              const locked = isLessonLocked(i);
              const isCurrent =
                !done && !locked && continueLesson?.id === lesson.id;
              const showSeparator = isCurrent && completedCount > 0 && i > 0;

              return (
                <div key={lesson.id}>
                  {showSeparator && (
                    <div className="flex items-center gap-3 py-2">
                      <div className="flex-1 h-px bg-white/10" />
                      <span className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">
                        Up Next
                      </span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>
                  )}
                  <motion.button
                    className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 ${
                      locked
                        ? "bg-black/20 border-white/5 opacity-50 cursor-default"
                        : isCurrent
                        ? "bg-orange-500/10 border-orange-500/30"
                        : done
                        ? "bg-black/30 border-white/10"
                        : "bg-black/50 backdrop-blur-md border-white/10 active:scale-[0.98]"
                    }`}
                    onClick={() =>
                      !locked &&
                      setLocation(
                        `/academy/platform-mastery/lesson/${lesson.id}`
                      )
                    }
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <div className="flex items-center gap-3">
                      {locked ? (
                        <Lock className="h-5 w-5 text-white/20 flex-shrink-0" />
                      ) : done ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                      ) : isCurrent ? (
                        <div className="h-5 w-5 rounded-full border-2 border-orange-400 bg-orange-400/20 flex-shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-white/20 flex-shrink-0" />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/25 flex-shrink-0 font-mono">
                            {String(lesson.num).padStart(2, "0")}
                          </span>
                          <h3
                            className={`text-sm font-semibold truncate ${done ? "text-white/50" : "text-white"}`}
                          >
                            {lesson.title}
                          </h3>
                        </div>
                        <p className="text-xs text-white/35 mt-0.5 ml-6 leading-snug">
                          {lesson.subtitle}
                        </p>
                        {/* Sub-status for cert track */}
                        {isCertTrack && !locked && (
                          <div className="flex items-center gap-3 mt-1.5 ml-6">
                            <span
                              className={`text-[10px] font-medium ${exerciseSt === "completed" ? "text-emerald-400" : "text-white/25"}`}
                            >
                              Exercise {exerciseSt === "completed" ? "✓" : "○"}
                            </span>
                            <span
                              className={`text-[10px] font-medium ${quiz.status === "completed" ? "text-emerald-400" : quiz.status === "quiz_failed" ? "text-red-400" : "text-white/25"}`}
                            >
                              Quiz{" "}
                              {quiz.status === "completed"
                                ? `✓ ${quiz.score}%`
                                : quiz.status === "quiz_failed"
                                ? `✗ ${quiz.score}%`
                                : "○"}
                            </span>
                          </div>
                        )}
                        {/* Lesson status label */}
                        {!locked && (
                          <div className="mt-0.5 ml-6">
                            {done ? (
                              <span className="text-xs text-emerald-400 font-medium">
                                Completed
                              </span>
                            ) : isCurrent ? (
                              <span className="text-xs text-orange-400 font-semibold">
                                Tap to continue
                              </span>
                            ) : (
                              <span className="text-xs text-white/25">
                                Not started
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {!locked && (
                        <ChevronRight className="h-4 w-4 text-white/20 flex-shrink-0" />
                      )}
                    </div>
                  </motion.button>
                </div>
              );
            })}
          </div>
        )}

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

        {/* Learning Mode completion message — no cert */}
        {!loading && !isCertTrack && allDone && !isCertified && (
          <motion.div
            className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-sm font-semibold text-emerald-300">
              All Lessons Complete!
            </p>
            <p className="text-xs text-white/50 leading-relaxed">
              You've finished My Perfect Meals Basics in Learning Mode. To earn a certificate, re-enroll in Certification Mode.
            </p>
          </motion.div>
        )}

        {/* Enrollment prompt for non-enrolled */}
        {!loading && !status?.enrolled && (
          <div className="p-4 rounded-2xl bg-orange-500/8 border border-orange-500/20">
            <p className="text-xs text-orange-200/70 leading-relaxed text-center">
              <span className="font-semibold text-orange-300">Learning Mode</span> — open access, optional quizzes, progress shown as Read / Completed.{" "}
              <span className="font-semibold text-orange-300">Certification Mode</span> — same lessons, quiz gate at 80%, certificate issued on completion.
            </p>
          </div>
        )}
      </div>

      {/* Enroll modal */}
      <AnimatePresence>
        {showEnrollModal && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center px-4 pb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => !enrolling && setShowEnrollModal(false)}
            />
            <motion.div
              className="relative w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-3xl p-6 space-y-5"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
            >
              <button
                className="absolute top-4 right-4 p-1.5 rounded-xl bg-black/40 text-white/50 active:scale-95"
                onClick={() => !enrolling && setShowEnrollModal(false)}
              >
                <X className="h-4 w-4" />
              </button>

              <div className="text-center space-y-2 pt-1">
                <div className="flex justify-center">
                  <div className="p-3 rounded-2xl bg-orange-500/15 border border-orange-500/25">
                    <GraduationCap className="h-7 w-7 text-orange-400" />
                  </div>
                </div>
                <h2 className="text-base font-bold text-white">
                  How would you like to learn?
                </h2>
                <p className="text-xs text-white/50 leading-relaxed">
                  Both modes use the same lessons and exercises. The difference is how your progress is tracked.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => handleEnroll(false)}
                  disabled={enrolling}
                  className="w-full p-4 rounded-2xl bg-white/8 border border-white/15 text-left active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  <p className="text-sm font-bold text-white">Learning Mode</p>
                  <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
                    Open access · Optional quizzes · Progress shown as Read / Completed
                  </p>
                </button>

                <button
                  onClick={() => handleEnroll(true)}
                  disabled={enrolling}
                  className="w-full p-4 rounded-2xl bg-orange-600/20 border border-orange-500/40 text-left active:scale-[0.98] transition-transform disabled:opacity-50"
                >
                  <p className="text-sm font-bold text-orange-300">
                    Certification Mode
                  </p>
                  <p className="text-xs text-orange-200/60 mt-0.5 leading-relaxed">
                    Sequential unlock · 80% quiz gate · Certificate issued on completion
                  </p>
                </button>
              </div>

              {enrolling && (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 text-orange-400 animate-spin" />
                  <span className="text-xs text-white/50">Starting…</span>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
