import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PillButton } from "@/components/ui/pill-button";
import { apiRequest } from "@/lib/apiRequest";

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

const STAGE_OPTIONS: { labelKey: string; value: Stage; emoji: string; descriptionKey: string }[] = [
  { labelKey: "pregnancySupport.stage.tryingToConceive.label", value: "trying-to-conceive", emoji: "🌸", descriptionKey: "pregnancySupport.stage.tryingToConceive.desc" },
  { labelKey: "pregnancySupport.stage.trimester1.label", value: "trimester-1", emoji: "🌱", descriptionKey: "pregnancySupport.stage.trimester1.desc" },
  { labelKey: "pregnancySupport.stage.trimester2.label", value: "trimester-2", emoji: "🌿", descriptionKey: "pregnancySupport.stage.trimester2.desc" },
  { labelKey: "pregnancySupport.stage.trimester3.label", value: "trimester-3", emoji: "🌺", descriptionKey: "pregnancySupport.stage.trimester3.desc" },
  { labelKey: "pregnancySupport.stage.breastfeeding.label", value: "breastfeeding", emoji: "🤱", descriptionKey: "pregnancySupport.stage.breastfeeding.desc" },
  { labelKey: "pregnancySupport.stage.postpartum.label", value: "postpartum", emoji: "🩷", descriptionKey: "pregnancySupport.stage.postpartum.desc" },
];

const SYMPTOM_OPTIONS: { labelKey: string; value: Symptom; emoji: string }[] = [
  { labelKey: "pregnancySupport.symptom.nausea", value: "nausea", emoji: "🤢" },
  { labelKey: "pregnancySupport.symptom.heartburn", value: "heartburn", emoji: "🔥" },
  { labelKey: "pregnancySupport.symptom.constipation", value: "constipation", emoji: "😣" },
  { labelKey: "pregnancySupport.symptom.fatigue", value: "fatigue", emoji: "😴" },
  { labelKey: "pregnancySupport.symptom.foodAversions", value: "food_aversions", emoji: "🙅" },
  { labelKey: "pregnancySupport.symptom.swelling", value: "swelling", emoji: "💧" },
  { labelKey: "pregnancySupport.symptom.shortnessOfBreath", value: "shortness_of_breath", emoji: "😮‍💨" },
  { labelKey: "pregnancySupport.symptom.lowAppetite", value: "low_appetite", emoji: "😐" },
];

