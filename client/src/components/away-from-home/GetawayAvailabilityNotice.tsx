import type { GetawayAvailability } from "@shared/getawayAvailability";

export default function GetawayAvailabilityNotice({ availability }: {
  availability: GetawayAvailability;
}) {
  const preferences = [
    availability.preferences.cuisine,
    ...availability.preferences.diets,
  ].filter((value): value is string => Boolean(value));

  return (
    <section
      aria-label="Possible dining listings"
      className="rounded-2xl border border-orange-500/20 bg-black/40 px-4 py-4"
    >
      <h3 className="text-sm font-bold text-white">Possible dining listings</h3>
      <p className="mt-1 text-xs leading-relaxed text-amber-100/80">
        Location and menu need confirmation.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-white/75">{availability.summary}</p>

      {preferences.length > 0 && (
        <p className="mt-2 text-xs text-white/55">
          Preferences considered: {preferences.join(" · ")}
        </p>
      )}

      {availability.restaurants.length > 0 && (
        <ul className="mt-3 divide-y divide-white/10">
          {availability.restaurants.map((restaurant, index) => (
            <li key={`${restaurant.name}-${index}`} className="py-3 first:pt-0 last:pb-0">
              <p className="text-sm font-semibold text-white">{restaurant.name}</p>
              {restaurant.address && (
                <p className="mt-0.5 text-xs text-white/55">{restaurant.address}</p>
              )}
              {restaurant.menuNote && (
                <p className="mt-1 text-xs leading-relaxed text-orange-100/75">
                  {restaurant.menuNote}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
