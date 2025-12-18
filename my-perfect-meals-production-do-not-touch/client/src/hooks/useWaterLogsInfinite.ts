import { useInfiniteQuery } from "@tanstack/react-query";
import axios from "axios";

export interface WaterLogRow {
  id: string;
  userId: string;
  amountMl: number;
  unit: string;       // original unit label user chose
  intakeTime: string; // ISO
  createdAt: string;
}

export function useWaterLogsInfinite(userId: string, range: { from: string | null; to: string | null }, pageSize = 50) {
  return useInfiniteQuery({
    queryKey: ["waterLogs", userId, range],
    queryFn: async ({ pageParam }) => {
      const params: any = { userId, limit: pageSize };
      if (range.from) params.from = range.from;
      if (range.to) params.to = range.to;
      if (pageParam) params.cursor = pageParam;
      const { data } = await axios.get("/api/water-logs", { params });
      return data as { items: WaterLogRow[]; nextCursor?: string };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor,
  });
}