/**
 * SavedMealRow
 *
 * Renders one row in the Favorites list. Owns the translation hook so
 * translations fire lazily on first expand and are cached permanently.
 *
 * All nutrition values, allergen identifiers, and structured safety data
 * always come from the canonical mealData — never from the translation payload.
 */
import { useState } from "react";
import { Heart, ChevronDown, ChevronRight, Activity, Loader2 } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MealImageSlot } from "@/components/ui/MealImageSlot";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";
import MealCardActions from "@/components/MealCardActions";
import { normalizeInstructions } from "@/utils/normalizeInstructions";
import { setQuickView } from "@/lib/macrosQuickView";
import { buildBiometricsUrl } from "@/lib/biometricsNavigation";
import { useTranslatedMeal } from "@/hooks/useTranslatedMeal";

function bglRangeLabel(bucket: string): string {
  switch (bucket) {
    case "low":      return "< 70 mg/dL";
    case "in-range": return "70–140 mg/dL";
    case "elevated": return "141–200 mg/dL";
    case "high":     return "> 200 mg/dL";
    default:         return "—";
  }
}

interface Props {
  row: any;
  sourceLabel: (s: string) => string;
  onRemove: (row: any) => void;
  onAddToMacros: (row: any) => void;
  onAddToPlanSuccess?: () => void;
}

