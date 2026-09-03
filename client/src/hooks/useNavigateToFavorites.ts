import { useLocation } from "wouter";

/**
 * Returns a stable callback that navigates to the Favorites page,
 * encoding the caller's current path as a `?from=` query parameter
 * so that AddToMealPlanButton can return the user here after a
 * successful plan save.
 *
 * Usage:
 *   const goToFavorites = useNavigateToFavorites();
 *   <button onClick={goToFavorites}>Favorites</button>
 */
export function useNavigateToFavorites(): () => void {
  const [, setLocation] = useLocation();
  const origin = window.location.pathname;
  return () => setLocation(`/saved-meals?from=${encodeURIComponent(origin)}`);
}
