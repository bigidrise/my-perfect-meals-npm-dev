import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import {
  Dna, Loader2, Save, ChevronDown, ChevronUp,
  FlaskConical, Pill, Zap, Heart, Target, Plus, X,
} from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import TherapeuticProtocolModal from "./TherapeuticProtocolModal";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TherapeuticEntry {
  type: string;
  dose: number;
  unit: string;
  frequency?: string;
  label?: string;
  custom?: boolean;
}

interface TherapeuticSupportCtx {
  peptides: TherapeuticEntry[];
  hormones: TherapeuticEntry[];
  medications: TherapeuticEntry[];
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

// ─────────────────────────────────────────────────────────────────────────────
// Entry row state — dose as string for UI, number on save
// ─────────────────────────────────────────────────────────────────────────────

interface EntryRow {
  type: string;
  label: string;
  dose: string;
  unit: string;
  placeholder: string;
  custom?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Preset definitions
// ─────────────────────────────────────────────────────────────────────────────

const PRESET_PEPTIDES: Omit<EntryRow, "dose">[] = [
  { type: "bpc-157",    label: "BPC-157",                    unit: "mcg/day",  placeholder: "e.g. 500" },
  { type: "tb-500",     label: "TB-500",                     unit: "mg/week",  placeholder: "e.g. 5"   },
  { type: "sermorelin", label: "Sermorelin",                  unit: "mcg/day",  placeholder: "e.g. 300" },
  { type: "ipamorelin", label: "Ipamorelin / CJC-1295",       unit: "mcg/day",  placeholder: "e.g. 300" },
  { type: "ghk-cu",     label: "GHK-Cu (Copper Peptide)",    unit: "mcg/day",  placeholder: "e.g. 2"   },
  { type: "pt-141",     label: "PT-141",                     unit: "mg/dose",  placeholder: "e.g. 1.75"},
  { type: "nad+",       label: "NAD+",                       unit: "mg/day",   placeholder: "e.g. 500" },
];

const PRESET_HORMONES: Omit<EntryRow, "dose">[] = [
  { type: "testosterone-cypionate",  label: "Testosterone Cypionate (TRT)",  unit: "mg/week",  placeholder: "e.g. 200" },
  { type: "testosterone-enanthate",  label: "Testosterone Enanthate",        unit: "mg/week",  placeholder: "e.g. 200" },
  { type: "estradiol",               label: "Estradiol (Estrogen)",          unit: "mg/day",   placeholder: "e.g. 1"   },
  { type: "progesterone",            label: "Progesterone",                  unit: "mg/day",   placeholder: "e.g. 200" },
  { type: "hgh",                     label: "Growth Hormone (HGH)",          unit: "IU/day",   placeholder: "e.g. 2"   },
  { type: "dhea",                    label: "DHEA",                          unit: "mg/day",   placeholder: "e.g. 25"  },
  { type: "thyroid-t3",              label: "T3 (Liothyronine)",             unit: "mcg/day",  placeholder: "e.g. 25"  },
];

const PRESET_MEDICATIONS: Omit<EntryRow, "dose">[] = [
  { type: "prednisone",   label: "Prednisone / Corticosteroids",      unit: "mg/day",   placeholder: "e.g. 20"  },
  { type: "metformin",    label: "Metformin",                         unit: "mg/day",   placeholder: "e.g. 1000"},
  { type: "semaglutide",  label: "Semaglutide (Ozempic / Wegovy)",    unit: "mg/week",  placeholder: "e.g. 0.5" },
  { type: "tirzepatide",  label: "Tirzepatide (Mounjaro)",            unit: "mg/week",  placeholder: "e.g. 5"   },
  { type: "tamoxifen",    label: "Tamoxifen",                         unit: "mg/day",   placeholder: "e.g. 20"  },
  { type: "anastrozole",  label: "Anastrozole (Aromatase Inhibitor)", unit: "mg/week",  placeholder: "e.g. 0.5" },
];

const THERAPY_OPTIONS = [
  { slug: "connective-tissue-recovery", labelKey: "therapeuticCard.therapyOptions.connectiveTissue" },
  { slug: "gut-support",                labelKey: "therapeuticCard.therapyOptions.gutSupport" },
  { slug: "red-light-therapy",          labelKey: "therapeuticCard.therapyOptions.redLight" },
  { slug: "sauna-recovery",             labelKey: "therapeuticCard.therapyOptions.sauna" },
  { slug: "cold-therapy",               labelKey: "therapeuticCard.therapyOptions.cold" },
  { slug: "iv-therapy",                 labelKey: "therapeuticCard.therapyOptions.iv" },
];

const RECOVERY_GOAL_OPTIONS = [
  { slug: "joint-recovery",         labelKey: "therapeuticCard.recoveryGoals.joint" },
  { slug: "muscle-recovery",        labelKey: "therapeuticCard.recoveryGoals.muscle" },
  { slug: "sleep-optimization",     labelKey: "therapeuticCard.recoveryGoals.sleep" },
  { slug: "inflammation-reduction", labelKey: "therapeuticCard.recoveryGoals.inflammation" },
  { slug: "gut-healing",            labelKey: "therapeuticCard.recoveryGoals.gutHealing" },
  { slug: "stress-recovery",        labelKey: "therapeuticCard.recoveryGoals.stress" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function buildPresetRows(presets: Omit<EntryRow, "dose">[]): EntryRow[] {
  return presets.map(p => ({ ...p, dose: "" }));
}

function mergeRows(presets: Omit<EntryRow, "dose">[], saved: TherapeuticEntry[]): EntryRow[] {
  const savedMap = new Map(saved.map(e => [e.type, e]));
  const presetTypes = new Set(presets.map(p => p.type));

  const merged: EntryRow[] = presets.map(p => {
    const s = savedMap.get(p.type);
    return { ...p, dose: s && s.dose > 0 ? String(s.dose) : "", unit: p.unit };
  });

  const customs: EntryRow[] = saved
    .filter(e => e.custom || !presetTypes.has(e.type))
    .map(e => ({
      type: e.type,
      label: e.label || e.type,
      dose: e.dose > 0 ? String(e.dose) : "",
      unit: e.unit,
      placeholder: "—",
      custom: true,
    }));

  return [...merged, ...customs];
}

function rowsToEntries(rows: EntryRow[]): TherapeuticEntry[] {
  return rows
    .filter(r => r.dose.trim() !== "" && parseFloat(r.dose) > 0)
    .map(r => ({
      type: r.type,
      dose: parseFloat(r.dose),
      unit: r.unit,
      label: r.custom ? r.label : undefined,
      custom: r.custom,
    }));
}

function activeCount(rows: EntryRow[]): number {
  return rows.filter(r => r.dose.trim() !== "" && parseFloat(r.dose) > 0).length;
}

function totalActiveCount(
  peptides: EntryRow[],
  hormones: EntryRow[],
  medications: EntryRow[],
  therapies: string[],
  recoveryGoals: string[],
): number {
  return (
    activeCount(peptides) +
    activeCount(hormones) +
    activeCount(medications) +
    therapies.length +
    recoveryGoals.length
  );
}

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

// ─────────────────────────────────────────────────────────────────────────────
// DoseRow — single preset entry row (label | input | unit)
// ─────────────────────────────────────────────────────────────────────────────

function DoseRow({
  row,
  onChange,
}: {
  row: EntryRow;
  onChange: (dose: string) => void;
}) {
  const isActive = row.dose.trim() !== "" && parseFloat(row.dose) > 0;
  return (
    <div className="flex items-center gap-2">
      <span className={`text-xs w-40 shrink-0 leading-tight ${isActive ? "text-teal-300/90" : "text-white/50"}`}>
        {row.label}
      </span>
      <div className="flex items-center gap-1 flex-1 min-w-0">
        <Input
          type="number"
          inputMode="decimal"
          step="any"
          value={row.dose}
          placeholder={row.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="bg-black/40 border-white/20 text-white placeholder:text-white/25 text-sm h-8 focus:bg-black/40 focus:text-white caret-white"
        />
        {row.unit && (
          <span className="text-[10px] text-white/30 shrink-0 w-14 text-left">{row.unit}</span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CustomDoseRow — user-added entry (name input | dose | unit | remove)
// ─────────────────────────────────────────────────────────────────────────────

function CustomDoseRow({
  row,
  onDoseChange,
  onLabelChange,
  onUnitChange,
  onRemove,
}: {
  row: EntryRow;
  onDoseChange: (v: string) => void;
  onLabelChange: (v: string) => void;
  onUnitChange: (v: string) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1.5 pt-1 border-t border-white/10">
      <Input
        type="text"
        value={row.label}
        placeholder={t("therapeuticCard.namePlaceholder")}
        onChange={(e) => onLabelChange(e.target.value)}
        className="bg-black/40 border-white/20 text-white placeholder:text-white/25 text-xs h-8 w-28 shrink-0"
      />
      <Input
        type="number"
        inputMode="decimal"
        step="any"
        value={row.dose}
        placeholder={t("therapeuticCard.dosePlaceholder")}
        onChange={(e) => onDoseChange(e.target.value)}
        className="bg-black/40 border-white/20 text-white placeholder:text-white/25 text-sm h-8 flex-1 min-w-0"
      />
      <Input
        type="text"
        value={row.unit}
        placeholder={t("therapeuticCard.unitPlaceholder")}
        onChange={(e) => onUnitChange(e.target.value)}
        className="bg-black/40 border-white/20 text-white placeholder:text-white/25 text-xs h-8 w-16 shrink-0"
      />
      <button
        onClick={onRemove}
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white/5 text-white/30 active:bg-white/20 active:text-white/70"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TherapeuticSection — collapsible section (matches ClinicalLabsCard pattern)
// ─────────────────────────────────────────────────────────────────────────────

function TherapeuticSection({
  id, label, icon, iconColor, open, onToggle, count, children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  iconColor: string;
  open: boolean;
  onToggle: () => void;
  count: number;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-white/20 overflow-hidden bg-black/20">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left active:opacity-80"
      >
        <div className="flex items-center gap-2.5">
          <span className={`shrink-0 ${iconColor}`}>{icon}</span>
          <span className="text-sm font-medium text-white/85">{label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {count > 0 && (
            <span className="text-[10px] font-semibold border rounded-full px-2 py-0.5 leading-none text-teal-300 bg-teal-500/10 border-teal-500/25">
              {t("therapeuticCard.activeCount", { count })}
            </span>
          )}
          {open
            ? <ChevronUp className="w-4 h-4 text-white/30" />
            : <ChevronDown className="w-4 h-4 text-white/30" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/20">
          {children}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function TherapeuticNutritionCard() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [peptideRows, setPeptideRows] = useState<EntryRow[]>(buildPresetRows(PRESET_PEPTIDES));
  const [hormoneRows, setHormoneRows] = useState<EntryRow[]>(buildPresetRows(PRESET_HORMONES));
  const [medicationRows, setMedicationRows] = useState<EntryRow[]>(buildPresetRows(PRESET_MEDICATIONS));
  const [selectedTherapies, setSelectedTherapies] = useState<string[]>([]);
  const [selectedRecoveryGoals, setSelectedRecoveryGoals] = useState<string[]>([]);

  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [modalContent, setModalContent] = useState<ModalContent | null>(null);

  // Saved state snapshot for dirty check
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");

  useEffect(() => {
    fetchContext();
  }, []);

  async function fetchContext() {
    try {
      const res = await fetch(apiUrl("/api/therapeutic/context"), {
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.context) {
        const ctx: TherapeuticSupportCtx = data.context;
        const mergedPeptides = mergeRows(PRESET_PEPTIDES, ctx.peptides);
        const mergedHormones = mergeRows(PRESET_HORMONES, ctx.hormones);
        const mergedMedications = mergeRows(PRESET_MEDICATIONS, ctx.medications);

        setPeptideRows(mergedPeptides);
        setHormoneRows(mergedHormones);
        setMedicationRows(mergedMedications);
        setSelectedTherapies(ctx.therapies ?? []);
        setSelectedRecoveryGoals(ctx.recoveryGoals ?? []);

        const sectionsToOpen = new Set<string>();
        if (activeCount(mergedPeptides) > 0) sectionsToOpen.add("peptides");
        if (activeCount(mergedHormones) > 0) sectionsToOpen.add("hormones");
        if (activeCount(mergedMedications) > 0) sectionsToOpen.add("medications");
        if ((ctx.therapies ?? []).length > 0) sectionsToOpen.add("therapies");
        if ((ctx.recoveryGoals ?? []).length > 0) sectionsToOpen.add("recovery");
        setOpenSections(sectionsToOpen);

        setSavedSnapshot(JSON.stringify(ctx));

        if (ctx.peptides.length > 0 || ctx.hormones.length > 0 || ctx.medications.length > 0) {
          setLastSaved(new Date().toLocaleDateString(undefined, {
            month: "short", day: "numeric", year: "numeric",
          }));
        }
      }
    } catch {
      // silent — panel still usable
    } finally {
      setLoading(false);
    }
  }

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  function addCustomRow(
    setter: React.Dispatch<React.SetStateAction<EntryRow[]>>,
    defaultUnit: string,
  ) {
    const id = `custom-${Date.now()}`;
    setter(rows => [
      ...rows,
      { type: id, label: "", dose: "", unit: defaultUnit, placeholder: "—", custom: true },
    ]);
  }

  function updateRow(
    setter: React.Dispatch<React.SetStateAction<EntryRow[]>>,
    type: string,
    field: keyof EntryRow,
    value: string,
  ) {
    setter(rows => rows.map(r => r.type === type ? { ...r, [field]: value } : r));
  }

  function removeCustomRow(
    setter: React.Dispatch<React.SetStateAction<EntryRow[]>>,
    type: string,
  ) {
    setter(rows => rows.filter(r => r.type !== type));
  }

  function toggleSlug(arr: string[], slug: string): string[] {
    return arr.includes(slug) ? arr.filter(s => s !== slug) : [...arr, slug];
  }

  const currentCtx: TherapeuticSupportCtx = {
    peptides: rowsToEntries(peptideRows),
    hormones: rowsToEntries(hormoneRows),
    medications: rowsToEntries(medicationRows),
    therapies: selectedTherapies,
    recoveryGoals: selectedRecoveryGoals,
  };
  const currentSnapshot = JSON.stringify(currentCtx);
  const isDirty = currentSnapshot !== savedSnapshot;

  const totalActive = totalActiveCount(
    peptideRows, hormoneRows, medicationRows,
    selectedTherapies, selectedRecoveryGoals,
  );
  // What was saved:
  const savedCtx: TherapeuticSupportCtx = savedSnapshot ? JSON.parse(savedSnapshot) : { peptides: [], hormones: [], medications: [], therapies: [], recoveryGoals: [] };
  const savedTotal = totalActiveCount(
    mergeRows(PRESET_PEPTIDES, savedCtx.peptides),
    mergeRows(PRESET_HORMONES, savedCtx.hormones),
    mergeRows(PRESET_MEDICATIONS, savedCtx.medications),
    savedCtx.therapies,
    savedCtx.recoveryGoals,
  );
  const isActive = savedTotal > 0;

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/therapeutic/setup"), {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(currentCtx),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();

      setSavedSnapshot(JSON.stringify(currentCtx));
      setLastSaved(new Date().toLocaleDateString(undefined, {
        month: "short", day: "numeric", year: "numeric",
      }));

      window.dispatchEvent(new Event("mpm:therapeuticUpdated"));

      if (data.modalContent) {
        setModalContent(data.modalContent);
      } else {
        toast({ title: t("therapeuticCard.toast.savedTitle"), description: t("therapeuticCard.toast.savedDesc") });
      }
    } catch {
      toast({ title: t("therapeuticCard.toast.errorTitle"), description: t("therapeuticCard.toast.errorDesc"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    const ctx: TherapeuticSupportCtx = savedSnapshot
      ? JSON.parse(savedSnapshot)
      : { peptides: [], hormones: [], medications: [], therapies: [], recoveryGoals: [] };
    setPeptideRows(mergeRows(PRESET_PEPTIDES, ctx.peptides));
    setHormoneRows(mergeRows(PRESET_HORMONES, ctx.hormones));
    setMedicationRows(mergeRows(PRESET_MEDICATIONS, ctx.medications));
    setSelectedTherapies(ctx.therapies ?? []);
    setSelectedRecoveryGoals(ctx.recoveryGoals ?? []);
  }

  return (
    <>
      <Card className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-white text-xl flex items-center gap-2">
            <Dna className="w-5 h-5 text-teal-400" />
            {t("therapeuticCard.title")}
            {isActive && (
              <PillButton active variant="emerald" className="ml-1 text-[8px]">
                {t("therapeuticCard.active")}
              </PillButton>
            )}
          </CardTitle>
          {lastSaved && (
            <span className="text-[10px] text-white/30 shrink-0">{t("therapeuticCard.last", { date: lastSaved })}</span>
          )}
        </CardHeader>

        <CardContent className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-white/30" />
            </div>
          ) : (
            <>
              <p className="text-[11px] text-white/35 leading-relaxed pb-1">
                {t("therapeuticCard.intro")}
              </p>

              {/* ── Peptides ──────────────────────────────────────────────── */}
              <TherapeuticSection
                id="peptides"
                label={t("therapeuticCard.sections.peptides")}
                icon={<FlaskConical className="w-4 h-4" />}
                iconColor="text-teal-400"
                open={openSections.has("peptides")}
                onToggle={() => toggleSection("peptides")}
                count={activeCount(peptideRows)}
              >
                {peptideRows.map(row => (
                  row.custom ? (
                    <CustomDoseRow
                      key={row.type}
                      row={row}
                      onDoseChange={v => updateRow(setPeptideRows, row.type, "dose", v)}
                      onLabelChange={v => updateRow(setPeptideRows, row.type, "label", v)}
                      onUnitChange={v => updateRow(setPeptideRows, row.type, "unit", v)}
                      onRemove={() => removeCustomRow(setPeptideRows, row.type)}
                    />
                  ) : (
                    <DoseRow
                      key={row.type}
                      row={row}
                      onChange={v => updateRow(setPeptideRows, row.type, "dose", v)}
                    />
                  )
                ))}
                <div className="pt-1">
                  <PillButton
                    onClick={() => addCustomRow(setPeptideRows, "mcg/day")}
                    className="text-[9px] px-3"
                  >
                    <Plus className="w-2.5 h-2.5 mr-1" /> {t("therapeuticCard.addPeptide")}
                  </PillButton>
                </div>
              </TherapeuticSection>

              {/* ── Hormones ─────────────────────────────────────────────── */}
              <TherapeuticSection
                id="hormones"
                label={t("therapeuticCard.sections.hormones")}
                icon={<Zap className="w-4 h-4" />}
                iconColor="text-amber-400"
                open={openSections.has("hormones")}
                onToggle={() => toggleSection("hormones")}
                count={activeCount(hormoneRows)}
              >
                {hormoneRows.map(row => (
                  row.custom ? (
                    <CustomDoseRow
                      key={row.type}
                      row={row}
                      onDoseChange={v => updateRow(setHormoneRows, row.type, "dose", v)}
                      onLabelChange={v => updateRow(setHormoneRows, row.type, "label", v)}
                      onUnitChange={v => updateRow(setHormoneRows, row.type, "unit", v)}
                      onRemove={() => removeCustomRow(setHormoneRows, row.type)}
                    />
                  ) : (
                    <DoseRow
                      key={row.type}
                      row={row}
                      onChange={v => updateRow(setHormoneRows, row.type, "dose", v)}
                    />
                  )
                ))}
                <div className="pt-1">
                  <PillButton
                    onClick={() => addCustomRow(setHormoneRows, "mg/week")}
                    className="text-[9px] px-3"
                  >
                    <Plus className="w-2.5 h-2.5 mr-1" /> {t("therapeuticCard.addHormone")}
                  </PillButton>
                </div>
              </TherapeuticSection>

              {/* ── Medications ──────────────────────────────────────────── */}
              <TherapeuticSection
                id="medications"
                label={t("therapeuticCard.sections.medications")}
                icon={<Pill className="w-4 h-4" />}
                iconColor="text-rose-400"
                open={openSections.has("medications")}
                onToggle={() => toggleSection("medications")}
                count={activeCount(medicationRows)}
              >
                {medicationRows.map(row => (
                  row.custom ? (
                    <CustomDoseRow
                      key={row.type}
                      row={row}
                      onDoseChange={v => updateRow(setMedicationRows, row.type, "dose", v)}
                      onLabelChange={v => updateRow(setMedicationRows, row.type, "label", v)}
                      onUnitChange={v => updateRow(setMedicationRows, row.type, "unit", v)}
                      onRemove={() => removeCustomRow(setMedicationRows, row.type)}
                    />
                  ) : (
                    <DoseRow
                      key={row.type}
                      row={row}
                      onChange={v => updateRow(setMedicationRows, row.type, "dose", v)}
                    />
                  )
                ))}
                <div className="pt-1">
                  <PillButton
                    onClick={() => addCustomRow(setMedicationRows, "mg/day")}
                    className="text-[9px] px-3"
                  >
                    <Plus className="w-2.5 h-2.5 mr-1" /> {t("therapeuticCard.addMedication")}
                  </PillButton>
                </div>
              </TherapeuticSection>

              {/* ── Therapies ────────────────────────────────────────────── */}
              <TherapeuticSection
                id="therapies"
                label={t("therapeuticCard.sections.therapies")}
                icon={<Heart className="w-4 h-4" />}
                iconColor="text-sky-400"
                open={openSections.has("therapies")}
                onToggle={() => toggleSection("therapies")}
                count={selectedTherapies.length}
              >
                <p className="text-[10px] text-white/35">{t("therapeuticCard.therapiesHint")}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {THERAPY_OPTIONS.map(opt => {
                    const active = selectedTherapies.includes(opt.slug);
                    return (
                      <PillButton
                        key={opt.slug}
                        active={active}
                        variant="sky"
                        onClick={() => setSelectedTherapies(arr => toggleSlug(arr, opt.slug))}
                        className="text-[9px] px-3 py-1"
                      >
                        {t(opt.labelKey)}
                      </PillButton>
                    );
                  })}
                </div>
              </TherapeuticSection>

              {/* ── Recovery Goals ───────────────────────────────────────── */}
              <TherapeuticSection
                id="recovery"
                label={t("therapeuticCard.sections.recovery")}
                icon={<Target className="w-4 h-4" />}
                iconColor="text-emerald-400"
                open={openSections.has("recovery")}
                onToggle={() => toggleSection("recovery")}
                count={selectedRecoveryGoals.length}
              >
                <p className="text-[10px] text-white/35">{t("therapeuticCard.recoveryHint")}</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {RECOVERY_GOAL_OPTIONS.map(opt => {
                    const active = selectedRecoveryGoals.includes(opt.slug);
                    return (
                      <PillButton
                        key={opt.slug}
                        active={active}
                        variant="emerald"
                        onClick={() => setSelectedRecoveryGoals(arr => toggleSlug(arr, opt.slug))}
                        className="text-[9px] px-3 py-1"
                      >
                        {t(opt.labelKey)}
                      </PillButton>
                    );
                  })}
                </div>
              </TherapeuticSection>

              {/* ── Save / Cancel ────────────────────────────────────────── */}
              <div className="pt-2 flex gap-2">
                <PillButton
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  active={isDirty}
                  variant="emerald"
                  className={`flex-1 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 text-[11px] ${
                    isDirty ? "" : "opacity-40"
                  }`}
                >
                  {saving ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("therapeuticCard.saving")}</>
                  ) : (
                    <><Save className="w-3.5 h-3.5" /> {t("therapeuticCard.saveProtocol")}</>
                  )}
                </PillButton>
                {isDirty && (
                  <PillButton
                    onClick={handleCancel}
                    className="px-4 py-2.5 rounded-xl text-[11px]"
                  >
                    {t("therapeuticCard.cancel")}
                  </PillButton>
                )}
              </div>

              <p className="text-[10px] text-white/25 leading-relaxed text-center pt-1">
                {t("therapeuticCard.footerNote")}
              </p>
            </>
          )}
        </CardContent>
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
