import { useTranslation } from "react-i18next";
import { restaurantResultContextMatches, type RestaurantResultContext } from "@shared/restaurantCuisine";
import { Button } from "@/components/ui/button";

/** Historical meals remain available; this never regenerates or deletes them. */
export default function RestaurantCuisineFeedback({ previous, current, cuisineNotice, compositionNotice, onRegenerate }: {
  previous?: RestaurantResultContext;
  current: RestaurantResultContext;
  cuisineNotice?: string | null;
  compositionNotice?: string | null;
  onRegenerate: () => void;
}) {
  const { t } = useTranslation();
  const historical = !restaurantResultContextMatches(previous, current);
  return (
    <div role="status" className="mb-4 space-y-2 rounded-lg border border-orange-300/40 p-3 text-sm text-white">
      {historical && <p>{t("restaurant.historicalCuisineResults", { defaultValue: "Previous recommendations — these were generated with different or unknown cuisine preferences. They have not been refreshed. Your saved meals are unchanged." })}</p>}
      {cuisineNotice && <p>{cuisineNotice}</p>}
      <p>{compositionNotice || t("restaurant.restoredEvidenceUnknown", { defaultValue: "Restored recommendations: menu availability and ingredient evidence have not been rechecked." })}</p>
      {historical && <Button onClick={onRegenerate} variant="outline" className="text-white border-white/40">
        {t("restaurant.reviewCuisineAndRegenerate", { defaultValue: "Review cuisine and generate again" })}
      </Button>}
    </div>
  );
}
