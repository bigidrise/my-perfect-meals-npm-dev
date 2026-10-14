import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { useOrg } from "@/contexts/OrgContext";
import { IS_DEVELOPMENT } from "@/lib/developmentAuthRoutes";
import { MEAL_BUILDER_GUIDANCE, type GuidedMealBuilderKey } from "@shared/mealBuilderGuidance";
import { useQuickTour } from "./useQuickTour";
import { createGuidancePreferenceStore } from "@/lib/guidedJourney/preferences";
import { guidancePausedForSession } from "@/lib/guidedJourney/presentation";

/** Page explanations only: no progress API, prescriptions, saving or redirects. */
export function useBuilderGuidanceTour(builder: GuidedMealBuilderKey, clientId?: string, householdProfileId?: string) {
  const { user, loading } = useAuth();
  const { activeProfileId } = useHousehold();
  const { org, isLoading: orgLoading } = useOrg();
  const household = householdProfileId || activeProfileId || null;
  // Keep the accepted personal General Nutrition flow exactly as it was.
  // Its existing GuidedMealBoard already owns the stage-three explanation.
  const useIntroduction = IS_DEVELOPMENT && (builder !== "general_nutrition" || Boolean(clientId || household));
  const scopeKey = useIntroduction
    ? JSON.stringify([builder, user?.id ?? null, org.id, clientId ?? null, household])
    : MEAL_BUILDER_GUIDANCE[builder].tourKey;
  const ready = !loading && !orgLoading && Boolean(user?.id);
  let automaticAllowed = true;
  if (useIntroduction && user?.id) {
    try {
      const preferences = createGuidancePreferenceStore({ accountId: user.id }).read().preferences;
      automaticAllowed = preferences.automaticExplanationsEnabled && preferences.mode !== "paused"
        && !guidancePausedForSession(user.id);
    } catch { automaticAllowed = false; }
  }
  const tour = useQuickTour(useIntroduction ? `builder-guidance::${scopeKey}` : scopeKey, undefined, {
    autoEnabled: !useIntroduction || (ready && automaticAllowed),
  });
  return {
    ...tour, scopeKey, useIntroduction,
    shouldShow: tour.shouldShow && (!useIntroduction || ready),
    openTour: () => { if (!useIntroduction || ready) tour.openTour(); },
  };
}
