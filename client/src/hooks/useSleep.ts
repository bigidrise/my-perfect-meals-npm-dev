// client/src/hooks/useSleep.ts
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { localDayRangeAsUTCISO } from "@/utils/dates";
import { apiUrl } from '@/lib/resolveApiBase';

export type SleepSession = {
  id?: string;
  startTime: string; // ISO
  endTime: string;   // ISO
  durationMin?: number;
  source?: "manual" | "device";
};

export function useSleepToday(userId: string) {
  return useQuery({
    queryKey: ["/api/biometrics", userId, "sleep", "today"],
    enabled: !!userId,
    queryFn: async () => {
      const { startUTC, endUTC } = localDayRangeAsUTCISO(new Date());
      const url = `/api/biometrics/summary?userId=${userId}&from=${startUTC}&to=${endUTC}&type=sleep`;
      const r = await fetch(apiUrl(url));
      if (!r.ok) throw new Error("Failed to load today sleep");
      return r.json();
    },
    staleTime: 60_000,
  });
}

export function useSleepHistory(userId: string, days = 30) {
  return useQuery({
    queryKey: ["/api/biometrics", userId, "sleep", "daily", days],
    enabled: !!userId,
    queryFn: async () => {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - (days - 1));
      const { startUTC } = localDayRangeAsUTCISO(start);
      const { endUTC } = localDayRangeAsUTCISO(end);
      const url = `/api/biometrics/summary?userId=${userId}&from=${startUTC}&to=${endUTC}&type=sleep&aggregate=day`;
      const r = await fetch(apiUrl(url));
      if (!r.ok) throw new Error("Failed to load sleep history");
      return r.json();
    },
    staleTime: 5 * 60_000,
  });
}

export async function saveSleepSession(userId: string, session: SleepSession) {
  const payload = {
    userId,
    provider: "manual",
    deviceId: "biometrics-sleep",
    samples: [{
      type: "sleep",
      unit: "min",
      value: Math.max(0, Math.round(((new Date(session.endTime).getTime()-new Date(session.startTime).getTime())/60000))),
      startTime: session.startTime,
      endTime: session.endTime,
      sourceRecordId: `manual-sleep-${Date.now()}`,
    }]
  };
  const r = await fetch(apiUrl("/api/biometrics/ingest"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error("Failed to save sleep");
  return r.json();
}
