import { useMemo, useState } from "react";
import { apiUrl } from '@/lib/resolveApiBase';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronsDown, ChevronsUp, Beef, Utensils, Sandwich, Coffee,
  Save, UploadCloud, Check, Loader2
} from "lucide-react";

type Goal = "loss" | "maintain" | "gain";
type Sex = "female" | "male";
type Unit = "lb" | "kg";

interface Range { min: number; max: number; } // g/kg or g/lb depending on unit

// ---- Evidence-based base ranges in g/kg ----
const GOAL_RANGES_G_PER_KG: Record<Goal, Range> = {
  loss: { min: 1.6, max: 2.4 },
  maintain: { min: 1.4, max: 2.0 },
  gain: { min: 1.6, max: 2.2 },
};

const SEX_NOTES: Record<Goal, { female: string; male: string }> = {
  loss: {
    female: "Aim toward the higher end (≈2.0–2.4 g/kg) when cutting—preserves lean mass and helps with hunger.",
    male:   "2.0–2.4 g/kg during a cut retains muscle; dip to ~1.8 g/kg only if calories are tight.",
  },
  maintain: {
    female: "1.4–1.8 g/kg covers recovery; go to ~2.0 g/kg on heavy weeks.",
    male:   "1.6–2.0 g/kg keeps performance strong; 1.4–1.6 g/kg is fine on lighter weeks.",
  },
  gain: {
    female: "1.6–2.0 g/kg is enough in a surplus—growth rides carbs + training volume.",
    male:   "1.6–2.2 g/kg works; extra protein beyond this rarely adds muscle vs. more carbs.",
  },
};

function toKg(weight: number, unit: Unit): number { return unit === "kg" ? weight : weight / 2.2046226218; }
function toLb(weightKg: number): number { return weightKg * 2.2046226218; }
function kgRangeToUnit(range: Range, unit: Unit): Range {
  if (unit === "kg") return range;
  const f = 2.2046226218;
  return { min: range.min * f, max: range.max * f }; // g/lb
}
function perMealSplit(total: number, meals = 4) {
  const even = Math.round((total / meals) * 10) / 10;
  return [even, even, even, even];
}
function GoalTitle({ goal }: { goal: Goal }) {
  return <>{goal === "loss" ? "Weight Loss (Cut)" : goal === "maintain" ? "Maintenance" : "Muscle Gain (Bulk)"}</>;
}

function MealChips() {
  const chips = [
    { label: "Breakfast", icon: Coffee },
    { label: "Lunch", icon: Sandwich },
    { label: "Dinner", icon: Utensils },
    { label: "Snack", icon: Beef },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <Badge key={c.label} variant="secondary" className="bg-white/10 text-white backdrop-blur rounded-full px-3 py-1">
          <c.icon className="h-4 w-4 mr-1" /> {c.label}
        </Badge>
      ))}
    </div>
  );
}

