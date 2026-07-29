import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/apiRequest";
import { Loader2, CheckCircle2, AlertTriangle, Target } from "lucide-react";

interface ProClientComplianceSnapshotProps {
  clientId: string;
}

interface ActivitySummary {
  complianceScore: number | null;
  calorieCompliance: number;
  proteinCompliance: number;
  loggingCompliance: number;
  loggedDays7: number;
  windowDays: number;
  reason?: string;
  proteinGoalDays: number;
  calorieGoalDays: number;
  mealSlots: { breakfast: number; lunch: number; dinner: number };
  biggestOpportunity: string;
  coachingSummary: string;
}

function getScoreColor(score: number): string {
  if (score >= 90) return "text-emerald-400";
  if (score >= 70) return "text-yellow-400";
  return "text-orange-400";
}

function getScoreBg(score: number): string {
  if (score >= 90) return "bg-emerald-500/10 border-emerald-500/20";
  if (score >= 70) return "bg-yellow-500/10 border-yellow-500/20";
  return "bg-orange-500/10 border-orange-500/20";
}

function BehaviorRow({
  label,
  value,
  total,
  warn,
}: {
  label: string;
  value: number;
  total: number;
  warn?: boolean;
}) {
  const Icon = warn ? AlertTriangle : CheckCircle2;
  const iconColor = warn ? "text-orange-400" : "text-emerald-400";
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <Icon className={`w-3 h-3 flex-shrink-0 ${iconColor}`} />
      <span className="text-white/70">
        {label}{" "}
        <span className="font-semibold text-white">
          {value}/{total}
        </span>
      </span>
    </div>
  );
}

export default function ProClientComplianceSnapshot({ clientId }: ProClientComplianceSnapshotProps) {
  const { data, isLoading, isError } = useQuery<ActivitySummary | null>({
    queryKey: ["proClientCompliance", clientId],
    queryFn: async () => {
      try {
        return await apiRequest(`/api/users/${clientId}/compliance`);
      } catch {
        return null;
      }
    },
    enabled: !!clientId,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  if (isLoading) {
    return (
      <div className="bg-white/5 rounded-lg p-3 border border-white/10">
        <h4 className="text-xs font-medium text-white/60 mb-2">Nutrition Activity</h4>
        <div className="flex items-center justify-center py-3">
          <Loader2 className="w-4 h-4 animate-spin text-white/40" />
        </div>
      </div>
    );
  }

  if (isError || !data || data.reason === "no_targets") {
    return (
      <div className="bg-white/5 rounded-lg p-3 border border-white/10">
        <h4 className="text-xs font-medium text-white/60 mb-1">Nutrition Activity</h4>
        <p className="text-[10px] text-white/30 italic">
          {!data || isError
            ? "Not available — client account not linked"
            : "No active macro targets set yet"}
        </p>
      </div>
    );
  }

  const score = data.complianceScore ?? 0;
  const win = data.windowDays ?? 7;
  const slots = data.mealSlots ?? { breakfast: 0, lunch: 0, dinner: 0 };
  const proteinGoalDays = data.proteinGoalDays ?? 0;
  const calorieGoalDays = data.calorieGoalDays ?? 0;
  const maxSlot = Math.max(slots.breakfast, slots.lunch, slots.dinner);
  const dinnerGap = maxSlot - slots.dinner >= 2;
  const lunchGap = maxSlot - slots.lunch >= 2;

  return (
    <div className="bg-white/5 rounded-lg p-3 border border-white/10 space-y-3">

      {/* Header + score */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-white/60">Nutrition Activity</h4>
        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${getScoreBg(score)}`}>
          <Target className={`w-3 h-3 ${getScoreColor(score)}`} />
          <span className={`text-xs font-bold ${getScoreColor(score)}`}>{score}%</span>
        </div>
      </div>

      {data.loggedDays7 === 0 ? (
        <p className="text-[10px] text-white/30 italic">
          No meal logs recorded in this window
        </p>
      ) : (
        <>
          {/* Behavioral summary */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wide">
              Behavioral Summary
            </p>
            <BehaviorRow
              label="Meal logging active"
              value={data.loggedDays7}
              total={win}
              warn={data.loggedDays7 < Math.ceil(win * 0.5)}
            />
            <BehaviorRow
              label="Protein goal achieved"
              value={proteinGoalDays}
              total={win}
              warn={proteinGoalDays < Math.ceil(win * 0.5)}
            />
            <BehaviorRow
              label="Calories on target"
              value={calorieGoalDays}
              total={win}
              warn={calorieGoalDays < Math.ceil(win * 0.5)}
            />
            {(slots.breakfast + slots.lunch + slots.dinner > 0) && (
              <>
                {dinnerGap && (
                  <BehaviorRow label="Dinner logging" value={slots.dinner} total={win} warn />
                )}
                {lunchGap && (
                  <BehaviorRow label="Lunch logging" value={slots.lunch} total={win} warn />
                )}
              </>
            )}
          </div>

          {/* Coaching focus */}
          {data.coachingSummary && (
            <div className="border-t border-white/10 pt-2">
              <p className="text-[10px] font-semibold text-orange-400/70 uppercase tracking-wide mb-1">
                Suggested Coaching Focus
              </p>
              <p className="text-[10px] text-white/55 leading-snug">
                {data.coachingSummary}
              </p>
            </div>
          )}
        </>
      )}

    </div>
  );
}
