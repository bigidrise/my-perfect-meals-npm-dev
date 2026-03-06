import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { Loader2, Target, Flame, Drumstick, CalendarCheck } from "lucide-react";

interface ProClientComplianceSnapshotProps {
  clientId: string;
}

interface ComplianceData {
  complianceScore: number | null;
  calorieCompliance: number;
  proteinCompliance: number;
  loggingCompliance: number;
  loggedDays7: number;
  windowDays: number;
  reason?: string;
}

function getScoreColor(score: number): string {
  if (score >= 90) return "text-emerald-400";
  if (score >= 70) return "text-yellow-400";
  return "text-red-400";
}

function getScoreBg(score: number): string {
  if (score >= 90) return "bg-emerald-500/10";
  if (score >= 70) return "bg-yellow-500/10";
  return "bg-red-500/10";
}

function getScoreBorder(score: number): string {
  if (score >= 90) return "border-emerald-500/20";
  if (score >= 70) return "border-yellow-500/20";
  return "border-red-500/20";
}

export default function ProClientComplianceSnapshot({ clientId }: ProClientComplianceSnapshotProps) {
  const { data, isLoading, isError } = useQuery<ComplianceData | null>({
    queryKey: ["proClientCompliance", clientId],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/users/${clientId}/compliance`), {
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!clientId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 animate-spin text-white/40" />
      </div>
    );
  }

  if (isError || !data) {
    return null;
  }

  if (data.reason === "no_targets") {
    return (
      <div className="bg-white/5 rounded-lg p-3 border border-white/10">
        <h4 className="text-xs font-medium text-white/60 mb-1">Compliance</h4>
        <p className="text-[10px] text-white/30 italic">
          No active macro targets set yet
        </p>
      </div>
    );
  }

  const score = data.complianceScore ?? 0;

  const metrics = [
    { label: "Calories", value: data.calorieCompliance, icon: Flame, color: getScoreColor(data.calorieCompliance) },
    { label: "Protein", value: data.proteinCompliance, icon: Drumstick, color: getScoreColor(data.proteinCompliance) },
    { label: "Logging", value: data.loggingCompliance, icon: CalendarCheck, color: getScoreColor(data.loggingCompliance) },
  ];

  return (
    <div className="bg-white/5 rounded-lg p-3 border border-white/10">
      <h4 className="text-xs font-medium text-white/60 mb-2">Compliance</h4>

      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${getScoreBg(score)} border ${getScoreBorder(score)}`}>
          <Target className={`w-4 h-4 ${getScoreColor(score)}`} />
        </div>
        <div>
          <p className={`text-xl font-bold ${getScoreColor(score)}`}>
            {Math.round(score)}%
          </p>
          <p className="text-[10px] text-white/30">Last {data.windowDays} days</p>
        </div>
      </div>

      {data.loggedDays7 === 0 && (
        <p className="text-[10px] text-white/30 italic mb-2">
          No meal logs recorded in this window
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {metrics.map((m) => (
          <div key={m.label} className="text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <m.icon className={`w-3 h-3 ${m.color}`} />
              <span className={`text-sm font-bold ${m.color}`}>
                {Math.round(m.value)}%
              </span>
            </div>
            <p className="text-[10px] text-white/40">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
