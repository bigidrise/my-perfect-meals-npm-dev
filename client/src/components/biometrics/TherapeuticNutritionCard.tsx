import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { ChevronDown, ChevronUp, Dna, Loader2, Save } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import TherapeuticProtocolModal from "./TherapeuticProtocolModal";

interface TherapeuticSupportCtx {
  peptides: string[];
  hormones: string[];
  medications: string[];
  therapies: string[];
  recoveryGoals: string[];
}

interface ModalContent {
  headline: string;
  selectedItems: string[];
  activeProtocols: string[];
  priorities: string[];
  body: string;
  conflictPolicy: string;
}

const EMPTY_CTX: TherapeuticSupportCtx = {
  peptides: [],
  hormones: [],
  medications: [],
  therapies: [],
  recoveryGoals: [],
};

const PEPTIDE_OPTIONS = [
  { slug: "bpc-157", label: "BPC-157" },
  { slug: "tb-500", label: "TB-500" },
  { slug: "sermorelin", label: "Sermorelin" },
  { slug: "ipamorelin", label: "Ipamorelin" },
  { slug: "ghk-cu", label: "GHK-Cu" },
];

const HORMONE_OPTIONS = [
  { slug: "trt", label: "TRT / Testosterone" },
  { slug: "estrogen", label: "Estrogen Therapy" },
  { slug: "progesterone", label: "Progesterone Therapy" },
  { slug: "growth-hormone", label: "Growth Hormone" },
];

const MEDICATION_OPTIONS = [
  { slug: "prednisone", label: "Prednisone / Corticosteroids" },
  { slug: "metformin-therapeutic", label: "Metformin (Therapeutic)" },
];

const THERAPY_OPTIONS = [
  { slug: "connective-tissue-recovery", label: "Connective Tissue Recovery" },
  { slug: "gut-support", label: "Gut Support" },
  { slug: "red-light-therapy", label: "Red Light Therapy" },
  { slug: "sauna-recovery", label: "Sauna / Heat Recovery" },
  { slug: "cold-therapy", label: "Cold Therapy" },
];

const RECOVERY_GOAL_OPTIONS = [
  { slug: "joint-recovery", label: "Joint Recovery" },
  { slug: "muscle-recovery", label: "Muscle Recovery" },
  { slug: "sleep-optimization", label: "Sleep Optimization" },
  { slug: "inflammation-reduction", label: "Inflammation Reduction" },
  { slug: "gut-healing", label: "Gut Healing" },
];

function toggle(arr: string[], slug: string): string[] {
  return arr.includes(slug) ? arr.filter(s => s !== slug) : [...arr, slug];
}

function hasSelections(ctx: TherapeuticSupportCtx): boolean {
  return (
    ctx.peptides.length > 0 ||
    ctx.hormones.length > 0 ||
    ctx.medications.length > 0 ||
    ctx.therapies.length > 0 ||
    ctx.recoveryGoals.length > 0
  );
}

interface SelectionGroupProps {
  label: string;
  options: { slug: string; label: string }[];
  selected: string[];
  onToggle: (slug: string) => void;
}

