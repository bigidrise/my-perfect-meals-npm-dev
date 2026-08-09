import { useState, useEffect } from "react";
import { Zap } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import { resolveDisplayCarbTargets } from "@/lib/macroResolver";
import { useAuth } from "@/contexts/AuthContext";

interface DailyTargetsCardProps {
  userId?: string;
  onQuickAddClick?: () => void;
  showQuickAddButton?: boolean;
  targetsOverride?: {
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    starchyCarbs_g?: number;
    fibrousCarbs_g?: number;
  };
}

export function DailyTargetsCard({
  userId,
  onQuickAddClick,
  showQuickAddButton = true,
  targetsOverride,
}: DailyTargetsCardProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const handleUpdate = () => setTick(t => t + 1);
    window.addEventListener("mpm:targetsUpdated", handleUpdate);
    return () => window.removeEventListener("mpm:targetsUpdated", handleUpdate);
  }, []);

  // Presentation component — targets must be supplied by the parent workflow page.
  // Never resolves nutrition internally.
  const resolved = targetsOverride ?? { protein_g: 0, carbs_g: 0, fat_g: 0 };
  const { starchyCarbs_g: starchyCarbs, fibrousCarbs_g: fibrousCarbs } = resolveDisplayCarbTargets(resolved);

  const { user } = useAuth();
  const DOW = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const todayKey = DOW[new Date().getDay()];
  const schedule = user?.weeklyTrainingSchedule as Record<string, string> | null | undefined;
  const todaySession = schedule?.[todayKey];
  const SESSION_LABELS: Record<string, string> = {
    strength: "Strength", power: "Power", endurance: "Endurance",
    sport_practice: "Sport Practice", competition: "Competition",
    recovery: "Recovery", off: "Rest",
  };
  const isPerformanceActive = !!(user?.performanceModeEnabled && user?.weeklyTrainingSchedule);
  const todayLabel = isPerformanceActive && todaySession ? (SESSION_LABELS[todaySession] ?? todaySession) : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 backdrop-blur-lg p-4 mb-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-white/60 uppercase tracking-wide">Daily Targets</span>
            {isPerformanceActive && (
              <span className="flex items-center gap-1 text-[9px] font-bold text-orange-400 bg-orange-600/20 border border-orange-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                <Zap className="w-2.5 h-2.5" />
                {todayLabel ? `${todayLabel} Day` : "Performance"}
              </span>
            )}
          </div>
          {showQuickAddButton && onQuickAddClick && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-semibold text-white/70 uppercase tracking-wide">QUICK</span>
              <PillButton
                onClick={onQuickAddClick}
                data-testid="button-quick-add-macros"
              >
                Add
              </PillButton>
            </div>
          )}
        </div>
        <div className="grid grid-cols-5 gap-2">
          <div className="text-center">
            <div className="text-lg font-bold text-white">{Math.round(resolved.protein_g || 0)}g</div>
            <div className="text-xs text-white/60">Protein</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-white">{Math.round(resolved.carbs_g || 0)}g</div>
            <div className="text-xs text-white/60">Total Carbs</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-white">{Math.round(starchyCarbs)}g</div>
            <div className="text-xs text-white/60">Starchy</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-white">{Math.round(fibrousCarbs)}g</div>
            <div className="text-xs text-white/60">Fibrous</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-white">{Math.round(resolved.fat_g || 0)}g</div>
            <div className="text-xs text-white/60">Fat</div>
          </div>
        </div>
      </div>
    </div>
  );
}
