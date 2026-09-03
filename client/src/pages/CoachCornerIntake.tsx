import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PillButton } from "@/components/ui/pill-button";
import { ChevronLeft } from "lucide-react";
import type { CoachCornerQuestion } from "@shared/coachCornerTypes";

interface QuestionsResponse {
  questions: CoachCornerQuestion[];
}

export default function CoachCornerIntake() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

  const { data, isLoading } = useQuery<QuestionsResponse>({
    queryKey: ["/api/coach-corner/questions"],
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/coach-corner/intake", {
        method: "POST",
        body: JSON.stringify({ answers }),
      }),
    onSuccess: () => setLocation("/coach-corner/complete"),
  });

  const questions = data?.questions ?? [];
  const question = questions[step];

  if (isLoading || !question) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black/60 via-orange-600 to-black/80 flex items-center justify-center text-white/70 text-sm">
        Loading your intake...
      </div>
    );
  }

  const current = answers[question.id];
  const selectedValues: string[] = Array.isArray(current)
    ? current
    : current
      ? [current]
      : [];

  const toggleOption = (value: string) => {
    if (question.multiSelect) {
      const max = question.maxSelect ?? question.options.length;
      const already = selectedValues.includes(value);
      let next: string[];
      if (already) {
        next = selectedValues.filter((v) => v !== value);
      } else {
        next = [...selectedValues, value].slice(-max);
      }
      setAnswers((prev) => ({ ...prev, [question.id]: next }));
    } else {
      setAnswers((prev) => ({ ...prev, [question.id]: value }));
    }
  };

  const canContinue = selectedValues.length > 0;
  const isLast = step === questions.length - 1;

  const handleNext = () => {
    if (isLast) {
      submitMutation.mutate();
    } else {
      setStep((s) => s + 1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black/60 via-orange-600 to-black/80 text-white flex flex-col" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="flex items-center justify-between px-4 pt-6 pb-2">
        <button
          onClick={() =>
            step === 0 ? setLocation("/coach-corner/welcome") : setStep((s) => s - 1)
          }
          className="w-9 h-9 rounded-full bg-black/40 border border-white/10 flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5 text-white/80" />
        </button>
        <span className="text-xs font-medium text-white/60 uppercase tracking-wide">
          Question {step + 1} of {questions.length}
        </span>
        <div className="w-9" />
      </div>

      <div className="px-4 mb-6">
        <div className="w-full h-1.5 rounded-full bg-black/30 overflow-hidden">
          <div
            className="h-full bg-orange-400 transition-all duration-300"
            style={{ width: `${((step + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 px-4">
        <h1 className="text-xl font-bold text-white mb-2 leading-snug">
          {question.prompt}
        </h1>
        {question.multiSelect && (
          <p className="text-xs text-white/60 mb-5">
            Choose up to {question.maxSelect ?? question.options.length}
          </p>
        )}
        {!question.multiSelect && <div className="mb-5" />}

        <div className="flex flex-col gap-3">
          {question.options.map((opt) => {
            const isActive = selectedValues.includes(opt.value);
            return (
              <PillButton
                key={opt.value}
                active={isActive}
                onClick={() => toggleOption(opt.value)}
                className="!w-full !justify-start !text-left !text-[13px] !normal-case !py-3 !px-4 !rounded-xl"
              >
                {opt.label}
              </PillButton>
            );
          })}
        </div>
      </div>

      <div className="p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
        <PillButton
          active
          disabled={!canContinue || submitMutation.isPending}
          onClick={handleNext}
          className="w-full !min-h-[52px] !text-sm !py-3 !rounded-2xl disabled:opacity-40"
        >
          {isLast
            ? submitMutation.isPending
              ? "Saving..."
              : "Finish"
            : "Next"}
        </PillButton>
      </div>
    </div>
  );
}
