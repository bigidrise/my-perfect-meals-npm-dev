import { ONCOLOGY_SYMPTOM_OPTIONS, type OncologySymptomSelection } from "../../../shared/oncologySupportSelection";
import { OncologySymptomSelector } from "./OncologySymptomSelector";
import { FormModal } from "./ui/universal-modal";

type OncologySymptomDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  symptoms: OncologySymptomSelection[];
  onChange: (symptoms: OncologySymptomSelection[]) => void;
  readOnly?: boolean;
  error?: string | null;
  saveHint: string;
};

export function OncologySymptomDialog({
  open,
  onOpenChange,
  symptoms,
  onChange,
  readOnly = false,
  error = null,
  saveHint,
}: OncologySymptomDialogProps) {
  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title="What are you currently experiencing?"
      description="Cancer Support — select all that apply, or choose None currently."
      className="w-[calc(100vw-2rem)] max-w-sm max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1.5rem)] rounded-2xl border border-rose-200/20 bg-[#251c25] text-rose-50 shadow-[0_24px_80px_rgba(16,8,18,0.48)]"
      footer={
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1 text-xs leading-relaxed text-rose-100/65">
            {saveHint && <p>{saveHint}</p>}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 px-5 text-sm font-semibold text-[#382633] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#251c25]"
          >
            Done
          </button>
        </div>
      }
    >
      <div className={`space-y-4 pb-2 pt-1 [&_legend]:sr-only [&_label]:min-h-11 [&_label]:rounded-lg [&_label]:border [&_label]:border-rose-200/15 [&_label]:p-2 [&_input]:h-4 [&_input]:w-4 [&_input]:shrink-0 ${readOnly ? "" : "[&_label]:cursor-pointer"}`}>
        <OncologySymptomSelector
          symptoms={symptoms}
          onChange={(nextSymptoms) => {
            if (!readOnly) onChange(nextSymptoms);
          }}
          readOnly={readOnly}
          error={error}
        />

        {error && !readOnly && (
          <p
            role="alert"
            className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-3.5 py-3 text-sm leading-relaxed text-rose-100"
          >
            {error}
          </p>
        )}
      </div>
    </FormModal>
  );
}

export function OncologySymptomSummary({ symptoms, onReview, readOnly = false, error }: {
  symptoms: OncologySymptomSelection[];
  onReview: () => void;
  readOnly?: boolean;
  error?: string | null;
}) {
  const summary = error ? "Saved selections could not be verified."
    : symptoms.length ? ONCOLOGY_SYMPTOM_OPTIONS.filter(option => symptoms.includes(option.value)).map(option =>
      option.value === "fatigue_low_prep" ? "Fatigue / need easier meals" : option.label).join(", ")
    : "None currently";
  return (
    <div className="mt-3 rounded-xl border border-rose-400/40 bg-rose-950/20 p-3">
      <p className="text-sm font-semibold text-white">Cancer Support symptoms</p>
      <p className="mt-1 break-words text-sm text-white/80" aria-live="polite">{summary}</p>
      <button type="button" onClick={onReview}
        className="mt-3 inline-flex min-h-11 items-center justify-center rounded-lg border border-rose-300/50 bg-rose-500/15 px-4 text-sm font-semibold text-rose-100 hover:bg-rose-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
        aria-haspopup="dialog">
        {readOnly ? "View symptoms" : "Review symptoms"}
      </button>
    </div>
  );
}
