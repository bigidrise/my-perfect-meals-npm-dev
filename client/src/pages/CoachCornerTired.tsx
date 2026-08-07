import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PillButton } from "@/components/ui/pill-button";
import { ChevronLeft } from "lucide-react";
import type {
  CoachMealAction,
  CoachMealActionType,
  PerceivedTiredDuration,
  SleepQuality,
  TiredContext,
  TiredResponse,
  TiredTiming,
} from "@shared/coachCornerTypes";

// Frontend-owned routing table — AI only emits controlled actionType strings
const MEAL_ACTION_ROUTES: Record<CoachMealActionType, string> = {
  create_dessert: "/craving-desserts",
  create_beverage: "/lifestyle/beverage-creator",
  create_meal: "/lifestyle/create-a-dish",
};

interface ContextResponse {
  context: TiredContext;
}

interface ResolveResponse {
  context: TiredContext;
  response: TiredResponse & {
    coachMessage?: string;
    suggestedMealActions?: CoachMealAction[];
  };
}

const DURATION_OPTIONS: { value: PerceivedTiredDuration; label: string }[] = [
  { value: "today", label: "Just today" },
  { value: "few_days", label: "The last few days" },
  { value: "week_plus", label: "A week or more" },
];

const TIMING_OPTIONS: { value: TiredTiming; label: string }[] = [
  { value: "all_day", label: "All day" },
  { value: "afternoon_slump", label: "Mostly in the afternoon" },
  { value: "after_meals", label: "Mostly right after meals" },
];

const SLEEP_OPTIONS: { value: SleepQuality; label: string }[] = [
  { value: "normal", label: "Sleeping normally" },
  { value: "poor", label: "Sleeping poorly" },
  { value: "not_sure", label: "Not sure" },
];

