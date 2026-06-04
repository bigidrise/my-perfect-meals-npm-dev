import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getModuleById, PASSING_SCORE } from "@/data/affiliateCertification";
import { apiRequest } from "@/lib/queryClient";

type AnswerMap = Record<string, number>;
type Phase = "quiz" | "results";

export default function CertificationQuiz() {
  const [, setLocation] = useLocation();
  const params = useParams<{ pathId: string; moduleId: string }>();
  const pathId = params.pathId ?? "social";
  const moduleId = params.moduleId ?? "";
  const certType = `affiliate_${pathId}`;
  const module = getModuleById(moduleId);

  const [answers, setAnswers] = useState<AnswerMap>({});
  const [phase, setPhase] = useState<Phase>("quiz");
  const [score, setScore] = useState(0);
  const [saving, setSaving] = useState(false);

  if (!module) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/50">Module not found.</p>
      </div>
    );
  }

  const { questions, passingScore } = module.quiz;
  const allAnswered = questions.every((q) => answers[q.id] !== undefined);

  const handleSubmit = async () => {
    if (!allAnswered) return;

    const correct = questions.filter((q) => answers[q.id] === q.correctIndex).length;
    const pct = Math.round((correct / questions.length) * 100);
    const passed = pct >= passingScore;
    setScore(pct);
    setPhase("results");

    setSaving(true);
    try {
      await apiRequest(`/api/certifications/${certType}/modules/${moduleId}/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: pct, passed }),
      });
    } catch {
      // non-fatal
    } finally {
      setSaving(false);
    }
  };

  const handleRetry = () => {
    setAnswers({});
    setPhase("quiz");
    setScore(0);
  };

  const passed = score >= passingScore;
  const isFinal = moduleId === "final-assessment";

  const handleContinue = async () => {
    if (isFinal) {
      setSaving(true);
      try {
        const res = await apiRequest(`/api/certifications/${certType}/complete`, {
          method: "POST",
        });
        const json = await res.json();
        if (json.ok) {
          setLocation(`/business-center/affiliate/${pathId}/certification/complete`);
          return;
        }
      } catch {
        // fall through to dashboard
      } finally {
        setSaving(false);
      }
    }
    setLocation(`/business-center/affiliate/${pathId}/certification`);
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-900 to-black/80 pb-28"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          {phase === "quiz" && (
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
          <h1 className="text-base font-bold text-white">
            {isFinal ? "Final Assessment" : `${module.title} — Quiz`}
          </h1>
        </div>
      </div>

      <div
        className="px-4 max-w-2xl mx-auto space-y-5"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}
      >
        <AnimatePresence mode="wait">
          {phase === "quiz" && (
            <motion.div
              key="quiz"
              className="space-y-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <p className="text-sm text-white/50 text-center">
                {questions.length} questions · {passingScore}% to pass
              </p>

              {questions.map((q, qi) => (
                <motion.div
                  key={q.id}
                  className="space-y-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: qi * 0.04 }}
                >
                  <p className="text-sm font-semibold text-white leading-relaxed">
                    <span className="text-orange-400 mr-1">{qi + 1}.</span>
                    {q.question}
                  </p>
                  <div className="flex flex-col gap-2">
                    {q.options.map((option, oi) => {
                      const selected = answers[q.id] === oi;
                      return (
                        <button
                          key={oi}
                          onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                          className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-150 active:scale-[0.98] ${
                            selected
                              ? "bg-orange-600 border-orange-500 text-white"
                              : "bg-white/5 border-white/10 text-white/80"
                          }`}
                        >
                          <span className="opacity-50 mr-2">{String.fromCharCode(65 + oi)}.</span>
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              ))}

              <button
                onClick={handleSubmit}
                disabled={!allAnswered}
                className={`w-full p-4 rounded-2xl font-bold text-sm transition-all duration-200 active:scale-[0.98] ${
                  allAnswered
                    ? "bg-orange-600 text-white"
                    : "bg-white/10 text-white/30 cursor-default"
                }`}
              >
                {allAnswered ? "Submit Quiz" : `Answer all ${questions.length} questions to submit`}
              </button>
            </motion.div>
          )}

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
                    ? "bg-green-500/10 border-green-500/30"
                    : "bg-red-500/10 border-red-500/30"
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
                <p className="text-xs text-white/40 mt-1">
                  {passed
                    ? "You met the passing score."
                    : `You need ${passingScore}% to pass. Review the lesson and try again.`}
                </p>
              </div>

              {/* Answer review */}
              <div className="space-y-4">
                <p className="text-xs text-white/40 font-semibold uppercase tracking-wide">Answer Review</p>
                {questions.map((q, qi) => {
                  const chosen = answers[q.id];
                  const correct = chosen === q.correctIndex;
                  return (
                    <div
                      key={q.id}
                      className={`p-4 rounded-xl border ${
                        correct ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"
                      }`}
                    >
                      <p className="text-xs font-semibold text-white mb-2">
                        {qi + 1}. {q.question}
                      </p>
                      <p className={`text-xs ${correct ? "text-green-400" : "text-red-400"}`}>
                        Your answer: {q.options[chosen]}
                      </p>
                      {!correct && (
                        <p className="text-xs text-white/50 mt-1">
                          Correct: {q.options[q.correctIndex]}
                        </p>
                      )}
                      <p className="text-xs text-white/40 mt-2 leading-relaxed">{q.explanation}</p>
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              {passed ? (
                <button
                  onClick={handleContinue}
                  disabled={saving}
                  className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform"
                >
                  {saving ? "Saving…" : isFinal ? "Complete Certification" : "Continue"}
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
