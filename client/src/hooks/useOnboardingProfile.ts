import { useAuth } from "@/contexts/AuthContext";

export type OnboardingProfile = {
  allergies?: string[];
  avoidBadges?: string[];
  preferredBadges?: string[];
  dailyCalories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
};

export function useOnboardingProfile(): OnboardingProfile {
  const { user } = useAuth();

  return {
    allergies: user?.allergies || [],
    avoidBadges: user?.dietaryRestrictions || [],
    preferredBadges: [],
    dailyCalories: user?.dailyCalorieTarget ?? undefined,
    proteinGrams: user?.dailyProteinTarget ?? undefined,
    carbsGrams: user?.dailyCarbsTarget ?? undefined,
    fatGrams: user?.dailyFatTarget ?? undefined,
  };
}
