/**
 * NutritionPersonalizationSummaryCard
 *
 * "Your Nutrition Life Plan" — the user-facing window into the Protocol Envelope.
 * Lives at the top of the Dashboard, above all other protocol cards.
 *
 * Read-only. No new protocol logic. Reads from GET /api/nutrition-summary.
 *
 * Accepts an optional `summary` prop so it can be embedded in ProCare views.
 * When no prop is provided it fetches via useNutritionSummary hook.
 */

import { useState } from "react";
import { ChevronDown, ChevronUp, ShieldCheck, Layers, FlaskConical, Activity } from "lucide-react";
import { useNutritionSummary } from "@/hooks/useNutritionSummary";
import type { NutritionPersonalizationSummary, NutritionSummaryHealthItem } from "@/types/nutritionSummary";

interface Props {
  summary?: NutritionPersonalizationSummary;
  isLoading?: boolean;
  defaultExpanded?: boolean;
}

export function NutritionPersonalizationSummaryCard({ summary: summaryProp, isLoading: isLoadingProp, defaultExpanded = false }: Props = {}) {
  const hook = useNutritionSummary();
  const data = summaryProp ?? hook.data;
  const isLoading = isLoadingProp ?? hook.isLoading;
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-black/50 border border-orange-500/20 p-4 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-48 mb-2" />
        <div className="h-3 bg-white/5 rounded w-full mb-1" />
        <div className="h-3 bg-white/5 rounded w-3/4" />
      </div>
    );
  }

  if (!data) return null;

  const { activeInputs, nutritionDrivers, nutritionPriorities, compositeExplanation, conflictPolicy, hasAnyActiveProtocol } = data;

  const highItems = activeInputs.health.filter(h => h.priority === "high");
  const moderateItems = activeInputs.health.filter(h => h.priority === "moderate");

  type ChipCategory = "clinical" | "performance" | "pregnancy" | "therapeutic" | "diet" | "cuisine" | "goal";

  const allChips: { label: string; category: ChipCategory }[] = [
    ...highItems.map(h => ({ label: h.label, category: "clinical" as const })),
    ...moderateItems.map(h => ({ label: h.label, category: "clinical" as const })),
    ...(activeInputs.pregnancy
      ? [{ label: activeInputs.pregnancy.label + (activeInputs.pregnancy.detail ? ` · ${activeInputs.pregnancy.detail}` : ""), category: "pregnancy" as const }]
      : []),
    ...(activeInputs.performance
      ? [{ label: activeInputs.performance.label + (activeInputs.performance.detail ? ` · ${activeInputs.performance.detail}` : ""), category: "performance" as const }]
      : []),
    ...(activeInputs.therapeutic
      ? [{ label: activeInputs.therapeutic.label + (activeInputs.therapeutic.detail ? ` · ${activeInputs.therapeutic.detail}` : ""), category: "therapeutic" as const }]
      : []),
    ...activeInputs.dietary.map(d => ({ label: d, category: "diet" as const })),
    ...(activeInputs.cuisine ? [{ label: activeInputs.cuisine, category: "cuisine" as const }] : []),
    ...(activeInputs.goal ? [{ label: activeInputs.goal, category: "goal" as const }] : []),
  ];

  const CHIP_COLORS: Record<ChipCategory, string> = {
    clinical:     "bg-orange-500/15 border-orange-500/30 text-orange-300",
    performance:  "bg-blue-500/15 border-blue-500/30 text-blue-300",
    pregnancy:    "bg-pink-500/15 border-pink-500/30 text-pink-300",
    therapeutic:  "bg-violet-500/15 border-violet-500/30 text-violet-300",
    diet:         "bg-emerald-500/12 border-emerald-500/25 text-emerald-300",
    cuisine:      "bg-amber-500/12 border-amber-500/25 text-amber-300",
    goal:         "bg-white/8 border-white/15 text-white/60",
  };

  const VISIBLE_CAP = 5;
  const visibleChips = expanded ? allChips : allChips.slice(0, VISIBLE_CAP);
  const hiddenCount = allChips.length - VISIBLE_CAP;

  const hasDriverDetails =
    (nutritionDrivers?.therapeuticInputs?.length ?? 0) > 0 ||
    (nutritionDrivers?.liveMetrics?.length ?? 0) > 0;

  return (
    <div className="rounded-2xl bg-black/50 border border-orange-500/25 overflow-hidden">

      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-orange-400 flex-shrink-0" />
          <p className="text-sm font-bold text-white">Your Nutrition Life Plan</p>
        </div>
        {!hasAnyActiveProtocol && (
          <span className="text-[10px] text-white/30 font-medium bg-white/5 rounded-full px-2 py-0.5 border border-white/10">
            Baseline
          </span>
        )}
      </div>

      {/* ── Active Input Chips ── */}
      {allChips.length > 0 && (
        <div className="px-4 pb-3 flex flex-wrap gap-1.5">
          {visibleChips.map((chip, i) => (
            <span
              key={i}
              className={`text-[11px] border rounded-full px-2.5 py-0.5 font-medium ${CHIP_COLORS[chip.category]}`}
            >
              {chip.label}
            </span>
          ))}
          {!expanded && hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(true)}
              className="text-[11px] bg-white/8 border border-white/15 text-white/45 rounded-full px-2.5 py-0.5 font-medium"
            >
              +{hiddenCount} more
            </button>
          )}
        </div>
      )}

      {/* ── Macros strip ── */}
      {activeInputs.macros && (activeInputs.macros.calories || activeInputs.macros.proteinG) && (
        <div className="px-4 pb-3">
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: "Cal",     value: activeInputs.macros.calories  ? `${activeInputs.macros.calories.toLocaleString()}` : "—" },
              { label: "Protein", value: activeInputs.macros.proteinG  ? `${activeInputs.macros.proteinG}g` : "—" },
              { label: "Carbs",   value: activeInputs.macros.carbsG    ? `${activeInputs.macros.carbsG}g`  : "—" },
              { label: "Fat",     value: activeInputs.macros.fatG      ? `${activeInputs.macros.fatG}g`    : "—" },
            ].map(m => (
              <div key={m.label} className="bg-white/5 rounded-lg py-1.5 text-center border border-white/8">
                <p className="text-white font-semibold text-xs leading-none">{m.value}</p>
                <p className="text-white/30 text-[9px] mt-0.5 uppercase tracking-wide">{m.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Expand / Collapse toggle ── */}
      <button
        onClick={() => setExpanded(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 border-t border-white/8 active:bg-white/5 transition-colors select-none"
      >
        <span className="text-[11px] font-semibold text-white/50">
          {expanded ? "Show less" : "See how your meals are being built"}
        </span>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
        }
      </button>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/8">

          {/* ── What's Driving Your Meals — details section ── */}
          {hasDriverDetails && (
            <div className="pt-3 space-y-3">
              <p className="text-[10px] text-white/35 uppercase tracking-widest font-semibold">
                What's Driving Your Meals
              </p>

              {/* Therapeutic Protocol — name + dose */}
              {(nutritionDrivers?.therapeuticInputs?.length ?? 0) > 0 && (
                <div className="bg-violet-500/8 border border-violet-500/20 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <FlaskConical className="w-3 h-3 text-violet-400/70 flex-shrink-0" />
                    <p className="text-[10px] text-violet-400/70 uppercase tracking-widest font-semibold">
                      Therapeutic Protocol
                    </p>
                  </div>
                  <div className="space-y-2">
                    {nutritionDrivers!.therapeuticInputs.map((item, i) => (
                      <div key={i} className="flex items-center justify-between gap-3">
                        <span className="text-xs text-white/75 leading-snug">{item.name}</span>
                        <span className="text-[11px] font-semibold text-violet-300 bg-violet-500/15 border border-violet-500/25 rounded-full px-2.5 py-0.5 flex-shrink-0">
                          {item.dose}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Metrics */}
              {(nutritionDrivers?.liveMetrics?.length ?? 0) > 0 && (
                <div className="bg-white/4 border border-white/10 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <Activity className="w-3 h-3 text-orange-400/70 flex-shrink-0" />
                    <p className="text-[10px] text-orange-400/70 uppercase tracking-widest font-semibold">
                      Live Context
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {nutritionDrivers!.liveMetrics.map((m, i) => (
                      <div key={i} className="bg-white/5 rounded-lg px-2.5 py-2">
                        <p className="text-[9px] text-white/35 uppercase tracking-wide mb-0.5">{m.label}</p>
                        <p className="text-xs font-semibold text-white/80">{m.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Nutrition priorities */}
          {nutritionPriorities.length > 0 && (
            <div className={hasDriverDetails ? "" : "pt-3"}>
              <p className="text-[10px] text-white/35 uppercase tracking-widest font-semibold mb-2">
                Your Nutrition Priorities
              </p>
              <div className="space-y-1.5">
                {nutritionPriorities.map((p, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-400/70 flex-shrink-0 mt-1.5" />
                    <span className="text-xs text-white/70 leading-snug">{p}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Composite explanation */}
          <div className="bg-white/5 border border-white/8 rounded-xl p-3">
            <p className="text-[10px] text-orange-400/60 uppercase tracking-widest font-semibold mb-1.5">
              Current Strategy
            </p>
            <p className="text-xs text-white/65 leading-relaxed">{compositeExplanation}</p>
          </div>

          {/* Protocol breakdown */}
          {(highItems.length > 0 || moderateItems.length > 0) && (
            <div>
              <p className="text-[10px] text-white/35 uppercase tracking-widest font-semibold mb-2">
                Active Protocols
              </p>
              <div className="space-y-1.5">
                {highItems.map((h: NutritionSummaryHealthItem) => (
                  <div key={h.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                      <span className="text-xs text-white/75">{h.label}</span>
                    </div>
                    <span className="text-[10px] text-orange-400/60 font-medium">Clinical</span>
                  </div>
                ))}
                {moderateItems.map((h: NutritionSummaryHealthItem) => (
                  <div key={h.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60 flex-shrink-0" />
                      <span className="text-xs text-white/60">{h.label}</span>
                    </div>
                    <span className="text-[10px] text-amber-400/50 font-medium">Support</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conflict policy */}
          <div className="flex items-start gap-2 pt-1">
            <Layers className="w-3 h-3 text-white/20 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-white/25 leading-relaxed">{conflictPolicy}</p>
          </div>

          {!hasAnyActiveProtocol && (
            <p className="text-[11px] text-white/35 leading-relaxed pt-1">
              Your meals are personalized using your dietary preferences and macro targets. Add health conditions, performance goals, or medical protocols in your profile to see how they shape your nutrition.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
