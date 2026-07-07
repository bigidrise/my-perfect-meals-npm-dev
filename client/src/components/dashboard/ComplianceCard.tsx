import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Target, AlertCircle } from "lucide-react";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { getAuthHeaders } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";

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
  if (score === null || score === 0 || loggedDays === 0) return "Start recording your meals to activate compliance tracking.";
  if (score >= 90) return "Excellent consistency. Your program is working.";
  if (score >= 75) return "Good progress. A little more consistency will improve results.";
  if (score >= 50) return "Your adherence is slipping. Focus on logging meals this week.";
  return "Low compliance. Results will stall without consistent tracking.";
}

interface ComplianceCardProps {
  userId: string | undefined;
}

export function ComplianceCard({ userId }: ComplianceCardProps) {
  const isDesktop = useIsDesktop();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleTargetsUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ["compliance", userId] });
    };
    window.addEventListener("mpm:targetsUpdated", handleTargetsUpdated);
    return () => window.removeEventListener("mpm:targetsUpdated", handleTargetsUpdated);
  }, [userId, queryClient]);

  const { data, isLoading, isError } = useQuery<ComplianceResponse>({
    queryKey: ["compliance", userId],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/users/${userId}/compliance`), {
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Compliance fetch failed: ${res.status}`);
      }
      return res.json();
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  if (!userId || isLoading) {
    return (
      <Card className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-gradient-to-br from-white/5 to-white/10 border border-white/10">
              <Target className="h-6 w-6 text-white" />
            </div>
            <div className="text-white text-sm">Loading compliance...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-gradient-to-br from-red-500/10 to-red-700/10 border border-red-500/20">
              <AlertCircle className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <h3 className="text-white text-sm font-semibold">Compliance</h3>
              <p className="text-red-400 text-sm">Unable to load compliance data</p>
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
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-gradient-to-br from-white/5 to-white/10 border border-white/10">
              <Target className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-white text-sm font-semibold">Compliance</h3>
              <p className="text-white text-sm">Macro targets not set yet</p>
            </div>
          </div>
          <p className="text-sm text-white italic">
            {getComplianceMessage(null, "no_targets")}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (data.loggedDays7 === 0) {
    return (
      <Card className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl">
        <CardContent className="p-6 space-y-3">
          <div className={isDesktop ? "flex items-center justify-between" : "space-y-3"}>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-gradient-to-br from-red-500/20 to-red-700/20 border border-red-500/30">
                <Target className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-white text-sm font-semibold">Compliance</h3>
                <p className="text-white text-xs">Last {data.windowDays} days</p>
                <p className="text-red-400 text-2xl font-bold">0%</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-white">No meals logged yet</p>
          <p className="text-sm text-white italic">
            {getComplianceMessage(0, undefined, 0)}
          </p>
        </CardContent>
      </Card>
    );
  }

  const score = data.complianceScore ?? 0;

  return (
    <Card className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl">
      <CardContent className="p-6 space-y-3">
        <div className={isDesktop ? "flex items-center justify-between" : "space-y-3"}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg bg-gradient-to-br ${getScoreBgColor(score)} border ${getScoreBorderColor(score)}`}>
              <Target className={`h-6 w-6 ${getScoreColor(score)}`} />
            </div>
            <div>
              <h3 className="text-white text-sm font-semibold">Compliance</h3>
              <p className="text-white text-xs">Last {data.windowDays} days</p>
              <p className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}%</p>
            </div>
          </div>
        </div>

        <p className="text-sm text-white italic">
          {getComplianceMessage(score, undefined, data.loggedDays7)}
        </p>
      </CardContent>
    </Card>
  );
}
