import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Ruler,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Check,
  X,
} from "lucide-react";
import { MacroDeltas, MacroTargets } from "@/lib/clinicalAdvisory";
import {
  calculateWaistHeightRatio,
  classifyWaistRisk,
  getWaistRiskDeltas,
  WaistRiskLevel,
} from "@shared/waistRisk";

interface WaistRiskSectionProps {
  waistCm: number;
  heightCm: number;
  baseTargets: MacroTargets;
  onApplyAdjustments: (deltas: MacroDeltas) => void;
  onClearAdjustments: () => void;
}

const RISK_COLORS: Record<WaistRiskLevel, { bg: string; border: string; text: string; badge: string }> = {
  green: {
    bg: "bg-green-900/20",
    border: "border-green-500/30",
    text: "text-green-400",
    badge: "bg-green-900/60 text-green-200",
  },
  yellow: {
    bg: "bg-amber-900/20",
    border: "border-amber-500/30",
    text: "text-amber-400",
    badge: "bg-amber-900/60 text-amber-200",
  },
  red: {
    bg: "bg-red-900/20",
    border: "border-red-500/30",
    text: "text-red-400",
    badge: "bg-red-900/60 text-red-200",
  },
};

export default function WaistRiskSection({
  waistCm,
  heightCm,
  baseTargets,
  onApplyAdjustments,
  onClearAdjustments,
}: WaistRiskSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [adjustmentApplied, setAdjustmentApplied] = useState(false);

  const ratio = useMemo(
    () => calculateWaistHeightRatio(waistCm, heightCm),
    [waistCm, heightCm],
  );

  const risk = useMemo(() => classifyWaistRisk(ratio), [ratio]);

  const totalCarbs =
    (baseTargets.starchyCarbs || 0) + (baseTargets.fibrousCarbs || 0) ||
    baseTargets.carbs ||
    0;

  const deltas = useMemo(
    () => getWaistRiskDeltas(risk.level, baseTargets.protein, totalCarbs, baseTargets.fat),
    [risk.level, baseTargets.protein, totalCarbs, baseTargets.fat],
  );

  const hasDeltas = deltas.protein !== 0 || deltas.carbs !== 0 || deltas.fat !== 0;
  const colors = RISK_COLORS[risk.level];
  const hasMeasurements = waistCm > 0 && heightCm > 0;

  const deltaColor = (val: number) =>
    val > 0 ? "text-green-400" : val < 0 ? "text-red-400" : "text-white/60";

  const formatDelta = (val: number) =>
    `${val > 0 ? "+" : ""}${val}g`;

  const handlePreviewChanges = () => {
    if (!hasDeltas) return;
    setShowConfirmDialog(true);
  };

  const handleConfirmApply = () => {
    onApplyAdjustments(deltas);
    setAdjustmentApplied(true);
    setShowConfirmDialog(false);
  };

  const handleCancelApply = () => {
    setShowConfirmDialog(false);
  };

  const handleClear = () => {
    onClearAdjustments();
    setAdjustmentApplied(false);
  };

  return (
    <Card className="bg-zinc-900/80 border border-white/30 text-white mt-5">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-5 cursor-pointer hover:bg-white/5 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Ruler className="h-5 w-5 text-orange-400" />
                  Waist-to-Height Risk
                  {hasMeasurements && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ml-2 ${colors.badge}`}>
                      {risk.label}
                    </span>
                  )}
                </h3>
                {!isOpen && (
                  <span className="text-sm text-orange-300/80 ml-7 mt-1">
                    {hasMeasurements
                      ? `Ratio: ${ratio} — Tap to review`
                      : "Enter waist & height to calculate"}
                  </span>
                )}
              </div>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 text-white/60" />
              ) : (
                <ChevronDown className="h-5 w-5 text-white/60" />
              )}
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 px-5 pb-5 space-y-4">
            {!hasMeasurements ? (
              <div className="p-4 bg-black/40 rounded-lg border border-white/10 text-center">
                <Ruler className="h-10 w-10 text-white/30 mx-auto mb-3" />
                <p className="text-white/70 text-sm mb-2">
                  No measurements available
                </p>
                <p className="text-white/50 text-xs">
                  Enter your waist circumference and height above to see your
                  waist-to-height risk assessment.
                </p>
              </div>
            ) : (
              <>
                <div className={`p-4 rounded-lg border ${colors.bg} ${colors.border}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className={`text-3xl font-bold ${colors.text}`}>
                        {ratio}
                      </div>
                      <div className="text-xs text-white/60 mt-1">
                        Waist-to-Height Ratio
                      </div>
                    </div>
                    <div className="text-right text-sm text-white/70">
                      <div>Waist: {waistCm} cm</div>
                      <div>Height: {heightCm} cm</div>
                    </div>
                  </div>
                  <div className={`text-sm font-medium ${colors.text} mb-1`}>
                    {risk.label}
                  </div>
                  <p className="text-xs text-white/70">{risk.description}</p>
                </div>

                {hasDeltas && (
                  <div className="p-4 bg-black/40 rounded-lg border border-white/10">
                    <div className="text-xs font-medium text-white/80 mb-2">
                      Suggested macro adjustments:
                    </div>
                    <div className="flex gap-4 text-sm mb-3">
                      <span className={deltaColor(deltas.protein)}>
                        Protein: {formatDelta(deltas.protein)}
                      </span>
                      <span className={deltaColor(deltas.carbs)}>
                        Carbs: {formatDelta(deltas.carbs)}
                      </span>
                      <span className={deltaColor(deltas.fat)}>
                        Fat: {formatDelta(deltas.fat)}
                      </span>
                    </div>

                    {!adjustmentApplied ? (
                      <Button
                        onClick={handlePreviewChanges}
                        className="w-full bg-lime-600 border border-2 border-lime-400 text-white"
                      >
                        Preview Changes
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-green-400">
                          <Check className="h-4 w-4" />
                          <span>Adjustment applied to your macros</span>
                        </div>
                        <Button
                          variant="outline"
                          onClick={handleClear}
                          className="w-full bg-black border-white/20 text-white hover:bg-white/10"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Clear Adjustment
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {!hasDeltas && hasMeasurements && (
                  <div className="flex items-center gap-2 text-sm text-green-400 p-3">
                    <Check className="h-4 w-4" />
                    <span>No macro adjustments needed</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      {showConfirmDialog && hasDeltas && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full bg-zinc-900 border border-orange-500/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="h-5 w-5 text-orange-400" />
                <h3 className="text-lg font-semibold text-white">
                  Apply Waist Risk Adjustment?
                </h3>
              </div>

              <p className="text-sm text-white/80 mb-4">
                Based on your waist-to-height ratio ({ratio} — {risk.label}),
                these adjustments will be applied to your macro targets:
              </p>

              <div className="p-4 bg-black/30 rounded-lg mb-2">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className={`text-lg font-bold ${deltaColor(deltas.protein)}`}>
                      {formatDelta(deltas.protein)}
                    </div>
                    <div className="text-xs text-white/60">Protein</div>
                  </div>
                  <div>
                    <div className={`text-lg font-bold ${deltaColor(deltas.carbs)}`}>
                      {formatDelta(deltas.carbs)}
                    </div>
                    <div className="text-xs text-white/60">Carbs</div>
                  </div>
                  <div>
                    <div className={`text-lg font-bold ${deltaColor(deltas.fat)}`}>
                      {formatDelta(deltas.fat)}
                    </div>
                    <div className="text-xs text-white/60">Fat</div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-white/60 italic mb-4">
                {risk.description}
              </p>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleCancelApply}
                  className="flex-1 bg-black border-white/20 text-white"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmApply}
                  className="flex-1 bg-lime-600 text-white"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Apply
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </Card>
  );
}
