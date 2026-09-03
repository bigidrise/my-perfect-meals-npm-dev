/**
 * ⚠️ DEPRECATED — ACE Daily Check-In v1
 *
 * Status: Retired, unmounted, kept only as archived reference.
 * Replaced by: Coach's Corner (client/src/pages/CoachCorner*.tsx)
 *
 * Do NOT import or render this component. See DailyCheckinCard.tsx in this
 * same folder for full deprecation rationale.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PillButton } from "@/components/ui/pill-button";
import { useSubmitCheckin, type DailyCheckinPayload, type CheckinIntervention } from "@/legacy/ace-checkin-v1/useDailyCheckin";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SCALE_LABELS: Record<string, string[]> = {
  energy:    ["Drained", "Low", "Okay", "Good", "Energized"],
  mood:      ["Struggling", "Low", "Neutral", "Good", "Excellent"],
  stress:    ["Calm", "Mild", "Moderate", "High", "Maxed Out"],
  sleep:     ["Terrible", "Poor", "Fair", "Good", "Great"],
  soreness:  ["None", "Mild", "Moderate", "Sore", "Very Sore"],
  digestion: ["Very Poor", "Poor", "Fair", "Good", "Great"],
  cravings:  ["None", "Mild", "Moderate", "Strong", "Intense"],
  hunger:    ["None", "Low", "Moderate", "Hungry", "Very Hungry"],
  motivation:["None", "Low", "Moderate", "Good", "High"],
  emotionalEatingRisk: ["None", "Low", "Moderate", "High", "Very High"],
};

const SCHEDULES = [
  { value: "normal", label: "Normal Day" },
  { value: "busy",   label: "Busy / Rushed" },
  { value: "travel", label: "Traveling" },
  { value: "rest",   label: "Rest Day" },
];

const SYMPTOM_OPTIONS = [
  "Headache", "Bloating", "Fatigue", "Nausea",
  "Brain Fog", "Joint Pain", "Mood Swings", "Insomnia",
  "Heartburn", "Low Back Pain",
];

const SEVERITY_COLORS: Record<string, string> = {
  low:      "text-green-400",
  moderate: "text-orange-400",
  high:     "text-red-400",
};

type ScaleField = keyof typeof SCALE_LABELS;

interface ScaleRowProps {
  label: string;
  field: ScaleField;
  value: number | null;
  onChange: (v: number) => void;
}

function ScaleRow({ label, field, value, onChange }: ScaleRowProps) {
  const labels = SCALE_LABELS[field];
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-white/80">{label}</p>
      <div className="flex gap-2 flex-wrap">
        {labels.map((lbl, i) => {
          const score = i + 1;
          return (
            <PillButton
              key={score}
              onClick={() => onChange(score)}
              className={
                value === score
                  ? "bg-orange-600 text-white border-orange-500"
                  : "bg-white/10 text-white/70 border-white/20 hover:bg-white/15"
              }
            >
              {lbl}
            </PillButton>
          );
        })}
      </div>
    </div>
  );
}

type FormState = {
  energy: number | null;
  stress: number | null;
  sleep: number | null;
  mood: number | null;
  cravings: number | null;
  hunger: number | null;
  digestion: number | null;
  soreness: number | null;
  schedule: string | null;
  motivation: number | null;
  emotionalEatingRisk: number | null;
  symptoms: string[];
  freeText: string;
};

const EMPTY_FORM: FormState = {
  energy: null, stress: null, sleep: null, mood: null,
  cravings: null, hunger: null, digestion: null, soreness: null,
  schedule: null, motivation: null, emotionalEatingRisk: null,
  symptoms: [], freeText: "",
};

export default function DailyCheckinModal({ open, onClose }: Props) {
  const [step, setStep] = useState<"form" | "result">("form");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [result, setResult] = useState<CheckinIntervention | null>(null);
  const { mutate, isPending } = useSubmitCheckin();
  const { toast } = useToast();

  function setScale(field: ScaleField) {
    return (v: number) => setForm((f) => ({ ...f, [field]: v }));
  }

  function toggleSymptom(sym: string) {
    setForm((f) => ({
      ...f,
      symptoms: f.symptoms.includes(sym)
        ? f.symptoms.filter((s) => s !== sym)
        : [...f.symptoms, sym],
    }));
  }

  function handleSubmit() {
    const payload: DailyCheckinPayload = {
      energy: form.energy,
      stress: form.stress,
      sleep: form.sleep,
      mood: form.mood,
      cravings: form.cravings,
      hunger: form.hunger,
      digestion: form.digestion,
      soreness: form.soreness,
      schedule: form.schedule,
      motivation: form.motivation,
      emotional_eating_risk: form.emotionalEatingRisk,
      symptoms: form.symptoms,
      free_text: form.freeText,
    };

    mutate(payload, {
      onSuccess: (data) => {
        setResult(data.interventions[0] ?? null);
        setStep("result");
      },
      onError: () => {
        toast({
          title: "Couldn't save check-in",
          description: "Please try again.",
          variant: "destructive",
        });
      },
    });
  }

  function handleClose() {
    setStep("form");
    setForm(EMPTY_FORM);
    setResult(null);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-b from-black/90 via-gray-900 to-black/95 border border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">
            {step === "form" ? "Daily Check-In" : "Today's Focus"}
          </DialogTitle>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-6 pb-2">
            <p className="text-sm text-white/50">
              Just the facts — no judgement. This takes about 60 seconds.
            </p>

            <Section title="How are you feeling?">
              <ScaleRow label="Energy" field="energy" value={form.energy} onChange={setScale("energy")} />
              <ScaleRow label="Mood" field="mood" value={form.mood} onChange={setScale("mood")} />
              <ScaleRow label="Motivation" field="motivation" value={form.motivation} onChange={setScale("motivation")} />
            </Section>

            <Section title="Recovery">
              <ScaleRow label="Sleep quality" field="sleep" value={form.sleep} onChange={setScale("sleep")} />
              <ScaleRow label="Muscle soreness" field="soreness" value={form.soreness} onChange={setScale("soreness")} />
              <ScaleRow label="Digestion" field="digestion" value={form.digestion} onChange={setScale("digestion")} />
            </Section>

            <Section title="Food & Mindset">
              <ScaleRow label="Stress level" field="stress" value={form.stress} onChange={setScale("stress")} />
              <ScaleRow label="Hunger" field="hunger" value={form.hunger} onChange={setScale("hunger")} />
              <ScaleRow label="Cravings" field="cravings" value={form.cravings} onChange={setScale("cravings")} />
              <ScaleRow label="Emotional eating risk" field="emotionalEatingRisk" value={form.emotionalEatingRisk} onChange={setScale("emotionalEatingRisk")} />
            </Section>

            <Section title="Today's Context">
              <div className="space-y-2">
                <p className="text-sm font-medium text-white/80">Schedule</p>
                <div className="flex gap-2 flex-wrap">
                  {SCHEDULES.map(({ value, label }) => (
                    <PillButton
                      key={value}
                      onClick={() => setForm((f) => ({ ...f, schedule: f.schedule === value ? null : value }))}
                      className={
                        form.schedule === value
                          ? "bg-orange-600 text-white border-orange-500"
                          : "bg-white/10 text-white/70 border-white/20 hover:bg-white/15"
                      }
                    >
                      {label}
                    </PillButton>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-white/80">Any symptoms? (optional)</p>
                <div className="flex gap-2 flex-wrap">
                  {SYMPTOM_OPTIONS.map((sym) => (
                    <PillButton
                      key={sym}
                      onClick={() => toggleSymptom(sym)}
                      className={
                        form.symptoms.includes(sym)
                          ? "bg-orange-600 text-white border-orange-500"
                          : "bg-white/10 text-white/70 border-white/20 hover:bg-white/15"
                      }
                    >
                      {sym}
                    </PillButton>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-white/80">Anything else on your mind? (optional)</p>
                <textarea
                  className="w-full rounded-lg bg-white/10 border border-white/20 text-white text-sm px-3 py-2 placeholder-white/30 resize-none focus:outline-none focus:border-orange-500 transition-colors"
                  rows={3}
                  placeholder="Today's context, wins, struggles..."
                  value={form.freeText}
                  onChange={(e) => setForm((f) => ({ ...f, freeText: e.target.value }))}
                  maxLength={1000}
                />
              </div>
            </Section>

            <div className="pt-2">
              <PillButton
                onClick={handleSubmit}
                disabled={isPending}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 text-base border-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? "Saving..." : "Save Check-In"}
              </PillButton>
            </div>
          </div>
        )}

        {step === "result" && (
          <div className="space-y-6 pb-2">
            <div className="text-center space-y-1">
              <p className="text-white/50 text-sm">Check-in saved ✓</p>
              <p className="text-white/80 text-sm">
                Based on today's signals, here's where to focus:
              </p>
            </div>

            {result ? (
              <div className="rounded-xl bg-white/5 border border-white/10 p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-white text-lg leading-snug">
                      {formatInterventionTitle(result.key)}
                    </h3>
                    <p className="text-white/60 text-sm mt-1">{result.situation}</p>
                  </div>
                  <span className={`text-xs font-semibold uppercase tracking-wide shrink-0 mt-1 ${SEVERITY_COLORS[result.severity] ?? "text-white/50"}`}>
                    {result.severity}
                  </span>
                </div>

                <div>
                  <p className="text-orange-400 font-semibold text-sm mb-1">Goal</p>
                  <p className="text-white/80 text-sm">{result.coaching_objective}</p>
                </div>

                <div>
                  <p className="text-orange-400 font-semibold text-sm mb-2">Today's Strategies</p>
                  <ul className="space-y-1">
                    {result.strategies.slice(0, 3).map((s, i) => (
                      <li key={i} className="text-white/75 text-sm flex gap-2">
                        <span className="text-orange-500 shrink-0">→</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {result.suggested_builders.length > 0 && (
                  <div>
                    <p className="text-orange-400 font-semibold text-sm mb-2">Suggested Tools</p>
                    <div className="flex gap-2 flex-wrap">
                      {result.suggested_builders.map((b) => (
                        <PillButton
                          key={b}
                          className="bg-white/10 text-white/70 border-white/20 text-xs"
                        >
                          {formatBuilderName(b)}
                        </PillButton>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl bg-white/5 border border-white/10 p-5 text-center">
                <p className="text-white/60 text-sm">
                  You're in a good place today. Keep doing what you're doing.
                </p>
              </div>
            )}

            <PillButton
              onClick={handleClose}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-3 text-base border-orange-500"
            >
              Done
            </PillButton>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-orange-400 font-semibold text-sm uppercase tracking-wide border-b border-white/10 pb-1">
        {title}
      </h3>
      {children}
    </div>
  );
}

function formatInterventionTitle(key: string): string {
  const map: Record<string, string> = {
    high_stress: "High Stress Management",
    low_energy: "Low Energy Recovery",
    sleep_deficit: "Sleep Deficit Support",
    plateau: "Progress Plateau Strategy",
    social_eating: "Social Eating Navigation",
    meal_skipping: "Meal Skipping Pattern",
    late_night_eating: "Late Night Eating",
    high_cravings: "Craving Management",
    low_motivation: "Motivation Recovery",
    travel: "Travel Nutrition",
    hormonal_shifts: "Hormonal Support",
    overeating_episode: "Overeating Reset",
    dehydration_pattern: "Hydration Reset",
    protein_deficit: "Protein Gap",
    fiber_deficit: "Fiber Deficit",
    restrictive_spiral: "Restriction Pattern",
    binge_risk: "Binge Risk — Priority",
    digestive_distress: "Digestive Support",
    muscle_soreness: "Recovery Nutrition",
    goal_drift: "Goal Reconnection",
  };
  return map[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatBuilderName(key: string): string {
  const map: Record<string, string> = {
    "create-dish": "Create a Dish",
    "snack-creator": "Craving Creator",
    "beverage-creator": "Beverage Creator",
    "fridge-rescue": "Fridge Rescue",
    "meal-planner": "Meal Planner",
    "craving-creator": "Craving Creator",
    "restaurant-guide": "Restaurant Guide",
    "breakfast": "Breakfast Builder",
    "lunch": "Lunch Builder",
    "dinner": "Dinner Builder",
    "dessert-creator": "Dessert Creator",
  };
  return map[key] ?? key.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
