import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { apiRequest } from "@/lib/apiRequest";

interface ActivitySummary {
  complianceScore: number | null;
  calorieCompliance: number;
  proteinCompliance: number;
  loggingCompliance: number;
  mealConsistency: number;
  mealCompletion: number | null;
  mealLogging: number;
  macroAdherence: number;
  macroAdherenceEligible: boolean;
  hydrationAdherence: number | null;
  hydrationEligible: boolean;
  calorieAverage7: number;
  proteinAverage7: number;
  loggedDays7: number;
  windowDays: number;
  reason?: string;
  proteinGoalDays: number;
  calorieGoalDays: number;
  mealSlots: { breakfast: number; lunch: number; dinner: number };
  completedMealSlots: { breakfast: number; lunch: number; dinner: number };
  mealActivity: {
    expectedMealCount: number;
    completedMealCount: number;
    plannedMealDays: number;
    completedMealDays: number;
    completionRate: number | null;
  };
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
  const { t } = useTranslation();
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
          {t("complianceCard.ofDays", { value, total })}
        </span>{" "}
        {t("complianceCard.days")}
      </span>
    </div>
  );
}

export function ComplianceCard({ userId }: ComplianceCardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleActivityUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ["compliance", userId] });
    };
    window.addEventListener("mpm:targetsUpdated", handleActivityUpdated);
    window.addEventListener("mpm:nutritionActivityUpdated", handleActivityUpdated);
    return () => {
      window.removeEventListener("mpm:targetsUpdated", handleActivityUpdated);
      window.removeEventListener("mpm:nutritionActivityUpdated", handleActivityUpdated);
    };
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
        <CardContent className="p-6 space-y-2">
          <h3 className="text-white text-sm font-semibold">{t("complianceCard.title")}</h3>
          <p className="text-white/40 text-xs">{t("complianceCard.last7Days")}</p>
          <p className="text-white/60 text-sm pt-1">
            {t("complianceCard.noActivity")}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (data.reason === "no_targets") {
    return (
      <Card className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl">
        <CardContent className="p-6 space-y-2">
          <h3 className="text-white text-sm font-semibold">{t("complianceCard.title")}</h3>
          <p className="text-white/60 text-xs">{t("complianceCard.setTargets")}</p>
        </CardContent>
      </Card>
    );
  }

  const win = data.windowDays ?? 7;
  const score = data.complianceScore ?? 0;
  const slots = data.mealSlots ?? { breakfast: 0, lunch: 0, dinner: 0 };

  if (data.loggedDays7 === 0 && (data.mealActivity?.expectedMealCount ?? 0) === 0) {
    return (
      <Card className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl">
        <CardContent className="p-6 space-y-2">
          <h3 className="text-white text-sm font-semibold">{t("complianceCard.title")}</h3>
          <p className="text-white/50 text-xs">{t("complianceCard.lastNDays", { count: win })}</p>
          <p className="text-white/70 text-sm pt-1">
            {t("complianceCard.noMeals")}
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
          <h3 className="text-white text-sm font-semibold">{t("complianceCard.title")}</h3>
          <p className="text-white/40 text-xs">{t("complianceCard.lastNDays", { count: win })}</p>
        </div>

        {/* Behavioral highlights — PRIMARY */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/80">Meal consistency</span>
            <span className="font-semibold text-white">{data.mealConsistency}%</span>
          </div>
          <div className="ml-2 space-y-1 border-l border-white/10 pl-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/55">Meals completed</span>
              <span className="font-medium text-white/80">
                {data.mealCompletion === null
                  ? "Not yet tracked"
                  : `${data.mealActivity.completedMealCount}/${data.mealActivity.expectedMealCount} · ${data.mealCompletion}%`}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/55">Days with meal logs</span>
              <span className="font-medium text-white/80">
                {data.loggedDays7}/{win} · {data.mealLogging}%
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-white/80">Whole-plan macro adherence</span>
            <span className="font-semibold text-white text-right">
              {data.macroAdherenceEligible ? `${data.macroAdherence}%` : "Not currently scored"}
            </span>
          </div>
          {data.hydrationEligible && data.hydrationAdherence !== null && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/80">Hydration adherence</span>
              <span className="font-semibold text-white">{data.hydrationAdherence}%</span>
            </div>
          )}
          {!data.hydrationEligible && (
            <p className="text-xs text-white/45">
              Hydration is not scored because no current measurable Hydration target is established.
            </p>
          )}
          {(slots.breakfast + slots.lunch + slots.dinner > 0) && (
            <>
              <BulletRow label={t("complianceCard.breakfastLogged")} value={slots.breakfast} total={win} highlight="neutral" />
              <BulletRow label={t("complianceCard.lunchLogged")} value={slots.lunch} total={win} highlight="neutral" />
              <BulletRow
                label={t("complianceCard.dinnerLogged")}
                value={slots.dinner}
                total={win}
                highlight={slots.dinner < Math.max(slots.breakfast, slots.lunch) - 1 ? "warn" : "neutral"}
              />
            </>
          )}
        </div>

        {/* Score — SECONDARY */}
        <div className="flex items-center gap-2 pt-1 border-t border-white/10">
          <span className="text-white/50 text-xs">{t("complianceCard.consistencyScore")}</span>
          <ScorePill score={score} />
        </div>

        {/* Biggest opportunity */}
        {data.biggestOpportunity && (
          <div className="bg-white/5 rounded-lg px-3 py-2 border border-white/10">
            <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wide mb-0.5">
              {t("complianceCard.biggestOpportunity")}
            </p>
            <p className="text-white/80 text-xs leading-snug">{data.biggestOpportunity}</p>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
