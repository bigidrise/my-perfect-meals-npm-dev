import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PillButton } from "@/components/ui/pill-button";
import { apiUrl } from "@/lib/resolveApiBase";

interface PregnancySupportSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (data: { stage: string; dueDate: string | null }) => void;
}

type Stage =
  | "trying-to-conceive"
  | "trimester-1"
  | "trimester-2"
  | "trimester-3"
  | "breastfeeding"
  | "postpartum";

type Symptom =
  | "nausea"
  | "heartburn"
  | "constipation"
  | "fatigue"
  | "food_aversions"
  | "swelling"
  | "shortness_of_breath"
  | "low_appetite";

const STAGE_OPTIONS: { label: string; value: Stage; emoji: string; description: string }[] = [
  { label: "Trying to Conceive", value: "trying-to-conceive", emoji: "🌸", description: "Preconception nutrition" },
  { label: "First Trimester", value: "trimester-1", emoji: "🌱", description: "Weeks 1–13 · Folate, nausea support" },
  { label: "Second Trimester", value: "trimester-2", emoji: "🌿", description: "Weeks 14–27 · Protein, calcium, DHA" },
  { label: "Third Trimester", value: "trimester-3", emoji: "🌺", description: "Weeks 28–40 · Iron, DHA, prep for birth" },
  { label: "Breastfeeding", value: "breastfeeding", emoji: "🤱", description: "Milk production, DHA, iodine, calcium" },
  { label: "Postpartum", value: "postpartum", emoji: "🩷", description: "Recovery, replenishment, energy" },
];

const SYMPTOM_OPTIONS: { label: string; value: Symptom; emoji: string }[] = [
  { label: "Nausea", value: "nausea", emoji: "🤢" },
  { label: "Heartburn", value: "heartburn", emoji: "🔥" },
  { label: "Constipation", value: "constipation", emoji: "😣" },
  { label: "Fatigue", value: "fatigue", emoji: "😴" },
  { label: "Food Aversions", value: "food_aversions", emoji: "🙅" },
  { label: "Swelling", value: "swelling", emoji: "💧" },
  { label: "Shortness of Breath", value: "shortness_of_breath", emoji: "😮‍💨" },
  { label: "Low Appetite", value: "low_appetite", emoji: "😐" },
];

export function PregnancySupportSetupModal({ open, onOpenChange, onSaved }: PregnancySupportSetupModalProps) {
  const [stage, setStage] = useState<Stage | null>(null);
  const [trackingMode, setTrackingMode] = useState<"due-date" | "manual">("manual");
  const [dueDate, setDueDate] = useState("");
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [isBreastfeeding, setIsBreastfeeding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggleSymptom(s: Symptom) {
    setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  async function handleSave() {
    if (!stage) return;
    setSaving(true);
    try {
      await fetch(apiUrl("/api/pregnancy/setup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          stage,
          dueDate: trackingMode === "due-date" && dueDate ? dueDate : null,
          symptoms,
          trackingMode,
          isBreastfeeding: stage === "breastfeeding" || isBreastfeeding,
        }),
      });
      setSaved(true);
      onSaved?.({ stage, dueDate: trackingMode === "due-date" ? dueDate : null });
      setTimeout(() => {
        onOpenChange(false);
        setSaved(false);
      }, 1200);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-black/95 border-t border-pink-500/30 text-white max-h-[90vh] overflow-y-auto rounded-t-3xl"
      >
        <SheetHeader className="text-left pb-4 border-b border-white/10">
          <SheetTitle className="text-white text-xl flex items-center gap-2">
            🩷 My Perfect Pregnancy Setup
          </SheetTitle>
          <p className="text-white/60 text-xs leading-relaxed mt-1">
            This helps personalize your nutrition guidance. Your information stays private and shapes every meal suggestion, food safety check, and coaching response.
          </p>
        </SheetHeader>

        <div className="py-5 space-y-6">
          {/* Stage selection */}
          <div>
            <p className="text-pink-300 text-sm font-semibold mb-3">Where are you in your journey?</p>
            <div className="space-y-2">
              {STAGE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setStage(opt.value);
                    if (opt.value === "breastfeeding") setIsBreastfeeding(true);
                    else setIsBreastfeeding(false);
                  }}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    stage === opt.value
                      ? "bg-pink-900/40 border-pink-400/60 text-white"
                      : "bg-white/5 border-white/10 text-white/80 active:bg-white/10"
                  }`}
                >
                  <span className="text-xl flex-shrink-0">{opt.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className="text-xs text-white/50">{opt.description}</p>
                  </div>
                  {stage === opt.value && (
                    <span className="ml-auto text-pink-400 text-sm">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Due date — only for trimester stages */}
          {stage && ["trimester-1", "trimester-2", "trimester-3"].includes(stage) && (
            <div>
              <p className="text-pink-300 text-sm font-semibold mb-2">Track by due date?</p>
              <p className="text-white/50 text-xs mb-3">
                When you enter your due date, your current week and trimester update automatically. You can skip this and track manually.
              </p>
              <div className="flex gap-2 mb-3">
                <PillButton
                  active={trackingMode === "due-date"}
                  onClick={() => setTrackingMode("due-date")}
                >
                  Yes, enter due date
                </PillButton>
                <PillButton
                  active={trackingMode === "manual"}
                  onClick={() => setTrackingMode("manual")}
                >
                  Skip — manual stage only
                </PillButton>
              </div>
              {trackingMode === "due-date" && (
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-pink-400/60"
                  placeholder="Due date (YYYY-MM-DD)"
                />
              )}
            </div>
          )}

          {/* Active symptoms */}
          {stage && stage !== "trying-to-conceive" && (
            <div>
              <p className="text-pink-300 text-sm font-semibold mb-1">Any active symptoms?</p>
              <p className="text-white/50 text-xs mb-3">
                Select all that apply — your meal suggestions will adapt to support them.
              </p>
              <div className="flex flex-wrap gap-2">
                {SYMPTOM_OPTIONS.map(opt => (
                  <PillButton
                    key={opt.value}
                    active={symptoms.includes(opt.value)}
                    onClick={() => toggleSymptom(opt.value)}
                  >
                    {opt.emoji} {opt.label}
                  </PillButton>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="bg-pink-950/20 border border-pink-500/20 rounded-xl p-3">
            <p className="text-white/60 text-xs leading-relaxed">
              My Perfect Pregnancy provides general nutrition education and food-structure support only. It is <span className="text-white/80 font-medium">not a substitute</span> for your OB/GYN, midwife, or registered dietitian. Always follow your healthcare provider's recommendations first.
            </p>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!stage || saving || saved}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
              saved
                ? "bg-green-700/60 text-white border border-green-500/40"
                : !stage || saving
                  ? "bg-white/10 text-white/40 cursor-not-allowed"
                  : "bg-gradient-to-r from-pink-600 to-orange-600 text-white active:scale-95"
            }`}
          >
            {saved ? "✓ Saved!" : saving ? "Saving…" : "Save My Pregnancy Setup"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
