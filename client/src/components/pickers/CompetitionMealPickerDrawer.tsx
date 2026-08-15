import React from "react";
import { useTranslation } from "react-i18next";
import { PickerModal } from "@/components/ui/universal-modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Meal } from "@/types/meal";
import type { AthleteMeal } from "@/data/athleteMeals";
import { getCompetitionMealsByCategory } from "@/data/competitionPremadeMeals";
import { Target } from "lucide-react";

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// 🔄 Convert AthleteMeal to standard Meal
function convertAthleteMealToMeal(athleteMeal: AthleteMeal): Meal {
  const ingredients = [
    {
      item: athleteMeal.protein_source,
      amount: `${athleteMeal.protein_oz} oz`,
    },
    ...(athleteMeal.carb_source
      ? [{ item: athleteMeal.carb_source, amount: `${athleteMeal.carb_g}g` }]
      : []),
    ...athleteMeal.fibrous_source.map((veg: string) => ({
      item: veg,
      amount: "1 cup",
    })),
  ];

  const instructions = [
    `Grill or bake ${athleteMeal.protein_source} (${athleteMeal.protein_oz}oz)`,
    ...(athleteMeal.carb_source
      ? [`Prepare ${athleteMeal.carb_source} (${athleteMeal.carb_g}g)`]
      : []),
    ...(athleteMeal.fibrous_source.length
      ? [`Steam or grill ${athleteMeal.fibrous_source.join(", ")}`]
      : []),
    "Season to taste with low-sodium options",
  ];

  // Stable ID based on meal content
  const stableId = simpleHash(`comp_${athleteMeal.id}_${athleteMeal.title}`);

  const totalCarbs = athleteMeal.macros.starchyCarbs + athleteMeal.macros.fibrousCarbs;

  return {
    id: `comp_${stableId.toString(36)}`,
    title: athleteMeal.title,
    servings: 1,
    ingredients,
    instructions,
    nutrition: {
      calories: athleteMeal.macros.kcal,
      protein: athleteMeal.macros.protein,
      carbs: totalCarbs,
      fat: athleteMeal.macros.fat,
    },
    badges: athleteMeal.tags,
  };
}

const DEFAULT_CATEGORY = "poultry";

const CATEGORY_OPTIONS = [
  { value: "poultry", emoji: "🐔", labelKey: "competitionPicker.categories.poultry" },
  { value: "redmeat", emoji: "🥩", labelKey: "competitionPicker.categories.redmeat" },
  { value: "fish", emoji: "🐟", labelKey: "competitionPicker.categories.fish" },
  { value: "eggs_shakes", emoji: "🥚", labelKey: "competitionPicker.categories.eggsShakes" },
] as const;

