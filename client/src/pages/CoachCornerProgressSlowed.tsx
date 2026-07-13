import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { PillButton } from "@/components/ui/pill-button";
import { ChevronLeft } from "lucide-react";
import type {
  PerceivedDuration,
  ProgressSlowedContext,
  ProgressSlowedResponse,
  SelfReportedWeightChange,
} from "@shared/coachCornerTypes";

interface ContextResponse {
  context: ProgressSlowedContext;
}

interface ResolveResponse {
  context: ProgressSlowedContext;
  response: ProgressSlowedResponse;
}

const DURATION_OPTIONS: { value: PerceivedDuration; label: string }[] = [
  { value: "short", label: "Less than 2 weeks" },
  { value: "medium", label: "2 to 4 weeks" },
  { value: "long", label: "More than a month" },
];

const WEIGHT_CHANGE_OPTIONS: { value: SelfReportedWeightChange; label: string }[] = [
  { value: "none_little", label: "None, or very little" },
  { value: "moderate", label: "A moderate amount" },
  { value: "significant", label: "A significant amount" },
];

export default function CoachCornerProgressSlowed() {
  const [, setLocation] = useLocation();
  const [duration, setDuration] = useState<PerceivedDuration | null>(null);
  const [weightChange, setWeightChange] = useState<SelfReportedWeightChange | null>(null);
  const [result, setResult] = useState<ProgressSlowedResponse | null>(null);

  const { data, isLoading } = useQuery<ContextResponse>({
    queryKey: ["/api/coach-corner/situations/progress-slowed/context"],
  });

  const context = data?.context ?? null;
  const needsSelfReportedWeightChange = context ? !context.hasWeightData : true;

  const resolveMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/coach-corner/situations/progress-slowed/resolve", {
        method: "POST",
        body: JSON.stringify({
          perceivedDuration: duration,
          ...(needsSelfReportedWeightChange && weightChange
            ? { selfReportedWeightChange: weightChange }
            : {}),
        }),
      }),
    onSuccess: (data: ResolveResponse) => setResult(data.response),
  });

  const canSubmit =
    !!duration && (!needsSelfReportedWeightChange || !!weightChange);

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
          My progress has slowed
        </span>
        <div className="w-9" />
      </div>

      <div className="flex-1 px-4">
        <h1 className="text-xl font-bold text-white mb-5 leading-snug">
          How long have you felt like your progress has slowed?
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

        {needsSelfReportedWeightChange && (
          <>
            <h2 className="text-lg font-bold text-white mb-5 leading-snug">
              About how much weight, if any, do you think you've lost since
              starting?
            </h2>
            <div className="flex flex-col gap-3 mb-8">
              {WEIGHT_CHANGE_OPTIONS.map((opt) => (
                <PillButton
                  key={opt.value}
                  active={weightChange === opt.value}
                  onClick={() => setWeightChange(opt.value)}
                  className="!w-full !justify-start !text-left !text-[13px] !normal-case !py-3 !px-4 !rounded-xl"
                >
                  {opt.label}
                </PillButton>
              ))}
            </div>
          </>
        )}
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
