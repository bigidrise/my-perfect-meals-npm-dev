import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { XCircle, ChevronRight, Award } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";
import { AcademyBackButton } from "@/components/AcademyBackButton";

interface QuizOption {
  id: string;
  optionText: string;
  sortOrder: number;
}

interface QuizQuestion {
  id: string;
  questionText: string;
  options: QuizOption[];
}

interface CertModule {
  slug: string;
  title: string;
  moduleType: "quiz" | "final_assessment";
  passingScorePct: number;
  questionLimit: number;
  questions?: QuizQuestion[];
}

type QuizPhase = "taking" | "results";

function shuffleArray<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function shuffleQuestions(qs: QuizQuestion[]): QuizQuestion[] {
  return qs.map((q) => ({ ...q, options: shuffleArray(q.options) }));
}

function getModuleNum(slug: string): string | null {
  const m = slug.match(/^quiz-(\d+)$/);
  return m ? m[1] : null;
}

export default function PlatformCertQuiz() {
  const [, setLocation] = useLocation();
  const params = useParams<{ certType: string; slug: string }>();
  const certType = params.certType ?? "platform";
  const slug = params.slug ?? "";

  const [module, setModule] = useState<CertModule | null>(null);
  const [rawQuestions, setRawQuestions] = useState<QuizQuestion[]>([]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<QuizPhase>("taking");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [result, setResult] = useState<{ score: number; passed: boolean; correct: number; total: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasNextModule, setHasNextModule] = useState(false);

  const isFinal = slug === "final";
  const passingScore = module?.passingScorePct ?? 80;
  const moduleNum = getModuleNum(slug);
  const videoSlug = moduleNum ? `module-${moduleNum}` : null;
  const quizBackTarget = isFinal
    ? `/certifications/${certType}`
    : videoSlug
      ? `/certifications/${certType}/video/${videoSlug}`
      : `/certifications/${certType}`;

  useEffect(() => {
    if (!slug) return;
    apiRequest(`/api/certifications/${certType}/modules`)
      .then((data: { modules: CertModule[] }) => {
        const mods = data.modules ?? [];
        const mod = mods.find((m) => m.slug === slug);
        if (mod) {
          setModule(mod);
          const qs = mod.questions ?? [];
          setRawQuestions(qs);
          setQuestions(shuffleQuestions(qs));
          const idx = mods.findIndex((m) => m.slug === slug);
          setHasNextModule(idx !== -1 && idx < mods.length - 1);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [certType, slug]);

  const currentQuestion = questions[currentIdx];
  const totalQuestions = questions.length;
  const progressPct = totalQuestions > 0 ? Math.round(((currentIdx + 1) / totalQuestions) * 100) : 0;

  const handleAnswer = (optionId: string) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionId }));
  };

  const handleNext = () => {
    if (currentIdx < totalQuestions - 1) {
      setCurrentIdx((i) => i + 1);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await apiRequest(`/api/certifications/${certType}/modules/${slug}/quiz/evaluate`, {
        method: "POST",
        body: JSON.stringify({ answers }),
        headers: { "Content-Type": "application/json" },
      }) as { ok: boolean; score: number; passed: boolean; correct: number; total: number };
      setResult(res);
      setPhase("results");
    } catch {
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetake = () => {
    setAnswers({});
    setCurrentIdx(0);
    setPhase("taking");
    setResult(null);
    setQuestions(shuffleQuestions(rawQuestions));
  };

  const handleReviewTraining = () => {
    if (videoSlug) {
      setLocation(`/certifications/${certType}/video/${videoSlug}`);
    } else {
      setLocation(`/certifications/${certType}`);
    }
  };

  const handleContinue = () => {
    setLocation(`/certifications/${certType}`);
  };

  if (loading) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT}`}>
        <div className={`academy-navigation-header fixed top-0 left-0 right-0 z-50 ${BC_HEADER}`} style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <div className="px-4 py-3 max-w-2xl mx-auto">
            <AcademyBackButton onClick={() => setLocation(`/certifications/${certType}`)} />
          </div>
        </div>
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-2 border-orange-400/40 border-t-orange-400 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT}`}>
        <div className={`academy-navigation-header fixed top-0 left-0 right-0 z-50 ${BC_HEADER}`} style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <div className="px-4 py-3 max-w-2xl mx-auto">
            <AcademyBackButton onClick={() => setLocation(`/certifications/${certType}`)} />
          </div>
        </div>
        <div className="flex flex-col items-center justify-center gap-4 px-4 min-h-screen">
          <p className="text-white/50 text-sm text-center">Quiz questions are being prepared for this module.</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} pb-28`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className={`academy-navigation-header fixed top-0 left-0 right-0 z-50 ${BC_HEADER}`} style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <AcademyBackButton onClick={() => setLocation(quizBackTarget)} />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white truncate">
              {phase === "taking" ? "Knowledge Check" : "Quiz Results"}
            </h1>
            {phase === "taking" && <p className="text-xs text-white/40">Question {currentIdx + 1} of {totalQuestions}</p>}
          </div>
        </div>
        {phase === "taking" && (
          <div className="px-4 pb-2 max-w-2xl mx-auto">
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div className="h-full bg-orange-500 rounded-full" animate={{ width: `${progressPct}%` }} transition={{ duration: 0.3 }} />
            </div>
          </div>
        )}
      </div>

      <div className="px-4 max-w-2xl mx-auto" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}>
        <AnimatePresence mode="wait">
          {/* ── QUIZ TAKING ── */}
          {phase === "taking" && currentQuestion && (
            <motion.div
              key={`q-${currentIdx}`}
              className="space-y-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="p-5 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10">
                <p className="text-sm font-semibold text-white leading-relaxed">{currentQuestion.questionText}</p>
              </div>

              <div className="space-y-2">
                {currentQuestion.options.map((opt) => {
                  const isSelected = answers[currentQuestion.id] === opt.id;
                  return (
                    <motion.button
                      key={opt.id}
                      className={`w-full text-left p-4 rounded-2xl border text-sm font-medium transition-all duration-150 active:scale-[0.98] ${isSelected ? "bg-orange-500/20 border-orange-500/60 text-white" : "bg-black/20 border-white/10 text-white/70"}`}
                      onClick={() => handleAnswer(opt.id)}
                      whileTap={{ scale: 0.98 }}
                    >
                      {opt.optionText}
                    </motion.button>
                  );
                })}
              </div>

              <button
                className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm flex items-center justify-between active:scale-[0.98] transition-transform disabled:opacity-40"
                disabled={!answers[currentQuestion.id] || submitting}
                onClick={handleNext}
              >
                <span>{currentIdx < totalQuestions - 1 ? "Next Question" : "Submit"}</span>
                {submitting ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <ChevronRight className="h-5 w-5" />}
              </button>
            </motion.div>
          )}

          {/* ── RESULTS ── */}
          {phase === "results" && result && (
            <motion.div
              key="results"
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Score card */}
              <div className={`p-6 rounded-2xl border text-center ${result.passed ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}>
                {result.passed ? (
                  <Award className="h-12 w-12 text-green-400 mx-auto mb-3" />
                ) : (
                  <XCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                )}
                <p className="text-4xl font-black text-white mb-1">{result.score}%</p>
                <p className={`text-xs text-white/50 mb-4`}>
                  {result.correct} of {result.total} correct · {passingScore}% required to pass
                </p>
                {result.passed ? (
                  <p className="text-sm font-semibold text-green-400 leading-snug">
                    Congratulations. You have successfully completed{moduleNum ? ` Module ${moduleNum}` : isFinal ? " the final assessment" : " this module"}.
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-red-400">
                    You must score at least {passingScore}% to continue.
                  </p>
                )}
              </div>

              {/* Action buttons */}
              {result.passed ? (
                <button
                  onClick={handleContinue}
                  className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform"
                >
                  {moduleNum
                    ? (hasNextModule ? `Continue to Module ${parseInt(moduleNum) + 1} →` : "Complete Certification →")
                    : isFinal ? "View Certificate →" : "Continue →"}
                </button>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={handleReviewTraining}
                    className="flex-1 p-4 rounded-2xl bg-white/10 text-white font-semibold text-sm active:scale-[0.98] transition-transform"
                  >
                    Review Training
                  </button>
                  <button
                    onClick={handleRetake}
                    className="flex-1 p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform"
                  >
                    Retake Quiz
                  </button>
                </div>
              )}

              {/* Submitted-answer review; the server intentionally never discloses answer keys. */}
              <div className="space-y-2 pt-2">
                <p className="text-xs text-white/30 uppercase tracking-widest font-semibold px-1">Your Submitted Answers</p>
                {questions.map((q) => {
                  const userAnswer = answers[q.id];
                  const userOpt = q.options.find((o) => o.id === userAnswer);
                  return (
                    <div key={q.id} className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] text-xs">
                      <p className="text-white/80 font-medium mb-2 text-sm leading-snug">{q.questionText}</p>
                      <p className="text-white/60">
                        Your answer: {userOpt?.optionText ?? "Not answered"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
