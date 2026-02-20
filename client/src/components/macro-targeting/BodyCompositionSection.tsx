import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useChefVoice } from "@/lib/useChefVoice";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Scale,
  ChevronDown,
  ChevronUp,
  Info,
  AlertTriangle,
  AlertCircle,
  Plus,
  Check,
  X,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";
import BodyCompositionSheet from "./BodyCompositionSheet";
import { MacroDeltas } from "@/lib/clinicalAdvisory";

interface BodyFatEntry {
  id: number;
  userId: string;
  currentBodyFatPct: string;
  goalBodyFatPct: string | null;
  scanMethod: string;
  source: "client" | "trainer" | "physician";
  createdById: string | null;
  notes: string | null;
  recordedAt: string;
}

interface BodyCompositionSectionProps {
  builderType?: string;
  onApplyAdjustments?: (deltas: MacroDeltas) => void;
}

export default function BodyCompositionSection({
  builderType,
  onApplyAdjustments,
}: BodyCompositionSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [latestEntry, setLatestEntry] = useState<BodyFatEntry | null>(null);
  const [latestSource, setLatestSource] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [adjustmentApplied, setAdjustmentApplied] = useState(false);

  const hasSpokenRef = useRef(false);
  const { speak, stop, preload } = useChefVoice();

  const user = getCurrentUser();
  const userId = user?.id;

  const BODY_COMP_EXPLANATION = `Your body composition affects how we calculate your starchy carb allocation. If you're above your goal body fat, we reduce starchy carbs to help you lean out. When you reach your goal, we can add them back.`;

  useEffect(() => {
    preload?.();
  }, [preload]);

  useEffect(() => {
    if (userId) {
      loadLatest();
    } else {
      setIsLoading(false);
    }
  }, [userId]);

  const loadLatest = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        apiUrl(`/api/users/${userId}/body-composition/latest`)
      );
      if (res.ok) {
        const data = await res.json();
        if (data.entry) {
          setLatestEntry(data.entry);
          setLatestSource(data.source);
        }
      }
    } catch (err) {
      console.error("Error loading body composition:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const starchImpact = useMemo(() => {
    if (!latestEntry) return null;

    const currentBf = parseFloat(latestEntry.currentBodyFatPct);
    const goalBf = latestEntry.goalBodyFatPct
      ? parseFloat(latestEntry.goalBodyFatPct)
      : null;

    if (!goalBf || isNaN(currentBf) || isNaN(goalBf)) return null;

    const diff = currentBf - goalBf;
    const starchPerSlot = 25;

    if (diff >= 5) {
      return {
        carbsDelta: -starchPerSlot,
        proteinDelta: 0,
        fatDelta: 0,
        direction: "reduce" as const,
        label: `${currentBf.toFixed(1)}% is 5%+ above your goal (${goalBf.toFixed(1)}%)`,
        explanation: "Reducing starchy carbs to help you lean out",
        color: "amber",
      };
    } else if (diff <= -3 && builderType === "performance_competition") {
      return {
        carbsDelta: starchPerSlot,
        proteinDelta: 0,
        fatDelta: 0,
        direction: "increase" as const,
        label: `${currentBf.toFixed(1)}% is below your goal (${goalBf.toFixed(1)}%)`,
        explanation: "Adding starchy carbs to fuel performance",
        color: "blue",
      };
    } else if (Math.abs(diff) <= 3) {
      return {
        carbsDelta: 0,
        proteinDelta: 0,
        fatDelta: 0,
        direction: "neutral" as const,
        label: `${currentBf.toFixed(1)}% is within range of goal (${goalBf.toFixed(1)}%)`,
        explanation: "Your starchy carb allocation stays standard",
        color: "green",
      };
    }

    return {
      carbsDelta: 0,
      proteinDelta: 0,
      fatDelta: 0,
      direction: "neutral" as const,
      label: `${currentBf.toFixed(1)}% is moderately above goal (${goalBf.toFixed(1)}%)`,
      explanation: "Your starchy carb allocation stays standard for now",
      color: "green",
    };
  }, [latestEntry, builderType]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && !hasSpokenRef.current) {
      hasSpokenRef.current = true;
      speak(BODY_COMP_EXPLANATION);
    }
  };

  const openSheet = () => {
    stop();
    setSheetOpen(true);
  };

  const handleSheetSaved = () => {
    setAdjustmentApplied(false);
    loadLatest();
  };

  const handlePreviewChanges = () => {
    if (!starchImpact || starchImpact.carbsDelta === 0) return;
    setShowConfirmDialog(true);
  };

  const handleConfirmApply = () => {
    if (starchImpact && onApplyAdjustments) {
      onApplyAdjustments({
        protein: starchImpact.proteinDelta,
        carbs: starchImpact.carbsDelta,
        fat: starchImpact.fatDelta,
      });
      setAdjustmentApplied(true);
    }
    setShowConfirmDialog(false);
  };

  const handleCancelApply = () => {
    setShowConfirmDialog(false);
  };

  const sourceLabel = (s: string) => {
    switch (s) {
      case "trainer":
        return "Trainer";
      case "physician":
        return "Physician";
      default:
        return "Self-Reported";
    }
  };

  const hasOverride = latestSource === "trainer" || latestSource === "physician";
  const hasData = !!latestEntry;

  const isRelevantBuilder =
    builderType === "beach_body" ||
    builderType === "performance_competition" ||
    !builderType;

  if (!isRelevantBuilder) {
    return null;
  }

  const deltaColor = (val: number) =>
    val > 0 ? "text-green-400" : val < 0 ? "text-red-400" : "text-white/60";

  const formatDelta = (val: number) =>
    `${val > 0 ? "+" : ""}${val}g`;

  return (
    <Card className="bg-zinc-900/80 border border-white/30 text-white mt-5">
      <Collapsible open={isOpen} onOpenChange={handleOpenChange}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-5 cursor-pointer hover:bg-white/5 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Scale className="h-5 w-5 text-blue-400" />
                  Body Composition
                  {hasData && (
                    <span className="text-xs bg-black/60 text-blue-200 px-2 py-0.5 rounded-full ml-2">
                      {latestEntry.currentBodyFatPct}% BF
                    </span>
                  )}
                  {hasOverride && (
                    <span className="text-xs bg-amber-900/60 text-amber-200 px-2 py-0.5 rounded-full">
                      {sourceLabel(latestSource!)}
                    </span>
                  )}
                </h3>
                {!isOpen && (
                  <span className="text-sm text-blue-300/80 ml-7 mt-1">
                    {hasData
                      ? "Tap to view how this affects your carbs"
                      : "Tap to add your body fat %"}
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
            {isLoading ? (
              <div className="text-white/60 text-sm py-4">Loading...</div>
            ) : hasData ? (
              <>
                <div className="p-4 bg-black/40 rounded-lg border border-white/10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-3xl font-bold text-white">
                      {latestEntry.currentBodyFatPct}%
                    </div>
                    <div className="text-right text-sm text-white/70">
                      <div>{latestEntry.scanMethod}</div>
                      <div>
                        {new Date(latestEntry.recordedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {latestEntry.goalBodyFatPct && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-white/60">Goal:</span>
                      <span className="text-green-400 font-medium">
                        {latestEntry.goalBodyFatPct}%
                      </span>
                    </div>
                  )}

                  {hasOverride && (
                    <div className="mt-3 p-2 bg-amber-900/30 rounded border border-amber-400/30 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-amber-200">
                        Set by your {latestSource}. This value takes precedence
                        for meal planning.
                      </p>
                    </div>
                  )}
                </div>

                {starchImpact && (
                  <div className={`p-4 rounded-lg border ${
                    starchImpact.direction === "reduce"
                      ? "bg-amber-900/20 border-amber-500/30"
                      : starchImpact.direction === "increase"
                        ? "bg-blue-900/20 border-blue-500/30"
                        : "bg-green-900/20 border-green-500/30"
                  }`}>
                    <div className="text-xs font-medium text-white/80 mb-2">
                      Impact on your macros:
                    </div>
                    <p className="text-sm text-white/90 mb-2">
                      {starchImpact.explanation}
                    </p>
                    <p className="text-xs text-white/60 italic mb-3">
                      {starchImpact.label}
                    </p>

                    {starchImpact.carbsDelta !== 0 && (
                      <>
                        <div className="flex gap-4 text-sm mb-3">
                          <span className={deltaColor(starchImpact.proteinDelta)}>
                            Protein: {formatDelta(starchImpact.proteinDelta)}
                          </span>
                          <span className={deltaColor(starchImpact.carbsDelta)}>
                            Carbs: {formatDelta(starchImpact.carbsDelta)}
                          </span>
                          <span className={deltaColor(starchImpact.fatDelta)}>
                            Fat: {formatDelta(starchImpact.fatDelta)}
                          </span>
                        </div>

                        {onApplyAdjustments && !adjustmentApplied && (
                          <Button
                            onClick={handlePreviewChanges}
                            className="w-full bg-lime-600 border border-2 border-lime-400 text-white"
                          >
                            Preview Changes
                          </Button>
                        )}

                        {adjustmentApplied && (
                          <div className="flex items-center gap-2 text-sm text-green-400">
                            <Check className="h-4 w-4" />
                            <span>Adjustment applied to your macros</span>
                          </div>
                        )}
                      </>
                    )}

                    {starchImpact.carbsDelta === 0 && (
                      <div className="flex items-center gap-2 text-sm text-green-400">
                        <Check className="h-4 w-4" />
                        <span>No macro changes needed</span>
                      </div>
                    )}
                  </div>
                )}

                {!starchImpact && latestEntry.goalBodyFatPct === null && (
                  <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-blue-200/90">
                        Add a goal body fat % to see how your body composition
                        affects your starchy carb allocation.
                      </p>
                    </div>
                  </div>
                )}

                <Button
                  onClick={openSheet}
                  variant="outline"
                  className="w-full bg-white/5 border-white/20 text-white hover:bg-white/10"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Entry
                </Button>
              </>
            ) : (
              <>
                <div className="p-4 bg-black/40 rounded-lg border border-white/10 text-center">
                  <Scale className="h-10 w-10 text-white/30 mx-auto mb-3" />
                  <p className="text-white/70 text-sm mb-2">
                    No body composition data yet
                  </p>
                  <p className="text-white/50 text-xs">
                    Add your body fat % to get personalized starchy carb
                    recommendations
                  </p>
                </div>

                <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-200/90">
                      Body composition helps us tailor your starchy carb
                      allocation. You can get this from DEXA scans, BodPod,
                      calipers, or smart scales.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={openSheet}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Scale className="h-4 w-4 mr-2" />
                  Add Body Composition
                </Button>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      <BodyCompositionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSaved={handleSheetSaved}
      />

      {showConfirmDialog && starchImpact && starchImpact.carbsDelta !== 0 && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full bg-zinc-900 border border-blue-500/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="h-5 w-5 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">
                  Apply Body Composition Adjustment?
                </h3>
              </div>

              <p className="text-sm text-white/80 mb-4">
                Based on your body fat data, these adjustments will be applied
                to your macro targets:
              </p>

              <div className="p-4 bg-black/30 rounded-lg mb-2">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className={`text-lg font-bold ${deltaColor(starchImpact.proteinDelta)}`}>
                      {formatDelta(starchImpact.proteinDelta)}
                    </div>
                    <div className="text-xs text-white/60">Protein</div>
                  </div>
                  <div>
                    <div className={`text-lg font-bold ${deltaColor(starchImpact.carbsDelta)}`}>
                      {formatDelta(starchImpact.carbsDelta)}
                    </div>
                    <div className="text-xs text-white/60">Carbs</div>
                  </div>
                  <div>
                    <div className={`text-lg font-bold ${deltaColor(starchImpact.fatDelta)}`}>
                      {formatDelta(starchImpact.fatDelta)}
                    </div>
                    <div className="text-xs text-white/60">Fat</div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-white/60 italic mb-4">
                {starchImpact.explanation} — {starchImpact.label}
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
