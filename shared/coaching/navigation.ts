/**
 * Fixed internal destinations only. The separate creatorRequest contract permits
 * reviewed Create a Dish text prefill, never arbitrary routes or generation.
 */
export const COACH_DESTINATIONS = {
  grocery_find_product: { label: "Find a Product", navigationLabel: "Grocery Store Coach", route: "/shopping-list-v2", access: "pro" },
  product_scan: { label: "Product Scan", route: "/shopping-list-v2", access: "essential" },
  grocery_create_meal: { label: "Grocery Coach — Create a Meal", navigationLabel: "Grocery Store Coach", route: "/shopping-list-v2", access: "pro" },
  sushi_creator: { label: "Sushi Creator", route: "/lifestyle/sushi-creator", access: "pro" },
  craving_creator: { label: "Craving Creator", route: "/craving-creator", access: "pro" },
  dessert_creator: { label: "Dessert Creator", route: "/craving-desserts", access: "pro" },
  beverage_creator: { label: "Beverage Creator", route: "/lifestyle/beverage-creator", access: "pro" },
  athlete_beverage_creator: { label: "Athlete Beverage Creator", route: "/lifestyle/athlete-beverage-creator", access: "pro" },
  hydration_center: { label: "Hydration Center", route: "/hydration", access: "hydration" },
  restaurant_guide: { label: "Restaurant Assistant", route: "/social-hub/restaurant-guide", access: "pro" },
  find_meals_near_me: { label: "Find Meals Near Me", route: "/social-hub/find", access: "pro" },
  my_perfect_buffet: { label: "My Perfect Buffet", route: "/my-perfect-buffet", access: "pro" },
  my_perfect_getaway: { label: "My Perfect Getaway", route: "/lifestyle/my-perfect-getaway", access: "clinical" },
  my_perfect_gatherings: { label: "My Perfect Gatherings", route: "/lifestyle/my-perfect-gatherings", access: "pro" },
  fridge_rescue: { label: "Fridge Rescue", route: "/fridge-rescue", access: "authenticated" },
  create_a_dish: { label: "Create a Dish", route: "/lifestyle/create-a-dish", access: "authenticated" },
  macro_calculator: { label: "Macro Calculator", route: "/macro-counter", access: "authenticated" },
  // Never guess a child. The existing hub establishes child context first.
  my_perfect_beginning: { label: "My Perfect Beginnings", route: "/lifestyle/my-perfect-beginning", access: "pro" },
  // Entry pages only: no builder selection, clinical activation or request transfer.
  my_perfect_menu: { label: "My Perfect Menu", route: "/foods-i-enjoy", access: "essential" },
  meal_builders: { label: "Meal Builders", route: "/builders", access: "meal_builders" },
  // Business Suite opens the existing Business Center, not Organization Hub.
  // Visiting this entry grants no business or administrator permissions.
  business_suite: { label: "Business Suite", route: "/business-center", access: "authenticated" },
} as const;

export type CoachDestinationId = keyof typeof COACH_DESTINATIONS;

/** Reviewed feature names bind explicit requests; never classify product words. */
export function mentionsCoachDestination(
  message: string, id: CoachDestinationId, environment?: string,
  establishedDestinationId?: CoachDestinationId,
): boolean {
  // Reviewed singular/plural feature names are evidence, never consent.
  // Bare "builder", pronouns and "meal prep" need semantic context instead.
  if (id === "meal_builders") {
    return /(?:^|[^\p{L}\p{N}_])meal\s+builders?(?=$|[^\p{L}\p{N}_])/iu.test(message) ||
      (establishedDestinationId === id &&
        /(?:^|[^\p{L}\p{N}_])(?:my|the|that)\s+builders?(?=$|[^\p{L}\p{N}_])/iu.test(message));
  }
  const names = id === "grocery_create_meal"
    ? environment === "development"
      // These are feature names, not meal-creation verbs. Interpretation of
      // shopping intent and acceptance of a pending offer remain server-owned.
      ? [COACH_DESTINATIONS[id].label, COACH_DESTINATIONS[id].navigationLabel, "Grocery Coach"]
      : [COACH_DESTINATIONS[id].label, "Create a Meal", "Build a Meal"]
    : [COACH_DESTINATIONS[id].label];
  return names.some(name => message.toLocaleLowerCase().includes(name.toLocaleLowerCase()));
}

export function isCoachDestinationId(value: unknown): value is CoachDestinationId {
  return typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(COACH_DESTINATIONS, value);
}

/** Unambiguous exact legacy routes only; never arbitrary URLs or guessed workflows. */
export function resolveCoachDestinationId(value: unknown): CoachDestinationId | undefined {
  if (isCoachDestinationId(value)) return value;
  const matches = (Object.keys(COACH_DESTINATIONS) as CoachDestinationId[])
    .filter(id => COACH_DESTINATIONS[id].route === value);
  // A shared parent URL cannot establish which nested workflow was chosen.
  return matches.length === 1 ? matches[0] : undefined;
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
