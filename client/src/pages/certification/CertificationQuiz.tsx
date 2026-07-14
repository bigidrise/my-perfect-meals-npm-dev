import { useEffect, useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, CheckCircle2, XCircle, RotateCcw, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getModuleById, getCoachingModuleById, getNextModuleId, getNextCoachingModuleId, PASSING_SCORE } from "@/data/affiliateCertification";
import { apiRequest } from "@/lib/queryClient";
import { BC_HEADER } from "@/components/BusinessCenterShell";

type AnswerMap = Record<string, number>;
type Phase = "loading" | "quiz" | "results";

export default function CertificationQuiz() {
  const [, setLocation] = useLocation();
  const params = useParams<{ pathId: string; moduleId: string }>();
  const pathId = params.pathId ?? "social";
  const moduleId = params.moduleId ?? "";
  const certType = `affiliate_${pathId}`;
  const module = pathId === "coaching" ? getCoachingModuleById(moduleId) : getModuleById(moduleId);

  const [phase, setPhase] = useState<Phase>("loading");
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [score, setScore] = useState(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  useEffect(() => {
    if (!moduleId) return;
    apiRequest(`/api/certifications/${certType}/modules/${moduleId}/quiz-attempt`)
      .then((data) => {
        if (data.attempt?.answersJson) {
          setAnswers(data.attempt.answersJson as AnswerMap);
        }
      })
      .catch(() => {})
      .finally(() => setPhase("quiz"));
  }, [certType, moduleId]);

  if (!module) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black flex items-center justify-center">
        <p className="text-gray-400">Module not found.</p>
      </div>
    );
  }

  const { questions, passingScore } = module.quiz;
  const answeredCount = questions.filter((q) => answers[q.id] !== undefined).length;
  const allAnswered = answeredCount === questions.length;
  const isFinal = moduleId === "final-assessment";

  const saveAnswer = (questionId: string, answerIndex: number) => {
    apiRequest(`/api/certifications/${certType}/modules/${moduleId}/quiz-attempt/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, answerIndex }),
    }).catch(() => {});
  };

  const clearAttempt = () => {
    apiRequest(`/api/certifications/${certType}/modules/${moduleId}/quiz-attempt`, {
      method: "DELETE",
    }).catch(() => {});
  };

  const handleAnswer = (questionId: string, answerIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answerIndex }));
    saveAnswer(questionId, answerIndex);
  };

  const handleSubmit = async () => {
    if (!allAnswered || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);

    const correct = questions.filter((q) => answers[q.id] === q.correctIndex).length;
    const pct = Math.round((correct / questions.length) * 100);
    const passed = pct >= passingScore;
    setScore(pct);

    try {
      await apiRequest(`/api/certifications/${certType}/modules/${moduleId}/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: pct, passed }),
      });
      clearAttempt();
    } catch {
      // non-fatal
    } finally {
      setSaving(false);
      savingRef.current = false;
    }

    setPhase("results");
  };

  const handleRetry = () => {
    clearAttempt();
    setAnswers({});
    setScore(0);
    setPhase("quiz");
  };

  const handleContinue = () => {
    const nextId = pathId === "coaching" ? getNextCoachingModuleId(moduleId) : getNextModuleId(moduleId);
    if (nextId) {
      setLocation(`/business-center/affiliate/${pathId}/certification/${nextId}`);
    } else {
      setLocation(`/business-center/affiliate/${pathId}/certification`);
    }
  };

  const passed = score >= passingScore;

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black pb-28"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div
        className={`fixed top-0 left-0 right-0 z-50 ${BC_HEADER}`}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          {phase !== "results" && (
            <button
              onClick={() =>
                setLocation(`/business-center/affiliate/${pathId}/certification/${moduleId}`)
              }
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white truncate">
              {isFinal ? "Final Assessment" : `${module.title} — Quiz`}
            </h1>
            {phase === "quiz" && answeredCount > 0 && answeredCount < questions.length && (
              <p className="text-xs text-orange-400">
                {answeredCount} of {questions.length} answered · progress saved
              </p>
            )}
          </div>
        </div>
      </div>

      <div
        className="px-4 max-w-2xl mx-auto space-y-5"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}
      >
        <AnimatePresence mode="wait">

          {/* Loading */}
          {phase === "loading" && (
            <motion.div
              key="loading"
              className="flex flex-col items-center justify-center py-24 gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="w-6 h-6 border-2 border-orange-400/40 border-t-orange-400 rounded-full animate-spin" />
              <p className="text-xs text-gray-400">Restoring your progress…</p>
            </motion.div>
          )}

          {/* Quiz */}
          {phase === "quiz" && (
            <motion.div
              key="quiz"
              className="space-y-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Resume banner */}
              {answeredCount > 0 && answeredCount < questions.length && (
                <motion.div
                  className="flex items-center gap-3 p-3 rounded-xl bg-orange-500/20 border border-orange-500/40"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <BookOpen className="h-4 w-4 text-orange-400 flex-shrink-0" />
                  <p className="text-xs text-orange-300">
                    Resuming — your answers have been saved. Continue where you left off.
                  </p>
                </motion.div>
              )}

              <p className="text-sm text-gray-400 text-center">
                {questions.length} questions · {passingScore}% to pass
              </p>

              {/* Question cards */}
              {questions.map((q, qi) => (
                <motion.div
                  key={q.id}
                  className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: qi * 0.03 }}
                >
                  <div className="px-5 pt-5 pb-4">
                    <p className="text-sm font-semibold text-white leading-relaxed mb-4">
                      <span className="text-orange-400 mr-1.5">{qi + 1}.</span>
                      {q.question}
                    </p>
                    <div className="flex flex-col gap-2">
                      {q.options.map((option, oi) => {
                        const selected = answers[q.id] === oi;
                        return (
                          <button
                            key={oi}
                            onClick={() => handleAnswer(q.id, oi)}
                            className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-150 active:scale-[0.98] ${
                              selected
                                ? "bg-orange-600 border-orange-600 text-white"
                                : "bg-white/5 border-white/10 text-gray-200"
                            }`}
                          >
                            <span className={`mr-2 ${selected ? "text-orange-200" : "text-gray-500"}`}>
                              {String.fromCharCode(65 + oi)}.
                            </span>
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              ))}

              <button
                onClick={handleSubmit}
                disabled={!allAnswered || saving}
                className={`w-full p-4 rounded-2xl font-bold text-sm transition-all duration-200 active:scale-[0.98] ${
                  allAnswered && !saving
                    ? "bg-orange-600 text-white"
                    : "bg-white/10 text-white/30 cursor-default"
                }`}
              >
                {saving
                  ? "Submitting…"
                  : allAnswered
                  ? "Submit Quiz"
                  : `${questions.length - answeredCount} question${questions.length - answeredCount !== 1 ? "s" : ""} remaining`}
              </button>
            </motion.div>
          )}

          {/* Results */}
          {phase === "results" && (
            <motion.div
              key="results"
              className="space-y-5"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Score card */}
              <div
                className={`p-6 rounded-2xl text-center border ${
                  passed
                    ? "bg-green-900/30 border-green-500/30"
                    : "bg-red-900/30 border-red-500/30"
                }`}
              >
                {passed ? (
                  <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto mb-3" />
                ) : (
                  <XCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
                )}
                <p className="text-4xl font-bold text-white mb-1">{score}%</p>
                <p className={`text-sm font-semibold ${passed ? "text-green-400" : "text-red-400"}`}>
                  {passed ? "Passed" : "Not Passed"}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {passed
                    ? "You met the passing score."
                    : `You need ${passingScore}% to pass. Review the lesson and try again.`}
                </p>
              </div>

              {/* Answer review */}
              <div className="space-y-3">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide px-1">
                  Answer Review
                </p>
                {questions.map((q, qi) => {
                  const chosen = answers[q.id];
                  const correct = chosen === q.correctIndex;
                  return (
                    <div
                      key={q.id}
                      className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden"
                    >
                      <div className={`h-1 w-full ${correct ? "bg-green-500" : "bg-red-500"}`} />
                      <div className="px-5 py-4 space-y-2">
                        <p className="text-sm font-semibold text-white">
                          {qi + 1}. {q.question}
                        </p>
                        <p className={`text-sm font-medium ${correct ? "text-green-400" : "text-red-400"}`}>
                          {correct ? "✓ " : "✗ "}Your answer: {q.options[chosen]}
                        </p>
                        {!correct && (
                          <p className="text-sm text-gray-300">
                            Correct: {q.options[q.correctIndex]}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 leading-relaxed pt-1 border-t border-white/5">
                          {q.explanation}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              {passed ? (
                <button
                  onClick={handleContinue}
                  className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform"
                >
                  {isFinal ? "Complete Certification →" : "Continue →"}
                </button>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      setLocation(`/business-center/affiliate/${pathId}/certification/${moduleId}`)
                    }
                    className="flex-1 p-4 rounded-2xl bg-white/10 text-white font-semibold text-sm active:scale-[0.98] transition-transform"
                  >
                    Review Lesson
                  </button>
                  <button
                    onClick={handleRetry}
                    className="flex-1 p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Retry Quiz
                  </button>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  );
}
