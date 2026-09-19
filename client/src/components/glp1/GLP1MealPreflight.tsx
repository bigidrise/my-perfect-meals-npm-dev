import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { useGlp1HubCheckin } from "@/hooks/useGlp1HubCheckin";
import type { HubCheckinPayload } from "@shared/glp1-schema";
import { canSaveGlp1MealPreflight } from "@/lib/glp1MenuFlow";

type Severity = "none" | "mild" | "moderate" | "severe";
type Appetite = "suppressed" | "reduced" | "normal" | "increased";
type Vomiting = "none" | "once" | "multiple" | "cant_keep_fluids";
type Fluids = "yes" | "with_difficulty" | "no";
type Eating = "yes" | "partially" | "no";

type MealRelevantForm = {
  appetiteLevel: Appetite;
  nausea: Severity;
  reflux: Severity;
  constipation: Severity;
  diarrhea: Severity;
  bloating: Severity;
  earlyFullness: Severity;
  foodAversions: Severity;
  vomiting: Vomiting;
  canKeepFluidsDown: Fluids;
  canEatWithoutWorsening: Eating;
};

const DEFAULT_FORM: MealRelevantForm = {
  appetiteLevel: "normal",
  nausea: "none",
  reflux: "none",
  constipation: "none",
  diarrhea: "none",
  bloating: "none",
  earlyFullness: "none",
  foodAversions: "none",
  vomiting: "none",
  canKeepFluidsDown: "yes",
  canEatWithoutWorsening: "yes",
};

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="text-xs font-bold text-white/70">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-black/55 px-3 text-sm text-white outline-none focus:border-violet-300/60"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

const severityOptions: Array<{ value: Severity; label: string }> = [
  { value: "none", label: "None" },
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
];

