import { z } from "zod";
import { assembleLocationContext } from "./locationContext/engine";
import { classifyRestaurantArchetype } from "./restaurantCuisineArchetype";

const Selection = z.object({
  destinationName: z.string().trim().min(2).max(200),
  venueId: z.string().trim().min(1).max(120).optional(),
  zoneId: z.string().trim().min(1).max(120).optional(),
});
const Name = z.string().trim().min(2).max(160);

/** An adapter into Restaurant Guide, not another recommender or menu provider.
 * A selected concept is never proof of an outlet, menu, or ingredient list. */
export function resolveGetawayRestaurantContext(input: unknown, name: unknown) {
  const selection = Selection.parse(input);
  const restaurantName = Name.parse(name);
  let destinationName = selection.destinationName;
  let destinationEvidence: "catalog" | "member-provided" = "member-provided";
  if (selection.venueId) {
    const context = assembleLocationContext(selection.venueId, selection.zoneId);
    if (!context || (selection.zoneId && !context.zone) ||
      context.venue.name.toLocaleLowerCase() !== destinationName.toLocaleLowerCase()) {
      throw new Error("The destination or dining area no longer matches. Please select it again.");
    }
    destinationName = context.venue.name;
    destinationEvidence = "catalog";
  }
  const classification = classifyRestaurantArchetype(restaurantName);
  return {
    restaurantName, destinationName, destinationEvidence,
    venueEvidence: "member-provided" as const,
    cuisine: classification.archetype.label,
    cuisineKnown: classification.confidence !== "fallback",
    ...(selection.venueId ? { venueId: selection.venueId } : {}),
    ...(selection.zoneId ? { zoneId: selection.zoneId } : {}),
  };
}
