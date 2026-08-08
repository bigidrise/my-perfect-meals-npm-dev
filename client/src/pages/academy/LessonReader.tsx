import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  BookOpen,
  Dumbbell,
  Trophy,
  RotateCcw,
  Loader2,
  Lock,
  Circle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { BC_GRADIENT } from "@/components/BusinessCenterShell";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import {
  PLATFORM_MASTERY_LESSONS,
  getLessonById,
  type QuizQuestion,
  type PlatformMasteryLesson,
} from "@/data/platformMasteryLessons";
import { NarrationBar } from "@/components/NarrationBar";
import { useIsDesktop } from "@/hooks/useIsDesktop";

// ── Lesson → Narration converter ─────────────────────────────────────────────
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
}

function lessonToNarrationSections(lesson: PlatformMasteryLesson) {
  const out: Array<{ heading: string; text: string }> = [];
  if (lesson.opening) {
    out.push({ heading: "Introduction", text: stripMarkdown(lesson.opening) });
  }
  for (const section of lesson.sections) {
    out.push({
      heading: section.heading || "Continued",
      text: stripMarkdown(section.body),
    });
  }
  return out;
}

const LESSONS_ORDER = PLATFORM_MASTERY_LESSONS.map((l) => l.id);

// ── Markdown-ish renderer ─────────────────────────────────────────────────────

