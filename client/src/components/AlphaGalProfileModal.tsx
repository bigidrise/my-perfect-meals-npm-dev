/**
 * AlphaGalProfileModal — Shared component for Alpha-gal Syndrome clinical profile collection.
 *
 * Used by both onboarding and Edit Profile so the same questions, field names,
 * and validation contract apply everywhere. Do NOT duplicate this logic.
 *
 * Props:
 *   open     — whether the modal is visible
 *   draft    — current in-progress answers (controlled)
 *   onChange — update the draft (functional updater)
 *   onSave   — called with the completed AlphaGalProfileData when user confirms
 *   onClose  — called when user dismisses without saving
 */

import { AlertTriangle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

// ── Shared Alpha-gal profile types ──────────────────────────────────────────

export interface AlphaGalProfileData {
  diagnosisStatus: "diagnosed" | "being_evaluated" | "no";
  dairyTolerance: "yes" | "no" | "unsure";
  gelatinRestriction: "yes" | "no" | "unsure";
  severeReactionHistory: "yes" | "no" | "unsure";
  profileComplete: boolean;
  activatedAt: string | null;
  updatedAt: string | null;
}

export type AlphaGalDraft = Pick<
  AlphaGalProfileData,
  "diagnosisStatus" | "dairyTolerance" | "gelatinRestriction" | "severeReactionHistory"
>;

export const DEFAULT_ALPHA_GAL_DRAFT: AlphaGalDraft = {
  diagnosisStatus: "diagnosed",
  dairyTolerance: "unsure",
  gelatinRestriction: "unsure",
  severeReactionHistory: "unsure",
};

// ── Modal component ──────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  draft: AlphaGalDraft;
  onChange: (updater: (d: AlphaGalDraft) => AlphaGalDraft) => void;
  onSave: (profile: AlphaGalProfileData) => void;
  onClose: () => void;
  /** When pre-existing profile exists, show as updating rather than first setup */
  isUpdate?: boolean;
}

export function AlphaGalProfileModal({ open, draft, onChange, onSave, onClose, isUpdate }: Props) {
  if (!open) return null;

  function handleSave() {
    onSave({
      diagnosisStatus: draft.diagnosisStatus,
      dairyTolerance: draft.dairyTolerance,
      gelatinRestriction: draft.gelatinRestriction,
      severeReactionHistory: draft.severeReactionHistory,
      profileComplete: true,
      activatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-zinc-900 border border-red-900/40 rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
              Alpha-gal Syndrome Details
            </h3>
            <p className="text-white/60 text-xs mt-1">
              {isUpdate
                ? "Update your Alpha-gal profile. Your answers shape exactly which ingredients are blocked."
                : "This helps us block the right ingredients safely. Answers stay private."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white flex-shrink-0 ml-3">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Q1: Diagnosis status */}
        <div className="space-y-2">
          <Label className="text-white/80 text-sm">How was this diagnosed?</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["diagnosed", "being_evaluated", "no"] as const).map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => onChange(d => ({ ...d, diagnosisStatus: val }))}
                className={`py-2 px-3 rounded-lg text-xs border transition-colors ${
                  draft.diagnosisStatus === val
                    ? "bg-red-900/60 border-red-500 text-white"
                    : "bg-white/5 border-white/20 text-white/60 hover:border-white/40"
                }`}
              >
                {val === "diagnosed" ? "Confirmed by doctor" : val === "being_evaluated" ? "Being evaluated" : "Self-suspected"}
              </button>
            ))}
          </div>
        </div>

        {/* Q2: Dairy tolerance */}
        <div className="space-y-2">
          <Label className="text-white/80 text-sm">Can you tolerate dairy (milk, cheese, yogurt)?</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["yes", "no", "unsure"] as const).map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => onChange(d => ({ ...d, dairyTolerance: val }))}
                className={`py-2 px-3 rounded-lg text-xs border transition-colors ${
                  draft.dairyTolerance === val
                    ? "bg-blue-900/60 border-blue-500 text-white"
                    : "bg-white/5 border-white/20 text-white/60 hover:border-white/40"
                }`}
              >
                {val === "yes" ? "Yes, tolerate" : val === "no" ? "No, avoid" : "Not sure yet"}
              </button>
            ))}
          </div>
          <p className="text-white/40 text-xs">Dairy tolerance varies — many people with Alpha-gal can still eat dairy.</p>
        </div>

        {/* Q3: Gelatin restriction */}
        <div className="space-y-2">
          <Label className="text-white/80 text-sm">Do you restrict gelatin or mammalian-derived thickeners?</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["yes", "no", "unsure"] as const).map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => onChange(d => ({ ...d, gelatinRestriction: val }))}
                className={`py-2 px-3 rounded-lg text-xs border transition-colors ${
                  draft.gelatinRestriction === val
                    ? "bg-purple-900/60 border-purple-500 text-white"
                    : "bg-white/5 border-white/20 text-white/60 hover:border-white/40"
                }`}
              >
                {val === "yes" ? "Yes, avoid" : val === "no" ? "No restriction" : "Not sure"}
              </button>
            ))}
          </div>
        </div>

        {/* Q4: Severe reaction history */}
        <div className="space-y-2">
          <Label className="text-white/80 text-sm">Have you had a severe or anaphylactic reaction?</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["yes", "no", "unsure"] as const).map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => onChange(d => ({ ...d, severeReactionHistory: val }))}
                className={`py-2 px-3 rounded-lg text-xs border transition-colors ${
                  draft.severeReactionHistory === val
                    ? "bg-amber-900/60 border-amber-500 text-white"
                    : "bg-white/5 border-white/20 text-white/60 hover:border-white/40"
                }`}
              >
                {val === "yes" ? "Yes" : val === "no" ? "No" : "Unsure"}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-1 space-y-2">
          <p className="text-xs text-white/40 leading-relaxed">
            Mammalian meats (beef, pork, lamb) and mammalian fats are always blocked regardless of answers above.
          </p>
          <Button
            type="button"
            onClick={handleSave}
            className="w-full bg-red-700 hover:bg-red-600 text-white"
          >
            <Check className="w-4 h-4 mr-2" />
            {isUpdate ? "Update Alpha-gal Profile" : "Save Alpha-gal Profile"}
          </Button>
        </div>
      </div>
    </div>
  );
}