export default function CoachCornerTired() {
  const [, setLocation] = useLocation();
  const [duration, setDuration] = useState<PerceivedTiredDuration | null>(null);
  const [timing, setTiming] = useState<TiredTiming | null>(null);
  const [sleepQuality, setSleepQuality] = useState<SleepQuality | null>(null);
  const [result, setResult] = useState<TiredResponse | null>(null);

  const { isLoading } = useQuery<ContextResponse>({
    queryKey: ["/api/coach-corner/situations/tired/context"],
  });

  const [mealActions, setMealActions] = useState<CoachMealAction[]>([]);

  const resolveMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/coach-corner/situations/tired/resolve", {
        method: "POST",
        body: JSON.stringify({ duration, timing, sleepQuality }),
      }),
    onSuccess: (data: ResolveResponse) => {
      setResult(data.response);
      setMealActions(data.response.suggestedMealActions ?? []);
    },
  });

  const canSubmit = !!duration && !!timing && !!sleepQuality;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black/60 via-orange-600 to-black/80 flex items-center justify-center text-white/70 text-sm">
        Loading...
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black/60 via-orange-600 to-black/80 text-white flex flex-col" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="flex-1 overflow-y-auto px-4 pb-10">
          <div className="pt-14 pb-2" />
          <div className="flex flex-col items-center mb-6 text-center">
            <img
              src="/assets/ProCareChef.png"
              alt="Chef"
              className="w-[18rem] h-auto -mb-3"
            />
          </div>

          {/*
            One coach, one message. `science` and `philosophy` are kept as
            separate fields internally (response-pipeline placeholders for
            future Science/Philosophy Libraries) but are rendered together
            here as plain paragraphs — the user should never see them as
            labeled sections.
          */}
          <div className="rounded-xl border border-white/10 bg-black/30 backdrop-blur-sm p-5 mb-4 text-sm text-white/85 leading-relaxed space-y-3">
            <p>{result.message.acknowledgment}</p>
            <p className="font-semibold text-orange-300">{result.message.recommendation}</p>
            <p>{result.message.science}</p>
            <p>{result.message.philosophy}</p>
            <p>{result.message.whatToWatchFor}</p>
            <p>{result.message.action}</p>
          </div>

          {mealActions.length > 0 && (
            <div className="mb-4">
              <p className="text-[10.5px] text-orange-300/80 uppercase tracking-widest font-medium mb-2">
                Make it now
              </p>
              <div className="flex flex-col gap-2">
                {mealActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => setLocation(MEAL_ACTION_ROUTES[action.actionType])}
                    className="
                      text-left text-[13px] font-medium text-orange-200
                      px-4 py-3 rounded-xl
                      bg-orange-900/40 border border-orange-500/40
                      hover:bg-orange-800/50 hover:border-orange-400/60
                      active:scale-[0.97] transition-all duration-150
                      flex items-center justify-between gap-2
                      w-full
                    "
                  >
                    <span>🍽 {action.label}</span>
                    <span className="text-orange-400/80 shrink-0">→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 items-center pb-6">
            {result.routeTo && (
              <PillButton
                active
                onClick={() => setLocation(result.routeTo!.path)}
                className="w-full !min-h-[48px] !text-sm !py-3 !rounded-2xl"
              >
                {result.routeTo.label}
              </PillButton>
            )}
            <PillButton
              onClick={() => setLocation("/coach-corner/home")}
              className="!min-h-[40px] !text-xs !py-2 !px-6 !rounded-full"
            >
              Back to Coach's Corner
            </PillButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black/60 via-orange-600 to-black/80 text-white flex flex-col" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="flex items-center justify-between px-4 pt-6 pb-2">
        <button
          onClick={() => setLocation("/coach-corner/home")}
          className="w-9 h-9 rounded-full bg-black/40 border border-white/10 flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5 text-white/80" />
        </button>
        <span className="text-xs font-medium text-white/60 uppercase tracking-wide">
          I'm feeling tired
        </span>
        <div className="w-9" />
      </div>

      <div className="flex-1 px-4 overflow-y-auto pb-6">
        <h1 className="text-xl font-bold text-white mb-5 leading-snug">
          How long have you been feeling this way?
        </h1>
        <div className="flex flex-col gap-3 mb-8">
          {DURATION_OPTIONS.map((opt) => (
            <PillButton
              key={opt.value}
              active={duration === opt.value}
              onClick={() => setDuration(opt.value)}
              className="!w-full !justify-start !text-left !text-[13px] !normal-case !py-3 !px-4 !rounded-xl"
            >
              {opt.label}
            </PillButton>
          ))}
        </div>

        <h2 className="text-lg font-bold text-white mb-5 leading-snug">
          When do you notice it most?
        </h2>
        <div className="flex flex-col gap-3 mb-8">
          {TIMING_OPTIONS.map((opt) => (
            <PillButton
              key={opt.value}
              active={timing === opt.value}
              onClick={() => setTiming(opt.value)}
              className="!w-full !justify-start !text-left !text-[13px] !normal-case !py-3 !px-4 !rounded-xl"
            >
              {opt.label}
            </PillButton>
          ))}
        </div>

        <h2 className="text-lg font-bold text-white mb-5 leading-snug">
          How has your sleep been lately?
        </h2>
        <div className="flex flex-col gap-3 mb-8">
          {SLEEP_OPTIONS.map((opt) => (
            <PillButton
              key={opt.value}
              active={sleepQuality === opt.value}
              onClick={() => setSleepQuality(opt.value)}
              className="!w-full !justify-start !text-left !text-[13px] !normal-case !py-3 !px-4 !rounded-xl"
            >
              {opt.label}
            </PillButton>
          ))}
        </div>
      </div>

      <div className="p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
        <PillButton
          active
          disabled={!canSubmit || resolveMutation.isPending}
          onClick={() => resolveMutation.mutate()}
          className="w-full !min-h-[52px] !text-sm !py-3 !rounded-2xl disabled:opacity-40"
        >
          {resolveMutation.isPending ? "Thinking..." : "Continue"}
        </PillButton>
      </div>
    </div>
  );
}