export function PregnancySupportSetupModal({ open, onOpenChange, onSaved }: PregnancySupportSetupModalProps) {
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage | null>(null);
  const [trackingMode, setTrackingMode] = useState<"due-date" | "manual">("manual");
  const [dueDate, setDueDate] = useState("");
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [isBreastfeeding, setIsBreastfeeding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  function toggleSymptom(s: Symptom) {
    setSymptoms(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  async function handleSave() {
    if (!stage) return;
    setSaving(true);
    try {
      await apiRequest("/api/pregnancy/setup", {
        method: "POST",
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
    } catch (err) {
      console.error("[PregnancySetup] save failed:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    setDeactivating(true);
    try {
      await apiRequest("/api/pregnancy/setup", { method: "DELETE" });
      onSaved?.({ stage: "", dueDate: null });
      setShowDeactivateConfirm(false);
      setTimeout(() => onOpenChange(false), 400);
    } catch (err) {
      console.error("[PregnancySetup] deactivate failed:", err);
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-black/95 border-t border-pink-500/30 text-white max-h-[90vh] overflow-y-auto rounded-t-3xl md:left-60"
      >
        <SheetHeader className="text-left pb-4 border-b border-white/10">
          <SheetTitle className="text-white text-xl flex items-center gap-2">
            🩷 {t("pregnancySupport.title")}
          </SheetTitle>
          <p className="text-white/60 text-xs leading-relaxed mt-1">
            {t("pregnancySupport.intro")}
          </p>
        </SheetHeader>

        <div className="py-5 space-y-6">
          {/* Stage selection */}
          <div>
            <p className="text-pink-300 text-sm font-semibold mb-3">{t("pregnancySupport.whereAreYou")}</p>
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
                    <p className="text-sm font-semibold">{t(opt.labelKey)}</p>
                    <p className="text-xs text-white/50">{t(opt.descriptionKey)}</p>
                  </div>
                  {stage === opt.value && (
                    <span className="ml-auto text-pink-400 text-sm">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Breastfeeding question — only for postpartum stage */}
          {stage === "postpartum" && (
            <div>
              <p className="text-pink-300 text-sm font-semibold mb-1">{t("pregnancySupport.breastfeedingQuestion")}</p>
              <p className="text-white/50 text-xs mb-3">
                {t("pregnancySupport.breastfeedingHelp")}
              </p>
              <div className="flex gap-2">
                <PillButton
                  active={isBreastfeeding === true}
                  onClick={() => setIsBreastfeeding(true)}
                >
                  {t("pregnancySupport.yesBreastfeeding")}
                </PillButton>
                <PillButton
                  active={isBreastfeeding === false}
                  onClick={() => setIsBreastfeeding(false)}
                >
                  {t("pregnancySupport.noBreastfeeding")}
                </PillButton>
              </div>
              {isBreastfeeding && (
                <p className="text-white/40 text-xs mt-2 leading-relaxed">
                  {t("pregnancySupport.breastfeedingNote")}
                </p>
              )}
              {!isBreastfeeding && (
                <p className="text-white/40 text-xs mt-2 leading-relaxed">
                  {t("pregnancySupport.postpartumNote")}
                </p>
              )}
            </div>
          )}

          {/* Due date — only for trimester stages */}
          {stage && ["trimester-1", "trimester-2", "trimester-3"].includes(stage) && (
            <div>
              <p className="text-pink-300 text-sm font-semibold mb-2">{t("pregnancySupport.trackByDueDate")}</p>
              <p className="text-white/50 text-xs mb-3">
                {t("pregnancySupport.trackByDueDateHelp")}
              </p>
              <div className="flex gap-2 mb-3">
                <PillButton
                  active={trackingMode === "due-date"}
                  onClick={() => setTrackingMode("due-date")}
                >
                  {t("pregnancySupport.yesEnterDueDate")}
                </PillButton>
                <PillButton
                  active={trackingMode === "manual"}
                  onClick={() => setTrackingMode("manual")}
                >
                  {t("pregnancySupport.skipManual")}
                </PillButton>
              </div>
              {trackingMode === "due-date" && (
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-pink-400/60"
                  placeholder={t("pregnancySupport.dueDatePlaceholder")}
                />
              )}
            </div>
          )}

          {/* Active symptoms */}
          {stage && stage !== "trying-to-conceive" && (
            <div>
              <p className="text-pink-300 text-sm font-semibold mb-1">{t("pregnancySupport.activeSymptoms")}</p>
              <p className="text-white/50 text-xs mb-3">
                {t("pregnancySupport.activeSymptomsHelp")}
              </p>
              <div className="flex flex-wrap gap-2">
                {SYMPTOM_OPTIONS.map(opt => (
                  <PillButton
                    key={opt.value}
                    active={symptoms.includes(opt.value)}
                    onClick={() => toggleSymptom(opt.value)}
                  >
                    {opt.emoji} {t(opt.labelKey)}
                  </PillButton>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="bg-pink-950/20 border border-pink-500/20 rounded-xl p-3">
            <p className="text-white/60 text-xs leading-relaxed">
              {t("pregnancySupport.disclaimerPart1")} <span className="text-white/80 font-medium">{t("pregnancySupport.disclaimerNotSubstitute")}</span> {t("pregnancySupport.disclaimerPart2")}
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
            {saved ? t("pregnancySupport.savedButton") : saving ? t("pregnancySupport.savingButton") : t("pregnancySupport.saveButton")}
          </button>

          {/* Deactivate section */}
          <div className="pt-2 border-t border-white/10">
            {!showDeactivateConfirm ? (
              <button
                onClick={() => setShowDeactivateConfirm(true)}
                className="w-full py-3 rounded-xl bg-white/10 border border-white/20 text-white text-sm font-semibold active:bg-white/20 transition-colors"
              >
                {t("pregnancySupport.turnOff")}
              </button>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                <p className="text-white/80 text-sm font-semibold">{t("pregnancySupport.turnOffConfirm")}</p>
                <p className="text-white/50 text-xs leading-relaxed">
                  {t("pregnancySupport.turnOffHelp")}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDeactivate}
                    disabled={deactivating}
                    className="flex-1 py-2.5 rounded-xl bg-white/10 text-white/80 text-xs font-semibold active:bg-white/20 transition-colors disabled:opacity-50"
                  >
                    {deactivating ? t("pregnancySupport.turningOff") : t("pregnancySupport.yesTurnOff")}
                  </button>
                  <button
                    onClick={() => setShowDeactivateConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl bg-pink-700/40 text-white text-xs font-semibold active:bg-pink-700/60 transition-colors"
                  >
                    {t("pregnancySupport.keepItOn")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
