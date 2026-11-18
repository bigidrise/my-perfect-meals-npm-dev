import { classifyPortionMethod, getPortionLabel, type PortionMethod } from "@/lib/portionMethodClassifier";
import { useConsumerCopy } from "@/i18n/useConsumerCopy";

interface ServingInstructionsBlockProps {
  servings: number;
  mealName?: string;
  description?: string;
  portionMethod?: PortionMethod;
}

export default function ServingInstructionsBlock({
  servings,
  mealName = "",
  description = "",
  portionMethod: overrideMethod,
}: ServingInstructionsBlockProps) {
  const { t } = useConsumerCopy();
  if (!servings || servings <= 1) return null;

  const method = overrideMethod ?? classifyPortionMethod(mealName, description, servings);

  const primaryLabels: Record<PortionMethod, string> = {
    "single-serving": t("This recipe is 1 serving — no dividing needed."),
    "slice-based": t("Chill or set, then slice into {{count}} equal pieces.", { count: servings }),
    "container-divided": t("Divide evenly into {{count}} jars or bowls.", { count: servings }),
    "spoon-divided": t("Spoon evenly into {{count}} dessert bowls or cups.", { count: servings }),
    "weight-divided": t("Weigh the finished mixture and divide evenly into {{count}} portions.", { count: servings }),
    "plate-divided": t("Divide evenly across {{count}} plates or meal prep containers.", { count: servings }),
  };
  const primaryLabel = primaryLabels[method] ?? getPortionLabel(method, servings);

  const showWeightOption =
    method !== "single-serving" && method !== "weight-divided";

  const containerWord =
    method === "slice-based"
      ? t("slices")
      : method === "spoon-divided"
      ? t("bowls")
      : method === "container-divided"
      ? t("jars or bowls")
      : t("containers");

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">🍽️</span>
        <span className="font-semibold text-white">
          {t("Serving Instructions")}
        </span>
        <span className="ml-auto text-xs text-white/50">
          {t("{{count}} servings", { count: servings })}
        </span>
      </div>

      <p className="text-white/80 mb-2">{primaryLabel}</p>

      {showWeightOption && (
        <p className="text-white/50 text-xs">
          {t("For best macro accuracy: weigh the finished dish and divide into {{count}} equal portions (~{{percent}}% each).", { count: servings, percent: Math.round((100 / servings) / 10) * 10 })}
        </p>
      )}

      {method === "container-divided" || method === "spoon-divided" ? (
        <p className="text-white/40 text-xs mt-1">
          {t("Tip: Use {{count}} equal-size {{containers}} to keep portions consistent.", { count: servings, containers: containerWord })}
        </p>
      ) : null}
    </div>
  );
}
