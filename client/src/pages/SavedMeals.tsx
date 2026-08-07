import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Heart, ArrowLeft, Loader2 } from "lucide-react";
import { useSavedMealsList, useDeleteSavedMeal } from "@/hooks/useSavedMeals";
import { useToast } from "@/hooks/use-toast";
import { setQuickView } from "@/lib/macrosQuickView";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { buildBiometricsUrl } from "@/lib/biometricsNavigation";
import SavedMealRow from "@/components/SavedMealRow";

export default function SavedMeals() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { data: meals, isLoading } = useSavedMealsList();
  const deleteMeal = useDeleteSavedMeal();
  const { toast } = useToast();

  // ── Source label map (i18n) ───────────────────────────────────────────────
  const SOURCE_LABELS: Record<string, string> = {
    "meal-builder":           t("savedMeals.sourceMealBuilder"),
    "general-nutrition":      t("savedMeals.sourceGeneralNutrition"),
    "performance-competition":t("savedMeals.sourcePerformance"),
    "diabetic":               t("savedMeals.sourceDiabetic"),
    "glp1":                   t("savedMeals.sourceMetabolic"),
    "anti-inflammatory":      t("savedMeals.sourceAntiInflam"),
    "craving-creator":        t("savedMeals.sourceCravingCreator"),
    "dessert-creator":        t("savedMeals.sourceDessertCreator"),
    "fridge-rescue":          t("savedMeals.sourceFridgeRescue"),
    "chefs-kitchen":          t("savedMeals.sourceChefsKitchen"),
    "weekly-board":           t("savedMeals.sourceWeeklyBoard"),
    "pairings-ai":            t("savedMeals.sourcePairings"),
    "wine-list-helper":       t("savedMeals.sourceWineList"),
    "my-inspiration":         t("savedMeals.sourceRecipeScan"),
    "grocery-coach":          t("savedMeals.sourceGroceryCoach"),
    unknown:                  t("savedMeals.sourceMeal"),
  };

  function sourceLabel(s: string): string {
    return SOURCE_LABELS[s] || s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // ── Diabetic BGL sections ─────────────────────────────────────────────────
  const BGL_SECTIONS = [
    {
      key: "low",
      label: t("savedMeals.lowBGL"),
      sublabel: t("savedMeals.lowBGLDesc"),
      accent: "text-sky-400",
      border: "border-sky-700/40",
      bg: "bg-sky-950/60",
      dot: "bg-sky-400",
      buckets: ["low"],
    },
    {
      key: "in-range",
      label: t("savedMeals.inRangeBGL"),
      sublabel: t("savedMeals.inRangeBGLDesc"),
      accent: "text-lime-400",
      border: "border-lime-700/40",
      bg: "bg-lime-950/60",
      dot: "bg-lime-400",
      buckets: ["in-range"],
    },
    {
      key: "elevated",
      label: t("savedMeals.elevatedBGL"),
      sublabel: t("savedMeals.elevatedBGLDesc"),
      accent: "text-amber-400",
      border: "border-amber-700/40",
      bg: "bg-amber-950/60",
      dot: "bg-amber-400",
      buckets: ["elevated", "high"],
    },
  ] as const;

  const [returnPath] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("from")
  );
  const [deepLinkMealId] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("mealId")
  );

  useEffect(() => {
    if (returnPath || deepLinkMealId) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [returnPath, deepLinkMealId]);

  // Expand and scroll to the deep-linked meal once the list has loaded
  useEffect(() => {
    if (!deepLinkMealId || !meals?.length) return;
    setTimeout(() => {
      document
        .getElementById(`meal-card-${deepLinkMealId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }, [deepLinkMealId, meals]);

  const handleAddToPlanSuccess = returnPath
    ? () => setLocation(decodeURIComponent(returnPath))
    : undefined;

  const handleRemove = (row: any) => {
    deleteMeal.mutate(row.id, {
      onSuccess: () => {
        toast({
          title: t("savedMeals.removed"),
          description: `"${row.title}" removed from favorites.`,
        });
      },
    });
  };

  const handleAddToMacros = (row: any) => {
    const d = row.mealData || row;
    const protein = d.nutrition?.protein || d.protein || 0;
    const carbs   = d.nutrition?.carbs   || d.carbs   || 0;
    const fat     = d.nutrition?.fat     || d.fat     || 0;
    const starchyCarbs  = d.nutrition?.starchyCarbs  || d.starchyCarbs  || 0;
    const fibrousCarbs  = d.nutrition?.fibrousCarbs  || d.fibrousCarbs  || 0;
    const calories = d.nutrition?.calories || d.calories || (protein * 4 + carbs * 4 + fat * 9);

    setQuickView({
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      starchyCarbs: Math.round(starchyCarbs),
      fibrousCarbs: Math.round(fibrousCarbs),
      fat: Math.round(fat),
      calories: Math.round(calories),
      dateISO: new Date().toISOString().slice(0, 10),
      mealSlot: null,
    });
    setLocation(buildBiometricsUrl({ section: "macros", from: "saved-meals", highlight: true }));
  };

  const allMeals     = meals ?? [];
  const diabeticMeals = allMeals.filter((r: any) => r.savedFromDiabeticBuilder === true);
  const otherMeals    = allMeals.filter((r: any) => r.savedFromDiabeticBuilder !== true);
  const hasDiabetic   = diabeticMeals.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white pb-24 flex flex-col">
      <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-40 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setLocation("/dashboard")}
              className="p-2 rounded-lg bg-white/10 active:scale-[0.98]"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>
            <h1 className="text-xl font-bold flex items-center gap-2 flex-1">
              <Heart className="h-6 w-6 text-red-500" fill="currentColor" />
              {t("savedMeals.pageTitle")}
            </h1>
          </div>
        </div>
      </MobileHeaderGuard>

      <div
        className="max-w-lg mx-auto px-4 space-y-4 w-full"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-white/50" />
          </div>
        )}

        {!isLoading && allMeals.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <Heart className="h-12 w-12 mx-auto text-white/20" />
            <p className="text-white/50 text-lg">{t("savedMeals.noMeals")}</p>
            <p className="text-white/40 text-sm">{t("savedMeals.noMealsHint")}</p>
          </div>
        )}

        {!isLoading && allMeals.length > 0 && (
          <div className="space-y-6">

            {/* Diabetic BGL sections */}
            {hasDiabetic &&
              BGL_SECTIONS.map((section) => {
                const sectionMeals = diabeticMeals.filter((r: any) =>
                  (section.buckets as readonly string[]).includes(r.bglBucket)
                );
                if (sectionMeals.length === 0) return null;
                return (
                  <div key={section.key} className="space-y-2">
                    <div className="flex items-center gap-2 px-1 pt-2">
                      <span className={`w-2 h-2 rounded-full ${section.dot} shrink-0`} />
                      <div>
                        <div className={`text-sm font-semibold ${section.accent}`}>
                          {section.label}
                        </div>
                        <div className="text-xs text-white/40">{section.sublabel}</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {sectionMeals.map((row: any) => (
                        <SavedMealRow
                          key={row.id}
                          row={row}
                          sourceLabel={sourceLabel}
                          onRemove={handleRemove}
                          onAddToMacros={handleAddToMacros}
                          onAddToPlanSuccess={handleAddToPlanSuccess}
                          isInitiallyExpanded={deepLinkMealId === row.id}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}

            {/* General meals */}
            {otherMeals.length > 0 && (
              <div className="space-y-2">
                {hasDiabetic && (
                  <div className="flex items-center gap-2 px-1 pt-2">
                    <span className="w-2 h-2 rounded-full bg-white/30 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-white/60">
                        {t("savedMeals.otherMeals")}
                      </div>
                      <div className="text-xs text-white/40">
                        {t("savedMeals.otherMealsDesc")}
                      </div>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {otherMeals.map((row: any) => (
                    <SavedMealRow
                      key={row.id}
                      row={row}
                      sourceLabel={sourceLabel}
                      onRemove={handleRemove}
                      onAddToMacros={handleAddToMacros}
                      onAddToPlanSuccess={handleAddToPlanSuccess}
                      isInitiallyExpanded={deepLinkMealId === row.id}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
