import { useState } from "react";
import { useLocation } from "wouter";
import { X, Pill, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import ShotTrackerPanel from "@/pages/glp1/ShotTrackerPanel";
import { useGLP1Profile } from "@/hooks/useGLP1";
import { useAuth } from "@/contexts/AuthContext";

interface GLP1CompanionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GLP1CompanionModal({ isOpen, onClose }: GLP1CompanionModalProps) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { data: glp1Profile } = useGLP1Profile();
  const [showGuardrails, setShowGuardrails] = useState(false);

  if (!isOpen) return null;

  const g = glp1Profile?.guardrails;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-gradient-to-b from-black/90 to-black/95 border border-orange-500/30 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-black/80 backdrop-blur-lg rounded-t-2xl sm:rounded-t-2xl">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Pill className="h-5 w-5 text-orange-400 shrink-0" />
            <div>
              <h2 className="text-white font-bold text-base leading-tight">GLP-1 Companion</h2>
              <p className="text-orange-400/80 text-xs">Active alongside your diabetic protocol</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PillButton
              onClick={() => { onClose(); setLocation("/glp1"); }}
              variant="default"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              Full Hub
            </PillButton>
            <div className="flex flex-col items-center gap-1">
              <PillButton onClick={onClose}>
                <X className="w-3 h-3" />
              </PillButton>
              <span className="text-[10px] text-white/50">Close</span>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Protocol stack notice */}
          <div className="rounded-xl border border-orange-500/25 bg-orange-500/8 px-4 py-3 space-y-1">
            <p className="text-sm text-white/80 leading-relaxed">
              Your meals are being generated with <span className="text-orange-400 font-semibold">both protocols active</span> — diabetic carb limits and GLP-1 portion / protein guardrails apply simultaneously. The stricter limit wins on each constraint.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {["Carb Control", "400 kcal Cap", "Protein ≥25g", "Nausea-Safe"].map(chip => (
                <span
                  key={chip}
                  className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/25 text-orange-300"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          {/* GLP-1 Guardrail Summary (collapsible) */}
          {g && (
            <section className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowGuardrails(!showGuardrails)}
                className="w-full px-4 py-3 flex items-center justify-between text-white"
              >
                <span className="text-sm font-semibold">GLP-1 Guardrails</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40">
                    {showGuardrails ? "Hide" : "View active limits"}
                  </span>
                  {showGuardrails
                    ? <ChevronUp className="h-4 w-4 text-white/40" />
                    : <ChevronDown className="h-4 w-4 text-white/40" />
                  }
                </div>
              </button>

              {showGuardrails && (
                <div className="px-4 pb-4 grid grid-cols-2 gap-3">
                  {[
                    { label: "Max Meal Volume", value: g.maxMealVolumeMl ? `${g.maxMealVolumeMl} mL` : "—" },
                    { label: "Protein Min", value: g.proteinMinG ? `${g.proteinMinG}g / meal` : "—" },
                    { label: "Fat Max", value: g.fatMaxG ? `${g.fatMaxG}g / meal` : "—" },
                    { label: "Fiber Min", value: g.fiberMinG ? `${g.fiberMinG}g / day` : "—" },
                    { label: "Hydration Goal", value: g.hydrationMinMl ? `${g.hydrationMinMl} mL` : "—" },
                    { label: "Meals / Day", value: g.mealsPerDay ? String(g.mealsPerDay) : "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-black/30 rounded-lg px-3 py-2">
                      <div className="text-[10px] text-white/40 uppercase tracking-wide mb-0.5">{label}</div>
                      <div className="text-sm text-white font-medium">{value}</div>
                    </div>
                  ))}
                  <div className="col-span-2 flex flex-wrap gap-2 pt-1">
                    {g.slowDigestOnly && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-500/15 border border-teal-400/25 text-teal-300">
                        Slow-digest only
                      </span>
                    )}
                    {g.limitCarbonation && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-400/25 text-blue-300">
                        No carbonation
                      </span>
                    )}
                    {g.limitAlcohol && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/25 text-amber-300">
                        Limit alcohol
                      </span>
                    )}
                  </div>
                  <div className="col-span-2 mt-1">
                    <PillButton
                      onClick={() => { onClose(); setLocation("/glp1"); }}
                      variant="default"
                    >
                      Edit Guardrails in GLP-1 Hub
                    </PillButton>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Shot Tracker */}
          <section className="bg-black/50 border border-orange-500/20 rounded-xl p-4">
            <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
              <Pill className="h-4 w-4 text-orange-400" />
              Shot Tracker
            </h3>
            {user?.id ? (
              <ShotTrackerPanel
                userId={user.id.toString()}
                onClose={onClose}
              />
            ) : (
              <p className="text-white/50 text-sm">Loading your profile...</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
