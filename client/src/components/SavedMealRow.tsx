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
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MealImageSlot } from "@/components/ui/MealImageSlot";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";
import MealCardActions, { MealCardAction } from "@/components/MealCardActions";
import { normalizeInstructions } from "@/utils/normalizeInstructions";
import { setQuickView } from "@/lib/macrosQuickView";
import { buildBiometricsUrl } from "@/lib/biometricsNavigation";
import { useTranslatedMeal } from "@/hooks/useTranslatedMeal";
import AlphaGalBadge from "@/components/AlphaGalBadge";
import DiabetesProtocolIndicator from "@/components/DiabetesProtocolIndicator";
import { GroceryCoachMacroTiles } from "./shopping/GroceryCoachMacroTiles";
import { mealMacroSnapshot } from "@/lib/mealMacroSnapshot";
import { groceryCoachCatalogEnabled } from "@/lib/groceryCoachCatalogGate";
import { groceryCoachPlanHandoff } from "@/lib/groceryCoachPlanHandoff";
import TrashButton from "@/components/ui/TrashButton";

interface Props {
  row: any;

  sourceLabel: (sourceType: string, mealData?: unknown) => string;

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
  const developmentGrocery = groceryCoachCatalogEnabled && row.sourceType === "grocery-coach";

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
    <div id={`meal-card-${row.id}`} ref={rowRef} className="rounded-2xl border border-white/15 bg-black/40 backdrop-blur-sm overflow-hidden">
      {/* ── Collapsed header ────────────────────────────────────────────── */}
      <div className="flex items-start gap-2 px-3 py-3">
        <button
          type="button"
          onClick={() => setIsExpanded((e) => !e)}
          aria-expanded={isExpanded}
          aria-controls={`saved-meal-details-${row.id}`}
          className="flex min-w-0 flex-1 items-start gap-3 text-left active:scale-[0.98]"
        >
          {!isExpanded && (
            <div className="mt-0.5 h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-white/10">
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
          )}
          <div className="min-w-0 flex-1">
            <div className="whitespace-normal break-words text-base font-semibold leading-snug text-white">{displayTitle}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-relaxed text-white/55">
              <span>{sourceLabel(row.sourceType, row.mealData)}</span>
              <span aria-hidden="true" className="text-white/25">·</span>
              <span>{Math.round(perServingNutrition.calories)} {t("savedMeals.cal")} / serving</span>
            </div>
            {!isExpanded && <DiabetesProtocolIndicator memory={d?.diabeticMemory} compact />}
          </div>
          {isExpanded
            ? <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-white/40" />
            : <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-white/40" />}
        </button>
        <TrashButton
          onClick={() => onRemove(row)}
          ariaLabel={`${t("savedMeals.remove")}: ${displayTitle}`}
          title={t("savedMeals.remove")}
          size="sm"
          className="!h-11 !w-11 shrink-0 !border-white/15 !bg-white/5 !text-white/55 !shadow-none hover:!border-red-500/50 hover:!bg-red-600/20 hover:!text-red-300"
        />
      </div>

      {/* ── Expanded body ─────────────────────────────────────────────────── */}
      {isExpanded && (
        <div id={`saved-meal-details-${row.id}`} className="space-y-4 border-t border-white/10 px-4 pb-4 pt-4">
          <MealImageSlot
            imageUrl={row.displayUrl || d?.imageUrl || row.thumbnailUrl}
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
          <GroceryCoachMacroTiles macros={perServingNutrition} servings={perServingNutrition.servings}
            showReview={developmentGrocery} review={d?.carbohydrateReview} ingredients={d?.ingredients} labels={{
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

          <MealCardActions
            shoppingAddAndView
            shoppingRecipe={{
              ...d, id: d?.id || row.id, name: d?.name || row.title,
              shoppingRecipeYield: d?.shoppingRecipeYield ?? d?.recipeYield ?? d?.servings ?? d?.recipeServings,
            }}
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
          >
            <MealCardAction kind="plan">
              <AddToMealPlanButton
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
                  ...(developmentGrocery ? groceryCoachPlanHandoff(d) : {}),
                }}
                onSuccess={onAddToPlanSuccess}
              />
            </MealCardAction>
            <MealCardAction kind="macros">
              <button
                onClick={() => onAddToMacros(row)}
                className="w-full border border-white/30 bg-gradient-to-r from-zinc-900 via-zinc-800 to-black px-3 py-2 text-sm text-white rounded-lg active:scale-[0.98]"
              >
                {t("savedMeals.addToMacros")}
              </button>
            </MealCardAction>
          </MealCardActions>
        </div>
      )}
    </div>
  );
}
