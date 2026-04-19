import { classifyPortionMethod, getPortionLabel, type PortionMethod } from "@/lib/portionMethodClassifier";

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
  if (!servings || servings <= 1) return null;

  const method = overrideMethod ?? classifyPortionMethod(mealName, description, servings);

  const primaryLabel = getPortionLabel(method, servings);

  const showWeightOption =
    method !== "single-serving" && method !== "weight-divided";

  const containerWord =
    method === "slice-based"
      ? "slices"
      : method === "spoon-divided"
      ? "bowls"
      : method === "container-divided"
      ? "jars or bowls"
      : "containers";

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">🍽️</span>
        <span className="font-semibold text-white">
          Serving Instructions
        </span>
        <span className="ml-auto text-xs text-white/50">
          {servings} {servings === 1 ? "serving" : "servings"}
        </span>
      </div>

      <p className="text-white/80 mb-2">{primaryLabel}</p>

      {showWeightOption && (
        <p className="text-white/50 text-xs">
          For best macro accuracy: weigh the finished dish and divide into{" "}
          {servings} equal portions (~{Math.round((100 / servings) / 10) * 10}% each).
        </p>
      )}

      {method === "container-divided" || method === "spoon-divided" ? (
        <p className="text-white/40 text-xs mt-1">
          Tip: Use {servings} equal-size {containerWord} to keep portions consistent.
        </p>
      ) : null}
    </div>
  );
}
