import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Target, Flame, Drumstick, CalendarCheck } from "lucide-react";
import { useIsDesktop } from "@/hooks/useIsDesktop";

interface ComplianceResponse {
  complianceScore: number | null;
  calorieCompliance: number;
  proteinCompliance: number;
  loggingCompliance: number;
  calorieAverage7: number;
  proteinAverage7: number;
  loggedDays7: number;
  windowDays: number;
  reason?: string;
}

function getScoreColor(score: number): string {
  if (score >= 90) return "text-emerald-400";
  if (score >= 70) return "text-yellow-400";
  return "text-red-400";
}

function getScoreBorderColor(score: number): string {
  if (score >= 90) return "border-emerald-500/30";
  if (score >= 70) return "border-yellow-500/30";
  return "border-red-500/30";
}

function getScoreBgColor(score: number): string {
  if (score >= 90) return "from-emerald-500/20 to-emerald-700/20";
  if (score >= 70) return "from-yellow-500/20 to-yellow-700/20";
  return "from-red-500/20 to-red-700/20";
}

function getComplianceMessage(score: number | null, reason?: string, loggedDays?: number): string {
  if (reason === "no_targets") return "Set your macro targets to begin compliance tracking.";
  if (score === null || score === 0 || loggedDays === 0) return "Start logging meals to activate your compliance score.";
  if (score >= 90) return "Excellent consistency. Your program is working.";
  if (score >= 75) return "Good progress. A little more consistency will improve results.";
  if (score >= 50) return "Your adherence is slipping. Focus on logging meals this week.";
  return "Low compliance. Results will stall without consistent tracking.";
}

interface ComplianceCardProps {
  userId: string | undefined;
}

export function ComplianceCard({ userId }: ComplianceCardProps) {
  const [, setLocation] = useLocation();
  const isDesktop = useIsDesktop();

  const { data, isLoading } = useQuery<ComplianceResponse | null>({
    queryKey: ["compliance", userId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/compliance`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <Card className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-gradient-to-br from-white/5 to-white/10 border border-white/10">
              <Target className="h-6 w-6 text-white/40" />
            </div>
            <div className="text-white/40 text-sm">Loading compliance...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleCardClick = () => {
    if (!data || data.reason === "no_targets") {
      setLocation("/macro-counter");
    } else {
      setLocation("/my-biometrics");
    }
  };

  if (!data || data.reason === "no_targets") {
    return (
      <Card
        className="cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-95 bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl"
        onClick={handleCardClick}
      >
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-gradient-to-br from-white/5 to-white/10 border border-white/10">
              <Target className="h-6 w-6 text-white/60" />
            </div>
            <div>
              <h3 className="text-white text-lg font-semibold">Compliance</h3>
              <p className="text-white/50 text-sm">Set your macro targets to begin tracking adherence</p>
            </div>
          </div>
          <p className="text-sm text-white/40 italic">
            {getComplianceMessage(null, "no_targets")}
          </p>
          <Button
            className="w-full bg-orange-500/20 border border-orange-500/40 text-orange-400 hover:bg-orange-500/30"
            onClick={(e) => {
              e.stopPropagation();
              setLocation("/macro-counter");
            }}
          >
            Go to Macro Calculator
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (data.loggedDays7 === 0) {
    return (
      <Card
        className="cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-95 bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl"
        onClick={handleCardClick}
      >
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-gradient-to-br from-red-500/20 to-red-700/20 border border-red-500/30">
              <Target className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <h3 className="text-white text-lg font-semibold">Compliance Score</h3>
              <p className="text-red-400 text-2xl font-bold">0%</p>
            </div>
          </div>
          <p className="text-sm text-white/50 italic">
            {getComplianceMessage(0, undefined, 0)}
          </p>
        </CardContent>
      </Card>
    );
  }

  const score = data.complianceScore ?? 0;

  return (
    <Card
      className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-95 bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl ${
        score >= 90
          ? "hover:border-emerald-500/30"
          : score >= 70
            ? "hover:border-yellow-500/30"
            : "hover:border-red-500/30"
      }`}
      onClick={handleCardClick}
    >
      <CardContent className="p-6">
        <div className={isDesktop ? "flex items-center gap-6" : "space-y-4"}>
          <div className={`flex items-center gap-3 ${isDesktop ? "flex-shrink-0" : ""}`}>
            <div className={`p-3 rounded-lg bg-gradient-to-br ${getScoreBgColor(score)} border ${getScoreBorderColor(score)}`}>
              <Target className={`h-6 w-6 ${getScoreColor(score)}`} />
            </div>
            <div>
              <h3 className="text-white/70 text-sm font-medium">Compliance</h3>
              <p className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}%</p>
            </div>
          </div>

          <div className={`grid grid-cols-3 gap-3 ${isDesktop ? "flex-1" : ""}`}>
            <div className="flex flex-col items-center p-2 rounded-lg bg-black/20 border border-white/5">
              <Flame className={`h-4 w-4 mb-1 ${getScoreColor(data.calorieCompliance)}`} />
              <div className="text-xs text-white/50">Calories</div>
              <div className={`text-sm font-bold ${getScoreColor(data.calorieCompliance)}`}>
                {data.calorieCompliance}%
              </div>
            </div>
            <div className="flex flex-col items-center p-2 rounded-lg bg-black/20 border border-white/5">
              <Drumstick className={`h-4 w-4 mb-1 ${getScoreColor(data.proteinCompliance)}`} />
              <div className="text-xs text-white/50">Protein</div>
              <div className={`text-sm font-bold ${getScoreColor(data.proteinCompliance)}`}>
                {data.proteinCompliance}%
              </div>
            </div>
            <div className="flex flex-col items-center p-2 rounded-lg bg-black/20 border border-white/5">
              <CalendarCheck className={`h-4 w-4 mb-1 ${getScoreColor(data.loggingCompliance)}`} />
              <div className="text-xs text-white/50">Logging</div>
              <div className={`text-sm font-bold ${getScoreColor(data.loggingCompliance)}`}>
                {data.loggingCompliance}%
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm text-white/50 italic mt-3">
          {getComplianceMessage(score, undefined, data.loggedDays7)}
        </p>

        <div className="mt-2 text-right">
          <span className="text-xs text-white/30">Last {data.windowDays} days</span>
        </div>
      </CardContent>
    </Card>
  );
}
