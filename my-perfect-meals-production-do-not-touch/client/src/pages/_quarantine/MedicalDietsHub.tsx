// client/src/pages/MedicalDietsHub.tsx
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ArrowUp,
  ArrowRight,
  Stethoscope,
  Droplets,
  Soup,
  Blend,
  BarChart3,
  ShoppingCart,
  Heart,
  Users,
  Apple,
  Info,
} from "lucide-react";
import { ACCENTS } from "@/lib/accents";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import BuilderDayBoard from "@/components/BuilderDayBoard";
import { useBuilderPlan } from "@/hooks/useBuilderPlan";
import type { BuilderPlanJSON, PlanDay } from "@/lib/builderPlansApi";
import { FeatureInstructions } from "@/components/FeatureInstructions";
import ShoppingAggregateBar from "@/components/ShoppingAggregateBar";
import { HORMONE_LIFE_STAGES_ENABLED } from "@/features/hormoneFeatureFlag";
import { HORMONE_PREVIEW_ENABLED } from "@/features/hormonePreviewFlag";
import { getAllHormonePresets } from "@/data/hormoneLifeStages";
import { ExportPhysicianReportButton } from "@/components/ExportPhysicianReportButton";

/** -------------------- Types -------------------- */
type DietKey =
  | "clear_liquid"
  | "full_liquid"
  | "pureed"
  | "soft"
  | "bariatric_stage2"
  | "bariatric_stage3";

type Item = {
  id: string;
  name: string;
  type: "shake" | "soup" | "broth" | "pudding" | "yogurt" | "puree" | "meal";
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  tags: string[];
  notes?: string;
};

type Protocol = {
  key: DietKey;
  label: string;
  defaultFeedings: number;
  guidance: string;
  allowedTypes: Item["type"][];
  defaultHydration: string;
};

type ExportSlot = {
  time: string;
  items: Array<{
    id: string;
    name: string;
    type: Item["type"];
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
    notes?: string;
  }>;
  totals: { kcal: number; protein: number; carbs: number; fat: number };
};

type ExportPlan = {
  source: "medical-diets-hub";
  diet: DietKey;
  feedings: number;
  kcalTarget: number;
  proteinTarget: number;
  flavorPrefs: string[];
  flags: { dairyFree: boolean; lactoseFree: boolean; lowSodium: boolean };
  slots: ExportSlot[];
  totals: { kcal: number; protein: number; carbs: number; fat: number };
  createdAt: string;
};

/** -------------------- Data: Protocols -------------------- */
const PROTOCOLS: Protocol[] = [
  {
    key: "clear_liquid",
    label: "Clear Liquid",
    defaultFeedings: 6,
    guidance:
      "Clear broths, electrolyte drinks, diluted juices (no pulp), clear protein drinks. No dairy or solid particles.",
    allowedTypes: ["broth"],
    defaultHydration:
      "Sip clear fluids throughout the day; aim ≈ 64 oz total unless restricted.",
  },
  {
    key: "full_liquid",
    label: "Full Liquid",
    defaultFeedings: 6,
    guidance:
      "Liquids you can pour: shakes, cream soups (strained), broths. Include protein-first choices.",
    allowedTypes: ["shake", "soup", "broth", "pudding", "yogurt"],
    defaultHydration:
      "Hydrate between feedings; avoid drinking 15–30 min before/after if advised.",
  },
  {
    key: "pureed",
    label: "Pureed",
    defaultFeedings: 5,
    guidance:
      "No chewing required: smooth purees (no chunks), blended meals. Protein first.",
    allowedTypes: ["puree", "soup", "pudding", "yogurt"],
    defaultHydration:
      "Slow sips across the day; separate liquids from meals if instructed.",
  },
  {
    key: "soft",
    label: "Soft / Mechanical Soft",
    defaultFeedings: 5,
    guidance:
      "Very tender, easy-to-chew foods; in this hub we emphasize soups/purees + soft puddings/yogurts.",
    allowedTypes: ["soup", "puree", "pudding", "yogurt"],
    defaultHydration: "Hydrate evenly; small sips between meals.",
  },
  {
    key: "bariatric_stage2",
    label: "Bariatric Stage 2 (Full Liquids)",
    defaultFeedings: 6,
    guidance:
      "Small volumes, high protein, low sugar. Lactose-free options often preferred. Follow your surgeon’s protocol.",
    allowedTypes: ["shake", "broth", "soup", "pudding", "yogurt"],
    defaultHydration:
      "Sips every 5–10 minutes; do not chug. Follow clinic guidance.",
  },
  {
    key: "bariatric_stage3",
    label: "Bariatric Stage 3 (Pureed/Soft)",
    defaultFeedings: 5,
    guidance:
      "Smooth purees, slow pace, protein-first. Avoid chunks and tough fibers.",
    allowedTypes: ["puree", "soup", "pudding", "yogurt"],
    defaultHydration: "Separate fluids from meals per surgeon’s rules.",
  },
];

