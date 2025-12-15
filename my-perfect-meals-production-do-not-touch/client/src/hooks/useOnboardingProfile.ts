// Replace the internals to match your real context/store.
// Expect: allergies[], avoidBadges[], dailyCalories/protein/carbs/fat, etc.
export type OnboardingProfile = {
  allergies?: string[];            // e.g. ["peanut","gluten"]
  avoidBadges?: string[];          // e.g. ["high-sugar"]
  preferredBadges?: string[];      // e.g. ["low-GI","gluten-free"]
  dailyCalories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
};

export function useOnboardingProfile(): OnboardingProfile {
  // wire this into your real context
  // eslint-disable-next-line
  return (window as any).__DEBUG_PROFILE__ || {
    allergies: [],
    avoidBadges: [],
    preferredBadges: ["low-GI"],
    dailyCalories: 2000,
    proteinGrams: 120,
    carbsGrams: 200,
    fatGrams: 67,
  };
}