export default function GLP1MealPreflight({
  open,
  onOpenChange,
  onSaved,
  onOpenSettings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
  onOpenSettings: () => void;
}) {
  const { checkin, tolerance, isLoading, isSubmitting, hasLoaded, submit, reload, error } = useGlp1HubCheckin();
  const [form, setForm] = useState<MealRelevantForm>(DEFAULT_FORM);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setHydratedKey(null);
      return;
    }
    if (!hasLoaded || isLoading) {
      setHydratedKey(null);
      return;
    }
    setForm({
      appetiteLevel: (checkin?.appetiteLevel as Appetite) ?? "normal",
      nausea: (checkin?.nausea as Severity) ?? "none",
      reflux: (checkin?.reflux as Severity) ?? "none",
      constipation: (checkin?.constipation as Severity) ?? "none",
      diarrhea: (checkin?.diarrhea as Severity) ?? "none",
      bloating: (checkin?.bloating as Severity) ?? "none",
      earlyFullness: (checkin?.earlyFullness as Severity) ?? "none",
      foodAversions: (checkin?.foodAversions as Severity) ?? "none",
      vomiting: (checkin?.vomiting as Vomiting) ?? "none",
      canKeepFluidsDown: (checkin?.canKeepFluidsDown as Fluids) ?? "yes",
      canEatWithoutWorsening: (checkin?.canEatWithoutWorsening as Eating) ?? "yes",
    });
    setHydratedKey(checkin?.id || "new");
  }, [open, checkin, hasLoaded, isLoading]);

  const set = <K extends keyof MealRelevantForm>(key: K, value: MealRelevantForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const payload: Partial<HubCheckinPayload> = {
      ...form,
      fatigue: (checkin?.fatigue as Severity) ?? "none",
      dizziness: (checkin?.dizziness as Severity) ?? "none",
      headache: (checkin?.headache as Severity) ?? "none",
      reducedUrination: checkin?.reducedUrination ?? false,
      symptomTrend: (checkin?.symptomTrend as HubCheckinPayload["symptomTrend"]) ?? "na",
      notifyCareTeam: (checkin?.notifyCareTeam as HubCheckinPayload["notifyCareTeam"]) ?? "none",
      symptomsAfterDose: (checkin?.symptomsAfterDose as HubCheckinPayload["symptomsAfterDose"]) ?? "unsure",
      medicationName: checkin?.medicationName ?? undefined,
      medicationClass: (checkin?.medicationClass as HubCheckinPayload["medicationClass"]) ?? undefined,
    };
    if (!await submit(payload)) return;
    await onSaved();
    onOpenChange(false);
  };

  const hasEscalation = Boolean(tolerance?.shouldEscalate);
  const currentCheckinKey = checkin?.id || "new";
  const canSave = canSaveGlp1MealPreflight({
    hasLoaded,
    isLoading,
    hydratedKey,
    currentKey: currentCheckinKey,
  });

  return (
    <div className="mt-4 rounded-2xl border border-violet-300/20 bg-violet-950/20 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          {hasEscalation
            ? <AlertTriangle className="mt-0.5 h-5 w-5 text-red-300" />
            : <CheckCircle className="mt-0.5 h-5 w-5 text-violet-200" />}
          <div>
            <p className="text-sm font-bold text-violet-100">GLP-1 settings are being applied</p>
            <p className="mt-0.5 text-xs text-white/55">
              {checkin
                ? `Today's appetite: ${checkin.appetiteLevel.replace("_", " ")}.`
                : "Add today's appetite and tolerance before creating ideas."}
              {" "}Shot history is maintenance and does not block meal ideas.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onOpenChange(!open)} className="text-sm font-bold text-violet-200">
            Update how you’re feeling
          </button>
          <button type="button" onClick={onOpenSettings} className="text-sm font-semibold text-white/55">
            Full settings
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 border-t border-white/10 pt-4">
          {isLoading ? (
            <div className="flex min-h-24 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-violet-200" /></div>
          ) : !hasLoaded ? (
            <div className="rounded-xl border border-red-300/20 bg-red-950/20 p-4">
              <p className="text-sm font-semibold text-red-100">We couldn’t load today’s GLP-1 check-in.</p>
              <p className="mt-1 text-xs text-white/55">Nothing can be saved until your current record is loaded.</p>
              <button type="button" onClick={() => void reload()} className="mt-3 min-h-10 rounded-xl border border-white/15 px-4 text-sm font-bold text-white">
                Try Again
              </button>
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm text-white/65">Only answers that can change today’s meal are shown here.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField label="Appetite today" value={form.appetiteLevel} onChange={(value) => set("appetiteLevel", value)} options={[
                  { value: "suppressed", label: "Suppressed" },
                  { value: "reduced", label: "Reduced" },
                  { value: "normal", label: "Normal" },
                  { value: "increased", label: "Increased" },
                ]} />
                {(["nausea", "reflux", "constipation", "diarrhea", "bloating", "earlyFullness", "foodAversions"] as const).map((key) => (
                  <SelectField
                    key={key}
                    label={{
                      nausea: "Nausea",
                      reflux: "Reflux",
                      constipation: "Constipation",
                      diarrhea: "Diarrhea",
                      bloating: "Bloating",
                      earlyFullness: "Early fullness",
                      foodAversions: "Food aversions",
                    }[key]}
                    value={form[key]}
                    onChange={(value) => set(key, value)}
                    options={severityOptions}
                  />
                ))}
                <SelectField label="Vomiting" value={form.vomiting} onChange={(value) => set("vomiting", value)} options={[
                  { value: "none", label: "None" },
                  { value: "once", label: "Once" },
                  { value: "multiple", label: "Multiple times" },
                  { value: "cant_keep_fluids", label: "Cannot keep fluids down" },
                ]} />
                <SelectField label="Can you keep fluids down?" value={form.canKeepFluidsDown} onChange={(value) => set("canKeepFluidsDown", value)} options={[
                  { value: "yes", label: "Yes" },
                  { value: "with_difficulty", label: "With difficulty" },
                  { value: "no", label: "No" },
                ]} />
                <SelectField label="Can you eat without symptoms worsening?" value={form.canEatWithoutWorsening} onChange={(value) => set("canEatWithoutWorsening", value)} options={[
                  { value: "yes", label: "Yes" },
                  { value: "partially", label: "Partially" },
                  { value: "no", label: "No" },
                ]} />
              </div>
              {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => onOpenChange(false)} className="min-h-10 rounded-xl border border-white/15 px-4 text-sm text-white/65">Cancel</button>
                <button type="button" disabled={isSubmitting || !canSave} onClick={() => void save()} className="min-h-10 rounded-xl bg-violet-500 px-4 text-sm font-black text-white disabled:opacity-60">
                  {isSubmitting ? "Saving…" : "Save & Continue"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}