/** -------------------- Data: Items Library (curated) -------------------- */
const ITEMS: Item[] = [
  // Shakes
  {
    id: "shake-vanilla1",
    name: "Vanilla Whey Shake (water)",
    type: "shake",
    kcal: 180,
    protein: 30,
    carbs: 6,
    fat: 3,
    tags: ["vanilla", "bariatric_ok"],
  },
  {
    id: "shake-choc1",
    name: "Chocolate Whey Shake (water)",
    type: "shake",
    kcal: 190,
    protein: 30,
    carbs: 8,
    fat: 4,
    tags: ["chocolate", "bariatric_ok"],
  },
  {
    id: "shake-plant1",
    name: "Plant Protein Shake (unsweetened almond milk)",
    type: "shake",
    kcal: 210,
    protein: 25,
    carbs: 9,
    fat: 8,
    tags: ["vanilla", "dairy_free", "lactose_free", "bariatric_ok"],
  },
  {
    id: "shake-iso1",
    name: "Isolate Clear Protein Drink (citrus)",
    type: "shake",
    kcal: 90,
    protein: 20,
    carbs: 1,
    fat: 0,
    tags: ["fruit", "clear", "dairy_free", "lactose_free", "bariatric_ok"],
  },

  // Soups / Broths
  {
    id: "soup-bone1",
    name: "Bone Broth (strained)",
    type: "broth",
    kcal: 40,
    protein: 9,
    carbs: 0,
    fat: 0,
    tags: [
      "clear",
      "savory",
      "low_sodium",
      "dairy_free",
      "lactose_free",
      "bariatric_ok",
    ],
  },
  {
    id: "soup-chk1",
    name: "Creamy Chicken Soup (blended, strained)",
    type: "soup",
    kcal: 160,
    protein: 18,
    carbs: 10,
    fat: 5,
    tags: ["savory"],
  },
  {
    id: "soup-tom1",
    name: "Tomato Basil Soup (strained)",
    type: "soup",
    kcal: 140,
    protein: 6,
    carbs: 16,
    fat: 6,
    tags: ["savory", "vegetarian"],
  },

  // Purees / Yogurts / Puddings (soft)
  {
    id: "yog-greek1",
    name: "Greek Yogurt (plain, blended smooth)",
    type: "yogurt",
    kcal: 120,
    protein: 20,
    carbs: 6,
    fat: 0,
    tags: ["vanilla"],
  },
  {
    id: "pud-pro1",
    name: "High-Protein Pudding (ready-to-eat)",
    type: "pudding",
    kcal: 140,
    protein: 15,
    carbs: 6,
    fat: 4,
    tags: ["chocolate", "bariatric_ok"],
  },
  {
    id: "puree-chk",
    name: "Pureed Chicken + Broth (silky smooth)",
    type: "puree",
    kcal: 150,
    protein: 22,
    carbs: 2,
    fat: 6,
    tags: ["savory", "bariatric_ok"],
  },
  {
    id: "puree-bn",
    name: "Pureed Black Beans (thinned, strained)",
    type: "puree",
    kcal: 120,
    protein: 8,
    carbs: 17,
    fat: 1,
    tags: ["savory", "vegetarian"],
  },

];
const BOOSTERS: Item[] = [
  {
    id: "boost-iso",
    name: "Protein Booster (half scoop isolate)",
    type: "shake",
    kcal: 60,
    protein: 12,
    carbs: 1,
    fat: 0,
    tags: ["bariatric_ok", "vanilla"],
  },
];