// --- API helpers ---
async function saveProteinTarget(params: {
  userId: string;
  goal: Goal;
  unit: Unit;
  weight: number;
  dailyTargetGrams: number;
  rangeUnitLabel: string; // "g/kg" or "g/lb"
  minFactor: number; // e.g., 1.6
  maxFactor: number; // e.g., 2.4
}) {
  const res = await fetch(apiUrl(`/api/users/${params.userId}/macros/protein-target`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function distributeProteinToMeals(params: {
  userId: string;
  weekStartISO: string;        // Monday or your canonical week anchor
  dailyTargetGrams: number;    // total per day
  mealsPerDay: number;         // 3 or 4
  goal: Goal;
}) {
  const res = await fetch(apiUrl(`/api/users/${params.userId}/meal-plan/distribute-protein`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function GoalCard({
  goal, sex, weight, unit, userId, weekStartISO, mealsPerDay = 4,
}: {
  goal: Goal; sex: Sex; weight: number; unit: Unit;
  userId: string; weekStartISO: string; mealsPerDay?: number;
}) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { rangeUnit, totalMin, totalMax, perMealMin, perMealMax, minFactor, maxFactor } = useMemo(() => {
    const base = GOAL_RANGES_G_PER_KG[goal];
    const r = kgRangeToUnit(base, unit);          // factors expressed in chosen unit (g/kg or g/lb)
    const w = weight;
    const totalMin = Math.round(r.min * w);
    const totalMax = Math.round(r.max * w);
    const [b1, l1, d1, s1] = perMealSplit(totalMin, mealsPerDay);
    const [b2, l2, d2, s2] = perMealSplit(totalMax, mealsPerDay);
    return {
      rangeUnit: unit === "kg" ? "g/kg" : "g/lb",
      totalMin, totalMax,
      perMealMin: [b1, l1, d1, s1],
      perMealMax: [b2, l2, d2, s2],
      minFactor: base.min, maxFactor: base.max, // preserve true factors (always g/kg) for record
    };
  }, [goal, unit, weight, mealsPerDay]);

  // Target selector (min/mid/max/custom)
  const defaultMid = Math.round((totalMin + totalMax) / 2);
  const [targetMode, setTargetMode] = useState<"min"|"mid"|"max"|"custom">("mid");
  const [customTarget, setCustomTarget] = useState<number>(defaultMid);
  const selectedTarget =
    targetMode === "min" ? totalMin : targetMode === "max" ? totalMax : targetMode === "custom" ? customTarget : defaultMid;

  const perMealNow = perMealSplit(selectedTarget, mealsPerDay);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveProteinTarget({
        userId,
        goal,
        unit,
        weight,
        dailyTargetGrams: selectedTarget,
        rangeUnitLabel: rangeUnit,
        minFactor,
        maxFactor,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["userProfile", userId] });
      toast({ title: "Protein target saved", description: `Saved ${selectedTarget} g/day to your profile.` });
    },
    onError: (e: any) => {
      toast({ title: "Save failed", description: String(e?.message ?? e), variant: "destructive" });
    },
  });

  const distMutation = useMutation({
    mutationFn: () =>
      distributeProteinToMeals({
        userId,
        weekStartISO,
        dailyTargetGrams: selectedTarget,
        mealsPerDay,
        goal,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weeklyMealPlan", userId, weekStartISO] });
      toast({ title: "Distributed", description: `Applied ${selectedTarget} g/day across ${mealsPerDay} meals.` });
    },
    onError: (e: any) => {
      toast({ title: "Distribution failed", description: String(e?.message ?? e), variant: "destructive" });
    },
  });

  return (
    <Card className="bg-black/30 text-white border-white/10 backdrop-blur-md">
      <CardHeader>
        <CardTitle className="text-xl font-semibold tracking-tight"><GoalTitle goal={goal} /></CardTitle>
        <div className="mt-2"><MealChips /></div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Headline numbers */}
        <div className="rounded-xl bg-white/5 p-4">
          <div className="text-sm text-zinc-300">Daily protein target range</div>
          <div className="text-2xl font-bold">{totalMin}–{totalMax} g/day</div>
          <div className="text-xs text-zinc-400 mt-1">Based on {minFactor}–{maxFactor} {rangeUnit}.</div>
        </div>

        {/* Per-meal quick split (range) */}
        <div className="rounded-xl bg-white/5 p-4">
          <div className="text-sm text-zinc-300 mb-2">Per-meal guide (even split)</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            {["Breakfast", "Lunch", "Dinner", mealsPerDay === 4 ? "Snack" : "—"].map((label, i) => (
              <div key={i} className="rounded-lg bg-white/5 p-3">
                <div className="text-zinc-400">{label}</div>
                <div className="font-semibold">
                  {perMealMin[i] ?? 0}–{perMealMax[i] ?? 0} g
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Choose exact target */}
        <div className="rounded-xl bg-white/5 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Label className="text-zinc-200">Select your daily target</Label>
            <div className="flex gap-2">
              <Button
                variant={targetMode === "min" ? "default" : "secondary"}
                size="sm"
                onClick={() => setTargetMode("min")}
                data-testid={`btn-${goal}-min`}
              >
                Min ({totalMin}g)
              </Button>
              <Button
                variant={targetMode === "mid" ? "default" : "secondary"}
                size="sm"
                onClick={() => setTargetMode("mid")}
                data-testid={`btn-${goal}-mid`}
              >
                Mid ({defaultMid}g)
              </Button>
              <Button
                variant={targetMode === "max" ? "default" : "secondary"}
                size="sm"
                onClick={() => setTargetMode("max")}
                data-testid={`btn-${goal}-max`}
              >
                Max ({totalMax}g)
              </Button>
              <Button
                variant={targetMode === "custom" ? "default" : "secondary"}
                size="sm"
                onClick={() => setTargetMode("custom")}
                data-testid={`btn-${goal}-custom`}
              >
                Custom
              </Button>
            </div>
          </div>

          {targetMode === "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
              <div className="sm:col-span-4 px-1">
                <Slider
                  value={[customTarget]}
                  onValueChange={(v) => setCustomTarget(v[0] ?? defaultMid)}
                  min={totalMin}
                  max={totalMax}
                  step={1}
                />
              </div>
              <Input
                inputMode="numeric"
                value={customTarget}
                onChange={(e) => setCustomTarget(Math.max(totalMin, Math.min(totalMax, Number(e.target.value || defaultMid))))}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
          )}

          <div className="text-xs text-zinc-400">
            Selected: <span className="font-semibold text-zinc-200">{selectedTarget} g/day</span> → {mealsPerDay} meals ={" "}
            <span className="font-semibold text-zinc-200">{perMealNow.join("g • ")}g</span>
          </div>
        </div>

        <Separator className="bg-white/10" />

        {/* Collapsible detail */}
        <Collapsible open={open} onOpenChange={setOpen}>
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-zinc-200">Why this works & exact guidance</div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="text-white">
                {open ? <>Hide details <ChevronsUp className="h-4 w-4 ml-1" /></> : <>Show more <ChevronsDown className="h-4 w-4 ml-1" /></>}
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent className="mt-3 space-y-4">
            {/* Why this works */}
            <div className="rounded-xl bg-white/5 p-4 leading-relaxed text-sm text-zinc-200">
              {goal === "loss" && (
                <>
                  <p className="mb-2">Cutting? Higher protein preserves lean mass, increases fullness, and protects performance.</p>
                  <p>Keep protein steady; flex carbs/fats to tune deficit.</p>
                </>
              )}
              {goal === "maintain" && (
                <>
                  <p className="mb-2">At maintenance, mid-range protein recovers you without stealing carbs (best training fuel).</p>
                  <p>Spread over 3–4 feedings to maximize MPS pulses.</p>
                </>
              )}
              {goal === "gain" && (
                <>
                  <p className="mb-2">In a surplus, growth is driven by training volume + calories. Protein in the mid-high range is enough.</p>
                  <p>Use carbs around training for horsepower.</p>
                </>
              )}
            </div>

            {/* Men vs Women clarity */}
            <div className="rounded-xl bg-white/5 p-4 text-sm">
              <div className="font-semibold text-zinc-100 mb-2">Men vs. Women — read this first</div>
              <ul className="list-disc pl-4 space-y-2 text-zinc-200">
                <li><span className="font-medium">Women:</span> {SEX_NOTES[goal].female}</li>
                <li><span className="font-medium">Men:</span> {SEX_NOTES[goal].male}</li>
                <li>Older lifters or anyone dieting hard: favor the higher end.</li>
              </ul>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      <CardFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-zinc-400">Tip: Set a repeating snack to backstop low-protein days.</div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            data-testid={`btn-${goal}-copy-to-profile`}
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Copy to Profile Targets
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => distMutation.mutate()}
            disabled={distMutation.isPending}
            data-testid={`btn-${goal}-distribute-to-meals`}
          >
            {distMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UploadCloud className="h-4 w-4 mr-2" />}
            Distribute to Meals
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

export default function ProteinGuidelinesCards({
  userId = "00000000-0000-0000-0000-000000000001",
  weekStartISO = "2025-01-01",
  mealsPerDay = 4,
}: {
  userId?: string;
  weekStartISO?: string; // e.g., "2025-09-01"
  mealsPerDay?: number;
}) {
  const [unit, setUnit] = useState<Unit>("lb");
  const [sex, setSex] = useState<Sex>("female");
  const [weightInput, setWeightInput] = useState<string>("150");

  const weightNum = Number(weightInput || 0);
  const safeWeight = Math.max(1, Math.min(999, isNaN(weightNum) ? 0 : weightNum));
  const weightKg = unit === "kg" ? safeWeight : toKg(safeWeight, "lb");

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="rounded-2xl bg-gradient-to-b from-black via-zinc-950 to-black border border-white/10 p-4 sm:p-6 text-white">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-zinc-200">Body weight</Label>
            <div className="flex gap-2 mt-2">
              <Input
                inputMode="decimal"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
                placeholder={unit === "lb" ? "e.g. 150" : "e.g. 68"}
                data-testid="input-bodyweight"
              />
              <Select value={unit} onValueChange={(v: Unit) => (v ? setUnit(v) : null)}>
                <SelectTrigger className="w-[110px] bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 text-white border-white/10">
                  <SelectItem value="lb">lb</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-zinc-400 mt-1">({weightKg.toFixed(1)} kg · {toLb(weightKg).toFixed(0)} lb)</div>
          </div>

          <div>
            <Label className="text-zinc-200">Sex</Label>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setSex("female")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  sex === "female"
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white/10 text-white/70 border-white/20 hover:bg-white/20"
                } border`}
              >
                Female
              </button>
              <button
                type="button"
                onClick={() => setSex("male")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  sex === "male"
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white/10 text-white/70 border-white/20 hover:bg-white/20"
                } border`}
              >
                Male
              </button>
            </div>
          </div>

          <div className="text-sm text-zinc-300 self-end">
            <p className="mb-1"><span className="font-semibold">How to use:</span> Pick weight & sex, then choose your exact target on a card and save/distribute.</p>
            <p className="text-zinc-400">Clean top chips. Long explanations tucked behind "Show more".</p>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GoalCard goal="loss" sex={sex} weight={safeWeight} unit={unit} userId={userId} weekStartISO={weekStartISO} mealsPerDay={mealsPerDay} />
        <GoalCard goal="maintain" sex={sex} weight={safeWeight} unit={unit} userId={userId} weekStartISO={weekStartISO} mealsPerDay={mealsPerDay} />
        <GoalCard goal="gain" sex={sex} weight={safeWeight} unit={unit} userId={userId} weekStartISO={weekStartISO} mealsPerDay={mealsPerDay} />
      </div>
    </div>
  );
}