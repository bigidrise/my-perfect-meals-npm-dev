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

const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

export function useSleepToday() {
  return useQuery({
    queryKey: ["/api/biometrics", DEV_USER_ID, "sleep", "today"],
    queryFn: async () => {
      const { startUTC, endUTC } = localDayRangeAsUTCISO(new Date());
      const url = `/api/biometrics/summary?userId=${DEV_USER_ID}&from=${startUTC}&to=${endUTC}&type=sleep`;
      const r = await fetch(apiUrl(url));
      if (!r.ok) throw new Error("Failed to load today sleep");
      // Expect { totalMinutes: number, sessions: SleepSession[] }
      return r.json();
    },
    staleTime: 60_000,
  });
}

export function useSleepHistory(days = 30) {
  return useQuery({
    queryKey: ["/api/biometrics", DEV_USER_ID, "sleep", "daily", days],
    queryFn: async () => {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - (days - 1));
      const { startUTC } = localDayRangeAsUTCISO(start);
      const { endUTC } = localDayRangeAsUTCISO(end);
      const url = `/api/biometrics/summary?userId=${DEV_USER_ID}&from=${startUTC}&to=${endUTC}&type=sleep&aggregate=day`;
      const r = await fetch(apiUrl(url));
      if (!r.ok) throw new Error("Failed to load sleep history");
      // Expect { daily: [{ date:'YYYY-MM-DD', totalMinutes:number }] }
      return r.json();
    },
    staleTime: 5 * 60_000,
  });
}

export async function saveSleepSession(session: SleepSession) {
  const payload = {
    userId: DEV_USER_ID,
    provider: "manual",
    deviceId: "biometrics-sleep",
    samples: [{
      type: "sleep",                  // ← server groups/aggregates by 'sleep'
      unit: "min",                    // duration minutes
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
