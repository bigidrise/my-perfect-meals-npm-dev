import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  FlaskConical, Loader2, Save,
  ChevronDown, ChevronUp,
  Heart, Droplets, Brain, Beaker, Activity, Flame, Wind,
} from "lucide-react";
import ProtocolRecommendationModal from "@/components/clinical/ProtocolRecommendationModal";
import ThyroidRecommendationModal from "@/components/clinical/ThyroidRecommendationModal";
import ProtocolDowngradeModal from "@/components/clinical/ProtocolDowngradeModal";
import type { LabProtocolSignal, ThyroidLabSignal, LabDowngradeSignal } from "@shared/clinical/protocolDecision";

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LabValues {
  // Cardiac & Metabolic
  ldl: string;
  hdl: string;
  triglycerides: string;
  blood_pressure_systolic: string;
  blood_pressure_diastolic: string;
  ejection_fraction: string;
  // Diabetes & Insulin
  a1c: string;
  glucose: string;
  fasting_insulin: string;
  // Hormonal / Stress
  cortisol: string;
  // Liver Panel
  alt: string;
  ast: string;
  bilirubin: string;
  albumin: string;
  // Thyroid Panel
  tsh: string;
  free_t4: string;
  free_t3: string;
  tpo_antibodies: string;
  thyroglobulin_antibodies: string;
  // Kidney / Renal
  creatinine: string;
  bun: string;
  inr: string;
  // Inflammation & Recovery
  crp: string;
  // Metadata
  notes: string;
  lab_date: string;
}

const EMPTY_LABS: LabValues = {
  ldl: "", hdl: "", triglycerides: "",
  blood_pressure_systolic: "", blood_pressure_diastolic: "", ejection_fraction: "",
  a1c: "", glucose: "", fasting_insulin: "",
  cortisol: "",
  alt: "", ast: "", bilirubin: "", albumin: "",
  tsh: "", free_t4: "", free_t3: "", tpo_antibodies: "", thyroglobulin_antibodies: "",
  creatinine: "", bun: "", inr: "",
  crp: "",
  notes: "",
  lab_date: todayIso(),
};

// ---------------------------------------------------------------------------
// Status chip — evaluates entered values against clinical thresholds
// ---------------------------------------------------------------------------

type FieldCheck =
  | { key: keyof LabValues; dir: "high"; threshold: number }
  | { key: keyof LabValues; dir: "low"; threshold: number }
  | { key: keyof LabValues; dir: "either"; hi: number; lo: number };

