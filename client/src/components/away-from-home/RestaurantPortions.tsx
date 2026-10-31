import { currentRestaurantServing, displayRestaurantPortion } from "@shared/restaurantServing";

export default function RestaurantPortions({ serving, meal }: {
  serving?: unknown;
  meal: { name: string; calories: number; protein: number; carbs: number; fat: number };
}) {
  const current = currentRestaurantServing(serving, meal);
  if (!current) return null;
  return <section className="mt-3 text-xs text-white/85" aria-label="Recommended serving">
    <h4 className="font-semibold text-orange-300">Your plate</h4>
    <p className="mt-1">{current.label}</p>
    {current.items.length > 0 && <ul className="mt-2 space-y-1">{current.items.map((item, index) =>
      <li key={index}>{item.food} — {displayRestaurantPortion(item)}
        {item.note && <span className="block text-white/65">{item.note}</span>}</li>)}</ul>}
    <p className="mt-2 text-white/65">{current.basis === "model_estimated"
      ? "Portions and nutrition are model estimates for the same suggested serving, not independently calculated or verified."
      : "Menu-source nutrition; modifications not recalculated."} {current.guidance}</p>
  </section>;
}
