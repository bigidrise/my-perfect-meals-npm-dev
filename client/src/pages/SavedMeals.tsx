import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Heart, ChevronDown, ChevronRight, ArrowLeft, Loader2, Activity, AlertTriangle } from "lucide-react";
import { useSavedMealsList, useDeleteSavedMeal } from "@/hooks/useSavedMeals";
import { useToast } from "@/hooks/use-toast";
import MealCardActions from "@/components/MealCardActions";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";
import { MealImageSlot } from "@/components/ui/MealImageSlot";
import { normalizeInstructions } from "@/utils/normalizeInstructions";
import { setQuickView } from "@/lib/macrosQuickView";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { buildBiometricsUrl } from "@/lib/biometricsNavigation";

function bglRangeLabel(bucket: string): string {
  switch (bucket) {
    case "low":      return "< 70 mg/dL";
    case "in-range": return "70–140 mg/dL";
    case "elevated": return "141–200 mg/dL";
    case "high":     return "> 200 mg/dL";
    default:         return "—";
  }
}

export default function SavedMeals() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { data: meals, isLoading } = useSavedMealsList();
  const deleteMeal = useDeleteSavedMeal();
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const SOURCE_LABELS: Record<string, string> = {
    "meal-builder": t("savedMeals.sourceMealBuilder"),
    "general-nutrition": t("savedMeals.sourceGeneralNutrition"),
    "performance-competition": t("savedMeals.sourcePerformance"),
    "diabetic": t("savedMeals.sourceDiabetic"),
    "glp1": t("savedMeals.sourceMetabolic"),
    "anti-inflammatory": t("savedMeals.sourceAntiInflam"),
    "craving-creator": t("savedMeals.sourceCravingCreator"),
    "dessert-creator": t("savedMeals.sourceDessertCreator"),
    "fridge-rescue": t("savedMeals.sourceFridgeRescue"),
    "chefs-kitchen": t("savedMeals.sourceChefsKitchen"),
    "weekly-board": t("savedMeals.sourceWeeklyBoard"),
    "pairings-ai": t("savedMeals.sourcePairings"),
    "wine-list-helper": t("savedMeals.sourceWineList"),
    "my-inspiration": t("savedMeals.sourceRecipeScan"),
    "grocery-coach": t("savedMeals.sourceGroceryCoach"),
    unknown: t("savedMeals.sourceMeal"),
  };

  function sourceLabel(s: string): string {
    return SOURCE_LABELS[s] || s.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

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

  useEffect(() => {
    if (!deepLinkMealId || !meals?.length) return;
    setExpandedId(deepLinkMealId);
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
        toast({ title: t("savedMeals.removed"), description: `"${row.title}" removed from favorites.` });
        if (expandedId === row.id) setExpandedId(null);
      },
    });
  };

  const handleAddToMacros = (meal: any) => {
    const d = meal.mealData || meal;
    const protein = d.nutrition?.protein || d.protein || 0;
    const carbs = d.nutrition?.carbs || d.carbs || 0;
    const fat = d.nutrition?.fat || d.fat || 0;
    const starchyCarbs = d.nutrition?.starchyCarbs || d.starchyCarbs || 0;
    const fibrousCarbs = d.nutrition?.fibrousCarbs || d.fibrousCarbs || 0;
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

  const renderMealCard = (row: any) => {
    const isExpanded = expandedId === row.id;
    const d = row.mealData as any;
    const calories = d?.nutrition?.calories || d?.calories || 0;
    const protein = d?.nutrition?.protein || d?.protein || 0;
    const carbs = d?.nutrition?.carbs || d?.carbs || 0;
    const fat = d?.nutrition?.fat || d?.fat || 0;

    const isDiabetic = row.savedFromDiabeticBuilder === true;
    const bglBucket: string = row.bglBucket ?? "";
    const generatedBglMgdl: number | null = row.generatedBglMgdl ?? null;
    const glucoseContext: string = row.glucoseContext ?? "";
    const protocolType: string = row.protocolType ?? "";
    const rangeLabel = bglBucket ? bglRangeLabel(bglBucket) : "";

    const bannerAccent =
      bglBucket === "low"      ? { text: "text-sky-400",  border: "border-sky-700/40",  bg: "bg-sky-950/60" }
      : bglBucket === "in-range" ? { text: "text-lime-400",  border: "border-lime-700/40",  bg: "bg-lime-950/60" }
      : { text: "text-amber-400", border: "border-amber-700/40", bg: "bg-amber-950/60" };

    return (
      <div key={row.id} id={`meal-card-${row.id}`} className="rounded-xl border border-white/15 bg-white/5 overflow-hidden">
        <button
          onClick={() => setExpandedId(isExpanded ? null : row.id)}
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
              <div className="text-white font-medium truncate">{row.title}</div>
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
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-white/40" />
            ) : (
              <ChevronRight className="h-4 w-4 text-white/40" />
            )}
          </div>
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 space-y-4 border-t border-white/10 pt-4">
            <MealImageSlot
              imageUrl={d?.imageUrl}
              mealName={row.title}
              height="h-52"
            />

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
                {protocolType && (
                  <div className="text-white/60">{protocolType}</div>
                )}
                {glucoseContext && protocolType !== glucoseContext && (
                  <div className="text-white/50">{glucoseContext}</div>
                )}
                {rangeLabel && (
                  <div className="text-white/50 text-[10px]">{t("savedMeals.relevantRange")} {rangeLabel}</div>
                )}
              </div>
            )}

            {d?.description && (
              <p className="text-white/80 text-sm">{d.description}</p>
            )}

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

            {d?.ingredients && d.ingredients.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-white/70 mb-2">{t("savedMeals.ingredients")}</h4>
                <ul className="space-y-1">
                  {d.ingredients.map((ing: any, i: number) => (
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

            {d?.instructions && (
              <div>
                <h4 className="text-sm font-semibold text-white/70 mb-2">{t("savedMeals.instructions")}</h4>
                <ol className="space-y-3">
                  {normalizeInstructions(d.instructions).map((step: string, i: number) => (
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

            <div className="flex flex-wrap gap-2 pt-2">
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
                }}
                onSuccess={handleAddToPlanSuccess}
              />
              <button
                onClick={() => handleAddToMacros(row)}
                className="flex-1 bg-white/10 text-white text-sm py-2 px-3 rounded-lg active:scale-[0.98]"
              >
                {t("savedMeals.addToMacros")}
              </button>
              <button
                onClick={() => handleRemove(row)}
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
  };

  const allMeals = meals ?? [];
  const diabeticMeals = allMeals.filter((r: any) => r.savedFromDiabeticBuilder === true);
  const otherMeals = allMeals.filter((r: any) => r.savedFromDiabeticBuilder !== true);

  const hasDiabetic = diabeticMeals.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white pb-24 flex flex-col">
      <MobileHeaderGuard>
      <div
        className="fixed top-0 left-0 right-0 z-40 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => setLocation("/dashboard")} className="p-2 rounded-lg bg-white/10 active:scale-[0.98]">
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

            {hasDiabetic && BGL_SECTIONS.map((section) => {
              const sectionMeals = diabeticMeals.filter((r: any) =>
                (section.buckets as readonly string[]).includes(r.bglBucket)
              );
              if (sectionMeals.length === 0) return null;
              return (
                <div key={section.key} className="space-y-2">
                  <div className="flex items-center gap-2 px-1 pt-2">
                    <span className={`w-2 h-2 rounded-full ${section.dot} shrink-0`} />
                    <div>
                      <div className={`text-sm font-semibold ${section.accent}`}>{section.label}</div>
                      <div className="text-xs text-white/40">{section.sublabel}</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {sectionMeals.map((row: any) => renderMealCard(row))}
                  </div>
                </div>
              );
            })}

            {otherMeals.length > 0 && (
              <div className="space-y-2">
                {hasDiabetic && (
                  <div className="flex items-center gap-2 px-1 pt-2">
                    <span className="w-2 h-2 rounded-full bg-white/30 shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-white/60">{t("savedMeals.otherMeals")}</div>
                      <div className="text-xs text-white/40">{t("savedMeals.otherMealsDesc")}</div>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {otherMeals.map((row: any) => renderMealCard(row))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
