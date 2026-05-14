import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { FlaskConical, Loader2, Save } from "lucide-react";
import ProtocolRecommendationModal from "@/components/clinical/ProtocolRecommendationModal";
import ThyroidRecommendationModal from "@/components/clinical/ThyroidRecommendationModal";
import ProtocolDowngradeModal from "@/components/clinical/ProtocolDowngradeModal";
import type { LabProtocolSignal, ThyroidLabSignal, LabDowngradeSignal } from "@shared/clinical/protocolDecision";

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

interface LabValues {
  a1c: string;
  ldl: string;
  hdl: string;
  blood_pressure_systolic: string;
  blood_pressure_diastolic: string;
  ejection_fraction: string;
  creatinine: string;
  bun: string;
  inr: string;
  // Liver panel
  alt: string;
  ast: string;
  bilirubin: string;
  albumin: string;
  // Thyroid panel
  tsh: string;
  free_t4: string;
  free_t3: string;
  tpo_antibodies: string;
  thyroglobulin_antibodies: string;
  notes: string;
  lab_date: string;
}

const EMPTY_LABS: LabValues = {
  a1c: "",
  ldl: "",
  hdl: "",
  blood_pressure_systolic: "",
  blood_pressure_diastolic: "",
  ejection_fraction: "",
  creatinine: "",
  bun: "",
  inr: "",
  alt: "",
  ast: "",
  bilirubin: "",
  albumin: "",
  tsh: "",
  free_t4: "",
  free_t3: "",
  tpo_antibodies: "",
  thyroglobulin_antibodies: "",
  notes: "",
  lab_date: todayIso(),
};

interface ClinicalLabsCardProps {
  userId: string;
}