/** -------------------- Helpers -------------------- */
function pickItems(
  protocol: Protocol,
  feedings: number,
  _kcalTarget: number,
  proteinTarget: number,
  opts: {
    dairyFree: boolean;
    lactoseFree: boolean;
    lowSodium: boolean;
    flavors: string[];
  },
) {
  let pool = ITEMS.filter((i) => protocol.allowedTypes.includes(i.type));
  if (opts.dairyFree)
    pool = pool.filter(
      (i) => i.tags.includes("dairy_free") || i.type === "broth",
    );
  if (opts.lactoseFree)
    pool = pool.filter(
      (i) => i.tags.includes("lactose_free") || i.type === "broth",
    );
  if (opts.lowSodium)
    pool = pool.filter(
      (i) =>
        i.tags.includes("low_sodium") ||
        i.type === "shake" ||
        i.type === "yogurt",
    );

  if (opts.flavors.length > 0) {
    const favored = pool.filter((i) =>
      i.tags.some((t) => opts.flavors.includes(t)),
    );
    if (favored.length > 0) pool = favored;
  }
  if (pool.length === 0)
    pool = ITEMS.filter((i) => protocol.allowedTypes.includes(i.type));

  const out: Item[] = [];
  for (let n = 0; n < feedings; n++) {
    const pick = pool[n % pool.length];
    out.push(pick);
  }

  // Add boosters until roughly meeting protein target
  const booster = BOOSTERS[0];
  let currentProtein = out.reduce((s, i) => s + i.protein, 0);
  let safety = 0;
  while (currentProtein < proteinTarget && safety < feedings) {
    let idx = 0;
    let minP = Infinity;
    out.forEach((it, i) => {
      if (it.protein < minP) {
        minP = it.protein;
        idx = i;
      }
    });
    out.splice(idx + 1, 0, booster);
    currentProtein += booster.protein;
    safety++;
  }
  return out;
}

function timeSlots(count: number) {
  const start = 8 * 60;
  const end = 20 * 60;
  const step = Math.floor((end - start) / Math.max(1, count - 1));
  const slots: string[] = [];
  for (let i = 0; i < count; i++) {
    const mins = start + i * step;
    const hh = String(Math.floor(mins / 60)).padStart(2, "0");
    const mm = String(mins % 60).padStart(2, "0");
    slots.push(`${hh}:${mm}`);
  }
  return slots;
}

function sumProtein(list: Item[]) {
  return list.reduce((s, it) => s + it.protein, 0);
}

