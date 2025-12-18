// Simple. Voluntary. Local-first. Black-glass UI.
// Features: log (type, ounces, date, notes) -> save -> see 7/30/90-day bars.
// Optional: call SYNC_ENDPOINT after local save (leave empty to skip).

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Wine, Beer, Martini, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import TrashButton from "@/components/ui/TrashButton";

// ---- CONFIG ---------------------------------------------------------------
const LS_KEY = "mpm_alcohol_entries_v1";
const SYNC_ENDPOINT = ""; // e.g., `${import.meta.env.VITE_API_BASE_URL}/api/alcohol/wean-plan` (optional)

// Calories / carbs per ounce (standard drinks)
const DRINK_PER_OZ: Record<string, { kcalPerOz: number; carbsPerOz: number }> =
  {
    beer: { kcalPerOz: 150 / 12, carbsPerOz: 13 / 12 },
    wine: { kcalPerOz: 120 / 5, carbsPerOz: 4 / 5 },
    whiskey: { kcalPerOz: 100 / 1.5, carbsPerOz: 0 / 1.5 },
    vodka: { kcalPerOz: 100 / 1.5, carbsPerOz: 0 / 1.5 },
    rum: { kcalPerOz: 100 / 1.5, carbsPerOz: 0 / 1.5 },
    gin: { kcalPerOz: 100 / 1.5, carbsPerOz: 0 / 1.5 },
    tequila: { kcalPerOz: 100 / 1.5, carbsPerOz: 0 / 1.5 },
    other: { kcalPerOz: 100 / 1.5, carbsPerOz: 2 / 1.5 },
  };

type DrinkType =
  | "Wine"
  | "Beer"
  | "Whiskey"
  | "Vodka"
  | "Rum"
  | "Gin"
  | "Tequila"
  | "Other";
type Range = 7 | 30 | 90;

interface AlcoholEntry {
  id: string;
  date: string; // YYYY-MM-DD
  type: DrinkType;
  ounces: number;
  notes?: string;
  kcal: number; // computed on save
  carbs: number; // computed on save
}

// ---- UTIL ---------------------------------------------------------------
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const keyOf = (type: string) => {
  const k = type.toLowerCase();
  if (k.includes("beer")) return "beer";
  if (k.includes("wine")) return "wine";
  if (k.includes("whiskey")) return "whiskey";
  if (k.includes("vodka")) return "vodka";
  if (k.includes("rum")) return "rum";
  if (k.includes("gin")) return "gin";
  if (k.includes("tequila")) return "tequila";
  return "other";
};
const load = (): AlcoholEntry[] => {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
};
const save = (rows: AlcoholEntry[]) => {
  localStorage.setItem(LS_KEY, JSON.stringify(rows));
};