function LabField({
  label,
  name,
  value,
  unit,
  placeholder,
  onChange,
}: {
  label: string;
  name: keyof LabValues;
  value: string;
  unit?: string;
  placeholder?: string;
  onChange: (name: keyof LabValues, val: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/50 w-36 shrink-0">{label}</span>
      <div className="flex items-center gap-1 flex-1">
        <Input
          type="number"
          inputMode="decimal"
          step="any"
          value={value}
          placeholder={placeholder || "—"}
          onChange={(e) => onChange(name, e.target.value)}
          className="bg-black/40 border-white/20 text-white placeholder:text-white/25 text-sm h-8 focus:bg-black/40 focus:text-white caret-white"
        />
        {unit && <span className="text-[10px] text-white/30 shrink-0">{unit}</span>}
      </div>
    </div>
  );
}

export default function ClinicalLabsCard({ userId }: ClinicalLabsCardProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<LabValues>(EMPTY_LABS);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  // Primary protocol recommendation modal state
  const [pendingSignal, setPendingSignal] = useState<LabProtocolSignal | null>(null);
  const [pendingLabId, setPendingLabId] = useState<number | null>(null);
  const [physicianLocked, setPhysicianLocked] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Thyroid signal — additive modifier, shown after (or instead of) the primary modal
  const [pendingThyroidSignal, setPendingThyroidSignal] = useState<ThyroidLabSignal | null>(null);
  const [showThyroidModal, setShowThyroidModal] = useState(false);

  // Downgrade signals — shown after activation modals finish (may be multiple)
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
          setForm({
            a1c: l.a1c != null ? String(l.a1c) : "",
            ldl: l.ldl != null ? String(l.ldl) : "",
            hdl: l.hdl != null ? String(l.hdl) : "",
            blood_pressure_systolic: l.blood_pressure_systolic != null ? String(l.blood_pressure_systolic) : "",
            blood_pressure_diastolic: l.blood_pressure_diastolic != null ? String(l.blood_pressure_diastolic) : "",
            ejection_fraction: l.ejection_fraction != null ? String(l.ejection_fraction) : "",
            creatinine: l.creatinine != null ? String(l.creatinine) : "",
            bun: l.bun != null ? String(l.bun) : "",
            inr: l.inr != null ? String(l.inr) : "",
            alt:       l.alt       != null ? String(l.alt)       : "",
            ast:       l.ast       != null ? String(l.ast)       : "",
            bilirubin: l.bilirubin != null ? String(l.bilirubin) : "",
            albumin:   l.albumin   != null ? String(l.albumin)   : "",
            tsh:                     l.tsh                     != null ? String(l.tsh)                     : "",
            free_t4:                 l.free_t4                 != null ? String(l.free_t4)                 : "",
            free_t3:                 l.free_t3                 != null ? String(l.free_t3)                 : "",
            tpo_antibodies:          l.tpo_antibodies          != null ? String(l.tpo_antibodies)          : "",
            thyroglobulin_antibodies:l.thyroglobulin_antibodies!= null ? String(l.thyroglobulin_antibodies): "",
            notes: l.notes || "",
            lab_date: l.lab_date || todayIso(),
          });
          setLastSaved(
            new Date(l.recorded_at).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              year: "numeric",
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

  const handleSave = async () => {
    const hasAnyValue = Object.entries(form).some(
      ([k, v]) => k !== "notes" && k !== "lab_date" && v.trim() !== ""
    );
    if (!hasAnyValue) {
      toast({ title: "Enter at least one lab value before saving", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = { recorded_at: new Date().toISOString() };
      const numFields: Array<keyof LabValues> = [
        "a1c", "ldl", "hdl", "blood_pressure_systolic", "blood_pressure_diastolic",
        "ejection_fraction", "creatinine", "bun", "inr",
        "alt", "ast", "bilirubin", "albumin",
        "tsh", "free_t4", "free_t3", "tpo_antibodies", "thyroglobulin_antibodies",
      ];
      for (const field of numFields) {
        const v = form[field].trim();
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

      const labId = data.labId ?? null;

      if (hasThyroid) {
        setPendingThyroidSignal(data.thyroidSignal);
        setPendingLabId(labId);
      }

      if (hasDowngrades) {
        setDowngradeQueue(data.downgradeSignals);
        setPendingLabId(labId);
      }

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
    "liver-disease": "Liver Disease",
    "kidney-disease": "Kidney Disease",
    "heart-failure": "Cardiac Health",
    "liver-support": "Liver Support",
  };

  // Helper: advance to next step in the modal chain
  // Order: activation → thyroid activation → downgrade reassessment(s) → done
  function advanceChain(opts: { skipThyroid?: boolean; skipDowngrades?: boolean } = {}) {
    if (!opts.skipThyroid && pendingThyroidSignal) {
      setShowThyroidModal(true);
      return;
    }
    if (!opts.skipDowngrades && downgradeQueue.length > 0) {
      setShowDowngradeModal(true);
      return;
    }
    // All modals done
    setPendingLabId(null);
    toast({ title: "Clinical Labs Saved", description: "Your lab values have been recorded." });
  }

  // After primary protocol modal is accepted, redirect then (optionally) chain thyroid/downgrade
  const handleModalAccepted = () => {
    const label = pendingSignal ? (PROTOCOL_LABEL[pendingSignal.protocol] ?? "Clinical") : "Clinical";
    toast({
      title: `${label} protocol activated`,
      description: "Your meals will now follow the recommended nutrition guardrails.",
    });
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

  // After primary protocol modal is closed/rejected, chain to thyroid/downgrade if pending
  const handleModalClose = () => {
    setShowModal(false);
    setPendingSignal(null);
    advanceChain();
  };

  const handleThyroidAccepted = () => {
    toast({
      title: "Thyroid Support activated",
      description: "Your meals will now include thyroid-supportive nutrition guidance.",
    });
    setShowThyroidModal(false);
    setPendingThyroidSignal(null);
    advanceChain({ skipThyroid: true });
  };

  const handleThyroidClose = () => {
    setShowThyroidModal(false);
    setPendingThyroidSignal(null);
    advanceChain({ skipThyroid: true });
  };

  // Downgrade modal: user chose to return to Anti-Inflammatory
  const handleDowngradeRemoved = () => {
    const current = downgradeQueue[0];
    if (current) {
      toast({
        title: `${current.protocolLabel} protocol removed`,
        description: "You have returned to the Anti-Inflammatory foundation.",
      });
    }
    const remaining = downgradeQueue.slice(1);
    setDowngradeQueue(remaining);
    setShowDowngradeModal(false);
    if (remaining.length > 0) {
      setTimeout(() => setShowDowngradeModal(true), 180);
    } else {
      setPendingLabId(null);
    }
  };

  // Downgrade modal: user chose to continue the protocol
  const handleDowngradeKept = () => {
    const remaining = downgradeQueue.slice(1);
    setDowngradeQueue(remaining);
    setShowDowngradeModal(false);
    if (remaining.length > 0) {
      setTimeout(() => setShowDowngradeModal(true), 180);
    } else {
      setPendingLabId(null);
      toast({ title: "Clinical Labs Saved", description: "Your lab values have been recorded." });
    }
  };

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
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-white/30" />
            </div>
          ) : (
            <>
              {/* Lab Date */}
              <div className="flex items-center gap-2 pb-1 mb-1 border-b border-white/10">
                <span className="text-xs text-white/50 w-36 shrink-0">Lab Date</span>
                <Input
                  type="date"
                  value={form.lab_date}
                  max={todayIso()}
                  onChange={(e) => handleChange("lab_date", e.target.value)}
                  className="bg-black/40 border-white/20 text-white text-sm h-8 focus:bg-black/40 focus:text-white caret-white flex-1"
                />
              </div>

              <LabField label="A1C" name="a1c" value={form.a1c} unit="%" placeholder="e.g. 6.2" onChange={handleChange} />
              <LabField label="LDL" name="ldl" value={form.ldl} unit="mg/dL" placeholder="e.g. 145" onChange={handleChange} />
              <LabField label="HDL" name="hdl" value={form.hdl} unit="mg/dL" placeholder="e.g. 48" onChange={handleChange} />

              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50 w-36 shrink-0">Blood Pressure</span>
                <div className="flex items-center gap-1 flex-1">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={form.blood_pressure_systolic}
                    placeholder="Sys"
                    onChange={(e) => handleChange("blood_pressure_systolic", e.target.value)}
                    className="bg-black/40 border-white/20 text-white placeholder:text-white/25 text-sm h-8 focus:bg-black/40 focus:text-white caret-white"
                  />
                  <span className="text-white/30 text-sm">/</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={form.blood_pressure_diastolic}
                    placeholder="Dia"
                    onChange={(e) => handleChange("blood_pressure_diastolic", e.target.value)}
                    className="bg-black/40 border-white/20 text-white placeholder:text-white/25 text-sm h-8 focus:bg-black/40 focus:text-white caret-white"
                  />
                  <span className="text-[10px] text-white/30 shrink-0">mmHg</span>
                </div>
              </div>

              <LabField label="Ejection Fraction" name="ejection_fraction" value={form.ejection_fraction} unit="%" placeholder="e.g. 55" onChange={handleChange} />
              <LabField label="Creatinine" name="creatinine" value={form.creatinine} unit="mg/dL" placeholder="e.g. 1.1" onChange={handleChange} />
              <LabField label="BUN" name="bun" value={form.bun} unit="mg/dL" placeholder="e.g. 18" onChange={handleChange} />
              <LabField label="INR" name="inr" value={form.inr} placeholder="e.g. 1.0" onChange={handleChange} />

              {/* Liver Panel */}
              <div className="pt-2 pb-1 border-t border-white/10">
                <span className="text-[10px] font-semibold tracking-widest text-amber-400/70 uppercase">Liver Panel</span>
              </div>
              <LabField label="ALT" name="alt" value={form.alt} unit="U/L" placeholder="e.g. 25" onChange={handleChange} />
              <LabField label="AST" name="ast" value={form.ast} unit="U/L" placeholder="e.g. 22" onChange={handleChange} />
              <LabField label="Bilirubin (Total)" name="bilirubin" value={form.bilirubin} unit="mg/dL" placeholder="e.g. 0.8" onChange={handleChange} />
              <LabField label="Albumin" name="albumin" value={form.albumin} unit="g/dL" placeholder="e.g. 4.0" onChange={handleChange} />

              {/* Thyroid Panel */}
              <div className="pt-2 pb-1 border-t border-white/10">
                <span className="text-[10px] font-semibold tracking-widest text-teal-400/70 uppercase">Thyroid Panel</span>
              </div>
              <LabField label="TSH" name="tsh" value={form.tsh} unit="mIU/L" placeholder="e.g. 2.5" onChange={handleChange} />
              <LabField label="Free T4" name="free_t4" value={form.free_t4} unit="ng/dL" placeholder="e.g. 1.2" onChange={handleChange} />
              <LabField label="Free T3" name="free_t3" value={form.free_t3} unit="pg/mL" placeholder="e.g. 3.1" onChange={handleChange} />
              <LabField label="TPO Antibodies" name="tpo_antibodies" value={form.tpo_antibodies} unit="IU/mL" placeholder="e.g. 17" onChange={handleChange} />
              <LabField label="Thyroglobulin Ab" name="thyroglobulin_antibodies" value={form.thyroglobulin_antibodies} unit="IU/mL" placeholder="e.g. 245" onChange={handleChange} />

              <div className="flex items-start gap-2 pt-1">
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
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
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

      {/* Thyroid additive-modifier modal — shown after primary modal (or standalone) */}
      {pendingThyroidSignal && (
        <ThyroidRecommendationModal
          open={showThyroidModal}
          onClose={handleThyroidClose}
          signal={pendingThyroidSignal}
          labId={pendingLabId}
          onAccepted={handleThyroidAccepted}
        />
      )}

      {/* Protocol downgrade / reassessment modal — shown when normalized labs detected */}
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
