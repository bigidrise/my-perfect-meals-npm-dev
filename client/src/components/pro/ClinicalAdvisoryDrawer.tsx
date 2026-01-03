import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Brain, ChevronDown, ChevronUp, Check, AlertCircle } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ClinicalAdvisory, Targets } from "@/lib/proData";

export type AdvisorySuggestion = {
  toggleId: string;
  label: string;
  proteinDelta: number;
  carbDelta: number;
  fatDelta: number;
  rationale: string;
};

const ADVISORY_DEFINITIONS: Record<
  keyof ClinicalAdvisory,
  {
    label: string;
    description: string;
    proteinDeltaPercent: number;
    carbDeltaPercent: number;
    fatDeltaPercent: number;
    rationale: string;
  }
> = {
  menopause: {
    label: "Menopause / Hormone Therapy",
    description: "Post-menopausal or on hormone replacement therapy",
    proteinDeltaPercent: 10,
    carbDeltaPercent: -5,
    fatDeltaPercent: 5,
    rationale:
      "Higher protein supports muscle preservation during hormonal changes. Moderate fat supports hormone synthesis. Slight carb reduction helps with insulin sensitivity.",
  },
  insulinResistance: {
    label: "Suspected Insulin Resistance",
    description: "Metabolic indicators suggest reduced insulin sensitivity",
    proteinDeltaPercent: 5,
    carbDeltaPercent: -15,
    fatDeltaPercent: 5,
    rationale:
      "Lower carbohydrate intake reduces glycemic load. Increased protein and fat help with satiety and blood sugar stability.",
  },
  highStress: {
    label: "High Stress / Poor Sleep",
    description: "Elevated cortisol, chronic stress, or sleep disruption",
    proteinDeltaPercent: 5,
    carbDeltaPercent: 0,
    fatDeltaPercent: 0,
    rationale:
      "Higher protein supports recovery and prevents muscle catabolism during stress. Consider timing carbs around sleep for cortisol regulation.",
  },
};

function calculateSuggestions(
  advisory: ClinicalAdvisory | undefined,
  targets: Targets
): AdvisorySuggestion[] {
  const suggestions: AdvisorySuggestion[] = [];

  if (!advisory) return suggestions;

  (Object.keys(ADVISORY_DEFINITIONS) as (keyof ClinicalAdvisory)[]).forEach(
    (key) => {
      const toggle = advisory[key];
      if (toggle?.enabled) {
        const def = ADVISORY_DEFINITIONS[key];
        const totalCarbs = (targets.starchyCarbs || 0) + (targets.fibrousCarbs || 0);

        suggestions.push({
          toggleId: key,
          label: def.label,
          proteinDelta: Math.round(
            (targets.protein * def.proteinDeltaPercent) / 100
          ),
          carbDelta: Math.round((totalCarbs * def.carbDeltaPercent) / 100),
          fatDelta: Math.round((targets.fat * def.fatDeltaPercent) / 100),
          rationale: def.rationale,
        });
      }
    }
  );

  return suggestions;
}

function aggregateSuggestions(suggestions: AdvisorySuggestion[]) {
  return suggestions.reduce(
    (acc, s) => ({
      protein: acc.protein + s.proteinDelta,
      carbs: acc.carbs + s.carbDelta,
      fat: acc.fat + s.fatDelta,
    }),
    { protein: 0, carbs: 0, fat: 0 }
  );
}

interface ClinicalAdvisoryDrawerProps {
  advisory: ClinicalAdvisory | undefined;
  targets: Targets;
  onAdvisoryChange: (advisory: ClinicalAdvisory) => void;
  onApplySuggestions: (deltas: { protein: number; carbs: number; fat: number }) => void;
}