function SelectionGroup({ label, options, selected, onToggle }: SelectionGroupProps) {
  return (
    <div className="space-y-2">
      <p className="text-white/50 text-[11px] uppercase tracking-wide font-semibold">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const active = selected.includes(opt.slug);
          return (
            <button
              key={opt.slug}
              onClick={() => onToggle(opt.slug)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 ${
                active
                  ? "bg-teal-600 text-white border border-teal-500"
                  : "bg-white/10 text-white/70 border border-white/10 active:bg-white/20"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TherapeuticNutritionCard() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ctx, setCtx] = useState<TherapeuticSupportCtx>(EMPTY_CTX);
  const [savedCtx, setSavedCtx] = useState<TherapeuticSupportCtx>(EMPTY_CTX);
  const [modalContent, setModalContent] = useState<ModalContent | null>(null);

  useEffect(() => {
    fetchContext();
  }, []);

  async function fetchContext() {
    try {
      const res = await fetch(apiUrl("/api/therapeutic/context"), {
        headers: await getAuthHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.context) {
        setCtx(data.context);
        setSavedCtx(data.context);
      }
    } catch {
      // silent — panel still usable
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/therapeutic/setup"), {
        method: "POST",
        headers: { ...(await getAuthHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify(ctx),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setSavedCtx(ctx);
      if (data.modalContent) {
        setModalContent(data.modalContent);
      } else {
        toast({ title: "Saved", description: "Therapeutic nutrition context updated." });
      }
    } catch {
      toast({ title: "Error", description: "Could not save. Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const isDirty = JSON.stringify(ctx) !== JSON.stringify(savedCtx);
  const isActive = hasSelections(savedCtx);

  return (
    <>
      <Card className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl">
        <CardHeader className="pb-3">
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full flex items-center justify-between text-left"
          >
            <CardTitle className="text-white text-xl flex items-center gap-2">
              <Dna className="w-5 h-5 text-teal-400" />
              Therapeutic Nutrition Intelligence
              {isActive && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-300 text-[10px] font-bold uppercase tracking-wide">
                  Active
                </span>
              )}
            </CardTitle>
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-white/40 flex-shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-white/40 flex-shrink-0" />
            )}
          </button>
          {!expanded && (
            <p className="text-white/50 text-sm mt-1 ml-7">
              {isActive
                ? `${[savedCtx.peptides, savedCtx.hormones, savedCtx.medications, savedCtx.therapies, savedCtx.recoveryGoals].flat().length} inputs active — tap to review`
                : "Peptides, hormones, medications, therapies, and recovery goals"}
            </p>
          )}
        </CardHeader>

        {expanded && (
          <CardContent className="space-y-5">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
              </div>
            ) : (
              <>
                <div className="text-xs text-white/40 leading-relaxed">
                  Select everything active. Your meals will be built around the intersection of all inputs.
                </div>

                <SelectionGroup
                  label="Peptides"
                  options={PEPTIDE_OPTIONS}
                  selected={ctx.peptides}
                  onToggle={slug => setCtx(c => ({ ...c, peptides: toggle(c.peptides, slug) }))}
                />

                <SelectionGroup
                  label="Hormones"
                  options={HORMONE_OPTIONS}
                  selected={ctx.hormones}
                  onToggle={slug => setCtx(c => ({ ...c, hormones: toggle(c.hormones, slug) }))}
                />

                <SelectionGroup
                  label="Medications Impacting Nutrition"
                  options={MEDICATION_OPTIONS}
                  selected={ctx.medications}
                  onToggle={slug => setCtx(c => ({ ...c, medications: toggle(c.medications, slug) }))}
                />

                <SelectionGroup
                  label="Therapies"
                  options={THERAPY_OPTIONS}
                  selected={ctx.therapies}
                  onToggle={slug => setCtx(c => ({ ...c, therapies: toggle(c.therapies, slug) }))}
                />

                <SelectionGroup
                  label="Recovery Goals"
                  options={RECOVERY_GOAL_OPTIONS}
                  selected={ctx.recoveryGoals}
                  onToggle={slug => setCtx(c => ({ ...c, recoveryGoals: toggle(c.recoveryGoals, slug) }))}
                />

                <div className="pt-1 flex gap-2">
                  <PillButton
                    onClick={handleSave}
                    disabled={saving || !isDirty}
                    className={`flex-1 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 ${
                      isDirty
                        ? "bg-teal-600 text-white"
                        : "bg-white/10 text-white/40"
                    }`}
                  >
                    {saving ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                    ) : (
                      <><Save className="w-4 h-4" /> Save Protocol</>
                    )}
                  </PillButton>
                  {isDirty && (
                    <PillButton
                      onClick={() => setCtx(savedCtx)}
                      className="px-4 py-2.5 rounded-xl bg-white/10 text-white/60 font-medium"
                    >
                      Cancel
                    </PillButton>
                  )}
                </div>

                <div className="text-[11px] text-white/30 leading-relaxed">
                  Clinical safety always takes priority. Selections inform meal generation and do not replace medical supervision.
                </div>
              </>
            )}
          </CardContent>
        )}
      </Card>

      {modalContent && (
        <TherapeuticProtocolModal
          content={modalContent}
          onClose={() => setModalContent(null)}
        />
      )}
    </>
  );
}
