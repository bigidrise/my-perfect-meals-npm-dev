import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";
const LS_KEY = (uid: string) => `sleep-sessions-v1:${uid}`;

function parseLocalDateTime(value: string): Date | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]), h = Number(m[4]), mi = Number(m[5]);
  const dt = new Date(y, mo - 1, d, h, mi, 0, 0);
  return isNaN(dt.getTime()) ? null : dt;
}
function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}
function localDayRangeAsUTCISO(d: Date) {
  const start = new Date(d); start.setHours(0, 0, 0, 0);
  const end = new Date(d);   end.setHours(23, 59, 59, 999);
  return {
    startUTC: new Date(start.getTime() - start.getTimezoneOffset() * 60000).toISOString(),
    endUTC:   new Date(end.getTime()   - end.getTimezoneOffset()   * 60000).toISOString(),
  };
}
function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type SleepSession = { id: string; startTime: string; endTime: string; minutes: number };
function readLocal(uid: string): SleepSession[] {
  try {
    const raw = localStorage.getItem(LS_KEY(uid));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function writeLocal(uid: string, sessions: SleepSession[]) {
  try { localStorage.setItem(LS_KEY(uid), JSON.stringify(sessions)); } catch {}
}

async function tryPostSleepServer(userId: string, session: SleepSession) {
  const candidates = [
    { url: "/api/sleep", body: { userId, sessions: [session] } },
    { url: `/api/users/${userId}/sleep`, body: { sessions: [session] } },
  ];
  let lastErr: any = null;
  for (const c of candidates) {
    try {
      const r = await fetch(c.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c.body),
      });
      if (r.ok) return await r.json();
      lastErr = await r.text();
    } catch (e) { lastErr = e; }
  }
  throw new Error(typeof lastErr === "string" ? lastErr : "No sleep API available");
}

async function tryGetSleepSummaryServer(userId: string, startUTC: string, endUTC: string, aggregate?: "day") {
  const params = new URLSearchParams({ userId, from: startUTC, to: endUTC });
  if (aggregate) params.set("aggregate", aggregate);
  const candidates = [
    `/api/sleep/summary?${params.toString()}`,
    `/api/users/${userId}/sleep/summary?${params.toString()}`,
  ];
  let lastErr: any = null;
  for (const u of candidates) {
    try {
      const r = await fetch(u);
      if (r.ok) return await r.json();
      lastErr = await r.text();
    } catch (e) { lastErr = e; }
  }
  throw new Error(typeof lastErr === "string" ? lastErr : "No sleep summary API");
}

function useSleepToday() {
  return useQuery({
    queryKey: ["sleep", DEV_USER_ID, "today"],
    queryFn: async () => {
      const { startUTC, endUTC } = localDayRangeAsUTCISO(new Date());
      try {
        const json = await tryGetSleepSummaryServer(DEV_USER_ID, startUTC, endUTC);
        if (typeof json?.totalMinutes === "number") return { totalMinutes: json.totalMinutes };
      } catch {}
      const sessions = readLocal(DEV_USER_ID);
      const total = sessions
        .filter(s => {
          const st = new Date(s.startTime).getTime();
          return st >= new Date(startUTC).getTime() && st <= new Date(endUTC).getTime();
        })
        .reduce((a, s) => a + (s.minutes || 0), 0);
      return { totalMinutes: total };
    },
    staleTime: 60_000,
  });
}

function useSleepHistory30() {
  return useQuery({
    queryKey: ["sleep", DEV_USER_ID, "daily", 30],
    queryFn: async () => {
      const end = new Date();
      const start = new Date(); start.setDate(end.getDate() - 29);
      const { startUTC } = localDayRangeAsUTCISO(start);
      const { endUTC }   = localDayRangeAsUTCISO(end);

      try {
        const json = await tryGetSleepSummaryServer(DEV_USER_ID, startUTC, endUTC, "day");
        if (Array.isArray(json?.daily)) return { daily: json.daily };
      } catch {}

      const sessions = readLocal(DEV_USER_ID);
      const map = new Map<string, number>();
      for (let i = 0; i < 30; i++) {
        const d = new Date(); d.setDate(end.getDate() - i);
        map.set(ymdLocal(d), 0);
      }
      sessions.forEach(s => {
        const d = ymdLocal(new Date(s.startTime));
        if (map.has(d)) map.set(d, (map.get(d) || 0) + (s.minutes || 0));
      });
      const daily = Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, totalMinutes]) => ({ date, totalMinutes }));
      return { daily };
    },
    staleTime: 60_000,
  });
}

async function saveSleep(userId: string, session: SleepSession) {
  try {
    return await tryPostSleepServer(userId, session);
  } catch {
    const existing = readLocal(userId);
    writeLocal(userId, [...existing, session]);
    return { saved: "local" };
  }
}