function evalStatus(form: LabValues, checks: FieldCheck[]) {
  let entered = 0;
  let elevated = 0;
  for (const c of checks) {
    const raw = (form[c.key] as string).trim();
    if (!raw) continue;
    const n = parseFloat(raw);
    if (!isFinite(n)) continue;
    entered++;
    if (c.dir === "high"   && n >  c.threshold) elevated++;
    if (c.dir === "low"    && n <  c.threshold) elevated++;
    if (c.dir === "either" && (n > c.hi || n < c.lo)) elevated++;
  }
  if (entered === 0) return null;
  if (elevated === 0) return { label: "Normal",    cls: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" };
  if (elevated === 1) return { label: "Needs review", cls: "text-amber-400 bg-amber-500/10 border-amber-500/25" };
  return { label: `${elevated} elevated`, cls: "text-red-400 bg-red-500/10 border-red-500/25" };
}

// ---------------------------------------------------------------------------
// Section definitions
// ---------------------------------------------------------------------------

interface SectionDef {
  id: string;
  label: string;
  icon: React.ReactNode;
  iconColor: string;
  checks: FieldCheck[];
  content: (form: LabValues, onChange: (k: keyof LabValues, v: string) => void) => React.ReactNode;
}

// ---------------------------------------------------------------------------
// LabField sub-component
// ---------------------------------------------------------------------------

function LabField({
  label, name, value, unit, placeholder, onChange,
}: {
  label: string; name: keyof LabValues; value: string;
  unit?: string; placeholder?: string;
  onChange: (k: keyof LabValues, v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/50 w-36 shrink-0">{label}</span>
      <div className="flex items-center gap-1 flex-1">
        <Input
          type="number" inputMode="decimal" step="any"
          value={value} placeholder={placeholder || "—"}
          onChange={(e) => onChange(name, e.target.value)}
          className="bg-black/40 border-white/20 text-white placeholder:text-white/25 text-sm h-8 focus:bg-black/40 focus:text-white caret-white"
        />
        {unit && <span className="text-[10px] text-white/30 shrink-0">{unit}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CollapsibleSection sub-component
// ---------------------------------------------------------------------------

function CollapsibleSection({
  section, form, open, onToggle, onChange,
}: {
  section: SectionDef;
  form: LabValues;
  open: boolean;
  onToggle: () => void;
  onChange: (k: keyof LabValues, v: string) => void;
}) {
  const status = evalStatus(form, section.checks);

  return (
    <div className="rounded-xl border border-white/8 overflow-hidden bg-black/20">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left active:opacity-80"
      >
        <div className="flex items-center gap-2.5">
          <span className={`shrink-0 ${section.iconColor}`}>{section.icon}</span>
          <span className="text-sm font-medium text-white/85">{section.label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {status && (
            <span className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 leading-none ${status.cls}`}>
              {status.label}
            </span>
          )}
          {open
            ? <ChevronUp className="w-4 h-4 text-white/30" />
            : <ChevronDown className="w-4 h-4 text-white/30" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-white/8">
          {section.content(form, onChange)}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ClinicalLabsCardProps {
  userId: string;
}

export default function ClinicalLabsCard({ userId }: ClinicalLabsCardProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<LabValues>(EMPTY_LABS);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const [pendingSignal, setPendingSignal] = useState<LabProtocolSignal | null>(null);
  const [pendingLabId, setPendingLabId] = useState<number | null>(null);
  const [physicianLocked, setPhysicianLocked] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [pendingThyroidSignal, setPendingThyroidSignal] = useState<ThyroidLabSignal | null>(null);
  const [showThyroidModal, setShowThyroidModal] = useState(false);

  const [downgradeQueue, setDowngradeQueue] = useState<LabDowngradeSignal[]>([]);
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const fetchLabs = async () => {
      setLoading(true);
      try {
        const res = await fetch(apiUrl(`/api/biometrics/labs/${userId}`), {
          headers: { ...getAuthHeaders() },
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.labs) {
          const l = data.labs;
          const loaded: LabValues = {
            ldl:                     l.ldl                     != null ? String(l.ldl)                     : "",
            hdl:                     l.hdl                     != null ? String(l.hdl)                     : "",
            triglycerides:           l.triglycerides           != null ? String(l.triglycerides)           : "",
            blood_pressure_systolic: l.blood_pressure_systolic != null ? String(l.blood_pressure_systolic) : "",
            blood_pressure_diastolic:l.blood_pressure_diastolic!= null ? String(l.blood_pressure_diastolic): "",
            ejection_fraction:       l.ejection_fraction       != null ? String(l.ejection_fraction)       : "",
            a1c:                     l.a1c                     != null ? String(l.a1c)                     : "",
            glucose:                 l.glucose                 != null ? String(l.glucose)                 : "",
            fasting_insulin:         l.fasting_insulin         != null ? String(l.fasting_insulin)         : "",
            cortisol:                l.cortisol                != null ? String(l.cortisol)                : "",
            alt:                     l.alt                     != null ? String(l.alt)                     : "",
            ast:                     l.ast                     != null ? String(l.ast)                     : "",
            bilirubin:               l.bilirubin               != null ? String(l.bilirubin)               : "",
            albumin:                 l.albumin                 != null ? String(l.albumin)                 : "",
            tsh:                     l.tsh                     != null ? String(l.tsh)                     : "",
            free_t4:                 l.free_t4                 != null ? String(l.free_t4)                 : "",
            free_t3:                 l.free_t3                 != null ? String(l.free_t3)                 : "",
            tpo_antibodies:          l.tpo_antibodies          != null ? String(l.tpo_antibodies)          : "",
            thyroglobulin_antibodies:l.thyroglobulin_antibodies!= null ? String(l.thyroglobulin_antibodies): "",
            creatinine:              l.creatinine              != null ? String(l.creatinine)              : "",
            bun:                     l.bun                     != null ? String(l.bun)                     : "",
            inr:                     l.inr                     != null ? String(l.inr)                     : "",
            crp:                     l.crp                     != null ? String(l.crp)                     : "",
            notes:    l.notes    || "",
            lab_date: l.lab_date || todayIso(),
          };
          setForm(loaded);

          // Auto-expand sections that have saved data
          const sectionsWithData = new Set<string>();
          if ([loaded.ldl, loaded.hdl, loaded.triglycerides, loaded.blood_pressure_systolic, loaded.ejection_fraction].some(Boolean)) sectionsWithData.add("cardiac");
          if ([loaded.a1c, loaded.glucose, loaded.fasting_insulin].some(Boolean)) sectionsWithData.add("diabetes");
          if (loaded.cortisol) sectionsWithData.add("hormonal");
          if ([loaded.alt, loaded.ast, loaded.bilirubin, loaded.albumin].some(Boolean)) sectionsWithData.add("liver");
          if ([loaded.tsh, loaded.free_t4, loaded.free_t3, loaded.tpo_antibodies, loaded.thyroglobulin_antibodies].some(Boolean)) sectionsWithData.add("thyroid");
          if ([loaded.creatinine, loaded.bun, loaded.inr].some(Boolean)) sectionsWithData.add("kidney");
          if (loaded.crp) sectionsWithData.add("inflammation");
          setOpenSections(sectionsWithData);

          setLastSaved(
            new Date(l.recorded_at).toLocaleDateString(undefined, {
              month: "short", day: "numeric", year: "numeric",
            })
          );
        }
      } catch {
        // silently ignore
      } finally {
        setLoading(false);
      }
    };
    fetchLabs();
  }, [userId]);

  const handleChange = (name: keyof LabValues, val: string) => {
    setForm((prev) => ({ ...prev, [name]: val }));
  };

  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    const hasAnyValue = Object.entries(form).some(
      ([k, v]) => k !== "notes" && k !== "lab_date" && (v as string).trim() !== ""
    );
    if (!hasAnyValue) {
      toast({ title: "Enter at least one lab value before saving", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = { recorded_at: new Date().toISOString() };
      const numFields: Array<keyof LabValues> = [
        "ldl", "hdl", "triglycerides",
        "blood_pressure_systolic", "blood_pressure_diastolic", "ejection_fraction",
        "a1c", "glucose", "fasting_insulin",
        "cortisol",
        "alt", "ast", "bilirubin", "albumin",
        "tsh", "free_t4", "free_t3", "tpo_antibodies", "thyroglobulin_antibodies",
        "creatinine", "bun", "inr",
        "crp",
      ];
      for (const field of numFields) {
        const v = (form[field] as string).trim();
        payload[field] = v !== "" ? parseFloat(v) : null;
      }
      payload.notes = form.notes.trim() || null;
      payload.lab_date = form.lab_date || todayIso();

      const res = await fetch(apiUrl("/api/biometrics/labs"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Save failed");

      const data = await res.json();

      setLastSaved(new Date().toLocaleDateString(undefined, {
        month: "short", day: "numeric", year: "numeric",
      }));

      const hasProtocol        = !!data.protocolSignal;
      const hasThyroid         = !!data.thyroidSignal?.hasThyroidIndicators;
      const hasDowngrades      = Array.isArray(data.downgradeSignals) && data.downgradeSignals.length > 0;
      const thyroidMonitoring  = !!data.thyroidMonitoring;
      const labId              = data.labId ?? null;

      if (hasThyroid)   { setPendingThyroidSignal(data.thyroidSignal); setPendingLabId(labId); }
      if (hasDowngrades){ setDowngradeQueue(data.downgradeSignals); setPendingLabId(labId); }

      if (hasProtocol) {
        setPendingSignal(data.protocolSignal);
        setPendingLabId(labId);
        setPhysicianLocked(!!data.physicianLocked);
        setShowModal(true);
      } else if (hasThyroid) {
        setShowThyroidModal(true);
      } else if (hasDowngrades) {
        setShowDowngradeModal(true);
      } else if (thyroidMonitoring) {
        toast({
          title: "Thyroid Labs Saved",
          description:
            "Some markers (TPO or Thyroglobulin antibodies) are still above the reference range. " +
            "Your Thyroid Support protocol remains active. When all markers return to normal, " +
            "you'll be prompted to reassess.",
        });
      } else {
        toast({ title: "Clinical Labs Saved", description: "Your lab values have been recorded." });
      }
    } catch {
      toast({ title: "Failed to save labs", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const PROTOCOL_LABEL: Record<string, string> = {
    "liver-disease":       "Liver Disease",
    "kidney-disease":      "Kidney Disease",
    "heart-failure":       "Cardiac Health",
    "liver-support":       "Liver Support",
    "metabolic-support":   "Metabolic Support",
    "inflammation-support":"Inflammation Support",
    "metabolic-stress":    "Metabolic Stress Support",
  };

  function advanceChain(opts: { skipThyroid?: boolean; skipDowngrades?: boolean } = {}) {
    if (!opts.skipThyroid && pendingThyroidSignal) { setShowThyroidModal(true); return; }
    if (!opts.skipDowngrades && downgradeQueue.length > 0) { setShowDowngradeModal(true); return; }
    setPendingLabId(null);
    toast({ title: "Clinical Labs Saved", description: "Your lab values have been recorded." });
  }

  const handleModalAccepted = () => {
    const label = pendingSignal ? (PROTOCOL_LABEL[pendingSignal.protocol] ?? "Clinical") : "Clinical";
    toast({ title: `${label} protocol activated`, description: "Your meals will now follow the recommended nutrition guardrails." });
    setShowModal(false);
    setPendingSignal(null);
    if (pendingThyroidSignal) {
      setShowThyroidModal(true);
    } else if (downgradeQueue.length > 0) {
      setShowDowngradeModal(true);
    } else {
      setTimeout(() => { window.location.href = "/anti-inflammatory-menu-builder"; }, 700);
    }
  };

  const handleModalClose = () => { setShowModal(false); setPendingSignal(null); advanceChain(); };

  const handleThyroidAccepted = () => {
    toast({ title: "Thyroid Support activated", description: "Your meals will now include thyroid-supportive nutrition guidance." });
    setShowThyroidModal(false); setPendingThyroidSignal(null); advanceChain({ skipThyroid: true });
  };

  const handleThyroidClose = () => { setShowThyroidModal(false); setPendingThyroidSignal(null); advanceChain({ skipThyroid: true }); };

  const handleDowngradeRemoved = () => {
    const current = downgradeQueue[0];
    if (current) {
      toast({ title: `${current.protocolLabel} protocol removed`, description: "You have returned to the Anti-Inflammatory foundation." });
    }
    const remaining = downgradeQueue.slice(1);
    setDowngradeQueue(remaining);
    setShowDowngradeModal(false);
    if (remaining.length > 0) setTimeout(() => setShowDowngradeModal(true), 180);
    else setPendingLabId(null);
  };

  const handleDowngradeKept = () => {
    const remaining = downgradeQueue.slice(1);
    setDowngradeQueue(remaining);
    setShowDowngradeModal(false);
    if (remaining.length > 0) setTimeout(() => setShowDowngradeModal(true), 180);
    else { setPendingLabId(null); toast({ title: "Clinical Labs Saved", description: "Your lab values have been recorded." }); }
  };

  // ── TG/HDL ratio for display in Cardiac section ──────────────────────────
  const tgHdlRatio = (() => {
    const tg  = parseFloat(form.triglycerides);
    const hdl = parseFloat(form.hdl);
    if (isFinite(tg) && isFinite(hdl) && hdl > 0) return (tg / hdl).toFixed(2);
    return null;
  })();

  // ---------------------------------------------------------------------------
  // Section definitions
  // ---------------------------------------------------------------------------

  const SECTIONS: SectionDef[] = [
    {
      id: "cardiac",
      label: "Cardiac & Metabolic",
      icon: <Heart className="w-4 h-4" />,
      iconColor: "text-rose-400",
      checks: [
        { key: "ldl",                     dir: "high", threshold: 130 },
        { key: "blood_pressure_systolic",  dir: "high", threshold: 130 },
        { key: "ejection_fraction",        dir: "low",  threshold: 50  },
        { key: "triglycerides",            dir: "high", threshold: 150 },
      ],
      content: (f, oc) => (
        <>
          <LabField label="LDL"          name="ldl"          value={f.ldl}          unit="mg/dL" placeholder="e.g. 145" onChange={oc} />
          <LabField label="HDL"          name="hdl"          value={f.hdl}          unit="mg/dL" placeholder="e.g. 55"  onChange={oc} />
          <LabField label="Triglycerides" name="triglycerides" value={f.triglycerides} unit="mg/dL" placeholder="e.g. 130" onChange={oc} />
          {tgHdlRatio && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/50 w-36 shrink-0">TG/HDL Ratio</span>
              <div className="flex items-center gap-2 flex-1">
                <span className="text-sm text-white/80 font-mono">{tgHdlRatio}</span>
                <span className={`text-[10px] border rounded-full px-1.5 py-0.5 leading-none font-semibold ${parseFloat(tgHdlRatio) > 3.5 ? "text-amber-400 bg-amber-500/10 border-amber-500/25" : "text-emerald-400 bg-emerald-500/10 border-emerald-500/25"}`}>
                  {parseFloat(tgHdlRatio) > 3.5 ? "Elevated" : "Normal"}
                </span>
              </div>
            </div>
          )}
          {/* Blood Pressure — dual input */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50 w-36 shrink-0">Blood Pressure</span>
            <div className="flex items-center gap-1 flex-1">
              <Input
                type="number" inputMode="numeric"
                value={f.blood_pressure_systolic} placeholder="Sys"
                onChange={(e) => oc("blood_pressure_systolic", e.target.value)}
                className="bg-black/40 border-white/20 text-white placeholder:text-white/25 text-sm h-8 focus:bg-black/40 focus:text-white caret-white"
              />
              <span className="text-white/30 text-sm">/</span>
              <Input
                type="number" inputMode="numeric"
                value={f.blood_pressure_diastolic} placeholder="Dia"
                onChange={(e) => oc("blood_pressure_diastolic", e.target.value)}
                className="bg-black/40 border-white/20 text-white placeholder:text-white/25 text-sm h-8 focus:bg-black/40 focus:text-white caret-white"
              />
              <span className="text-[10px] text-white/30 shrink-0">mmHg</span>
            </div>
          </div>
          <LabField label="Ejection Fraction" name="ejection_fraction" value={f.ejection_fraction} unit="%" placeholder="e.g. 55" onChange={oc} />
        </>
      ),
    },
    {
      id: "diabetes",
      label: "Diabetes & Insulin",
      icon: <Droplets className="w-4 h-4" />,
      iconColor: "text-sky-400",
      checks: [
        { key: "a1c",            dir: "high", threshold: 5.7  },
        { key: "glucose",        dir: "high", threshold: 100  },
        { key: "fasting_insulin",dir: "high", threshold: 15   },
      ],
      content: (f, oc) => (
        <>
          <LabField label="A1C"             name="a1c"             value={f.a1c}             unit="%"       placeholder="e.g. 6.2" onChange={oc} />
          <LabField label="Fasting Glucose" name="glucose"         value={f.glucose}         unit="mg/dL"   placeholder="e.g. 95"  onChange={oc} />
          <LabField label="Fasting Insulin" name="fasting_insulin" value={f.fasting_insulin} unit="µIU/mL" placeholder="e.g. 10"  onChange={oc} />
        </>
      ),
    },
    {
      id: "hormonal",
      label: "Hormonal / Stress",
      icon: <Brain className="w-4 h-4" />,
      iconColor: "text-amber-400",
      checks: [
        { key: "cortisol", dir: "high", threshold: 20 },
      ],
      content: (f, oc) => (
        <LabField label="Cortisol (AM)" name="cortisol" value={f.cortisol} unit="µg/dL" placeholder="e.g. 14" onChange={oc} />
      ),
    },
    {
      id: "liver",
      label: "Liver Panel",
      icon: <Beaker className="w-4 h-4" />,
      iconColor: "text-amber-500",
      checks: [
        { key: "alt",       dir: "high", threshold: 36  },
        { key: "ast",       dir: "high", threshold: 33  },
        { key: "bilirubin", dir: "high", threshold: 1.2 },
        { key: "albumin",   dir: "low",  threshold: 3.4 },
      ],
      content: (f, oc) => (
        <>
          <LabField label="ALT"              name="alt"       value={f.alt}       unit="U/L"   placeholder="e.g. 25"  onChange={oc} />
          <LabField label="AST"              name="ast"       value={f.ast}       unit="U/L"   placeholder="e.g. 22"  onChange={oc} />
          <LabField label="Bilirubin (Total)"name="bilirubin" value={f.bilirubin} unit="mg/dL" placeholder="e.g. 0.8" onChange={oc} />
          <LabField label="Albumin"          name="albumin"   value={f.albumin}   unit="g/dL"  placeholder="e.g. 4.0" onChange={oc} />
        </>
      ),
    },
    {
      id: "thyroid",
      label: "Thyroid Panel",
      icon: <Activity className="w-4 h-4" />,
      iconColor: "text-teal-400",
      checks: [
        { key: "tsh",                     dir: "either", hi: 4.5, lo: 0.4 },
        { key: "free_t4",                 dir: "low",    threshold: 0.8   },
        { key: "free_t3",                 dir: "low",    threshold: 2.3   },
        { key: "tpo_antibodies",          dir: "high",   threshold: 9     },
        { key: "thyroglobulin_antibodies",dir: "high",   threshold: 1     },
      ],
      content: (f, oc) => (
        <>
          <LabField label="TSH"              name="tsh"                      value={f.tsh}                      unit="mIU/L" placeholder="e.g. 2.5"  onChange={oc} />
          <LabField label="Free T4"          name="free_t4"                  value={f.free_t4}                  unit="ng/dL" placeholder="e.g. 1.2"  onChange={oc} />
          <LabField label="Free T3"          name="free_t3"                  value={f.free_t3}                  unit="pg/mL" placeholder="e.g. 3.1"  onChange={oc} />
          <LabField label="TPO Antibodies"   name="tpo_antibodies"           value={f.tpo_antibodies}           unit="IU/mL" placeholder="e.g. 17"   onChange={oc} />
          <LabField label="Thyroglobulin Ab" name="thyroglobulin_antibodies" value={f.thyroglobulin_antibodies} unit="IU/mL" placeholder="e.g. 245"  onChange={oc} />
        </>
      ),
    },
    {
      id: "kidney",
      label: "Kidney / Renal",
      icon: <Wind className="w-4 h-4" />,
      iconColor: "text-blue-400",
      checks: [
        { key: "creatinine", dir: "high", threshold: 1.2 },
        { key: "bun",        dir: "high", threshold: 20  },
      ],
      content: (f, oc) => (
        <>
          <LabField label="Creatinine" name="creatinine" value={f.creatinine} unit="mg/dL" placeholder="e.g. 1.1" onChange={oc} />
          <LabField label="BUN"        name="bun"        value={f.bun}        unit="mg/dL" placeholder="e.g. 18"  onChange={oc} />
          <LabField label="INR"        name="inr"        value={f.inr}                     placeholder="e.g. 1.0" onChange={oc} />
        </>
      ),
    },
    {
      id: "inflammation",
      label: "Inflammation & Recovery",
      icon: <Flame className="w-4 h-4" />,
      iconColor: "text-orange-400",
      checks: [
        { key: "crp", dir: "high", threshold: 3.0 },
      ],
      content: (f, oc) => (
        <LabField label="CRP (hs-CRP)" name="crp" value={f.crp} unit="mg/L" placeholder="e.g. 1.5" onChange={oc} />
      ),
    },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <Card className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-white text-xl flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-cyan-400" />
            Clinical Labs
          </CardTitle>
          {lastSaved && (
            <span className="text-[10px] text-white/30">Last: {lastSaved}</span>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-white/30" />
            </div>
          ) : (
            <>
              {/* Lab Date — always visible */}
              <div className="flex items-center gap-2 pb-2 mb-1 border-b border-white/10">
                <span className="text-xs text-white/50 w-36 shrink-0">Lab Date</span>
                <Input
                  type="date"
                  value={form.lab_date}
                  max={todayIso()}
                  onChange={(e) => handleChange("lab_date", e.target.value)}
                  className="bg-black/40 border-white/20 text-white text-sm h-8 focus:bg-black/40 focus:text-white caret-white flex-1"
                />
              </div>

              {/* Collapsible sections */}
              {SECTIONS.map((section) => (
                <CollapsibleSection
                  key={section.id}
                  section={section}
                  form={form}
                  open={openSections.has(section.id)}
                  onToggle={() => toggleSection(section.id)}
                  onChange={handleChange}
                />
              ))}

              {/* Notes — always visible */}
              <div className="flex items-start gap-2 pt-2">
                <span className="text-xs text-white/50 w-36 shrink-0 pt-2">Notes</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => handleChange("notes", e.target.value)}
                  placeholder="Optional provider notes..."
                  rows={2}
                  className="flex-1 bg-black/40 border border-white/20 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/25 resize-none focus:outline-none focus:border-white/40"
                />
              </div>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-cyan-700 hover:bg-cyan-600 text-white font-semibold mt-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save Lab Values
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Primary protocol recommendation modal */}
      {pendingSignal && (
        <ProtocolRecommendationModal
          open={showModal}
          onClose={handleModalClose}
          signal={pendingSignal}
          labId={pendingLabId}
          physicianLocked={physicianLocked}
          onAccepted={handleModalAccepted}
        />
      )}

      {/* Thyroid additive-modifier modal */}
      {pendingThyroidSignal && (
        <ThyroidRecommendationModal
          open={showThyroidModal}
          onClose={handleThyroidClose}
          signal={pendingThyroidSignal}
          labId={pendingLabId}
          onAccepted={handleThyroidAccepted}
        />
      )}

      {/* Protocol downgrade / reassessment modal */}
      {downgradeQueue.length > 0 && (
        <ProtocolDowngradeModal
          open={showDowngradeModal}
          onClose={handleDowngradeKept}
          signal={downgradeQueue[0]}
          labId={pendingLabId}
          onRemoved={handleDowngradeRemoved}
        />
      )}
    </>
  );
}
