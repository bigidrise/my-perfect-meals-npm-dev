import { currentRestaurantServing } from "@shared/restaurantServing";
import PlateItems from "./PlateItems";

export default function RestaurantPortions({ serving, meal, noticeOnly = false }: {
  noticeOnly?: boolean;
  serving?: unknown;
  meal: { name: string; calories: number; protein: number; carbs: number; fat: number };
}) {
  const current = currentRestaurantServing(serving, meal);
  if (!current) return null;
  return <section className="mt-3 text-xs text-white/85" aria-label="Recommended serving">
    {!noticeOnly && current.buffetItems.length > 0 && <>
      <h4 className="font-semibold text-orange-300">Your plate</h4>
      <PlateItems items={current.buffetItems} />
    </>}
    <p className="mt-2 text-white/65">{current.status === "complete"
      ? "Portions and nutrition are model estimates for the same suggested serving, not independently calculated or verified."
      : current.status === "published" ? "Menu-source nutrition; modifications not recalculated."
        : "Serving not established."} {(!noticeOnly || !current.buffetItems.length) && current.portionGuidance}</p>
  </section>;
}