function renderBody(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let key = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Numbered list item
    if (/^\d+\.\s/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      elements.push(
        <ol key={key++} className="space-y-1.5 my-3 ml-1">
          {listItems.map((item, j) => (
            <li key={j} className="flex items-start gap-2.5 text-sm text-white/75 leading-relaxed">
              <span className="mt-0.5 h-5 w-5 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
                {j + 1}
              </span>
              <span className="flex-1">{renderInline(item)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Bullet list item
    if (/^[-*]\s/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        listItems.push(lines[i].replace(/^[-*]\s/, ""));
        i++;
      }
      elements.push(
        <ul key={key++} className="space-y-1.5 my-3">
          {listItems.map((item, j) => (
            <li key={j} className="flex items-start gap-2.5 text-sm text-white/75 leading-relaxed">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
              <span className="flex-1">{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Paragraph
    elements.push(
      <p key={key++} className="text-sm text-white/75 leading-relaxed my-2">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return elements;
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let k = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
    const italicMatch = remaining.match(/^\*(.+?)\*/);

    if (boldMatch) {
      parts.push(
        <strong key={k++} className="font-semibold text-white">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
    } else if (italicMatch) {
      parts.push(
        <em key={k++} className="italic text-white/90">
          {italicMatch[1]}
        </em>
      );
      remaining = remaining.slice(italicMatch[0].length);
    } else {
      const nextSpecial = remaining.search(/\*\*|\*/);
      if (nextSpecial === -1) {
        parts.push(<span key={k++}>{remaining}</span>);
        remaining = "";
      } else {
        parts.push(<span key={k++}>{remaining.slice(0, nextSpecial)}</span>);
        remaining = remaining.slice(nextSpecial);
      }
    }
  }

  return parts;
}

// ── Quiz Component ────────────────────────────────────────────────────────────

interface QuizProps {
  lessonId: string;
  questions: QuizQuestion[];
  isCertTrack: boolean;
  exerciseDone: boolean;
  existingQuizStatus: string;
  existingQuizScore: number | null;
  onQuizComplete: (passed: boolean, score: number) => void;
}

function QuizComponent({
  lessonId,
  questions,
  isCertTrack,
  exerciseDone,
  existingQuizStatus,
  existingQuizScore,
  onQuizComplete,
}: QuizProps) {
  // ── Draft persistence key (follows mpm.* localStorage convention) ──
  const draftKey = `mpm.quiz.draft.${lessonId}`;

  // Lazy initialisers — localStorage is only read once on mount, not on every render
  const [started, setStarted] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem(draftKey) || "null")?.started ?? false; }
    catch { return false; }
  });
  const [currentQ, setCurrentQ] = useState<number>(() => {
    try { return JSON.parse(localStorage.getItem(draftKey) || "null")?.currentQ ?? 0; }
    catch { return 0; }
  });
  const [answers, setAnswers] = useState<Record<number, number>>(() => {
    try { return JSON.parse(localStorage.getItem(draftKey) || "null")?.answers ?? {}; }
    catch { return {}; }
  });
  // True when we're restoring a mid-quiz draft (so we can show a resume banner)
  const isResuming = started && currentQ > 0;
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [passed, setPassed] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Persist draft whenever in-progress state changes
  const draftRef = useRef({ started, currentQ, answers });
  useEffect(() => {
    draftRef.current = { started, currentQ, answers };
  });
  useEffect(() => {
    if (!submitted && started) {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ started, currentQ, answers }));
      } catch { /* quota exceeded — ignore */ }
    }
  }, [started, currentQ, answers, submitted, draftKey]);

  function clearDraft() {
    try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
  }

  const alreadyPassed = existingQuizStatus === "completed";
  const alreadyFailed = existingQuizStatus === "quiz_failed";

  const isGated = isCertTrack && !exerciseDone;

  function handleAnswer(optionIdx: number) {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [currentQ]: optionIdx }));
  }

  function handleNext() {
    if (currentQ < questions.length - 1) {
      setCurrentQ((q) => q + 1);
    } else {
      submitQuiz();
    }
  }

  async function submitQuiz() {
    setSubmitting(true);
    try {
      // Send answers to server — score is computed server-side from the authoritative key
      const result = await apiRequest(
        `/api/academy/platform-mastery/lessons/${lessonId}/quiz`,
        {
          method: "POST",
          body: JSON.stringify({ answers }),
          headers: { "Content-Type": "application/json" },
        }
      ) as { ok: boolean; score: number; passed: boolean };

      const pct = result.score ?? 0;
      const didPass = result.passed ?? false;
      setScore(pct);
      setPassed(didPass);
      setSubmitted(true);
      setShowResults(true);
      clearDraft(); // quiz finished — no longer need the draft
      onQuizComplete(didPass, pct);
    } catch {
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
  }

  function retake() {
    clearDraft(); // starting fresh — wipe any saved progress
    setStarted(true);
    setCurrentQ(0);
    setAnswers({});
    setSubmitted(false);
    setScore(null);
    setPassed(null);
    setShowResults(false);
  }

  // Already passed — show status + retake option
  if (alreadyPassed && !started) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Quiz Passed</p>
            {existingQuizScore != null && (
              <p className="text-xs text-white/50">
                You scored {existingQuizScore}%
              </p>
            )}
          </div>
        </div>
        <button
          onClick={retake}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/8 border border-white/15 text-white/70 text-sm font-medium active:scale-[0.98] transition-transform"
        >
          <RotateCcw className="h-4 w-4" />
          Retake Quiz
        </button>
      </div>
    );
  }

  // Gated by exercise in cert mode
  if (isGated) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
        <Lock className="h-5 w-5 text-white/25 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-white/60">
            Quiz Locked
          </p>
          <p className="text-xs text-white/35 mt-0.5 leading-relaxed">
            Complete the platform exercise above and tap "I Completed the Exercise" to unlock the quiz.
          </p>
        </div>
      </div>
    );
  }

  // Not started yet
  if (!started) {
    return (
      <div className="space-y-3">
        {alreadyFailed && (
          <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-500/10 border border-red-500/25">
            <p className="text-xs text-red-300 leading-relaxed">
              You scored {existingQuizScore}% last time. You need 80% to pass. Try again when you're ready.
            </p>
          </div>
        )}
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-orange-500/8 border border-orange-500/20">
          <Trophy className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-white">
              {alreadyFailed ? "Retry Quiz" : "Ready for the Quiz?"}
            </p>
            <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
              10 questions · {isCertTrack ? "80% required to advance" : "Optional — no gate"}
            </p>
          </div>
        </div>
        <button
          onClick={() => setStarted(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform"
        >
          {alreadyFailed ? "Retry Quiz" : "Start Quiz"}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Results
  if (showResults && score !== null && passed !== null) {
    return (
      <div className="space-y-4">
        <div
          className={`p-5 rounded-2xl border text-center space-y-3 ${passed ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/20"}`}
        >
          <div className="flex justify-center">
            {passed ? (
              <div className="p-3 rounded-2xl bg-emerald-500/20">
                <Trophy className="h-8 w-8 text-emerald-400" />
              </div>
            ) : (
              <div className="p-3 rounded-2xl bg-red-500/15">
                <RotateCcw className="h-8 w-8 text-red-400" />
              </div>
            )}
          </div>
          <div>
            <p className={`text-2xl font-bold ${passed ? "text-emerald-400" : "text-red-400"}`}>
              {score}%
            </p>
            <p className="text-sm font-semibold text-white mt-1">
              {passed ? "Quiz Passed!" : "Not quite — try again"}
            </p>
            <p className="text-xs text-white/50 mt-0.5">
              {passed
                ? "Well done. This lesson is now complete."
                : `You need 80% to pass. You scored ${score}%.`}
            </p>
          </div>
        </div>
        {!passed && (
          <button
            onClick={retake}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform"
          >
            <RotateCcw className="h-4 w-4" />
            Retry Quiz
          </button>
        )}
      </div>
    );
  }

  // In progress
  const q = questions[currentQ];
  const selected = answers[currentQ];
  const answered = selected !== undefined;

  return (
    <div className="space-y-4">
      {/* Resume banner — only shown when restoring a saved draft */}
      {isResuming && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/25">
          <RotateCcw className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
          <p className="text-xs text-orange-200/70">
            Picking up where you left off — Question {currentQ + 1} of {questions.length}
          </p>
        </div>
      )}

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-white/40">
          <span>
            Question {currentQ + 1} of {questions.length}
          </span>
          <span>{Math.round(((currentQ) / questions.length) * 100)}%</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-orange-500 rounded-full"
            animate={{ width: `${((currentQ) / questions.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQ}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="space-y-3"
        >
          <p className="text-sm font-semibold text-white leading-relaxed">
            {q.question}
          </p>

          <div className="space-y-2">
            {q.options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => handleAnswer(idx)}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-150 active:scale-[0.98] ${
                  selected === idx
                    ? "bg-orange-500/20 border-orange-500/50 text-white"
                    : "bg-white/5 border-white/10 text-white/70 active:bg-white/8"
                }`}
              >
                <span className="flex items-start gap-2.5">
                  <span
                    className={`mt-0.5 h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                      selected === idx
                        ? "border-orange-400 bg-orange-400"
                        : "border-white/25"
                    }`}
                  >
                    {selected === idx && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </span>
                  <span className="leading-relaxed">{option}</span>
                </span>
              </button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Next / Submit */}
      {answered && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleNext}
          disabled={submitting}
          className="w-full py-3.5 rounded-xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Scoring…
            </span>
          ) : currentQ < questions.length - 1 ? (
            "Next Question"
          ) : (
            "Submit Quiz"
          )}
        </motion.button>
      )}
    </div>
  );
}

