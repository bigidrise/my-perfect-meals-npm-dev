import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { COACH_DESTINATIONS, isCoachDestinationId } from "@shared/coaching/navigation";
import { chefNavigationRoute } from "@shared/coaching/creatorRequest";
import { useConsumerCopy } from "@/i18n/useConsumerCopy";

/** Fixed routes only; reviewed request text can populate an editable creator field. */
export default function CoachFeatureAction({ destinationId, creatorRequest, messageId }: {
  destinationId: unknown; creatorRequest?: unknown; messageId?: string;
}) {
  const { t } = useConsumerCopy();
  const [, navigate] = useLocation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (!isCoachDestinationId(destinationId)) return null;
  const destination = COACH_DESTINATIONS[destinationId];
  // Name the feature being opened, not a nested function that still needs selection.
  const navigationLabel = "navigationLabel" in destination ? destination.navigationLabel : destination.label;
  const labels: Record<string, string> = {
    "Grocery Store Coach": t("Grocery Store Coach"), "Product Scan": t("Product Scan"),
    "Sushi Creator": t("Sushi Creator"), "Craving Creator": t("Craving Creator"),
    "Dessert Creator": t("Dessert Creator"), "Beverage Creator": t("Beverage Creator"),
    "Athlete Beverage Creator": t("Athlete Beverage Creator"), "Hydration Center": t("Hydration Center"),
    "Restaurant Assistant": t("Restaurant Assistant"), "Find Meals Near Me": t("Find Meals Near Me"),
    "My Perfect Buffet": t("My Perfect Buffet"), "My Perfect Getaway": t("lifestyle.getawayTitle"),
    "My Perfect Gatherings": t("lifestyle.gatheringsTitle"), "Fridge Rescue": t("lifestyle.fridgeRescueTitle"),
    "Create a Dish": t("lifestyle.createDishTitle"), "Macro Calculator": t("Macro Calculator"),
    "My Perfect Beginnings": t("My Perfect Beginnings"), "My Perfect Menu": t("My Perfect Menu"),
    "Meal Builders": t("Meal Builders"), "Business Suite": t("Business Suite"),
    "Business Organization": t("Business Organization"), "My Perfect Pets": t("lifestyle.petsTitle"),
    "My Perfect Dog": t("My Perfect Dog"), "My Perfect Cat": t("My Perfect Cat"),
    "Spirit, Beer & Wine Pairings": t("Spirit, Beer & Wine Pairings"),
    "Wine List Translator": t("Wine List Translator"), "Reduce Drinking Tool": t("Reduce Drinking Tool"),
    "My Perfect Meals Academy": t("My Perfect Meals Academy"), "Tips & Strategies": t("Tips & Strategies"),
    "Favorites": t("Favorites"), "Daily Journal & Inspiration": t("Daily Journal & Inspiration"),
    "Smart Grocery List": t("Smart Grocery List"), "My Biometrics": t("My Biometrics"),
    "Dashboard": t("nav.dashboard"),
  };
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
      // Authorization success or a displayed button is not route evidence.
      if (messageId && `${window.location.pathname}${window.location.search}` === expectedRoute) {
        void apiRequest("/api/coach/navigation/performed", {
          method: "POST", body: JSON.stringify({ messageId, destinationId }),
        }).catch(() => console.warn("[ChefNavigation] route_receipt_unavailable"));
      }
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "";
      setError(message.includes("403")
        ? t("This feature is not included in your current access. Your conversation is still here.")
        : message.includes("401")
          ? t("Please sign in again to open this feature.")
          : t("Could not open this feature. Please try again. Your conversation is still here."));
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="mt-2">
      <Button type="button" onClick={() => void open()} disabled={pending}
        className="h-auto min-h-10 max-w-full whitespace-normal text-left"
        aria-busy={pending}>
        {pending ? t("Checking access…") : t("Open {{feature}}", { feature: labels[navigationLabel] ?? navigationLabel })}
      </Button>
      {error && <p role="alert" className="mt-2 text-sm text-orange-200">{error}</p>}
    </div>
  );
}
