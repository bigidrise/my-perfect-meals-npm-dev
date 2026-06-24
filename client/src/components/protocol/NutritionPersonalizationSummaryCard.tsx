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

// ── Per-protocol color map (keyed by condition slug) ─────────────────────────
interface ProtocolColor { bg: string; border: string; text: string }

const PROTOCOL_COLORS: Record<string, ProtocolColor> = {
  // Diabetes
  "diabetes":               { bg: "bg-blue-500/10",    border: "border-blue-500/25",    text: "text-blue-400"    },
  "diabetic":               { bg: "bg-blue-500/10",    border: "border-blue-500/25",    text: "text-blue-400"    },
  "diabetes-type1":         { bg: "bg-blue-500/10",    border: "border-blue-500/25",    text: "text-blue-400"    },
  "diabetes-type2":         { bg: "bg-blue-500/10",    border: "border-blue-500/25",    text: "text-blue-400"    },
  "prediabetes":            { bg: "bg-blue-500/10",    border: "border-blue-500/25",    text: "text-blue-400"    },
  // GLP-1
  "glp-1":                  { bg: "bg-orange-500/10",  border: "border-orange-500/25",  text: "text-orange-400"  },
  "glp1":                   { bg: "bg-orange-500/10",  border: "border-orange-500/25",  text: "text-orange-400"  },
  // Anti-inflammatory
  "anti-inflammatory":      { bg: "bg-green-500/10",   border: "border-green-500/25",   text: "text-green-400"   },
  "anti_inflammatory":      { bg: "bg-green-500/10",   border: "border-green-500/25",   text: "text-green-400"   },
  "arthritis":              { bg: "bg-green-500/10",   border: "border-green-500/25",   text: "text-green-400"   },
  // Cardiac
  "cardiac":                { bg: "bg-red-500/10",     border: "border-red-500/25",     text: "text-red-400"     },
  "heart-disease":          { bg: "bg-red-500/10",     border: "border-red-500/25",     text: "text-red-400"     },
  "hypertension":           { bg: "bg-red-500/10",     border: "border-red-500/25",     text: "text-red-400"     },
  // Renal
  "renal":                  { bg: "bg-sky-500/10",     border: "border-sky-500/25",     text: "text-sky-400"     },
  "kidney-disease":         { bg: "bg-sky-500/10",     border: "border-sky-500/25",     text: "text-sky-400"     },
  "ckd":                    { bg: "bg-sky-500/10",     border: "border-sky-500/25",     text: "text-sky-400"     },
  // Oncology
  "oncology":               { bg: "bg-pink-500/10",    border: "border-pink-500/25",    text: "text-pink-400"    },
  "oncology-support":       { bg: "bg-pink-500/10",    border: "border-pink-500/25",    text: "text-pink-400"    },
  // Liver
  "liver-support":          { bg: "bg-emerald-500/10", border: "border-emerald-500/25", text: "text-emerald-400" },
  "liver-disease":          { bg: "bg-emerald-500/10", border: "border-emerald-500/25", text: "text-emerald-400" },
  // Thyroid
  "thyroid-support":        { bg: "bg-teal-500/10",    border: "border-teal-500/25",    text: "text-teal-400"    },
  "hashimotos":             { bg: "bg-teal-500/10",    border: "border-teal-500/25",    text: "text-teal-300"    },
  "hypothyroid":            { bg: "bg-teal-500/10",    border: "border-teal-500/25",    text: "text-teal-400"    },
  "hyperthyroid":           { bg: "bg-cyan-500/10",    border: "border-cyan-500/25",    text: "text-cyan-400"    },
  // Hormone / Menopause
  "hormone-optimization":   { bg: "bg-purple-500/10",  border: "border-purple-500/25",  text: "text-purple-400"  },
  "menopause":              { bg: "bg-violet-500/10",  border: "border-violet-500/25",  text: "text-violet-400"  },
  "perimenopause":          { bg: "bg-purple-500/10",  border: "border-purple-500/25",  text: "text-purple-400"  },
  "metabolic-recovery":     { bg: "bg-amber-500/10",   border: "border-amber-500/25",   text: "text-amber-400"   },
  // Others
  "cholesterol":            { bg: "bg-yellow-500/10",  border: "border-yellow-500/25",  text: "text-yellow-400"  },
  "gout":                   { bg: "bg-lime-500/10",    border: "border-lime-500/25",    text: "text-lime-400"    },
  // Pregnancy
  "pregnancy-support":      { bg: "bg-pink-500/10",    border: "border-pink-500/25",    text: "text-pink-400"    },
  // Therapeutic
  "therapeutic-support":    { bg: "bg-violet-500/10",  border: "border-violet-500/25",  text: "text-violet-400"  },
  // Performance
  "performance-nutrition":  { bg: "bg-blue-500/10",    border: "border-blue-500/25",    text: "text-blue-400"    },
};

