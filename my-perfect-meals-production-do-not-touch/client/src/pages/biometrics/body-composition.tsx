import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Scale, Ruler, Calendar as CalIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Method = "DEXA" | "BodPod" | "Calipers" | "Smart Scale" | "Other";
type Units = "imperial" | "metric";

type SavedEntry = {
  date: string;
  method: Method;
  units: Units;
  weight: string;
  height: string;
  bodyFatPct: string;
  waist: string;
};

export default function BodyCompositionPro() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [units, setUnits] = useState<Units>("imperial");
  const [method, setMethod] = useState<Method>("DEXA");
  const [date, setDate] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [bodyFatPct, setBodyFatPct] = useState<string>("");
  const [waist, setWaist] = useState<string>("");
  const [history, setHistory] = useState<SavedEntry[]>([]);

  useEffect(() => {
    document.title = "Body Composition | My Perfect Meals";
    loadHistory();
    const saved = localStorage.getItem("biometrics.bodyComp");
    if (saved) {
      try {
        const j = JSON.parse(saved);
        setUnits(j.units ?? "imperial");
        setMethod(j.method ?? "DEXA");
        setDate(j.date ?? "");
        setWeight(j.weight ?? "");
        setHeight(j.height ?? "");
        setBodyFatPct(j.bodyFatPct ?? "");
        setWaist(j.waist ?? "");
      } catch {}
    }
  }, []);

  const loadHistory = () => {
    try {
      const saved = localStorage.getItem("biometrics.bodyComp.history");
      if (saved) {
        const entries: SavedEntry[] = JSON.parse(saved);
        setHistory(entries.sort((a, b) => (b.date || "").localeCompare(a.date || "")));
      }
    } catch {}
  };

  const toNumber = (v: string) => (v ? Number(v) : NaN);

  const derived = useMemo(() => {
    const w = toNumber(weight);
    const h = toNumber(height);
    const bf = toNumber(bodyFatPct);

    if (!isFinite(w) || !isFinite(h) || !isFinite(bf)) {
      return null;
    }

    const kg = units === "imperial" ? w * 0.45359237 : w;
    const cm = units === "imperial" ? h * 2.54 : h;
    const m = cm / 100;

    const bmi = kg / (m * m);
    const fatMassKg = kg * (bf / 100);
    const leanMassKg = kg - fatMassKg;

    const ffmi = leanMassKg / (m * m);

    const waistNum = toNumber(waist);
    const whtr = isFinite(waistNum)
      ? units === "imperial"
        ? (waistNum * 2.54) / cm
        : waistNum / cm
      : null;

    return { kg, cm, m, bmi, fatMassKg, leanMassKg, ffmi, whtr };
  }, [units, weight, height, bodyFatPct, waist]);

  const save = () => {
    const payload = { units, method, date, weight, height, bodyFatPct, waist };
    localStorage.setItem("biometrics.bodyComp", JSON.stringify(payload));
    
    const entry: SavedEntry = { ...payload };
    const existingHistory = localStorage.getItem("biometrics.bodyComp.history");
    const historyList: SavedEntry[] = existingHistory ? JSON.parse(existingHistory) : [];
    historyList.push(entry);
    localStorage.setItem("biometrics.bodyComp.history", JSON.stringify(historyList));
    loadHistory();
    
    toast({
      title: "✅ Data Saved",
      description: "Your body composition measurements have been saved successfully.",
    });
  };

  return (
    <div
      className="min-h-screen p-4 md:p-6 text-white
      bg-gradient-to-br from-black/60 via-orange-600 to-black/80"
    >
      <div className="fixed top-4 left-4 z-50">
        <Button
          onClick={() => setLocation("/my-biometrics")}
          className="bg-black/10 blur-none border border-white/20 text-white hover:bg-black/20 rounded-2xl w-10 h-10 p-0"
          aria-label="Back to Biometrics"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      <div className="max-w-5xl mx-auto space-y-6">
        <div className="mt-16 relative isolate text-center rounded-2xl px-6 py-6
          bg-white/5 backdrop-blur-2xl border border-white/10 shadow-xl">
          <span className="absolute inset-0 -z-0 pointer-events-none rounded-2xl
                           bg-gradient-to-r from-white/10 via-transparent to-white/5" />
          <h1 className="relative z-10 text-2xl md:text-2xl font-bold">Body Composition (Pro)</h1>
          <p className="relative z-10 mt-2 text-white/85 text-md">
            Record results from DEXA, BodPod, calipers, or smart scales. We'll compute the rest.
          </p>
        </div>

        <Card className="relative isolate bg-white/5 backdrop-blur-2xl border border-white/10 shadow-xl rounded-2xl">
          <span className="absolute inset-0 -z-0 pointer-events-none rounded-2xl
                           bg-gradient-to-br from-white/10 via-transparent to-white/5" />
          <CardHeader className="relative z-10">
            <CardTitle className="text-white flex items-center gap-2 text-lg">
              <Scale className="h-5 w-5" /> Enter Measurements
            </CardTitle>
            <CardDescription className="text-white/80 text-md">
              Use consistent conditions (time of day, hydration, clothing) for best trending.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-white/85">Assessment Method</label>
              <Select value={method} onValueChange={(v: Method) => setMethod(v)}>
                <SelectTrigger className="bg-black/30 border-white/10 text-white">
                  <SelectValue placeholder="Pick a method" />
                </SelectTrigger>
                <SelectContent className="bg-black/80 text-white border border-white/10">
                  {["DEXA", "BodPod", "Calipers", "Smart Scale", "Other"].map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/85">Date</label>
              <div className="flex items-center gap-2">
                <CalIcon className="h-4 w-4 text-white/80" />
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-black/30 border-white/10 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/85">Units</label>
              <Select value={units} onValueChange={(v: Units) => setUnits(v)}>
                <SelectTrigger className="bg-black/30 border-white/10 text-white">
                  <SelectValue placeholder="Units" />
                </SelectTrigger>
                <SelectContent className="bg-black/80 text-white border border-white/10">
                  <SelectItem value="imperial">Imperial (lb / in)</SelectItem>
                  <SelectItem value="metric">Metric (kg / cm)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/85">
                Body Weight ({units === "imperial" ? "lb" : "kg"})
              </label>
              <Input
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="bg-black/30 border-white/10 text-white"
                placeholder={units === "imperial" ? "e.g., 185" : "e.g., 84"}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/85">
                Height ({units === "imperial" ? "in" : "cm"})
              </label>
              <div className="flex items-center gap-2">
                <Ruler className="h-4 w-4 text-white/80" />
                <Input
                  inputMode="decimal"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="bg-black/30 border-white/10 text-white"
                  placeholder={units === "imperial" ? "e.g., 71" : "e.g., 180"}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/85">Body Fat %</label>
              <Input
                inputMode="decimal"
                value={bodyFatPct}
                onChange={(e) => setBodyFatPct(e.target.value)}
                className="bg-black/30 border-white/10 text-white"
                placeholder="e.g., 18"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-white/85">
                Waist ({units === "imperial" ? "in" : "cm"}) (optional)
              </label>
              <Input
                inputMode="decimal"
                value={waist}
                onChange={(e) => setWaist(e.target.value)}
                className="bg-black/30 border-white/10 text-white"
                placeholder={units === "imperial" ? "e.g., 34" : "e.g., 86"}
              />
            </div>

            <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
              <Button
                onClick={save}
                className="relative isolate rounded-xl px-4 py-2
                bg-white/5 backdrop-blur-2xl border border-white/10
                           text-white shadow-md hover:bg-black/50 transition-colors"
              >
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="relative isolate bg-black/30 backdrop-blur-md border border-white/10 shadow-xl rounded-2xl">
          <span className="absolute inset-0 -z-0 pointer-events-none rounded-2xl
                           bg-gradient-to-br from-white/10 via-transparent to-white/5" />
          <CardHeader className="relative z-10">
            <CardTitle className="text-lg text-white">Derived Metrics</CardTitle>
            <CardDescription className="text-white/80">
              Instant calculations based on your inputs
            </CardDescription>
          </CardHeader>
          <CardContent className="relative z-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {derived ? (
              <>
                <div className="p-4 rounded-xl bg-black/25 border border-white/10">
                  <div className="text-sm text-white/80">BMI</div>
                  <div className="text-md font-semibold text-white">{derived.bmi.toFixed(1)}</div>
                </div>
                <div className="p-4 rounded-xl bg-black/25 border border-white/10">
                  <div className="text-sm text-white/80">Fat Mass</div>
                  <div className="text-md font-semibold text-white">
                    {units === "imperial"
                      ? `${(derived.fatMassKg * 2.20462).toFixed(1)} lb`
                      : `${derived.fatMassKg.toFixed(1)} kg`}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-black/25 border border-white/10">
                  <div className="text-sm text-white/80">Lean Mass</div>
                  <div className="text-md font-semibold text-white">
                    {units === "imperial"
                      ? `${(derived.leanMassKg * 2.20462).toFixed(1)} lb`
                      : `${derived.leanMassKg.toFixed(1)} kg`}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-black/25 border border-white/10">
                  <div className="text-sm text-white/80">FFMI</div>
                  <div className="text-md font-semibold text-white">{derived.ffmi.toFixed(1)}</div>
                </div>
                <div className="p-4 rounded-xl bg-black/25 border border-white/10">
                  <div className="text-sm text-white/80">Waist-to-Height</div>
                  <div className="text-md font-semibold text-white">
                    {derived.whtr ? derived.whtr.toFixed(2) : "—"}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-white/80 text-sm">
                Enter weight, height, and body fat % to see results.
              </div>
            )}
          </CardContent>
        </Card>

        {history.length > 0 && (
          <Card className="relative isolate bg-black/30 backdrop-blur-md border border-white/10 shadow-xl rounded-2xl">
            <span className="absolute inset-0 -z-0 pointer-events-none rounded-2xl
                             bg-gradient-to-br from-white/10 via-transparent to-white/5" />
            <CardHeader className="relative z-10">
              <CardTitle className="text-white">Saved History</CardTitle>
              <CardDescription className="text-white/80">
                Your recorded body composition measurements
              </CardDescription>
            </CardHeader>
            <CardContent className="relative z-10 space-y-3">
              {history.slice(0, 5).map((entry, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-black/25 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-white font-semibold">{entry.date || "No date"}</div>
                    <div className="text-white/60 text-sm">{entry.method}</div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div>
                      <div className="text-white/60">Weight</div>
                      <div className="text-white">{entry.weight} {entry.units === "imperial" ? "lb" : "kg"}</div>
                    </div>
                    <div>
                      <div className="text-white/60">Height</div>
                      <div className="text-white">{entry.height} {entry.units === "imperial" ? "in" : "cm"}</div>
                    </div>
                    <div>
                      <div className="text-white/60">Body Fat</div>
                      <div className="text-white">{entry.bodyFatPct}%</div>
                    </div>
                    {entry.waist && (
                      <div>
                        <div className="text-white/60">Waist</div>
                        <div className="text-white">{entry.waist} {entry.units === "imperial" ? "in" : "cm"}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {history.length > 5 && (
                <div className="text-center text-white/60 text-sm pt-2">
                  Showing 5 most recent entries (total: {history.length})
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
      </div>
    </div>
  );
}
