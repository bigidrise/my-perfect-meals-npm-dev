/**
 * MetabolicConsiderations Component v1.0
 * 
 * User-facing section for the Macro Calculator that displays
 * metabolic and hormonal considerations that may affect macro needs.
 * 
 * V1 Conditions (LOCKED):
 * - Menopause / Hormone Therapy
 * - Suspected Insulin Resistance
 * - High Stress / Poor Sleep
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PillButton } from '@/components/ui/pill-button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Heart,
  Info,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Check,
  X,
} from 'lucide-react';
import {
  ADVISORY_DEFINITIONS,
  ADVISORY_KEYS,
  ClinicalAdvisoryState,
  AdvisoryConditionKey,
  MacroTargets,
  MacroDeltas,
  calculateAdvisorySuggestions,
  aggregateDeltas,
  formatDeltaPercent,
  loadUserAdvisory,
  saveUserAdvisory,
  hasAnyActiveAdvisory,
} from '@/lib/clinicalAdvisory';

interface MetabolicConsiderationsProps {
  currentTargets: MacroTargets;
  onApplyAdjustments: (deltas: MacroDeltas) => void;
}

export default function MetabolicConsiderations({
  currentTargets,
  onApplyAdjustments,
}: MetabolicConsiderationsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [advisory, setAdvisory] = useState<ClinicalAdvisoryState>(() => loadUserAdvisory() || {});
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingDeltas, setPendingDeltas] = useState<MacroDeltas | null>(null);

  const suggestions = calculateAdvisorySuggestions(advisory, currentTargets);
  const aggregated = aggregateDeltas(suggestions);
  const hasActive = hasAnyActiveAdvisory(advisory);

  const handleToggle = (key: AdvisoryConditionKey, enabled: boolean) => {
    const updated: ClinicalAdvisoryState = {
      ...advisory,
      [key]: {
        id: key,
        enabled,
        appliedAt: enabled ? new Date().toISOString() : undefined,
      },
    };
    setAdvisory(updated);
    saveUserAdvisory(updated);
  };

  const handlePreviewChanges = () => {
    if (suggestions.length === 0) return;
    setPendingDeltas(aggregated);
    setShowConfirmDialog(true);
  };

  const handleConfirmApply = () => {
    if (pendingDeltas) {
      onApplyAdjustments(pendingDeltas);
    }
    setShowConfirmDialog(false);
    setPendingDeltas(null);
  };

  const handleCancelApply = () => {
    setShowConfirmDialog(false);
    setPendingDeltas(null);
  };

  return (
    <Card className="bg-zinc-900/80 border border-white/30 text-white mt-5">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-5 cursor-pointer hover:bg-white/5 transition-colors">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Heart className="h-5 w-5 text-pink-400" />
                Metabolic & Hormonal Considerations
                {hasActive && (
                  <span className="text-xs bg-black/60 text-pink-200 px-2 py-0.5 rounded-full ml-2">
                    {suggestions.length} active
                  </span>
                )}
              </h3>
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
            <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-200/90">
                  These factors can influence how your body responds to calories and macros.
                  They do not override your goals — they help fine-tune recommendations.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {ADVISORY_KEYS.map((key) => {
                const def = ADVISORY_DEFINITIONS[key];
                const toggle = advisory[key];
                const isEnabled = toggle?.enabled || false;

                return (
                  <div
                    key={key}
                    className={`p-4 rounded-lg border transition-colors ${
                      isEnabled
                        ? 'bg-black/60'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{def.label}</span>
                      </div>
                      <PillButton
                        onClick={() => handleToggle(key, !isEnabled)}
                        active={isEnabled}
                      >
                        {isEnabled ? "On" : "Off"}
                      </PillButton>
                    </div>
                    <p className="text-xs text-white/60 mb-2">{def.description}</p>

                    {isEnabled && (
                      <div className="mt-3 p-3 bg-black/30 rounded-lg">
                        <div className="text-xs font-medium text-white/80 mb-2">Suggested adjustment:</div>
                        <div className="flex gap-4 text-xs mb-2">
                          <span className={def.proteinDeltaPercent > 0 ? 'text-green-400' : def.proteinDeltaPercent < 0 ? 'text-red-400' : 'text-white/60'}>
                            Protein: {formatDeltaPercent(def.proteinDeltaPercent)}
                          </span>
                          <span className={def.carbDeltaPercent > 0 ? 'text-green-400' : def.carbDeltaPercent < 0 ? 'text-red-400' : 'text-white/60'}>
                            Carbs: {formatDeltaPercent(def.carbDeltaPercent)}
                          </span>
                          <span className={def.fatDeltaPercent > 0 ? 'text-green-400' : def.fatDeltaPercent < 0 ? 'text-red-400' : 'text-white/60'}>
                            Fat: {formatDeltaPercent(def.fatDeltaPercent)}
                          </span>
                        </div>
                        <p className="text-xs text-white/70 italic">{def.userExplanation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {hasActive && suggestions.length > 0 && (
              <div className="mt-4 p-4 bg-black/60 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-white">Combined adjustments:</span>
                </div>
                <div className="flex gap-4 text-sm mb-4">
                  <span className={aggregated.protein > 0 ? 'text-green-400' : aggregated.protein < 0 ? 'text-red-400' : 'text-white/60'}>
                    Protein: {aggregated.protein > 0 ? '+' : ''}{aggregated.protein}g
                  </span>
                  <span className={aggregated.carbs > 0 ? 'text-green-400' : aggregated.carbs < 0 ? 'text-red-400' : 'text-white/60'}>
                    Carbs: {aggregated.carbs > 0 ? '+' : ''}{aggregated.carbs}g
                  </span>
                  <span className={aggregated.fat > 0 ? 'text-green-400' : aggregated.fat < 0 ? 'text-red-400' : 'text-white/60'}>
                    Fat: {aggregated.fat > 0 ? '+' : ''}{aggregated.fat}g
                  </span>
                </div>
                <Button
                  onClick={handlePreviewChanges}
                  className="w-full bg-blue-800 text-white"
                >
                  Preview Changes
                </Button>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-white/15 bg-black/40 p-3 text-xs text-white/70">
              <div className="font-semibold text-white/80 mb-1">
                Educational Notice
              </div>
              <p>
                Metabolic and hormone-related insights are provided for educational and
                lifestyle guidance only. They do not diagnose, treat, or replace medical
                advice. Individual responses vary. Consult a qualified healthcare
                professional for medical concerns.
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      {showConfirmDialog && pendingDeltas && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full bg-zinc-900 border border-pink-500/50">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="h-5 w-5 text-pink-400" />
                <h3 className="text-lg font-semibold text-white">Apply Adjustments?</h3>
              </div>

              <p className="text-sm text-white/80 mb-4">
                These adjustments will be applied to your calculated macro targets:
              </p>

              <div className="p-4 bg-black/30 rounded-lg mb-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className={`text-lg font-bold ${pendingDeltas.protein > 0 ? 'text-green-400' : pendingDeltas.protein < 0 ? 'text-red-400' : 'text-white/60'}`}>
                      {pendingDeltas.protein > 0 ? '+' : ''}{pendingDeltas.protein}g
                    </div>
                    <div className="text-xs text-white/60">Protein</div>
                  </div>
                  <div>
                    <div className={`text-lg font-bold ${pendingDeltas.carbs > 0 ? 'text-green-400' : pendingDeltas.carbs < 0 ? 'text-red-400' : 'text-white/60'}`}>
                      {pendingDeltas.carbs > 0 ? '+' : ''}{pendingDeltas.carbs}g
                    </div>
                    <div className="text-xs text-white/60">Carbs</div>
                  </div>
                  <div>
                    <div className={`text-lg font-bold ${pendingDeltas.fat > 0 ? 'text-green-400' : pendingDeltas.fat < 0 ? 'text-red-400' : 'text-white/60'}`}>
                      {pendingDeltas.fat > 0 ? '+' : ''}{pendingDeltas.fat}g
                    </div>
                    <div className="text-xs text-white/60">Fat</div>
                  </div>
                </div>
              </div>

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