export default function ClinicalAdvisoryDrawer({
  advisory,
  targets,
  onAdvisoryChange,
  onApplySuggestions,
}: ClinicalAdvisoryDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const suggestions = calculateSuggestions(advisory, targets);
  const aggregated = aggregateSuggestions(suggestions);
  const hasSuggestions = suggestions.length > 0;

  const handleToggle = (key: keyof ClinicalAdvisory, enabled: boolean) => {
    const current = advisory || {};
    onAdvisoryChange({
      ...current,
      [key]: {
        id: key,
        enabled,
        appliedAt: enabled ? new Date().toISOString() : undefined,
      },
    });
  };

  const handleApply = () => {
    onApplySuggestions(aggregated);
    setShowConfirm(false);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between p-3 bg-purple-900/30 border border-purple-500/30 rounded-lg hover:bg-purple-900/40 transition-colors">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-400" />
            <span className="text-sm font-medium text-purple-300">
              Clinical Advisory
            </span>
            {hasSuggestions && (
              <span className="text-xs bg-purple-500/30 text-purple-200 px-2 py-0.5 rounded-full">
                {suggestions.length} active
              </span>
            )}
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4 text-purple-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-purple-400" />
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-3 space-y-4">
        <div className="p-3 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-yellow-200/80">
              These are advisory suggestions only. You maintain full control
              over final macro targets. Changes require explicit confirmation.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {(Object.keys(ADVISORY_DEFINITIONS) as (keyof ClinicalAdvisory)[]).map(
            (key) => {
              const def = ADVISORY_DEFINITIONS[key];
              const toggle = advisory?.[key];
              const isEnabled = toggle?.enabled || false;

              return (
                <div
                  key={key}
                  className={`p-3 rounded-lg border transition-colors ${
                    isEnabled
                      ? "bg-purple-900/30 border-purple-500/40"
                      : "bg-white/5 border-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-white">
                      {def.label}
                    </span>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) => handleToggle(key, checked)}
                    />
                  </div>
                  <p className="text-xs text-white/60">{def.description}</p>

                  {isEnabled && (
                    <div className="mt-2 p-2 bg-black/20 rounded text-xs">
                      <div className="flex gap-3 mb-1">
                        <span
                          className={
                            def.proteinDeltaPercent > 0
                              ? "text-green-400"
                              : def.proteinDeltaPercent < 0
                                ? "text-red-400"
                                : "text-white/60"
                          }
                        >
                          Protein: {def.proteinDeltaPercent > 0 ? "+" : ""}
                          {def.proteinDeltaPercent}%
                        </span>
                        <span
                          className={
                            def.carbDeltaPercent > 0
                              ? "text-green-400"
                              : def.carbDeltaPercent < 0
                                ? "text-red-400"
                                : "text-white/60"
                          }
                        >
                          Carbs: {def.carbDeltaPercent > 0 ? "+" : ""}
                          {def.carbDeltaPercent}%
                        </span>
                        <span
                          className={
                            def.fatDeltaPercent > 0
                              ? "text-green-400"
                              : def.fatDeltaPercent < 0
                                ? "text-red-400"
                                : "text-white/60"
                          }
                        >
                          Fat: {def.fatDeltaPercent > 0 ? "+" : ""}
                          {def.fatDeltaPercent}%
                        </span>
                      </div>
                      <p className="text-white/50 italic">{def.rationale}</p>
                    </div>
                  )}
                </div>
              );
            }
          )}
        </div>

        {hasSuggestions && (
          <div className="p-3 bg-green-900/20 border border-green-500/30 rounded-lg">
            <h4 className="text-sm font-medium text-green-300 mb-2">
              Aggregated Suggestion
            </h4>
            <div className="flex gap-4 text-sm mb-3">
              <span
                className={
                  aggregated.protein > 0
                    ? "text-green-400"
                    : aggregated.protein < 0
                      ? "text-red-400"
                      : "text-white/60"
                }
              >
                Protein: {aggregated.protein > 0 ? "+" : ""}
                {aggregated.protein}g
              </span>
              <span
                className={
                  aggregated.carbs > 0
                    ? "text-green-400"
                    : aggregated.carbs < 0
                      ? "text-red-400"
                      : "text-white/60"
                }
              >
                Carbs: {aggregated.carbs > 0 ? "+" : ""}
                {aggregated.carbs}g
              </span>
              <span
                className={
                  aggregated.fat > 0
                    ? "text-green-400"
                    : aggregated.fat < 0
                      ? "text-red-400"
                      : "text-white/60"
                }
              >
                Fat: {aggregated.fat > 0 ? "+" : ""}
                {aggregated.fat}g
              </span>
            </div>

            {!showConfirm ? (
              <Button
                size="sm"
                variant="outline"
                className="w-full bg-green-600/20 border-green-500/40 text-green-300 hover:bg-green-600/30"
                onClick={() => setShowConfirm(true)}
              >
                Stage Changes for Review
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-yellow-200">
                  This will adjust your current macro targets. Confirm to apply.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 bg-white/10 border-white/20"
                    onClick={() => setShowConfirm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleApply}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Apply to Targets
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
