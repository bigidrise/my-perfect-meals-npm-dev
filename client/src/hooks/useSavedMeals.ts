import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { get, post } from "@/lib/api";

export interface SavedMealRow {
  id: string;
  userId: string;
  title: string;
  sourceType: string;
  signatureHash: string;
  mealData: any;
  createdAt: string;
  savedAt?: string;
  savedFromDiabeticBuilder?: boolean;
  generatedBglMgdl?: number | null;
  glucoseContext?: string | null;
  protocolType?: string | null;
  bglBucket?: string | null;
  // Canonical media asset URLs (Phase 4 — may be null for legacy rows)
  mediaAssetId?: string | null;
  thumbnailUrl?: string | null;
  displayUrl?: string | null;
  mediaStatus?: "ready" | "pending" | "failed" | "legacy" | "none";
  // Day-mismatch annotation
  dayMismatchNote?: string | null;
  dayMismatchPolicy?: string | null;
}

export interface SavedMealsFeedPage {
  meals: SavedMealRow[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export function useSavedMealsCheck() {
  return useQuery<string[]>({
    queryKey: ["saved-meals-check"],
    queryFn: () => get<string[]>("/api/saved-meals/check"),
    staleTime: 30_000,
  });
}

/** Paginated list hook — fetches 20 at a time, accumulates pages. */
export function useSavedMealsFeed(limitPerPage = 20) {
  return useInfiniteQuery<SavedMealsFeedPage>({
    queryKey: ["saved-meals-feed", limitPerPage],
    queryFn: ({ pageParam = 1 }) =>
      get<SavedMealsFeedPage>(`/api/saved-meals?page=${pageParam}&limit=${limitPerPage}`),
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    initialPageParam: 1,
    staleTime: 10_000,
  });
}

/**
 * Legacy flat-list hook — kept for backward compatibility with components that
 * use `useSavedMealsList()`. Loads all pages and flattens them.
 * For new work, prefer `useSavedMealsFeed`.
 */
export function useSavedMealsList() {
  const q = useSavedMealsFeed(100); // 100 per page to minimize round-trips for legacy callers
  const allMeals = q.data?.pages.flatMap(p => p.meals) ?? undefined;
  return {
    ...q,
    data: allMeals,
    isLoading: q.isLoading,
    isError: q.isError,
  };
}

export function useToggleSavedMeal() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: { title: string; sourceType: string; mealData: any }) => {
      return post<{ saved: boolean; id: string | null }>("/api/saved-meals/toggle", params);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-meals-check"] });
      qc.invalidateQueries({ queryKey: ["saved-meals-feed"] });
    },
  });
}

export function useDeleteSavedMeal() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { del } = await import("@/lib/api");
      return del<{ success: boolean }>(`/api/saved-meals/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saved-meals-check"] });
      qc.invalidateQueries({ queryKey: ["saved-meals-feed"] });
    },
  });
}

export function makeMealKey(title: string, sourceType: string): string {
  return `${(title || "").trim().toLowerCase()}|${sourceType}`;
}

export function isMealSaved(keys: string[] | undefined, title: string, sourceType: string): boolean {
  if (!keys || keys.length === 0) return false;
  return keys.includes(makeMealKey(title, sourceType));
}
