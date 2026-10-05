import { useEffect, useMemo, useState } from "react";
import { ONCOLOGY_SYMPTOM_OPTIONS, readOncologySupportSelection, type OncologySymptomSelection } from "../../../shared/oncologySupportSelection";

export function useConsumerOncologySelection(context: unknown) {
  const saved = useMemo(() => {
    try { return { selection: readOncologySupportSelection(context), error: null }; }
    catch { return { selection: readOncologySupportSelection(null), error: "Your oncology settings could not be verified. Reload before saving." }; }
  }, [context]);
  const [symptoms, setSymptoms] = useState<OncologySymptomSelection[]>(saved.selection.symptoms);
  useEffect(() => { setSymptoms(saved.selection.symptoms); }, [saved]);
  const ownership = context as { source?: string; locked?: boolean } | null | undefined;
  const readOnly = Boolean(saved.error || ownership?.source === "physician" || ownership?.locked);
  return {
    symptoms, readOnly, error: saved.error, enabled: saved.selection.enabled,
    changed: !readOnly && JSON.stringify([...symptoms].sort()) !== JSON.stringify([...saved.selection.symptoms].sort()),
    setSymptoms: (values: OncologySymptomSelection[]) => { if (!readOnly) setSymptoms(values); },
    payload: () => {
      if (saved.error) throw new Error(saved.error);
      return readOnly ? undefined : { symptoms };
    },
  };
}

export function OncologySymptomSelector({ symptoms, onChange, readOnly = false, error }: {
  symptoms: OncologySymptomSelection[];
  onChange: (values: OncologySymptomSelection[]) => void;
  readOnly?: boolean;
  error?: string | null;
}) {
  return <fieldset className="mt-3 rounded-xl border border-rose-400/40 bg-rose-950/20 p-3">
    <legend className="px-1 text-sm font-semibold text-white">What are you currently experiencing?</legend>
    {readOnly && <p className="mb-2 text-xs text-white/80">{error || "Managed by your care team. Contact them to change these selections."}</p>}
    <div className="grid gap-2 sm:grid-cols-2">
      {ONCOLOGY_SYMPTOM_OPTIONS.map(option => <label key={option.value} className="flex items-center gap-2 text-sm text-white">
        <input type="checkbox" disabled={readOnly} checked={symptoms.includes(option.value)}
          onChange={() => onChange(symptoms.includes(option.value) ? symptoms.filter(value => value !== option.value) : [...symptoms, option.value])} />
        {option.value === "fatigue_low_prep" ? "Fatigue / need easier meals" : option.label}
      </label>)}
      <label className="flex items-center gap-2 text-sm text-white">
        <input type="checkbox" disabled={readOnly} checked={symptoms.length === 0} onChange={() => onChange([])} />
        None currently
      </label>
    </div>
  </fieldset>;
}
