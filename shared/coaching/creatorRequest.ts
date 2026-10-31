import { COACH_DESTINATIONS, type CoachDestinationId } from "./navigation";

/** Editable text only. Never a generation command, redirect, or entitlement. */
export interface ChefCreatorRequest {
  destinationId: "create_a_dish";
  idea: string;
}

export function parseChefCreatorRequest(value: unknown): ChefCreatorRequest | undefined {
  if (!value || typeof value !== "object") return undefined;
  const request = value as Record<string, unknown>;
  if (Object.keys(request).some(key => key !== "destinationId" && key !== "idea") ||
      request.destinationId !== "create_a_dish" || typeof request.idea !== "string") return undefined;
  if (/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(request.idea)) return undefined;
  const idea = request.idea.trim();
  if (!idea || idea.length > 600) return undefined;
  return { destinationId: "create_a_dish", idea };
}

/** Only one reviewed destination and query key can receive conversational text. */
export function chefNavigationRoute(id: CoachDestinationId, value?: unknown): string {
  const route = COACH_DESTINATIONS[id].route;
  if (value === undefined) return route;
  const request = parseChefCreatorRequest(value);
  if (!request || id !== request.destinationId) throw new Error("Invalid creator request");
  return `${route}?${new URLSearchParams({ idea: request.idea }).toString()}`;
}