// ── Main LessonReader ─────────────────────────────────────────────────────────

export default function LessonReader() {
  const [, setLocation] = useLocation();
  const params = useParams<{ lessonId: string }>();
  const lessonId = params.lessonId ?? "";
  const { user } = useAuth();
  const isDesktop = useIsDesktop();

  const lesson = getLessonById(lessonId);

  const { toast } = useToast();

  const [status, setStatus] = useState<{
    enrolled: boolean;
    isCertificationTrack: boolean;
    progress: Record<string, { status: string; score: number | null }>;
  } | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [exerciseDone, setExerciseDone] = useState(false);
  const [exerciseLoading, setExerciseLoading] = useState(false);
  const [quizPassed, setQuizPassed] = useState(false);
  const viewedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const d = await apiRequest("/api/academy/platform-mastery/status");

      // Auto-enroll in learning mode on first lesson open.
      // This ensures a user_certifications record always exists so that
      // exercise/quiz progress, and eventually /complete, can reference it.
      // If the user later upgrades to cert track via the Dashboard, the
      // upsert sets isCertificationTrack=true without resetting progress.
      if (!(d as any).enrolled) {
        await apiRequest("/api/academy/platform-mastery/enroll", {
          method: "POST",
          body: JSON.stringify({ isCertificationTrack: false }),
          headers: { "Content-Type": "application/json" },
        }).catch(() => {});
      }

      setStatus(d as any);
      const prog = (d as any).progress ?? {};
      const exSt = prog[`${lessonId}-exercise`]?.status;
      setExerciseDone(exSt === "completed");
      const qSt = prog[`${lessonId}-quiz`]?.status;
      setQuizPassed(qSt === "completed");

      // Sequential unlock guard: cert-track users cannot access a locked lesson
      const isCert = (d as any).isCertificationTrack ?? false;
      if (isCert) {
        const idx = LESSONS_ORDER.indexOf(lessonId);
        if (idx > 0) {
          const priorId = LESSONS_ORDER[idx - 1];
          const priorDone = prog[priorId]?.status === "completed";
          if (!priorDone) {
            const priorLesson = getLessonById(priorId);
            toast({
              title: "Lesson locked",
              description: `Finish Lesson ${priorLesson?.lessonNumber ?? idx} first — complete the exercise and pass the quiz to unlock this lesson.`,
            });
            // Send her back to the lesson she still needs to complete, not just the Academy home
            setLocation(`/academy/platform-mastery/lesson/${priorId}`);
            return;
          }
        }
      }
    } catch {
    } finally {
      setLoadingStatus(false);
    }
  }, [lessonId, setLocation]);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  // Mark lesson as "read" when opened
  useEffect(() => {
    if (!user || !lessonId || viewedRef.current) return;
    viewedRef.current = true;
    apiRequest(`/api/academy/platform-mastery/lessons/${lessonId}/read`, {
      method: "POST",
    }).catch(() => {});
  }, [user, lessonId]);

  const handleImBack = async () => {
    setExerciseLoading(true);
    try {
      await apiRequest(
        `/api/academy/platform-mastery/lessons/${lessonId}/exercise`,
        { method: "POST" }
      );
      setExerciseDone(true);
    } catch {
    } finally {
      setExerciseLoading(false);
    }
  };

  const handleQuizComplete = (passed: boolean, score: number) => {
    if (passed) setQuizPassed(true);
  };

  const nextLessonId = () => {
    const idx = LESSONS_ORDER.indexOf(lessonId);
    if (idx < LESSONS_ORDER.length - 1) return LESSONS_ORDER[idx + 1];
    return null;
  };

  const isLastLesson = LESSONS_ORDER.indexOf(lessonId) === LESSONS_ORDER.length - 1;

  if (!lesson) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-orange-950/20 to-black flex items-center justify-center">
        <p className="text-white/40">Lesson not found.</p>
      </div>
    );
  }

  const isCertTrack = status?.isCertificationTrack ?? false;
  const prog = status?.progress ?? {};
  const lessonStatus = prog[lessonId]?.status ?? "not_started";
  const lessonDone = lessonStatus === "completed";
  const quizProg = prog[`${lessonId}-quiz`];

  return (
    <motion.div
      className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} pb-32`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Lesson header — fixed on desktop (flush under DesktopHeader), sticky on mobile */}
      <div
        className={
          isDesktop
            ? "fixed left-0 md:left-60 right-0 z-40 bg-black/55 backdrop-blur-md border-b border-white/10"
            : "sticky top-0 z-20 bg-black/55 backdrop-blur-md border-b border-white/10"
        }
        style={
          isDesktop
            ? { top: "calc(env(safe-area-inset-top, 0px) + 56px)" }
            : { paddingTop: "env(safe-area-inset-top, 0px)" }
        }
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
            <p className="text-xs text-white/40 font-medium">
              Lesson {lesson.lessonNumber}
            </p>
            <h1 className="text-sm font-bold text-white truncate leading-tight">
              {lesson.title}
            </h1>
          </div>
          {lessonDone && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-900/40 border border-emerald-500/30 flex-shrink-0">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs text-emerald-400 font-semibold">
                Done
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Desktop spacer — pushes content below the fixed banner (banner is ~h-12) */}
      {isDesktop && <div className="h-12" />}

      <div className="px-4 max-w-2xl mx-auto space-y-5 pt-5">
        {/* Lesson header card */}
        <motion.div
          className="bg-white/5 border border-white/10 rounded-2xl px-5 py-5 space-y-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-orange-500/20 flex-shrink-0">
              <BookOpen className="h-6 w-6 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-orange-400 uppercase tracking-widest mb-1">
                Lesson {lesson.lessonNumber} · Platform Mastery
              </p>
              <h2 className="text-lg font-bold text-white leading-tight">
                {lesson.title}
              </h2>
              <p className="text-sm text-white/50 mt-1 leading-relaxed">
                {lesson.subtitle}
              </p>
            </div>
          </div>
          <NarrationBar sections={lessonToNarrationSections(lesson)} />
        </motion.div>

        {/* Learning Objectives */}
        {lesson.learningObjectives && lesson.learningObjectives.length > 0 && (
          <motion.div
            className="bg-orange-500/10 border border-orange-500/25 rounded-2xl px-5 py-4 space-y-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
          >
            <p className="text-xs font-bold text-orange-400 uppercase tracking-widest">
              Learning Objectives
            </p>
            <ul className="space-y-2">
              {lesson.learningObjectives.map((obj, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-[9px] font-bold text-orange-400">
                    {i + 1}
                  </span>
                  <span className="text-sm text-white/75 leading-relaxed">{obj}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Opening paragraph */}
        <motion.div
          className="px-1"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06 }}
        >
          {lesson.opening.split("\n\n").map((para, i) => (
            <p key={i} className="text-sm text-white/80 leading-relaxed mb-3">
              {para}
            </p>
          ))}
        </motion.div>

        {/* Content sections */}
        {lesson.sections.map((section, i) => (
          <motion.div
            key={i}
            className="bg-white/5 border border-white/10 rounded-2xl px-5 py-5 space-y-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + i * 0.05 }}
          >
            {section.heading && (
              <h3 className="text-sm font-bold text-orange-400 leading-snug">
                {section.heading}
              </h3>
            )}
            <div>{renderBody(section.body)}</div>
          </motion.div>
        ))}

        {/* Closing text (before exercise, if any) */}
        {lesson.closing && !isLastLesson && (
          <motion.div
            className="px-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <p className="text-sm text-white/60 leading-relaxed italic text-center">
              {lesson.closing}
            </p>
          </motion.div>
        )}

        {/* ── Platform Exercise ── */}
        <motion.div
          className="rounded-2xl overflow-hidden border-2 border-orange-500/50 bg-gradient-to-b from-orange-950/60 to-black/60"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-orange-500/25 bg-orange-500/10">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-xl bg-orange-500/25 flex-shrink-0">
                <Dumbbell className="h-6 w-6 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-1">
                  Hands-On Practice
                </p>
                <p className="text-lg font-bold text-white leading-tight">
                  Platform Exercise
                </p>
                {exerciseDone && (
                  <p className="text-sm text-emerald-400 font-semibold mt-1 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> Exercise completed
                  </p>
                )}
              </div>
              {exerciseDone && (
                <CheckCircle2 className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-1" />
              )}
            </div>
          </div>

          <div className="px-5 py-5 space-y-5">
            {/* What to do */}
            {!exerciseDone && (
              <div className="bg-orange-500/10 border border-orange-500/25 rounded-xl p-4 space-y-1.5">
                <p className="text-sm font-bold text-orange-300">
                  This is a practical exercise — leave the Academy and go into the app.
                </p>
                <p className="text-sm text-orange-100/70 leading-relaxed">
                  Complete the steps below inside My Perfect Meals, then come back here and tap{" "}
                  <span className="font-bold text-white">"I Completed the Exercise"</span>{" "}
                  to confirm and unlock your quiz.
                </p>
              </div>
            )}

            {/* Steps */}
            <ol className="space-y-3">
              {lesson.exercise.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-orange-100/85 leading-relaxed">
                  <span className="mt-0.5 h-6 w-6 rounded-full bg-orange-500/30 border border-orange-500/50 text-orange-300 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="flex-1 pt-0.5">{renderInline(step)}</span>
                </li>
              ))}
            </ol>

            {/* Return instruction + button */}
            {!exerciseDone && (
              <p className="text-xs text-orange-200/50 text-center leading-relaxed">
                Done with all the steps above? Tap the button below to confirm and unlock your quiz.
              </p>
            )}

            <button
              onClick={handleImBack}
              disabled={exerciseDone || exerciseLoading}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-base transition-all active:scale-[0.98] ${
                exerciseDone
                  ? "bg-emerald-600/25 border border-emerald-500/40 text-emerald-300 cursor-default"
                  : "bg-orange-600 border border-orange-500/60 text-white shadow-lg shadow-orange-900/30"
              } disabled:cursor-default`}
            >
              {exerciseLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : exerciseDone ? (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  Exercise Complete
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  I Completed the Exercise
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* ── Remember Box ── */}
        <motion.blockquote
          className="border-l-4 border-orange-500/60 pl-5 py-2 my-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          <p className="text-sm font-semibold text-orange-200/90 leading-relaxed">
            <span className="text-orange-400 font-bold">Remember: </span>
            {lesson.remember}
          </p>
        </motion.blockquote>

        {/* Closing for last lesson */}
        {isLastLesson && lesson.closing && (
          <motion.div
            className="p-5 rounded-2xl bg-orange-500/10 border border-orange-500/25 text-center space-y-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38 }}
          >
            <p className="text-2xl">🎓</p>
            <p className="text-sm font-semibold text-orange-300 leading-relaxed">
              {lesson.closing}
            </p>
          </motion.div>
        )}

        {/* ── Quiz Section ── */}
        <motion.div
          className="rounded-2xl overflow-hidden bg-white/5 border border-white/10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="px-5 pt-5 pb-4 border-b border-white/8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-orange-500/15">
                <Trophy className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  Lesson Quiz
                </p>
                <p className="text-xs text-white/40 mt-0.5">
                  {isCertTrack
                    ? "Required — 80% to advance · Complete exercise first"
                    : "Optional — test your knowledge"}
                </p>
              </div>
            </div>
          </div>
          <div className="px-5 py-4">
            {loadingStatus ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 text-orange-400 animate-spin" />
              </div>
            ) : (
              <QuizComponent
                lessonId={lessonId}
                questions={lesson.quiz}
                isCertTrack={isCertTrack}
                exerciseDone={exerciseDone}
                existingQuizStatus={quizProg?.status ?? "not_started"}
                existingQuizScore={quizProg?.score ?? null}
                onQuizComplete={handleQuizComplete}
              />
            )}
          </div>
        </motion.div>

        {/* ── Navigation ── */}
        <motion.div
          className="space-y-3 pb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
        >
          {/* Next lesson button */}
          {(() => {
            const next = nextLessonId();
            if (!next) {
              // Last lesson — go to dashboard to claim cert
              return (
                <button
                  onClick={() => setLocation("/academy")}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform"
                >
                  Back to Academy
                  <ChevronRight className="h-4 w-4" />
                </button>
              );
            }

            const nextLesson = getLessonById(next);
            if (!nextLesson) return null;

            // In cert track: only show if exercise done (and quiz passed if applicable)
            const canAdvance = isCertTrack
              ? exerciseDone && (quizPassed || quizProg?.status === "completed")
              : true;

            if (!canAdvance && isCertTrack) {
              const quizDone = quizPassed || quizProg?.status === "completed";
              return (
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-white/25 flex-shrink-0" />
                    <p className="text-xs font-semibold text-white/50">
                      Complete to unlock Lesson {nextLesson.lessonNumber}
                    </p>
                  </div>
                  <div className="space-y-2 ml-6">
                    <div className="flex items-center gap-2">
                      {exerciseDone
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                        : <Circle className="h-4 w-4 text-white/20 flex-shrink-0" />}
                      <span className={`text-xs leading-relaxed ${exerciseDone ? "text-emerald-400" : "text-white/40"}`}>
                        Exercise — go into the app and tap "I'm Back" when done
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {quizDone
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                        : <Circle className="h-4 w-4 text-white/20 flex-shrink-0" />}
                      <span className={`text-xs leading-relaxed ${quizDone ? "text-emerald-400" : "text-white/40"}`}>
                        Quiz — scroll down and score 80% or above to pass
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <button
                onClick={() =>
                  setLocation(`/academy/platform-mastery/lesson/${next}`)
                }
                className="w-full flex items-center justify-between gap-2 py-4 px-5 rounded-2xl bg-white/8 border border-white/15 text-white active:scale-[0.98] transition-transform"
              >
                <div className="text-left">
                  <p className="text-xs text-white/40 font-medium">
                    Next — Lesson {nextLesson.lessonNumber}
                  </p>
                  <p className="text-sm font-semibold text-white mt-0.5">
                    {nextLesson.title}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-white/40 flex-shrink-0" />
              </button>
            );
          })()}

          <button
            onClick={() => setLocation("/academy")}
            className="w-full text-center text-xs text-white/30 py-2 active:text-white/50 transition-colors"
          >
            Back to Academy
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
