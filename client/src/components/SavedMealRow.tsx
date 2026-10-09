/**
 * SavedMealRow
 *
 * Renders one row in the Favorites list. Owns the translation hook so
 * translations fire lazily on first expand and are cached permanently.
 *
 * All nutrition values, allergen identifiers, and structured safety data
 * always come from the canonical mealData — never from the translation payload.
 */
import { useState, useRef, useEffect } from "react";
import { Heart, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MealImageSlot } from "@/components/ui/MealImageSlot";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";
import MealCardActions from "@/components/MealCardActions";
import { normalizeInstructions } from "@/utils/normalizeInstructions";
import { setQuickView } from "@/lib/macrosQuickView";
import { buildBiometricsUrl } from "@/lib/biometricsNavigation";
import { useTranslatedMeal } from "@/hooks/useTranslatedMeal";
import AlphaGalBadge from "@/components/AlphaGalBadge";
import DiabetesProtocolIndicator from "@/components/DiabetesProtocolIndicator";
import { GroceryCoachMacroTiles } from "./shopping/GroceryCoachMacroTiles";
import { mealMacroSnapshot } from "@/lib/mealMacroSnapshot";

interface Props {
  row: any;

  sourceLabel: (s: string) => string;

  onRemove: (row: any) => void;

  onAddToMacros: (row: any) => void;

  onAddToPlanSuccess?: () => void;
  /** When true, the row auto-expands and scrolls into view (deep-link support) */
  isInitiallyExpanded?: boolean;
  initialExpanded?: boolean;
}

export default function SavedMealRow({
  row,
  sourceLabel,
  onRemove,
  onAddToMacros,
  onAddToPlanSuccess,
  isInitiallyExpanded = false,
  initialExpanded = false,
}: Props) {
  const { t } = useTranslation();
  // Support both prop names for backward compatibility
  const startExpanded = isInitiallyExpanded || initialExpanded;
  const rowRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(startExpanded);

  // Scroll the auto-expanded row into view after the first render
  useEffect(() => {
    if (startExpanded && rowRef.current) {
      rowRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Translation layer — fires on first expand for non-English locales ──
  const { data: translation, isLoading: isTranslating } = useTranslatedMeal(
    row.id,
    isExpanded
  );

  const d = row.mealData as any;
  const perServingNutrition = mealMacroSnapshot(d);

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

  return (
    <div id={`meal-card-${row.id}`} ref={rowRef} className="rounded-xl border border-white/15 bg-white/5 overflow-hidden">
      {/* ── Collapsed header ────────────────────────────────────────────── */}
      <button
        onClick={() => setIsExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-3 py-3 active:scale-[0.98]"
      >
        <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-white/10 mr-3">
          <MealImageSlot
            imageUrl={row.thumbnailUrl || d?.imageUrl}
            mealName={row.title}
            ingredients={d?.ingredients}
            savedMealId={row.id}
            mediaAssetId={row.mediaAssetId}
            height="h-14"
            className="!mb-0 !rounded-none"
          />
        </div>
        <div className="flex items-center gap-2 text-left min-w-0 flex-1">
          <div className="min-w-0">
            <div className="text-white font-medium truncate">{displayTitle}</div>
            <div className="text-xs text-white/50">{sourceLabel(row.sourceType)}</div>
            {!isExpanded && <DiabetesProtocolIndicator memory={d?.diabeticMemory} compact />}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Heart className="h-4 w-4 text-red-500 shrink-0" fill="currentColor" />
          <span className="text-xs text-white/40">{Math.round(perServingNutrition.calories)} {t("savedMeals.cal")} / serving</span>
          {isExpanded
            ? <ChevronDown className="h-4 w-4 text-white/40" />
            : <ChevronRight className="h-4 w-4 text-white/40" />}
        </div>
      </button>

      {/* ── Expanded body ─────────────────────────────────────────────────── */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-white/10 pt-4">
          <MealImageSlot
            imageUrl={row.displayUrl || row.thumbnailUrl || d?.imageUrl}
            mealName={row.title}
            ingredients={d?.ingredients}
            savedMealId={row.id}
            mediaAssetId={row.mediaAssetId}
            height="h-52"
          />

          {/* Alpha-gal protection badge — server-computed at generation time */}
          {d?.alphaGalBadge && (
            <AlphaGalBadge badge={d.alphaGalBadge} />
          )}

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

          <DiabetesProtocolIndicator memory={d?.diabeticMemory} />

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
          <GroceryCoachMacroTiles macros={perServingNutrition} servings={perServingNutrition.servings} labels={{
            Calories: t("savedMeals.cal"), Protein: t("savedMeals.protein"), Fat: t("savedMeals.fat"),
            "Starchy Carbs": t("biometrics.starchyCarbs"),
            "Fibrous Carbs": t("biometrics.fibrousCarbs"),
          }} />

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
