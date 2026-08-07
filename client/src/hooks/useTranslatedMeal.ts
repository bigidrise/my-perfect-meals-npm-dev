/**
 * useTranslatedMeal
 *
 * Fetches (or triggers) a cached translation for a saved meal.
 * Returns null immediately for English — no network call is made.
 * Enabled only when `enabled` is true (i.e. the card is expanded).
 *
 * Translations are stable (staleTime: Infinity client-side); the server
 * re-generates automatically when the source_hash drifts.
 */
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { get } from "@/lib/api";

export interface MealTranslation {
  translatedName: string;
  translatedDescription?: string | null;
  /** Only the item name + notes for each ingredient — quantities stay canonical */
  translatedIngredients?: Array<{ item: string; notes?: string }> | null;
  translatedInstructions?: string[] | null;
  locale: string;
  fromCache: boolean;
}

export function useTranslatedMeal(mealId: string, enabled: boolean) {
  const { i18n } = useTranslation();
  const locale = i18n.language.split("-")[0]; // "en-US" → "en"
  const active = enabled && locale !== "en";

  return useQuery<MealTranslation | null>({
    queryKey: [`meal-translation`, mealId, locale],
    queryFn: () =>
      get<MealTranslation>(
        `/api/saved-meals/${encodeURIComponent(mealId)}/translation?locale=${locale}`
      ),
    enabled: active,
    staleTime: Infinity,   // server re-generates on hash mismatch; client trusts cache
    retry: false,
    throwOnError: false,   // on failure, component falls back to original English
  });
}