export default function SleepPage() {
  const [, setLocation] = useLocation();
  const qc = useQueryClient();

  const todayQ = useSleepToday();
  const histQ  = useSleepHistory30();

  const [timeframe, setTimeframe] = useState<"7day" | "30day" | "90day">("7day");
  const [start, setStart] = useState("");
  const [end, setEnd]     = useState("");
  const [err, setErr]     = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startLocal = parseLocalDateTime(start);
  const endLocal   = parseLocalDateTime(end);
  const durationMin = startLocal && endLocal ? minutesBetween(startLocal, endLocal) : 0;
  const canSave = !!startLocal && !!endLocal && durationMin >= 1;

  const chartData = useMemo(() => {
    const days = timeframe === "7day" ? 7 : timeframe === "30day" ? 30 : 90;
    const daily = histQ.data?.daily ?? [];
    const end = new Date();
    const result = [];
    
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(end.getDate() - i);
      const dateStr = ymdLocal(d);
      const dayData = daily.find(item => item.date === dateStr);
      result.push({
        date: `${d.getMonth() + 1}/${d.getDate()}`,
        minutes: dayData ? Math.round(dayData.totalMinutes) : 0,
      });
    }
    
    return result;
  }, [histQ.data, timeframe]);

  return (
    <div className="relative min-h-screen p-6 text-white bg-gradient-to-br from-black/60 via-orange-600 to-black/80">
      <div className="fixed top-4 left-4 z-50">
        <Button
          onClick={() => setLocation("/my-biometrics")}
          className="bg-black/10 blur-none border border-white/20 text-white hover:bg-black/20 rounded-2xl w-10 h-10 p-0"
          aria-label="Back to Biometrics"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        <div className="mt-16 relative isolate text-center rounded-2xl px-6 py-6
          bg-white/5 backdrop-blur-2xl border border-white/10 shadow-xl">
          <span className="absolute inset-0 -z-0 pointer-events-none rounded-2xl
                           bg-gradient-to-r from-white/10 via-transparent to-white/5" />
          <h1 className="relative z-10 text-2xl md:text-2xl font-semi-bold">😴 Sleep</h1>
          <p className="relative z-10 mt-2 text-white/85 text-md">
            Track your sleep sessions and analyze patterns over time.
          </p>
        </div>

        <Card className="bg-white/5 border border-white/30 backdrop-blur-xl">
          <CardContent className="p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-white/75 mb-1">Start</div>
                <Input
                  type="datetime-local"
                  step="60"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  aria-label="Sleep start"
                  className="bg-black/40 border-white/30 text-white placeholder:text-white/50 [color-scheme:dark]"
                />
              </div>
              <div>
                <div className="text-xs text-white/75 mb-1">End</div>
                <Input
                  type="datetime-local"
                  step="60"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  aria-label="Sleep end"
                  className="bg-black/40 border-white/30 text-white placeholder:text-white/50 [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="text-xs text-white/60 mt-1">
              {startLocal && endLocal ? `Duration: ${durationMin} min` : "Pick start and end"}
            </div>

            {err && <div className="mt-1 text-sm text-rose-300">{err}</div>}

            <Button
              disabled={!canSave || saving}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={async () => {
                setErr(null);
                if (!startLocal || !endLocal) { setErr("Pick both start and end."); return; }
                if (endLocal <= startLocal)    { setErr("End must be after start."); return; }
                const minutes = minutesBetween(startLocal, endLocal);
                if (!Number.isFinite(minutes) || minutes <= 0) { setErr("Duration invalid."); return; }

                const session: SleepSession = {
                  id: `sleep-${Date.now()}`,
                  startTime: startLocal.toISOString(),
                  endTime: endLocal.toISOString(),
                  minutes,
                };

                try {
                  setSaving(true);
                  await saveSleep(DEV_USER_ID, session);
                  setStart(""); setEnd("");
                  await Promise.all([
                    qc.invalidateQueries({ queryKey: ["sleep", DEV_USER_ID, "today"] }),
                    qc.invalidateQueries({ queryKey: ["sleep", DEV_USER_ID, "daily", 30] }),
                  ]);
                } catch (e: any) {
                  setErr(e?.message || "Failed to save");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Saving…" : "Save Sleep"}
            </Button>

            <p className="text-xs text-white/60">
              If your server lacks a sleep endpoint, entries are safely cached on this device and still appear in summaries.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border border-white/30 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="text-sm text-white/80 font-medium pb-2 border-b border-white/25">
              Today
            </div>

            {todayQ.isLoading ? (
              <div className="mt-3 text-sm text-white/70">Loading…</div>
            ) : todayQ.error ? (
              <div className="mt-3 text-sm text-rose-300">Couldn't load today.</div>
            ) : (
              <div className="mt-3 text-xl font-bold text-white">
                {Math.round(todayQ.data?.totalMinutes ?? 0)} min
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/5 border border-white/30 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="text-sm text-white/80 font-medium pb-2 border-b border-white/25 mb-4">
              Sleep History
            </div>

            <div className="flex gap-2 mb-4">
              {(["7day", "30day", "90day"] as const).map((tf) => (
                <Button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`
                    rounded-xl px-4 py-2 text-sm transition-all
                    ${timeframe === tf 
                      ? "bg-purple-600 text-white border-purple-400" 
                      : "bg-black/30 text-white/70 border-white/20 hover:bg-black/40"
                    }
                  `}
                  variant={timeframe === tf ? "default" : "outline"}
                >
                  {tf === "7day" ? "7 Days" : tf === "30day" ? "30 Days" : "90 Days"}
                </Button>
              ))}
            </div>

            {histQ.isLoading ? (
              <div className="mt-3 text-sm text-white/70">Loading…</div>
            ) : histQ.error ? (
              <div className="mt-3 text-sm text-rose-300">Couldn't load history.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#fff" 
                    fontSize={12}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    stroke="#fff" 
                    fontSize={12}
                    label={{ value: 'Minutes', angle: -90, position: 'insideLeft', fill: '#fff' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(0,0,0,0.8)",
                      border: "1px solid rgba(168,85,247,0.5)",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="minutes"
                    stroke="#a855f7"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#a855f7" }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
