/**
 * Fixed internal destinations only. The separate creatorRequest contract permits
 * reviewed Create a Dish text prefill, never arbitrary routes or generation.
 */
export const COACH_DESTINATIONS = {
  sushi_creator: { label: "Sushi Creator", route: "/lifestyle/sushi-creator", access: "pro" },
  craving_creator: { label: "Craving Creator", route: "/craving-creator", access: "pro" },
  dessert_creator: { label: "Dessert Creator", route: "/craving-desserts", access: "pro" },
  beverage_creator: { label: "Beverage Creator", route: "/lifestyle/beverage-creator", access: "pro" },
  athlete_beverage_creator: { label: "Athlete Beverage Creator", route: "/lifestyle/athlete-beverage-creator", access: "pro" },
  hydration_center: { label: "Hydration Center", route: "/hydration", access: "hydration" },
  restaurant_guide: { label: "Restaurant Guide", route: "/social-hub/restaurant-guide", access: "pro" },
  find_meals_near_me: { label: "Find Meals Near Me", route: "/social-hub/restaurant-finder", access: "pro" },
  my_perfect_buffet: { label: "My Perfect Buffet", route: "/my-perfect-buffet", access: "pro" },
  my_perfect_getaway: { label: "My Perfect Getaway", route: "/lifestyle/my-perfect-getaway", access: "clinical" },
  my_perfect_gatherings: { label: "My Perfect Gatherings", route: "/lifestyle/my-perfect-gatherings", access: "pro" },
  fridge_rescue: { label: "Fridge Rescue", route: "/fridge-rescue", access: "authenticated" },
  create_a_dish: { label: "Create a Dish", route: "/lifestyle/create-a-dish", access: "authenticated" },
  macro_calculator: { label: "Macro Calculator", route: "/macro-counter", access: "authenticated" },
  // Never guess a child. The existing hub establishes child context first.
  my_perfect_beginning: { label: "My Perfect Beginnings", route: "/lifestyle/my-perfect-beginning", access: "pro" },
} as const;

export type CoachDestinationId = keyof typeof COACH_DESTINATIONS;

export function isCoachDestinationId(value: unknown): value is CoachDestinationId {
  return typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(COACH_DESTINATIONS, value);
}

/** Exact legacy routes are accepted for existing model output, never arbitrary URLs. */
export function resolveCoachDestinationId(value: unknown): CoachDestinationId | undefined {
  if (isCoachDestinationId(value)) return value;
  return (Object.keys(COACH_DESTINATIONS) as CoachDestinationId[])
    .find(id => COACH_DESTINATIONS[id].route === value);
}

/** Only the server calls this on model output before persistence/response. */
export function validateCoachNavigationItems<T extends {
  kind: string; featureTarget?: string; destinationId?: string;
}>(items: T[], enabled: boolean): Array<Omit<T, "featureTarget" | "destinationId"> & {
  featureTarget?: string; destinationId?: CoachDestinationId;
}> {
  const escalation = items.some(item => item.kind === "contact_care");
  return items.map(item => {
    // Never accept a model-supplied "validated" identifier.
    const { destinationId: _untrusted, featureTarget: raw, ...safe } = item;
    if (!enabled) return { ...safe, ...(raw !== undefined ? { featureTarget: raw } : {}) };
    const id = !escalation && item.kind === "use_feature"
      ? resolveCoachDestinationId(raw) : undefined;
    return { ...safe, ...(id ? { featureTarget: id, destinationId: id } : {}) };
  });
}
