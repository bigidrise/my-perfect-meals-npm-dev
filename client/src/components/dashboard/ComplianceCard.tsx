import { useQuery } from "@tanstack/react-query";
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

interface MacroTargetsResponse {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  hasTargets: boolean;
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

function TargetMacrosStrip({ targets }: { targets: MacroTargetsResponse }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-white/40 font-medium uppercase tracking-wide">Target Macros</div>
      <div className="flex gap-3 text-sm">
        <span className="text-white/70">P <span className="text-white font-semibold">{targets.protein_g}g</span></span>
        <span className="text-white/70">C <span className="text-white font-semibold">{targets.carbs_g}g</span></span>
        <span className="text-white/70">Fat <span className="text-white font-semibold">{targets.fat_g}g</span></span>
      </div>
    </div>
  );
}

interface ComplianceCardProps {
  userId: string | undefined;
}

export function ComplianceCard({ userId }: ComplianceCardProps) {
  const isDesktop = useIsDesktop();

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

  const { data: targets } = useQuery<MacroTargetsResponse>({
    queryKey: ["macro-targets", userId],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/users/${userId}/macro-targets`), {
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Macro targets fetch failed: ${res.status}`);
      }
      return res.json();
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

  if (!userId || isLoading) {
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

  if (isError || !data) {
    return (
      <Card className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-xl">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-gradient-to-br from-red-500/10 to-red-700/10 border border-red-500/20">
              <AlertCircle className="h-6 w-6 text-red-400" />
            </div>
            <div>
              <h3 className="text-white text-lg font-semibold">Compliance</h3>
              <p className="text-red-400/70 text-sm">Unable to load compliance data</p>
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
              <Target className="h-6 w-6 text-white/60" />
            </div>
            <div>
              <h3 className="text-white text-lg font-semibold">Compliance</h3>
              <p className="text-white/50 text-sm">Macro targets not set yet</p>
            </div>
          </div>
          <p className="text-sm text-white/40 italic">
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
                <h3 className="text-white text-lg font-semibold">Compliance</h3>
                <p className="text-white/40 text-xs">Last {data.windowDays} days</p>
                <p className="text-red-400 text-2xl font-bold">0%</p>
              </div>
            </div>
            {targets?.hasTargets && <TargetMacrosStrip targets={targets} />}
          </div>
          <p className="text-sm text-white/50">No meals logged yet</p>
          <p className="text-sm text-white/40 italic">
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
              <h3 className="text-white/70 text-sm font-medium">Compliance</h3>
              <p className="text-white/30 text-xs">Last {data.windowDays} days</p>
              <p className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}%</p>
            </div>
          </div>
          {targets?.hasTargets && <TargetMacrosStrip targets={targets} />}
        </div>

        <p className="text-sm text-white/50 italic">
          {getComplianceMessage(score, undefined, data.loggedDays7)}
        </p>
      </CardContent>
    </Card>
  );
}
