import { useInfiniteQuery } from "@tanstack/react-query";
import axios from "axios";
import { getAuthHeaders } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";

export interface MealLogRow {
  id: string;
  userId: string;
  description: string;
  mealTime: string; // ISO
  createdAt: string;
}

export function useMealLogsInfinite(userId: string, range: { from: string | null; to: string | null }, pageSize = 50) {
  return useInfiniteQuery({
    queryKey: ["mealLogs", userId, range],
    queryFn: async ({ pageParam }) => {
      const params: any = { userId, limit: pageSize };
      if (range.from) params.from = range.from;
      if (range.to) params.to = range.to;
      if (pageParam) params.cursor = pageParam;
      const { data } = await axios.get(apiUrl("/api/meal-logs"), {
        params,
        headers: getAuthHeaders(),
        withCredentials: true,
      });
      return data as { items: MealLogRow[]; nextCursor?: string };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
  });
}