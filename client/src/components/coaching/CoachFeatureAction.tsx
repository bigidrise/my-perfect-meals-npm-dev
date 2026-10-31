import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { COACH_DESTINATIONS, isCoachDestinationId } from "@shared/coaching/navigation";
import { chefNavigationRoute } from "@shared/coaching/creatorRequest";

/** Fixed routes only; reviewed request text can populate an editable creator field. */
export default function CoachFeatureAction({ destinationId, creatorRequest }: {
  destinationId: unknown; creatorRequest?: unknown;
}) {
  const [, navigate] = useLocation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (!isCoachDestinationId(destinationId)) return null;
  const destination = COACH_DESTINATIONS[destinationId];
  const open = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const expectedRoute = chefNavigationRoute(destinationId, creatorRequest);
      const result = await apiRequest("/api/coach/navigation", {
        method: "POST", body: JSON.stringify({ destinationId,
          ...(creatorRequest !== undefined ? { creatorRequest } : {}) }),
      }) as { destinationId?: unknown; route?: unknown };
      if (result.destinationId !== destinationId || result.route !== expectedRoute) {
        throw new Error("This recommendation is unavailable. Please ask Chef again.");
      }
      navigate(expectedRoute);
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "";
      setError(message.includes("403")
        ? "This feature is not included in your current access. Your conversation is still here."
        : message.includes("401")
          ? "Please sign in again to open this feature."
          : "Could not open this feature. Please try again. Your conversation is still here.");
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="mt-2">
      <Button type="button" onClick={() => void open()} disabled={pending}
        className="h-auto min-h-10 max-w-full whitespace-normal text-left"
        aria-busy={pending}>
        {pending ? "Checking access…" : `Open ${destination.label}`}
      </Button>
      {error && <p role="alert" className="mt-2 text-sm text-orange-200">{error}</p>}
    </div>
  );
}
