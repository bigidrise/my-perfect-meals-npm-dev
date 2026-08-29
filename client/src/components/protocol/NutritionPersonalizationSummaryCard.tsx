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
import { Bell, ChevronDown, ChevronUp, ShieldCheck, Layers, FlaskConical, Activity, Droplets } from "lucide-react";
import { useNutritionSummary } from "@/hooks/useNutritionSummary";
import type { NutritionPersonalizationSummary, NutritionSummaryHealthItem } from "@/types/nutritionSummary";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";

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
  // Alpha-gal Syndrome — clinical allergy
  "alpha-gal-syndrome":     { bg: "bg-red-500/10",     border: "border-red-500/25",     text: "text-red-400"     },
  "alpha-gal syndrome":     { bg: "bg-red-500/10",     border: "border-red-500/25",     text: "text-red-400"     },
  "alpha-gal":              { bg: "bg-red-500/10",     border: "border-red-500/25",     text: "text-red-400"     },
};

const DEFAULT_COLOR: ProtocolColor = { bg: "bg-orange-500/10", border: "border-orange-500/25", text: "text-orange-400" };

export function NutritionPersonalizationSummaryCard({ summary: summaryProp, isLoading: isLoadingProp, defaultExpanded = false }: Props = {}) {
  const hook = useNutritionSummary();
  const data = summaryProp ?? hook.data;
  const isLoading = isLoadingProp ?? hook.isLoading;
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { t } = useTranslation("nutritionPlan");
  const [, navigate] = useLocation();
  const [acknowledgedUpdateId, setAcknowledgedUpdateId] = useState<string | null>(null);

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

  const { activeInputs, nutritionDrivers, nutritionPriorities, compositeExplanation, conflictPolicy, hasAnyActiveProtocol, carbCycleActive } = data;

  const highItems   = (activeInputs?.health ?? []).filter(h => h.priority === "high");
  const moderateItems = (activeInputs?.health ?? []).filter(h => h.priority === "moderate");
  const allHealthItems = [...highItems, ...moderateItems];

  const hasTherapeuticInputs = (nutritionDrivers?.therapeuticInputs?.length ?? 0) > 0;
  const hasLiveMetrics       = (nutritionDrivers?.liveMetrics?.length ?? 0) > 0;
  const hasDietaryIdentity   = (data.dietaryIdentity?.length ?? 0) > 0;
  const hasMealBuilder       = !!data.mealBuilderLabel;
  const latestProfessionalUpdate = data.professionalUpdates?.[0] ?? null;
  const updateSeen = latestProfessionalUpdate
    ? acknowledgedUpdateId === latestProfessionalUpdate.id ||
      localStorage.getItem(`mpm-plan-update-seen:${latestProfessionalUpdate.id}`) === "1"
    : true;
  const hasHydrationPlan =
    data.hydration?.tracking.status === "NUMERIC_ACTIVE" ||
    data.hydration?.liquidNutrition?.status === "active";
  const displayMl = (ml: number | null) =>
    ml === null ? null : `${Math.round(ml / 29.5735)} oz (${ml.toLocaleString()} mL)`;
  const hydrationDetail = (() => {
    const tracking = data.hydration?.tracking;
    if (!tracking) return "Hydration status is unavailable.";
    if (tracking.status === "TRACK_ONLY") return "Tracking active — no numeric target established.";
    if (tracking.status === "PLAN_WITHHELD") return "A numeric plan is currently withheld.";
    if (tracking.status === "NEEDS_REVIEW") return "Hydration guidance needs review.";
    if (tracking.targetKind === "range") {
      return `${displayMl(tracking.minimumMl)}–${displayMl(tracking.maximumMl)} per day`;
    }
    if (tracking.targetKind === "floor") return `At least ${displayMl(tracking.minimumMl)} per day`;
    if (tracking.targetKind === "ceiling") return `Up to ${displayMl(tracking.maximumMl)} per day`;
    return `${displayMl(tracking.targetMl)} per day`;
  })();

  const openProfessionalUpdate = () => {
    if (!latestProfessionalUpdate) return;
    localStorage.setItem(`mpm-plan-update-seen:${latestProfessionalUpdate.id}`, "1");
    setAcknowledgedUpdateId(latestProfessionalUpdate.id);
    navigate(latestProfessionalUpdate.href);
  };

  return (
    <div className="rounded-2xl bg-black/50 border border-orange-500/25 overflow-hidden">

      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-orange-400 flex-shrink-0" />
          <p className="text-sm font-bold text-white">{t("title")}</p>
        </div>
        {!hasAnyActiveProtocol && !hasHydrationPlan && (
          <span className="text-[10px] text-white/30 font-medium bg-white/5 rounded-full px-2 py-0.5 border border-white/10">
            {t("baseline")}
          </span>
        )}
      </div>

      {latestProfessionalUpdate && !updateSeen && (
        <button
          type="button"
          onClick={openProfessionalUpdate}
          className="mx-4 mb-3 flex w-[calc(100%-2rem)] items-start gap-3 rounded-xl border border-orange-400/40 bg-orange-500/15 p-3 text-left active:scale-[0.99]"
          data-testid="nutrition-plan-professional-update"
        >
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-orange-300" />
          <span className="min-w-0">
            <span className="block text-xs font-bold text-orange-200">New update from your care team</span>
            <span className="mt-0.5 block text-xs text-white/80">{latestProfessionalUpdate.title}</span>
            <span className="mt-1 block text-[10px] font-semibold text-orange-300">Review update</span>
          </span>
        </button>
      )}

      {/* ── Macros strip ── */}
      {activeInputs?.macros && (activeInputs.macros.calories || activeInputs.macros.proteinG) && (() => {
        const m = activeInputs.macros;
        const hasCarbSplit = !!(m.starchyCarbsG || m.fibrousCarbsG);
        const pills = hasCarbSplit
          ? [
              { label: "Cal",     value: m.calories ? m.calories.toLocaleString() : "—" },
              { label: "Protein", value: m.proteinG ? `${m.proteinG}g`            : "—" },
              { label: "Starchy", value: m.starchyCarbsG ? `${m.starchyCarbsG}g` : "—" },
              { label: "Fibrous", value: m.fibrousCarbsG ? `${m.fibrousCarbsG}g` : "—" },
              { label: "Fat",     value: m.fatG ? `${m.fatG}g`                   : "—" },
            ]
          : [
              { label: "Cal",     value: m.calories ? m.calories.toLocaleString() : "—" },
              { label: "Protein", value: m.proteinG ? `${m.proteinG}g`            : "—" },
              { label: "Carbs",   value: m.carbsG   ? `${m.carbsG}g`             : "—" },
              { label: "Fat",     value: m.fatG     ? `${m.fatG}g`               : "—" },
            ];
        return (
          <div className="px-4 pb-3">
            <div className={`grid gap-1.5 ${hasCarbSplit ? "grid-cols-5" : "grid-cols-4"}`}>
              {pills.map(p => (
                <div key={p.label} className="bg-white/5 rounded-lg py-1.5 text-center border border-white/8">
                  <p className="text-white font-semibold text-xs leading-none">{p.value}</p>
                  <p className="text-green-400 text-[9px] mt-0.5 uppercase tracking-wide">{p.label}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Expand / Collapse toggle ── */}
      <button
        onClick={() => setExpanded(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 border-t border-white/8 active:bg-white/5 transition-colors select-none"
      >
        <span className="text-[11px] font-semibold text-orange-400">
          {expanded ? t("showLess") : t("showMore")}
        </span>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
        }
      </button>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="px-4 pb-4 space-y-2.5 border-t border-white/8">

          {/* ── No-protocol baseline message ── */}
          {!hasAnyActiveProtocol && !hasDietaryIdentity && !hasMealBuilder && (
            <p className="text-[11px] text-white/35 leading-relaxed pt-4">
              {t("baselineDesc")}
            </p>
          )}

          {/* ── Active Protocol blocks — one per condition ── */}
          {allHealthItems.length > 0 && (
            <div className="pt-3 space-y-2">
              <p className="text-[10px] text-white/35 uppercase tracking-widest font-semibold">
                {t("activeProtocols")}
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

          {data.hydration && (
            <div className={allHealthItems.length === 0 ? "pt-3" : ""}>
              <div className="rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 py-3">
                <div className="flex items-start gap-2">
                  <Droplets className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-black uppercase tracking-widest text-sky-300">Hydration</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-white/75">{hydrationDetail}</p>
                    {data.hydration.tracking.validThrough && data.hydration.tracking.status === "NUMERIC_ACTIVE" && (
                      <p className="mt-1 text-[10px] text-white/55">
                        Active through {new Date(data.hydration.tracking.validThrough).toLocaleDateString()}
                      </p>
                    )}
                    {data.hydration.liquidNutrition?.status === "active" && (
                      <div className="mt-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-2">
                        <p className="text-[10px] font-semibold text-sky-200">Liquid Nutrition Support</p>
                        <p className="mt-0.5 text-[10px] text-white/65">
                          {data.hydration.liquidNutrition.currentDay
                            ? `Day ${data.hydration.liquidNutrition.currentDay} · `
                            : ""}
                          Ends {new Date(`${data.hydration.liquidNutrition.endsOn}T12:00:00`).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate(data.hydration!.href)}
                      className="mt-2 text-[10px] font-semibold text-sky-300"
                    >
                      Open Hydration
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Performance block ── */}
          {activeInputs?.performance && (
            <div className={allHealthItems.length === 0 ? "pt-3" : ""}>
              {allHealthItems.length === 0 && (
                <p className="text-[10px] text-white/35 uppercase tracking-widest font-semibold mb-2">
                  {t("activeProtocols")}
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
          {activeInputs?.pregnancy && (
            <div className="bg-pink-500/10 border border-pink-500/25 rounded-xl px-3 py-2.5">
              <p className="text-[11px] font-black uppercase tracking-widest text-pink-400">
                {activeInputs.pregnancy.label}
              </p>
              {activeInputs.pregnancy.detail && (
                <p className="text-[11px] text-pink-300/70 mt-0.5">{activeInputs.pregnancy.detail}</p>
              )}
            </div>
          )}

          {/* ── Carb Cycle Active block ── */}
          {carbCycleActive && (
            <div className="bg-orange-500/10 border border-orange-500/25 rounded-xl px-3 py-2.5">
              <p className="text-[11px] font-black uppercase tracking-widest text-orange-400">
{t("carbCyclingActive")}
              </p>
              <p className="text-[11px] text-orange-300/70 mt-0.5">{t("carbCyclingDetail")}</p>
            </div>
          )}

          {/* ── Alpha-gal Syndrome detail block ── */}
          {data.alphaGal && (
            <div className="bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2.5">
              <p className="text-[11px] font-black uppercase tracking-widest text-red-400 mb-2">
                Alpha-gal Protocol Active
              </p>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/50 w-16 flex-shrink-0">Dairy</span>
                  <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${
                    data.alphaGal.dairyTolerance === "yes"
                      ? "text-green-300 bg-green-500/15 border border-green-500/25"
                      : data.alphaGal.dairyTolerance === "no"
                      ? "text-red-300 bg-red-500/15 border border-red-500/25"
                      : "text-amber-300 bg-amber-500/15 border border-amber-500/25"
                  }`}>
                    {data.alphaGal.dairyTolerance === "yes" ? "Tolerated" : data.alphaGal.dairyTolerance === "no" ? "Avoided" : "Verify"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/50 w-16 flex-shrink-0">Gelatin</span>
                  <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${
                    data.alphaGal.gelatinRestriction === "yes"
                      ? "text-red-300 bg-red-500/15 border border-red-500/25"
                      : data.alphaGal.gelatinRestriction === "no"
                      ? "text-green-300 bg-green-500/15 border border-green-500/25"
                      : "text-amber-300 bg-amber-500/15 border border-amber-500/25"
                  }`}>
                    {data.alphaGal.gelatinRestriction === "yes" ? "Avoided" : data.alphaGal.gelatinRestriction === "no" ? "No restriction" : "Verify"}
                  </span>
                </div>
                {!data.alphaGal.profileComplete && (
                  <p className="text-[10px] text-amber-400/80 mt-1">⚠ Profile incomplete — update in Edit Profile for full protection</p>
                )}
              </div>
            </div>
          )}

          {/* ── Therapeutic Support block ── */}
          {hasTherapeuticInputs && (
            <div className="bg-violet-500/10 border border-violet-500/25 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-2.5">
                <FlaskConical className="w-3 h-3 text-violet-400 flex-shrink-0" />
                <p className="text-[11px] font-black uppercase tracking-widest text-violet-400">
                  {t("therapeuticSupport")}
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
                {t("dietaryIdentity")}
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
          {activeInputs?.cuisine && (
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2.5">
              <p className="text-[11px] font-black uppercase tracking-widest text-amber-400 mb-1.5">
                {t("cuisine")}
              </p>
              <p className="text-[12px] font-bold uppercase tracking-wide text-amber-300">
                {activeInputs.cuisine}
              </p>
            </div>
          )}

          {/* ── Goal block ── */}
          {activeInputs?.goal && (
            <div className="bg-orange-500/10 border border-orange-500/25 rounded-xl px-3 py-2.5">
              <p className="text-[11px] font-black uppercase tracking-widest text-orange-400 mb-1.5">
                {t("goal")}
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
                {t("mealBuilder")}
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
                  {t("liveContext")}
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
                {t("nutritionPriorities")}
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
              {t("currentStrategy")}
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