export default function SavedMealRow({
  row,
  sourceLabel,
  onRemove,
  onAddToMacros,
  onAddToPlanSuccess,
}: Props) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  // ── Translation layer — fires on first expand for non-English locales ──
  const { data: translation, isLoading: isTranslating } = useTranslatedMeal(
    row.id,
    isExpanded
  );

  const d = row.mealData as any;

  // ── Nutrition always from canonical record ─────────────────────────────
  const calories = d?.nutrition?.calories || d?.calories || 0;
  const protein  = d?.nutrition?.protein  || d?.protein  || 0;
  const carbs    = d?.nutrition?.carbs    || d?.carbs    || 0;
  const fat      = d?.nutrition?.fat      || d?.fat      || 0;

  // ── Display fields: translated when available, original otherwise ──────
  const displayTitle        = translation?.translatedName ?? row.title;
  const displayDescription  = translation?.translatedDescription ?? d?.description;
  const displayInstructions = translation?.translatedInstructions
    ? translation.translatedInstructions
    : d?.instructions;

  /**
   * Merge translated ingredient text with original quantities/units.
   * Numbers, amounts, and units always come from the canonical record.
   */
  function displayIngredients(): any[] {
    const originals: any[] = d?.ingredients ?? [];
    const txIngredients = translation?.translatedIngredients;
    if (!txIngredients) return originals;

    return originals.map((orig: any, i: number) => {
      const tx = txIngredients[i];
      if (!tx) return orig;
      if (typeof orig === "string") return tx.item;
      return { ...orig, item: tx.item ?? orig.item, notes: tx.notes ?? orig.notes };
    });
  }

  const isDiabetic       = row.savedFromDiabeticBuilder === true;
  const bglBucket        = row.bglBucket ?? "";
  const generatedBglMgdl = row.generatedBglMgdl ?? null;
  const protocolType     = row.protocolType ?? "";
  const glucoseContext   = row.glucoseContext ?? "";
  const rangeLabel       = bglBucket ? bglRangeLabel(bglBucket) : "";

  const bannerAccent =
    bglBucket === "low"
      ? { text: "text-sky-400",   border: "border-sky-700/40",   bg: "bg-sky-950/60"   }
      : bglBucket === "in-range"
      ? { text: "text-lime-400",  border: "border-lime-700/40",  bg: "bg-lime-950/60"  }
      : { text: "text-amber-400", border: "border-amber-700/40", bg: "bg-amber-950/60" };

  return (
    <div id={`meal-card-${row.id}`} className="rounded-xl border border-white/15 bg-white/5 overflow-hidden">
      {/* ── Collapsed header ────────────────────────────────────────────── */}
      <button
        onClick={() => setIsExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-3 py-3 active:scale-[0.98]"
      >
        <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-white/10 mr-3">
          <MealImageSlot
            imageUrl={d?.imageUrl}
            mealName={row.title}
            height="h-14"
            className="!mb-0 !rounded-none"
          />
        </div>
        <div className="flex items-center gap-2 text-left min-w-0 flex-1">
          <div className="min-w-0">
            <div className="text-white font-medium truncate">{displayTitle}</div>
            <div className="text-xs text-white/50">{sourceLabel(row.sourceType)}</div>
            {isDiabetic && generatedBglMgdl !== null && (
              <div className={`text-xs ${bannerAccent.text} flex items-center gap-1 mt-0.5 opacity-80`}>
                <Activity className="h-3 w-3 shrink-0" />
                <span>BGL {generatedBglMgdl} mg/dL</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Heart className="h-4 w-4 text-red-500 shrink-0" fill="currentColor" />
          <span className="text-xs text-white/40">{calories} {t("savedMeals.cal")}</span>
          {isExpanded
            ? <ChevronDown className="h-4 w-4 text-white/40" />
            : <ChevronRight className="h-4 w-4 text-white/40" />}
        </div>
      </button>

      {/* ── Expanded body ─────────────────────────────────────────────────── */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/10 pt-4">
          <MealImageSlot
            imageUrl={d?.imageUrl}
            mealName={row.title}
            height="h-52"
          />

          {/* Diabetic BGL banner */}
          {row.dayMismatchNote && (
            <div className="rounded-lg bg-amber-950/60 border border-amber-700/40 px-3 py-2.5 flex gap-2.5 items-start">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="text-amber-400 font-semibold tracking-wide uppercase text-[10px]">
                  {t("savedMeals.todayStrategy")}
                </div>
                <div className="text-white/80 text-xs">{row.dayMismatchNote}</div>
              </div>
            </div>
          )}

          {isDiabetic && generatedBglMgdl !== null && (
            <div className={`rounded-lg ${bannerAccent.bg} border ${bannerAccent.border} px-3 py-2 text-xs space-y-0.5`}>
              <div className={`${bannerAccent.text} font-semibold tracking-wide uppercase text-[10px]`}>
                {t("savedMeals.diabetesProtocol")}
              </div>
              <div className="text-white/80">
                Generated for BGL:{" "}
                <span className="text-white font-medium">{generatedBglMgdl} mg/dL</span>
              </div>
              {protocolType && <div className="text-white/60">{protocolType}</div>}
              {glucoseContext && protocolType !== glucoseContext && (
                <div className="text-white/50">{glucoseContext}</div>
              )}
              {rangeLabel && (
                <div className="text-white/50 text-[10px]">
                  {t("savedMeals.relevantRange")} {rangeLabel}
                </div>
              )}
            </div>
          )}

          {/* Translation loading indicator */}
          {isTranslating && (
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Translating…</span>
            </div>
          )}

          {/* Description — canonical nutrition values only below */}
          {displayDescription && (
            <p className="text-white/80 text-sm">{displayDescription}</p>
          )}

          {/* Macro strip — always from canonical record */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-black/30 border border-white/15 p-2 rounded-lg">
              <div className="text-xs text-white/50">{t("savedMeals.cal")}</div>
              <div className="text-white font-bold">{Math.round(calories)}</div>
            </div>
            <div className="bg-black/30 border border-white/15 p-2 rounded-lg">
              <div className="text-xs text-white/50">{t("savedMeals.protein")}</div>
              <div className="text-white font-bold">{Math.round(protein)}g</div>
            </div>
            <div className="bg-black/30 border border-white/15 p-2 rounded-lg">
              <div className="text-xs text-white/50">{t("savedMeals.carbs")}</div>
              <div className="text-white font-bold">{Math.round(carbs)}g</div>
            </div>
            <div className="bg-black/30 border border-white/15 p-2 rounded-lg">
              <div className="text-xs text-white/50">{t("savedMeals.fat")}</div>
              <div className="text-white font-bold">{Math.round(fat)}g</div>
            </div>
          </div>

          {/* Ingredients — item/notes from translation, amounts from canonical */}
          {d?.ingredients && d.ingredients.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-white/70 mb-2">
                {t("savedMeals.ingredients")}
              </h4>
              <ul className="space-y-1">
                {displayIngredients().map((ing: any, i: number) => (
                  <li key={i} className="text-sm text-white/80 flex items-start gap-2">
                    <span className="text-white/30 mt-1">•</span>
                    <span>
                      {typeof ing === "string"
                        ? ing
                        : `${ing.amount || ing.quantity || ""} ${ing.unit || ""} ${ing.name || ing.item || ""}`.trim()}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Instructions */}
          {d?.instructions && (
            <div>
              <h4 className="text-sm font-semibold text-white/70 mb-2">
                {t("savedMeals.instructions")}
              </h4>
              <ol className="space-y-3">
                {normalizeInstructions(displayInstructions).map((step: string, i: number) => (
                  <li key={i} className="flex gap-3 text-sm text-white/80">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600/70 flex items-center justify-center text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2">
            <AddToMealPlanButton
              meal={{
                id: row.id,
                name: row.title,          // canonical title for plan slot
                description: d?.description,
                instructions: d?.instructions,
                ingredients: d?.ingredients,
                nutrition: d?.nutrition || { calories, protein, carbs, fat },
                imageUrl: d?.imageUrl,
                servings: d?.servings,
                servingSize: d?.servingSize,
              }}
              onSuccess={onAddToPlanSuccess}
            />
            <button
              onClick={() => onAddToMacros(row)}
              className="flex-1 bg-white/10 text-white text-sm py-2 px-3 rounded-lg active:scale-[0.98]"
            >
              {t("savedMeals.addToMacros")}
            </button>
            <button
              onClick={() => onRemove(row)}
              className="bg-white/10 text-red-400 text-sm py-2 px-3 rounded-lg active:scale-[0.98] flex items-center gap-1"
            >
              <Heart className="h-4 w-4" fill="currentColor" />
              {t("savedMeals.remove")}
            </button>
          </div>

          <MealCardActions
            meal={{
              id: row.id,
              name: row.title,
              description: d?.description,
              instructions: d?.instructions,
              ingredients: d?.ingredients,
              nutrition: d?.nutrition || { calories, protein, carbs, fat },
              imageUrl: d?.imageUrl,
              servings: d?.servings,
              servingSize: d?.servingSize,
            }}
            source={row.sourceType}
            showTranslate={true}
            showPrepareButton={true}
          />
        </div>
      )}
    </div>
  );
}
