export type Glp1MenuStatus = {
  active: boolean;
  shouldEscalate: boolean;
};

export function shouldRequireGlp1MealPreflight(
  status: Glp1MenuStatus,
  hasCheckinToday: boolean,
  isHouseholdSubject: boolean,
): boolean {
  return status.active && !status.shouldEscalate && !hasCheckinToday && !isHouseholdSubject;
}

export function glp1HubReturnTarget(category: string | null): string {
  const params = new URLSearchParams({ builder: "glp1", glp1SettingsChanged: "1" });
  if (category) params.set("category", category);
  return `/foods-i-enjoy?${params.toString()}`;
}

export function canSaveGlp1MealPreflight({
  hasLoaded,
  isLoading,
  hydratedKey,
  currentKey,
}: {
  hasLoaded: boolean;
  isLoading: boolean;
  hydratedKey: string | null;
  currentKey: string;
}): boolean {
  return hasLoaded && !isLoading && hydratedKey === currentKey;
}