// ---- PAGE ---------------------------------------------------------------
export default function AlcoholLogPage() {
  const [, setLocation] = useLocation();

  // form
  const [type, setType] = useState<DrinkType>("Wine");
  const [ounces, setOunces] = useState<string>("");
  const [date, setDate] = useState<string>(today());
  const [notes, setNotes] = useState<string>("");

  // data
  const [rows, setRows] = useState<AlcoholEntry[]>(() => load());
  const [range, setRange] = useState<Range>(30);

  // derived
  const windowed = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - (range - 1));
    const sISO = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
    ).getTime();
    return rows
      .filter((r) => new Date(r.date + "T12:00:00").getTime() >= sISO)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [rows, range]);

  const groupedByDate = useMemo(() => {
    const map = new Map<
      string,
      { date: string; drinks: number; kcal: number; carbs: number }
    >();
    for (const r of windowed) {
      const g = map.get(r.date) || {
        date: r.date,
        drinks: 0,
        kcal: 0,
        carbs: 0,
      };
      // 1 standard drink ~ 14g alcohol; here we simply count ounces as "drink units" visual
      g.drinks += r.ounces ? Math.round((r.ounces / 12) * 10) / 10 : 0; // optional: normalize; or just count entries
      g.kcal += r.kcal;
      g.carbs += r.carbs;
      map.set(r.date, g);
    }
    // Fill missing dates with zero for clean charts
    const out: typeof map extends Map<any, infer V> ? V[] : never = [];
    const days = range;
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      out.push(map.get(iso) || { date: iso, drinks: 0, kcal: 0, carbs: 0 });
    }
    return out;
  }, [windowed, range]);

  const totals = useMemo(() => {
    return groupedByDate.reduce(
      (acc, d) => {
        acc.drinks += d.drinks;
        acc.kcal += d.kcal;
        acc.carbs += d.carbs;
        return acc;
      },
      { drinks: 0, kcal: 0, carbs: 0 },
    );
  }, [groupedByDate]);

  // actions
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const oz = Number(ounces);
    if (!oz || oz <= 0) return;

    const per = DRINK_PER_OZ[keyOf(type)];
    const entry: AlcoholEntry = {
      id: crypto.randomUUID(),
      date,
      type,
      ounces: oz,
      notes: notes || undefined,
      kcal: Math.round(per.kcalPerOz * oz),
      carbs: Math.round(per.carbsPerOz * oz),
    };

    const next = [entry, ...rows].sort(
      (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
    );
    setRows(next);
    save(next);

    // optional server sync (fire-and-forget)
    if (SYNC_ENDPOINT) {
      fetch(SYNC_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry }),
      }).catch(() => void 0);
    }

    setOunces("");
    setNotes("");
    setDate(today());

    // Emit added event after successful log entry
    setTimeout(() => {
      const event = new CustomEvent("walkthrough:event", {
        detail: { testId: "alcohollog-added", event: "done" },
      });
      window.dispatchEvent(event);
    }, 300);
  };

  const remove = (id: string) => {
    const next = rows.filter((r) => r.id !== id);
    setRows(next);
    save(next);
  };

  // UI helpers
  const Icon = ({ t }: { t: DrinkType }) => {
    const k = t.toLowerCase();
    if (k.includes("wine")) return <Wine className="h-4 w-4" />;
    if (k.includes("beer")) return <Beer className="h-4 w-4" />;
    return <Martini className="h-4 w-4" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav">
      {/* Universal Safe-Area Header */}
      <div
        className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-8 py-3 flex items-center gap-3">
          {/* Back Button */}
          <button
            onClick={() => setLocation("/alcohol-hub")}
            className="flex items-center gap-1 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg"
            data-testid="button-back-to-hub"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>

          {/* Title */}
          <h1 className="text-lg font-bold text-white">Alcohol Log</h1>
        </div>
      </div>

      <div
        className="max-w-4xl mx-auto px-4 pb-12"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        

        {/* Form */}
        <Card className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <Plus className="h-5 w-5" />
              Log Entry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={submit}
              className="grid md:grid-cols-4 gap-4 text-white"
            >
              <div className="md:col-span-1">
                <Label className="text-sm text-white">Type</Label>
                <Select
                  value={type}
                  onValueChange={(v) => setType(v as DrinkType)}
                >
                  <SelectTrigger className="bg-black/20 border-white/20 text-white mt-2">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent className="bg-black/90 border-white/20 text-white">
                    {[
                      "Wine",
                      "Beer",
                      "Whiskey",
                      "Vodka",
                      "Rum",
                      "Gin",
                      "Tequila",
                      "Other",
                    ].map((t) => (
                      <SelectItem
                        key={t}
                        value={t}
                        className="text-white hover:bg-white/10"
                      >
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-1">
                <Label className="text-white">Ounces</Label>
                <Input
                  inputMode="decimal"
                  value={ounces}
                  onChange={(e) => setOunces(e.target.value)}
                  placeholder="e.g., 5"
                  className="mt-2 bg-black/20 border-white/20 text-white"
                  data-testid="input-ounces"
                />
              </div>

              <div className="md:col-span-1">
                <Label className="text-white">Date</Label>
                <Input
                  type="date"
                  value={date}
                  max={today()}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-2 bg-black/20 border-white/20 text-white"
                  data-testid="input-date"
                />
              </div>

              <div className="md:col-span-1">
                <Label className="text-white">Notes (optional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Context/mood…"
                  className="mt-2 bg-black/20 border-white/20 text-white"
                  data-testid="input-notes"
                />
              </div>

              <div className="md:col-span-4">
                <Button
                  type="submit"
                  className="w-full bg-white/10 border border-white/20 text-white hover:bg-white/20"
                  data-testid="alcohollog-add"
                >
                  Save Entry
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Range + badges */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex gap-2">
            {[7, 30, 90].map((r) => (
              <Button
                key={r}
                onClick={() => setRange(r as Range)}
                className={`bg-black/20 border border-white/20 text-white hover:bg-black/30 ${range === r ? "ring-2 ring-white/40" : ""}`}
                data-testid={`button-range-${r}`}
              >
                Last {r} days
              </Button>
            ))}
          </div>
          <div className="text-sm text-white/90">
            <span className="mr-4">
              <strong>{Math.round(totals.drinks * 10) / 10}</strong> drinks
            </span>
            <span className="mr-4">
              <strong>{totals.kcal}</strong> kcal
            </span>
            <span>
              <strong>{Math.round(totals.carbs)}</strong> g carbs
            </span>
          </div>
        </div>

        {/* Chart */}
        <Card className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur mb-8">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Daily Drinks (Last {range} Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <BarChart data={groupedByDate}>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: "#fff" }}
                    tickFormatter={(v) => {
                      const d = new Date(v + "T12:00:00");
                      return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 12, fill: "#fff" }} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(0,0,0,0.9)",
                      border: "1px solid #333",
                      color: "#fff",
                      borderRadius: 8,
                    }}
                    labelFormatter={(label) =>
                      new Date(label + "T12:00:00").toLocaleDateString()
                    }
                    formatter={(value: any, name: any) => [
                      value,
                      name === "drinks" ? "Drinks" : name,
                    ]}
                  />
                  <Bar dataKey="drinks" fill="#f97316" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent entries */}
        <Card className="rounded-2xl border border-zinc-800 bg-zinc-900/40 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg text-white">Recent Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <div className="text-center py-8 text-white/70">
                <Wine className="h-10 w-10 mx-auto mb-3 opacity-60" />
                <p>No entries yet. Log your first one above.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rows.slice(0, 30).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-4 bg-black/20 border border-white/10 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <Icon t={r.type} />
                      <div>
                        <div className="text-white font-medium">
                          {r.ounces} oz {r.type}
                        </div>
                        <div className="text-xs text-white/60">
                          {new Date(r.date + "T12:00:00").toLocaleDateString()}{" "}
                          • {r.kcal} kcal • {r.carbs} g carbs
                        </div>
                        {r.notes && (
                          <div className="text-sm text-white/80 mt-1">
                            "{r.notes}"
                          </div>
                        )}
                      </div>
                    </div>
                    <TrashButton
                      size="sm"
                      onClick={() => remove(r.id)}
                      confirm
                      confirmMessage="Delete this alcohol log?"
                      ariaLabel="Delete entry"
                      title="Delete entry"
                      data-testid={`button-delete-${r.id}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
