import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/apiRequest";

interface ActivitySummary {
  complianceScore: number | null;
  calorieCompliance: number;
  proteinCompliance: number;
  loggingCompliance: number;
  calorieAverage7: number;
  proteinAverage7: number;
  loggedDays7: number;
  windowDays: number;
  reason?: string;
  proteinGoalDays: number;
  calorieGoalDays: number;
  mealSlots: { breakfast: number; lunch: number; dinner: number };
  biggestOpportunity: string;
  coachingSummary: string;
}

interface ComplianceCardProps {
  userId: string | undefined;
}

function ScorePill({ score }: { score: number }) {
  const color =
    score >= 90 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" :
    score >= 70 ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" :
    "text-orange-400 bg-orange-500/10 border-orange-500/30";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-bold border ${color}`}>
      {score}%
    </span>
  );
}

function BulletRow({
  label,
  value,
  total,
  highlight,
}: {
  label: string;
  value: number;
  total: number;
  highlight?: "good" | "warn" | "neutral";
}) {
  const pct = total > 0 ? value / total : 0;
  const tone = highlight ?? (pct >= 0.71 ? "good" : pct >= 0.43 ? "neutral" : "warn");
  const Icon = tone === "good" ? CheckCircle2 : tone === "warn" ? AlertTriangle : CheckCircle2;
  const iconColor = tone === "good" ? "text-emerald-400" : tone === "warn" ? "text-orange-400" : "text-white/40";
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${iconColor}`} />
      <span className="text-white/80">
        {label}{" "}
        <span className="font-semibold text-white">
          {value} of {total}
        </span>{" "}
        days
      </span>
    </div>
  );
}

export function ComplianceCard({ userId }: ComplianceCardProps) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleTargetsUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ["compliance", userId] });
    };
    window.addEventListener("mpm:targetsUpdated", handleTargetsUpdated);
    return () => window.removeEventListener("mpm:targetsUpdated", handleTargetsUpdated);
  }, [userId, queryClient]);

  const { data, isLoading, isError } = useQuery<ActivitySummary>({
    queryKey: ["compliance", userId],
    queryFn: async () => {
      return apiRequest(`/api/users/${userId}/compliance`);
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  if (!userId || isLoading) {
    return (
      <Card className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl">
        <CardContent className="p-6">
          <div className="h-4 w-40 bg-white/10 rounded animate-pulse mb-3" />
          <div className="h-3 w-24 bg-white/5 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h3 className="text-white text-sm font-semibold">Nutrition Activity Summary</h3>
              <p className="text-red-400 text-xs">Unable to load activity data</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.reason === "no_targets") {
    return (
      <Card className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl">
        <CardContent className="p-6 space-y-2">
          <h3 className="text-white text-sm font-semibold">Nutrition Activity Summary</h3>
          <p className="text-white/60 text-xs">Set your macro targets to activate full nutrition tracking.</p>
        </CardContent>
      </Card>
    );
  }

  const win = data.windowDays ?? 7;
  const score = data.complianceScore ?? 0;
  const slots = data.mealSlots ?? { breakfast: 0, lunch: 0, dinner: 0 };

  if (data.loggedDays7 === 0) {
    return (
      <Card className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl">
        <CardContent className="p-6 space-y-2">
          <h3 className="text-white text-sm font-semibold">Nutrition Activity Summary</h3>
          <p className="text-white/50 text-xs">Last {win} days</p>
          <p className="text-white/70 text-sm pt-1">
            No meals logged yet. Start recording your meals to see your activity summary.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl">
      <CardContent className="p-6 space-y-4">

        {/* Header */}
        <div>
          <h3 className="text-white text-sm font-semibold">Nutrition Activity Summary</h3>
          <p className="text-white/40 text-xs">Last {win} days</p>
        </div>

        {/* Behavioral highlights — PRIMARY */}
        <div className="space-y-2">
          <BulletRow label="Logged meals" value={data.loggedDays7} total={win} />
          <BulletRow label="Protein goal met" value={data.proteinGoalDays ?? 0} total={win} />
          <BulletRow label="Calories on target" value={data.calorieGoalDays ?? 0} total={win} />
          {(slots.breakfast + slots.lunch + slots.dinner > 0) && (
            <>
              <BulletRow label="Breakfast logged" value={slots.breakfast} total={win} highlight="neutral" />
              <BulletRow label="Lunch logged" value={slots.lunch} total={win} highlight="neutral" />
              <BulletRow
                label="Dinner logged"
                value={slots.dinner}
                total={win}
                highlight={slots.dinner < Math.max(slots.breakfast, slots.lunch) - 1 ? "warn" : "neutral"}
              />
            </>
          )}
        </div>

        {/* Score — SECONDARY */}
        <div className="flex items-center gap-2 pt-1 border-t border-white/10">
          <span className="text-white/50 text-xs">Consistency Score</span>
          <ScorePill score={score} />
        </div>

        {/* Biggest opportunity */}
        {data.biggestOpportunity && (
          <div className="bg-white/5 rounded-lg px-3 py-2 border border-white/10">
            <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wide mb-0.5">
              Biggest Opportunity
            </p>
            <p className="text-white/80 text-xs leading-snug">{data.biggestOpportunity}</p>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