const DEFAULT_COLOR: ProtocolColor = { bg: "bg-orange-500/10", border: "border-orange-500/25", text: "text-orange-400" };

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

  const highItems   = activeInputs.health.filter(h => h.priority === "high");
  const moderateItems = activeInputs.health.filter(h => h.priority === "moderate");
  const allHealthItems = [...highItems, ...moderateItems];

  const hasTherapeuticInputs = (nutritionDrivers?.therapeuticInputs?.length ?? 0) > 0;
  const hasLiveMetrics       = (nutritionDrivers?.liveMetrics?.length ?? 0) > 0;
  const hasDietaryIdentity   = (data.dietaryIdentity?.length ?? 0) > 0;
  const hasMealBuilder       = !!data.mealBuilderLabel;

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

      {/* ── Macros strip ── */}
      {activeInputs.macros && (activeInputs.macros.calories || activeInputs.macros.proteinG) && (
        <div className="px-4 pb-3">
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: "Cal",     value: activeInputs.macros.calories ? `${activeInputs.macros.calories.toLocaleString()}` : "—" },
              { label: "Protein", value: activeInputs.macros.proteinG ? `${activeInputs.macros.proteinG}g` : "—" },
              { label: "Carbs",   value: activeInputs.macros.carbsG   ? `${activeInputs.macros.carbsG}g`  : "—" },
              { label: "Fat",     value: activeInputs.macros.fatG     ? `${activeInputs.macros.fatG}g`    : "—" },
            ].map(m => (
              <div key={m.label} className="bg-white/5 rounded-lg py-1.5 text-center border border-white/8">
                <p className="text-white font-semibold text-xs leading-none">{m.value}</p>
                <p className="text-green-400 text-[9px] mt-0.5 uppercase tracking-wide">{m.label}</p>
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
        <div className="px-4 pb-4 space-y-2.5 border-t border-white/8">

          {/* ── No-protocol baseline message ── */}
          {!hasAnyActiveProtocol && !hasDietaryIdentity && !hasMealBuilder && (
            <p className="text-[11px] text-white/35 leading-relaxed pt-4">
              Your meals are personalized using your dietary preferences and macro targets. Add health conditions, performance goals, or medical protocols in your profile to see how they shape your nutrition.
            </p>
          )}

          {/* ── Active Protocol blocks — one per condition ── */}
          {allHealthItems.length > 0 && (
            <div className="pt-3 space-y-2">
              <p className="text-[10px] text-white/35 uppercase tracking-widest font-semibold">
                Active Protocols
              </p>
              {allHealthItems.map((h: NutritionSummaryHealthItem) => {
                const c = PROTOCOL_COLORS[h.key] ?? DEFAULT_COLOR;
                return (
                  <div key={h.key} className={`${c.bg} border ${c.border} rounded-xl px-3 py-2.5`}>
                    <p className={`text-[11px] font-black uppercase tracking-widest ${c.text}`}>
                      {h.label}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Performance block ── */}
          {activeInputs.performance && (
            <div className={allHealthItems.length === 0 ? "pt-3" : ""}>
              {allHealthItems.length === 0 && (
                <p className="text-[10px] text-white/35 uppercase tracking-widest font-semibold mb-2">
                  Active Protocols
                </p>
              )}
              <div className="bg-blue-500/10 border border-blue-500/25 rounded-xl px-3 py-2.5">
                <p className="text-[11px] font-black uppercase tracking-widest text-blue-400">
                  {activeInputs.performance.label}
                </p>
                {activeInputs.performance.detail && (
                  <p className="text-[11px] text-blue-300/70 mt-0.5">{activeInputs.performance.detail}</p>
                )}
              </div>
            </div>
          )}

          {/* ── Pregnancy block ── */}
          {activeInputs.pregnancy && (
            <div className="bg-pink-500/10 border border-pink-500/25 rounded-xl px-3 py-2.5">
              <p className="text-[11px] font-black uppercase tracking-widest text-pink-400">
                {activeInputs.pregnancy.label}
              </p>
              {activeInputs.pregnancy.detail && (
                <p className="text-[11px] text-pink-300/70 mt-0.5">{activeInputs.pregnancy.detail}</p>
              )}
            </div>
          )}

          {/* ── Therapeutic Support block ── */}
          {hasTherapeuticInputs && (
            <div className="bg-violet-500/10 border border-violet-500/25 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-2.5">
                <FlaskConical className="w-3 h-3 text-violet-400 flex-shrink-0" />
                <p className="text-[11px] font-black uppercase tracking-widest text-violet-400">
                  Therapeutic Support
                </p>
              </div>
              <div className="space-y-2">
                {nutritionDrivers!.therapeuticInputs.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-white/75 leading-snug">{item.name}</span>
                    <span className="text-[11px] font-semibold text-violet-300 bg-violet-500/15 border border-violet-500/25 rounded-full px-2.5 py-0.5 flex-shrink-0">
                      ({item.dose})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Dietary Identity block ── */}
          {hasDietaryIdentity && (
            <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl px-3 py-2.5">
              <p className="text-[11px] font-black uppercase tracking-widest text-emerald-400 mb-2.5">
                Dietary Identity
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.dietaryIdentity!.map((d, i) => (
                  <span key={i} className="text-[11px] font-bold uppercase tracking-wide text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 rounded-full px-2.5 py-0.5">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Cuisine block ── */}
          {activeInputs.cuisine && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2.5">
              <p className="text-[11px] font-black uppercase tracking-widest text-amber-400 mb-1.5">
                Cuisine
              </p>
              <p className="text-[12px] font-bold uppercase tracking-wide text-amber-300">
                {activeInputs.cuisine}
              </p>
            </div>
          )}

          {/* ── Goal block ── */}
          {activeInputs.goal && (
            <div className="bg-orange-500/10 border border-orange-500/25 rounded-xl px-3 py-2.5">
              <p className="text-[11px] font-black uppercase tracking-widest text-orange-400 mb-1.5">
                Goal
              </p>
              <p className="text-[12px] font-bold uppercase tracking-wide text-orange-300">
                {activeInputs.goal}
              </p>
            </div>
          )}

          {/* ── Meal Builder block ── */}
          {hasMealBuilder && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2.5">
              <p className="text-[11px] font-black uppercase tracking-widest text-amber-400 mb-1.5">
                Meal Builder
              </p>
              <p className="text-[12px] font-bold uppercase tracking-wide text-amber-300">
                {data.mealBuilderLabel}
              </p>
            </div>
          )}

          {/* ── Live Context block ── */}
          {hasLiveMetrics && (
            <div className="bg-white/4 border border-white/10 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Activity className="w-3 h-3 text-orange-400 flex-shrink-0" />
                <p className="text-[11px] font-black uppercase tracking-widest text-orange-400">
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

          {/* ── Nutrition Priorities ── */}
          {nutritionPriorities.length > 0 && (
            <div className="pt-1">
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

          {/* ── Current Strategy ── */}
          <div className="bg-white/5 border border-white/8 rounded-xl p-3">
            <p className="text-[10px] text-orange-400/60 uppercase tracking-widest font-semibold mb-1.5">
              Current Strategy
            </p>
            <p className="text-xs text-white/65 leading-relaxed">{compositeExplanation}</p>
          </div>

          {/* ── Conflict policy footer ── */}
          <div className="flex items-start gap-2 pt-1">
            <Layers className="w-3 h-3 text-white/20 flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-white/25 leading-relaxed">{conflictPolicy}</p>
          </div>

        </div>
      )}
    </div>
  );
}