export function CompetitionMealPickerDrawer({
  open,
  list,
  onClose,
  onPick,
}: {
  open: boolean;
  list: "breakfast" | "lunch" | "dinner" | "snacks" | "meal4" | "meal5" | "meal6" | null;
  onClose: () => void;
  onPick: (meal: Meal) => void;
}) {
  const { t } = useTranslation();
  const [category, setCategory] =
    React.useState<AthleteMeal["category"]>(DEFAULT_CATEGORY);
  const [showInfoModal, setShowInfoModal] = React.useState(false);

  // Auto-expand first category when drawer opens
  React.useEffect(() => {
    if (open) {
      setCategory(DEFAULT_CATEGORY);
    }
  }, [open]);

  // Filter meals by selected category
  const filteredMeals = React.useMemo(() => {
    return getCompetitionMealsByCategory(category);
  }, [category]);

  // State for the info modal, assuming it's defined elsewhere or not needed for this specific change
  // const [showInfoModal, setShowInfoModal] = React.useState(false);


  if (!open || !list) return null;

  return (
    <>
    <PickerModal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={
        <span className="text-2xl font-bold text-white flex items-center gap-2">
          🏆 {t("competitionPicker.headerAddTo", { slot: list })}
          <button
            onClick={() => setShowInfoModal(true)}
            className="bg-lime-700 hover:bg-lime-800 border-2 border-lime-600 text-white rounded-xl w-5 h-5 flex items-center justify-center text-sm font-bold flash-border"
            aria-label={t("competitionPicker.howToAria")}
          >
            ?
          </button>
        </span>
      }
      className="bg-black/90 border-white/20 text-white max-w-4xl"
    >
        <div className="space-y-4">
          {/* Category Selector */}
          <div className="bg-black/30 p-4 rounded-lg border border-white/10">
            <label className="text-white/80 text-sm mb-2 block">{t("competitionPicker.selectCategory")}</label>
            <Select
              value={category}
              onValueChange={(val) =>
                setCategory(val as AthleteMeal["category"])
              }
            >
              <SelectTrigger className="w-full bg-black/60 border-white/20 text-white h-10 text-sm">
                <SelectValue>
                  {(() => {
                    const opt = CATEGORY_OPTIONS.find((o) => o.value === category);
                    return opt ? `${opt.emoji} ${t(opt.labelKey)}` : t("competitionPicker.selectCategoryShort");
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-zinc-900/95 border-white/20 text-white">
                {CATEGORY_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="text-white hover:bg-white/10 focus:bg-white/20 cursor-pointer"
                  >
                    {`${option.emoji} ${t(option.labelKey)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Meal Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredMeals.map((am: AthleteMeal) => (
              <button
                key={am.id}
                onClick={() => {
                  const mealToAdd = convertAthleteMealToMeal(am);
                  onPick(mealToAdd);
                }}
                className="w-full text-left rounded-xl border border-white/20 bg-black/50 hover:bg-white/10 p-4 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="text-white/90 font-medium text-sm flex-1 leading-tight">
                    {am.title.includes('(') ? (
                      <>
                        {am.title.split('(')[0].trim()}
                        <br />
                        <span className="text-xs text-white/70">({am.title.split('(')[1]}</span>
                      </>
                    ) : (
                      am.title
                    )}
                  </div>
                  {am.includeCarbs ? (
                    <Badge className="bg-green-600/80 text-white text-[10px] ml-2 px-2 py-0.5 shrink-0">
                      {t("competitionPicker.badgeCarbs")}
                    </Badge>
                  ) : (
                    <Badge className="bg-orange-600/80 text-white text-[10px] ml-2 px-2 py-0.5 shrink-0">
                      P+V
                    </Badge>
                  )}
                </div>

                <div className="text-white/70 text-xs mb-1 leading-tight">
                  {am.protein_source} ({am.protein_oz}oz)
                  {am.carb_source && ` • ${am.carb_source} (${am.carb_g}g)`}
                </div>

                <div className="text-white/90 text-xs font-semibold leading-tight">
                  {am.macros.kcal} kcal · P{am.macros.protein} · C
                  {am.macros.starchyCarbs + am.macros.fibrousCarbs} · F{am.macros.fat}
                </div>

                {am.tags?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {am.tags.slice(0, 2).map((tag: string) => (
                      <span
                        key={tag}
                        className="text-[9px] bg-white/10 text-white/70 px-1.5 py-0.5 rounded-full leading-none"
                      >
                        {tag.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                ) : null}
              </button>
            ))}
          </div>

          {/* Info Note */}
          <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-4">
            <div className="flex items-start gap-2 mb-2">
              <Target className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-400 mb-1">{t("competitionPicker.noteTitle")}</p>
                <p className="text-white/80 text-xs mb-2">
                  {t("competitionPicker.noteDesc")}
                </p>
                <ul className="list-disc list-inside space-y-1 text-xs text-white/70 ml-2">
                  <li>{t("competitionPicker.noteStep1")}</li>
                  <li>{t("competitionPicker.noteStep2")}</li>
                  <li>{t("competitionPicker.noteStep3")}</li>
                  <li>{t("competitionPicker.noteStep4")}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
    </PickerModal>

    {/* Info Modal */}
    {showInfoModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="bg-black/30 backdrop-blur-lg border border-white/20 rounded-2xl p-6 max-w-md w-full shadow-xl">
          <h3 className="text-xl font-bold text-white mb-4">{t("competitionPicker.info.title")}</h3>

          <div className="space-y-4 text-white/90 text-sm">
            <p>{t("competitionPicker.info.intro")}</p>

            <div>
              <h4 className="font-semibold text-white mb-2">{t("competitionPicker.info.stepsLabel")}</h4>
              <ul className="space-y-2 text-white/80 text-sm">
                <li><strong className="text-white">{t("competitionPicker.info.step1Label")}</strong> {t("competitionPicker.info.step1Text")}</li>
                <li><strong className="text-white">{t("competitionPicker.info.step2Label")}</strong> {t("competitionPicker.info.step2Text")}</li>
                <li><strong className="text-white">{t("competitionPicker.info.step3Label")}</strong> {t("competitionPicker.info.step3Text")}</li>
                <li><strong className="text-white">{t("competitionPicker.info.step4Label")}</strong> {t("competitionPicker.info.step4Text")}</li>
              </ul>
            </div>

            <div className="bg-black/20 border border-white/10 rounded-lg p-3">
              <p className="font-semibold text-white mb-1">{t("competitionPicker.info.tipLabel")}</p>
              <p className="text-white/70">
                {t("competitionPicker.info.tipText")}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowInfoModal(false)}
            className="mt-6 w-full bg-lime-700 hover:bg-lime-800 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {t("competitionPicker.gotIt")}
          </button>
        </div>
      </div>
    )}
    </>
  );
}