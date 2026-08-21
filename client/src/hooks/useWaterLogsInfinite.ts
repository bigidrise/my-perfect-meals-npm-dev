import { useInfiniteQuery } from "@tanstack/react-query";
import {
  getWaterLogs,
  waterLogsQueryKey,
  type WaterLogRow,
} from "@/lib/waterLogsApi";

export type { WaterLogRow };

export function useWaterLogsInfinite(
  userId: string,
  range: { from: string | null; to: string | null },
  pageSize = 50,
) {
  return useInfiniteQuery({
    queryKey: waterLogsQueryKey(userId, range),
    enabled: Boolean(userId),
    queryFn: async ({ pageParam }) => {
      return getWaterLogs({
        from: range.from,
        to: range.to,
        limit: pageSize,
        cursor: pageParam,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
  });
}