/** Build normalized, slot-based export (no localStorage side-effects) */
function buildExportPlan(
  plan: Item[],
  feedings: number,
  slots: string[],
  meta: {
    diet: DietKey;
    kcalTarget: number;
    proteinTarget: number;
    flavorPrefs: string[];
    flags: { dairyFree: boolean; lactoseFree: boolean; lowSodium: boolean };
  },
): ExportPlan {
  const buckets: Item[][] = Array.from({ length: feedings }, () => []);
  let i = 0;
  for (let s = 0; s < feedings && i < plan.length; s++)
    buckets[s].push(plan[i++]);
  while (i < plan.length) {
    let minIdx = 0;
    let minProtein = sumProtein(buckets[0]);
    for (let b = 1; b < buckets.length; b++) {
      const p = sumProtein(buckets[b]);
      if (p < minProtein) {
        minProtein = p;
        minIdx = b;
      }
    }
    buckets[minIdx].push(plan[i++]);
  }

  const exportSlots: ExportSlot[] = buckets.map((items, idx) => {
    const totals = items.reduce(
      (acc, it) => {
        acc.kcal += it.kcal;
        acc.protein += it.protein;
        acc.carbs += it.carbs;
        acc.fat += it.fat;
        return acc;
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    );
    return {
      time: slots[idx],
      items: items.map((it) => ({
        id: it.id,
        name: it.name,
        type: it.type,
        kcal: it.kcal,
        protein: it.protein,
        carbs: it.carbs,
        fat: it.fat,
        notes: it.notes,
      })),
      totals,
    };
  });

  const grandTotals = exportSlots.reduce(
    (acc, s) => {
      acc.kcal += s.totals.kcal;
      acc.protein += s.totals.protein;
      acc.carbs += s.totals.carbs;
      acc.fat += s.totals.fat;
      return acc;
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return {
    source: "medical-diets-hub",
    diet: meta.diet,
    feedings,
    kcalTarget: meta.kcalTarget,
    proteinTarget: meta.proteinTarget,
    flavorPrefs: meta.flavorPrefs,
    flags: meta.flags,
    slots: exportSlots,
    totals: grandTotals,
    createdAt: new Date().toISOString(),
  };
}

// Helper: Convert Item[] plan to BuilderPlanJSON
function makeDraftFromMedicalPlan(items: Item[], numDays: number): BuilderPlanJSON {
  const lists = {
    breakfast: items.filter(it => it.type === "shake" || it.type === "pudding").slice(0, 2),
    lunch: items.filter(it => it.type === "soup" || it.type === "broth").slice(0, 2),
    dinner: items.filter(it => it.type === "soup" || it.type === "shake").slice(0, 2),
    snacks: items.filter(it => it.type === "yogurt" || it.type === "puree").slice(0, 2),
  };

  const days: PlanDay[] = [];
  for (let i = 0; i < numDays; i++) {
    days.push({
      dayIndex: i,
      lists: lists,
    });
  }

  return {
    source: "medical",
    days,
    createdAtISO: new Date().toISOString(),
  };
}

/** -------------------- Page -------------------- */
export default function MedicalDietHub() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const ui = ACCENTS.red;
  const { query, save, update, clear } = useBuilderPlan("medical");

  const [diet, setDiet] = useState<DietKey>("full_liquid");
  const currentProtocol = useMemo(
    () => PROTOCOLS.find((p) => p.key === diet)!,
    [diet],
  );

  const [feedings, setFeedings] = useState<number>(
    currentProtocol.defaultFeedings,
  );
  const [kcalTarget, setKcalTarget] = useState<number>(1500);
  const [proteinTarget, setProteinTarget] = useState<number>(100);
  const [dairyFree, setDairyFree] = useState(false);
  const [lactoseFree, setLactoseFree] = useState(false);
  const [lowSodium, setLowSodium] = useState(false);
  const [flavors, setFlavors] = useState<string[]>([]);
  const [plan, setPlan] = useState<Item[] | null>(null);

  // Draft flow state
  const [daysCount, setDaysCount] = useState<number>(3);
  const [draft, setDraft] = useState<BuilderPlanJSON | null>(null);

  const slots = useMemo(() => timeSlots(feedings), [feedings]);
  const totals = useMemo(() => {
    if (!plan) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    return plan.reduce(
      (acc, i) => {
        acc.kcal += i.kcal;
        acc.protein += i.protein;
        acc.carbs += i.carbs;
        acc.fat += i.fat;
        return acc;
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    );
  }, [plan]);

  function generate() {
    const out = pickItems(
      currentProtocol,
      feedings,
      kcalTarget,
      proteinTarget,
      { dairyFree, lactoseFree, lowSodium, flavors },
    );
    setPlan(out);
    // No localStorage usage—per Coach’s directive.
    setTimeout(
      () =>
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "smooth",
        }),
      100,
    );
  }

  function onDietChange(next: DietKey) {
    setDiet(next);
    const p = PROTOCOLS.find((x) => x.key === next)!;
    setFeedings(p.defaultFeedings);
  }

  const clientId = localStorage.getItem("pro-client-id");

  return (
    <div className={`min-h-screen ${ui.pageBg} p-6`}>
      {/* Back to Dashboard */}
      <button
        onClick={() => setLocation("/dashboard")}
        className="fixed top-4 left-4 z-[9999] isolate overflow-hidden rounded-2xl px-3 py-2 bg-white/10 backdrop-blur-none border border-white/30 text-white shadow-lg hover:bg-white/20 transition flex items-center gap-2"
        title="Back to Dashboard"
      >
        <ArrowLeft className="w-5 h-5" />
        <span className="text-sm font-medium"></span>
      </button>

      {clientId && (
        <button
          onClick={() => setLocation(`/pro/clients/${clientId}`)}
          className="fixed top-4 right-4 z-[9999] isolate overflow-hidden rounded-2xl px-3 py-2 bg-white/10 backdrop-blur-none border border-white/30 text-white shadow-lg hover:bg-white/20 transition flex items-center gap-2"
          data-testid="button-client-dashboard"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Client Dashboard</span>
        </button>
      )}

      {/* Premium Banner */}
      <div className="max-w-6xl mx-auto mb-4 mt-14">
        <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/40 rounded-2xl p-4 text-center backdrop-blur-sm">
          <span className="text-amber-200 font-semibold">🔒 Premium Feature</span>
          <span className="text-white/90 ml-2">Unlock Clinical Recovery & Protocols Hub with Premium Plan – $19.99/month</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto space-y-8">
        {/* Professional Hospital-Grade Header */}
        <Card className="bg-black/40 backdrop-blur-xl border-2 border-purple-400/40 shadow-[0_0_40px_#a855f766] rounded-2xl">
          <CardHeader className="bg-gradient-to-r from-purple-600/20 via-purple-500/10 to-purple-600/20 border-b border-purple-400/20 rounded-t-2xl text-white p-8">
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Stethoscope className="w-10 h-10 text-purple-400" />
                <CardTitle className="text-3xl font-bold">Clinical Recovery & Protocols Hub</CardTitle>
              </div>
              <p className="text-md text-white/90 max-w-3xl mx-auto">
                Evidence-based nutrition protocols for clinical practice. Physician-reviewed frameworks designed for healthcare professionals managing patients with complex medical needs.
              </p>
              <Badge variant="outline" className="mt-4 bg-yellow-600/20 text-yellow-200 border-yellow-400/40 px-4 py-1">
                🏥 Hospital-Grade • Professional Use
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Hormone & Life Stages Section (if enabled) */}
        {HORMONE_LIFE_STAGES_ENABLED && (
          <>
            <Separator className="bg-purple-400/30" />
            <Card className="bg-black/30 backdrop-blur-xl border border-purple-400/30 rounded-2xl">
              <CardHeader className="bg-gradient-to-r from-purple-600/10 to-pink-600/10 border-b border-purple-400/20 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl text-white flex items-center gap-3">
                      <Heart className="h-6 w-6 text-purple-400" />
                      Hormone & Life Stages Support
                    </CardTitle>
                    <p className="text-sm text-white/70 mt-2">
                      Medical-grade nutrition frameworks for hormonal and life stage management
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-yellow-600/20 text-yellow-200 border-yellow-400/40">
                    Beta - Doctor Review
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 gap-4">
                  {getAllHormonePresets().map((preset: any) => (
                    <Card key={preset.id} className="bg-black/40 backdrop-blur-lg border border-purple-400/30 hover:border-purple-400/60 transition-all group" data-testid={`card-hormone-${preset.id}`}>
                      <CardHeader className="p-5 bg-gradient-to-r from-purple-600/10 to-pink-600/10 cursor-pointer" onClick={() => setLocation(`/hormone-presets/${preset.id}`)}>
                        <CardTitle className="text-lg text-white group-hover:text-purple-300 transition-colors flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            <Stethoscope className="h-5 w-5 text-purple-400" />
                            {preset.name}
                          </span>
                          <ArrowRight className="h-5 w-5 text-purple-400" />
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-5">
                        <p className="text-sm text-white/70 mb-3">{preset.intent}</p>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {preset.nutrientEmphasisTags.slice(0, 3).map((tag: string, i: number) => (
                            <Badge key={i} variant="secondary" className="bg-purple-600/20 text-purple-200 text-xs">{tag}</Badge>
                          ))}
                          {preset.nutrientEmphasisTags.length > 3 && (
                            <Badge variant="secondary" className="bg-purple-600/20 text-purple-200 text-xs">+{preset.nutrientEmphasisTags.length - 3} more</Badge>
                          )}
                        </div>
                        {HORMONE_PREVIEW_ENABLED && (
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/hormone-preview/${preset.id}`);
                            }}
                            variant="outline"
                            size="sm"
                            className="w-full bg-purple-500/10 border-purple-400/40 hover:bg-purple-500/20 hover:border-purple-400/60 text-purple-200 transition-all"
                            data-testid={`button-preview-${preset.id}`}
                          >
                            <Info className="h-3.5 w-3.5 mr-1.5" />
                            Preview Weekly Board
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Separator className="bg-purple-400/30" />
          </>
        )}

        {/* Clinical Protocols Section Header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-2">Clinical Diet Protocols</h2>
          <p className="text-white/70 max-w-2xl mx-auto">
            Liquid, soft, and pureed diet protocols for post-surgical, bariatric, and medically complex patients
          </p>
        </div>

        {/* Main Protocol Builder Header - replace old header */}
        <Card className={`bg-black/30 backdrop-blur-xl border ${ui.cardBorder} shadow-[0_0_30px_#7c3aed33]`}>
          <CardHeader className={`bg-black/20 border-b ${ui.softBorder} rounded-t-2xl text-white`}>
            <div className="flex items-center gap-3">
              <Soup className="w-6 h-6" />
              <CardTitle className="text-2xl">Protocol Builder</CardTitle>
            </div>
            <p className="text-sm text-white/80 mt-2">
              Generate safe, simple <strong>liquid / soft / pureed</strong> day plans fast. Not medical advice—follow your clinician's protocol.
            </p>
          </CardHeader>
          <CardContent className="p-6 text-white">
            <FeatureInstructions
              steps={[
                "Select your medical protocol (Clear Liquid, Full Liquid, Pureed, etc.)",
                "Set your number of feedings per day (3-8 meals)",
                "Enter your daily calorie target",
                "Review the auto-generated meal plan with even timing",
                "Save to Menu Plan or send to Shopping List"
              ]}
            />

            {/* Controls */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Protocol</Label>
                <Select
                  value={diet}
                  onValueChange={(v) => onDietChange(v as DietKey)}
                >
                  <SelectTrigger
                    className={`bg-black/40 border ${ui.softBorder} text-white`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROTOCOLS.map((p) => (
                      <SelectItem key={p.key} value={p.key}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-white/70 bg-white/5 border border-white/10 rounded-2xl p-2">
                  {currentProtocol.guidance}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Feedings per day</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={3}
                  max={8}
                  value={feedings}
                  onChange={(e) =>
                    setFeedings(
                      Math.max(
                        3,
                        Math.min(
                          8,
                          Number(
                            e.target.value || currentProtocol.defaultFeedings,
                          ),
                        ),
                      ),
                    )
                  }
                  className={`bg-black/40 border ${ui.softBorder} text-white`}
                />
                <div className="text-xs text-white/70">
                  Typical range 5–6. Evenly spaced times are auto-assigned.
                </div>
              </div>

              <div className="space-y-2">
                <Label>Daily Calories Target</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={kcalTarget}
                  onChange={(e) =>
                    setKcalTarget(Math.max(600, Number(e.target.value || 0)))
                  }
                  className={`bg-black/40 border ${ui.softBorder} text-white`}
                />
              </div>

              <div className="space-y-2">
                <Label>Daily Protein Target (g)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={proteinTarget}
                  onChange={(e) =>
                    setProteinTarget(Math.max(40, Number(e.target.value || 0)))
                  }
                  className={`bg-black/40 border ${ui.softBorder} text-white`}
                />
                <div className="text-xs text-white/70">
                  Many protocols aim 60–100g/day. Confirm with your clinician.
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="mt-4 grid md:grid-cols-2 gap-4">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                <div className="font-semibold mb-2">Exclusions</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={dairyFree}
                      onChange={(e) => setDairyFree(e.target.checked)}
                    />
                    Dairy-free
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={lactoseFree}
                      onChange={(e) => setLactoseFree(e.target.checked)}
                    />
                    Lactose-free
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={lowSodium}
                      onChange={(e) => setLowSodium(e.target.checked)}
                    />
                    Low sodium
                  </label>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
                <div className="font-semibold mb-2">Flavors</div>
                <div className="flex flex-wrap gap-2">
                  {["chocolate", "vanilla", "fruit", "savory"].map((f) => {
                    const active = flavors.includes(f);
                    return (
                      <Button
                        key={f}
                        size="sm"
                        variant={active ? "default" : "outline"}
                        onClick={() =>
                          setFlavors(
                            active
                              ? flavors.filter((x) => x !== f)
                              : [...flavors, f],
                          )
                        }
                        className={
                          active
                            ? `bg-black text-white h-8 px-3 text-sm hover:bg-white/20 border border-white/30`
                            : `bg-black/20 border border-white/20 text-white/90 hover:text-white hover:bg-white/10 h-8 px-3 text-sm transition-all`
                        }
                      >
                        {f}
                      </Button>
                    );
                  })}
                </div>
                <div className="text-xs text-white/70 mt-2">
                  Pick none for maximum variety.
                </div>
              </div>
            </div>

            {/* Generate */}
            <div className="mt-4">
              <Button
                onClick={generate}
                className="bg-black/20 border border-white/20 text-white hover:text-white hover:bg-white/10 transition-all"
              >
                Generate Plan
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {plan && (
          <Card
            className={`mt-6 bg-black/30 backdrop-blur-xl border ${ui.cardBorder} shadow-[0_0_30px_#7c3aed22]`}
          >
            <CardHeader
              className={`bg-black/20 border-b ${ui.softBorder} rounded-t-xl text-white`}
            >
              <CardTitle className="text-xl">Your Day Plan</CardTitle>
              <div className="text-white/80 text-sm mt-1">
                {currentProtocol.defaultHydration}
              </div>
              <p className="text-xs text-amber-300 mt-2">
                🔒 This plan will stay here until you generate a new one.
              </p>
            </CardHeader>

            <CardContent className="p-6 text-white">
              <div className="space-y-2">
                {renderPackedSlots(plan, feedings, slots)}
              </div>

              <div className="mt-6 grid sm:grid-cols-3 gap-3">
                <Hint title="Protein-first">
                  Prioritize protein at each feeding. We’ll auto-add boosters if
                  a slot is light.
                </Hint>
                <Hint title="Small sips">
                  Hydrate slowly between feedings; avoid chugging, especially
                  for bariatric protocols.
                </Hint>
                <Hint title="Pace & feel">
                  Stop if you feel pressure, pain, or nausea. Resume with
                  smaller volumes later.
                </Hint>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Export for Physician Review */}
        {plan && plan.length > 0 && (
          <div className="mt-6 flex justify-center">
            <ExportPhysicianReportButton
              mealPlan={plan.map(item => ({
                name: item.name,
                description: item.notes || `${item.type} - ${item.tags.join(", ")}`,
                protein: item.protein,
                carbs: item.carbs,
                fat: item.fat,
                kcal: item.kcal,
                ingredients: [item.name], // Simple for now
                medicalBadges: item.tags.map(tag => ({
                  type: "compatible",
                  reason: `Suitable for ${tag} protocol`
                }))
              }))}
              protocol={currentProtocol.label}
              userId={localStorage.getItem("currentUser") ? JSON.parse(localStorage.getItem("currentUser")!).id : "guest"}
              className="bg-purple-600 hover:bg-purple-700 text-white border-0"
            />
          </div>
        )}
      </div>

      {/* Persistent Day Board */}
      <div className="mt-8">
        <BuilderDayBoard builderKey="medical" />
      </div>

      {/* Shopping Aggregate Bar */}
      {plan && plan.length > 0 && (
        <ShoppingAggregateBar
          ingredients={plan.map(item => ({
            name: item.name,
            quantity: "1",
            unit: "serving"
          }))}
          source="Clinical Recovery & Protocols Hub"
        />
      )}
    </div>
  );
}

/** --- Slot packing (display helpers) --- */
function renderPackedSlots(plan: Item[], feedings: number, slots: string[]) {
  const buckets: Item[][] = Array.from({ length: feedings }, () => []);
  let i = 0;
  for (let s = 0; s < feedings && i < plan.length; s++) {
    buckets[s].push(plan[i++]);
  }
  while (i < plan.length) {
    let minIdx = 0;
    let minProtein = sumProtein(buckets[0]);
    for (let b = 1; b < buckets.length; b++) {
      const p = sumProtein(buckets[b]);
      if (p < minProtein) {
        minProtein = p;
        minIdx = b;
      }
    }
    buckets[minIdx].push(plan[i++]);
  }

  return (
    <div className="space-y-2">
      {buckets.map((items, idx) => {
        const slotProtein = items.reduce((s, it) => s + it.protein, 0);
        const slotKcal = items.reduce((s, it) => s + it.kcal, 0);
        return (
          <div
            key={idx}
            className="bg-white/5 border border-white/10 rounded-xl p-3"
          >
            <div className="flex items-center justify-between text-sm mb-2">
              <div className="flex items-center gap-2">
                <SlotIcon items={items} />
                <span className="font-semibold">{slots[idx]}</span>
              </div>
              <div className="text-white/80">
                {slotProtein}g • {slotKcal} kcal
              </div>
            </div>
            <div className="space-y-2">
              {items.map((it) => (
                <MedicalDietItem key={it.id} item={it} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** --- NEW: Ingredients & Instructions generator --- */
function getPrepForItem(item: Item): {
  ingredients: string[];
  steps: string[];
} {
  const common = {
    seasonLowSodium: "Season lightly; prefer low-sodium options.",
  };

  switch (item.type) {
    case "shake":
      return {
        ingredients: [
          "Protein powder – 1 scoop",
          item.tags.includes("dairy_free") ||
          item.name.toLowerCase().includes("plant")
            ? "Unsweetened almond milk or water – 8–12 oz"
            : "Cold water – 8–12 oz",
          "Ice (optional)",
        ],
        steps: [
          "Add liquid to blender, then protein powder.",
          "Blend 30–45 seconds until silky smooth.",
          "Thin with more liquid if needed for tolerance.",
        ],
      };
    case "broth":
      return {
        ingredients: ["Bone broth – 1 cup", "Water (optional) to thin"],
        steps: [
          "Heat to a gentle simmer.",
          "Strain if needed for clarity.",
          common.seasonLowSodium,
        ],
      };
    case "soup":
      return {
        ingredients: [
          "Cream/strained soup – 1 cup",
          "Low-sodium broth (as needed to thin)",
        ],
        steps: [
          "Warm over low heat; do not boil.",
          "Blend and/or strain until completely smooth.",
          "Adjust thickness with broth for surgeon/clinic protocol.",
        ],
      };
    case "yogurt":
      return {
        ingredients: [
          "Plain Greek yogurt – ¾ cup",
          "Water or milk (optional) to thin",
        ],
        steps: [
          "Blend or whisk until silky smooth (no chunks).",
          "Serve chilled; thin for easier tolerance if needed.",
        ],
      };
    case "pudding":
      return {
        ingredients: ["High-protein pudding – 1 serving cup"],
        steps: [
          "Chill, then stir until smooth.",
          "Optional: whisk with a tablespoon of water for looser texture.",
        ],
      };
    case "puree":
      if (item.id === "puree-chk") {
        return {
          ingredients: [
            "Cooked chicken breast – 3–4 oz",
            "Low-sodium broth – ¼–½ cup",
          ],
          steps: [
            "Cube chicken; add to blender with broth.",
            "Blend on high until completely smooth.",
            "Strain if any fibers remain; thin to tolerance.",
          ],
        };
      }
      if (item.id === "puree-bn") {
        return {
          ingredients: [
            "Canned black beans (rinsed) – ½ cup",
            "Low-sodium broth – ¼–½ cup",
          ],
          steps: [
            "Blend beans with broth until silky smooth.",
            "Strain to remove skins if required by protocol.",
            "Thin to tolerance; re-warm gently if desired.",
          ],
        };
      }
      return {
        ingredients: [
          "Base food (well-cooked) – 1 serving",
          "Low-sodium broth – as needed",
        ],
        steps: [
          "Blend on high until fully smooth (no chunks).",
          "Strain if required; thin to tolerance.",
          common.seasonLowSodium,
        ],
      };
    case "meal":
      return {
        ingredients: [
          "Main protein (chicken, fish, turkey, or plant-based) – 1 serving",
          "Complex carbohydrate (rice, quinoa, pasta, or potatoes) – 1 serving",
          "Vegetables (fresh or frozen) – 1-2 servings",
          "Healthy fats (olive oil, avocado) as indicated",
          "Herbs and spices for seasoning (adjust sodium as needed)",
        ],
        steps: [
          "Prepare protein according to diet restrictions (baked, grilled, or steamed).",
          "Cook carbohydrates per package directions; for renal diets, use double-boiling method to reduce potassium.",
          "Prepare vegetables (steamed, roasted, or sautéed); leach vegetables if required for low-potassium diets.",
          "Season with approved herbs and spices; avoid salt if on sodium-restricted diet.",
          "Plate meal with balanced portions according to your healthcare provider's guidance.",
        ],
      };
    default:
      return { ingredients: [], steps: [] };
  }
}

function MedicalDietItem({ item }: { item: Item }) {
  const prep = getPrepForItem(item);

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-3">
      <div className="font-medium mb-1">{item.name}</div>
      <div className="text-white/70 text-xs mb-3">
        {item.type} • {item.protein}g protein • {item.carbs}g carbs • {item.fat}
        g fat • {item.kcal} kcal
        {item.notes && ` • ${item.notes}`}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <div className="text-xs font-semibold mb-1">Ingredients</div>
          {prep.ingredients.length ? (
            <ul className="text-xs text-white/80 list-disc pl-4 space-y-1">
              {prep.ingredients.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-white/60">
              See label; keep texture smooth.
            </div>
          )}
        </div>
        <div>
          <div className="text-xs font-semibold mb-1">Cooking Instructions</div>
          {prep.steps.length ? (
            <ol className="text-xs text-white/80 list-decimal pl-4 space-y-1">
              {prep.steps.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          ) : (
            <div className="text-xs text-white/60">
              Follow clinic protocol for preparation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SlotIcon({ items }: { items: Item[] }) {
  const hasMeal = items.some((i) => i.type === "meal");
  const hasSavory = items.some(
    (i) =>
      i.tags.includes("savory") ||
      i.type === "soup" ||
      i.type === "broth" ||
      i.type === "puree",
  );
  const hasShake = items.some((i) => i.type === "shake");
  if (hasMeal) return <Apple className="w-4 h-4" />;
  if (hasSavory && hasShake) return <Soup className="w-4 h-4" />;
  if (hasSavory) return <Soup className="w-4 h-4" />;
  if (hasShake) return <Blend className="w-4 h-4" />;
  return <Droplets className="w-4 h-4" />;
}

/** tiny hint card */
function Hint({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3">
      <div className="font-semibold mb-1">{title}</div>
      <div className="text-sm text-white/80">{children}</div>
    </div>
  );
}