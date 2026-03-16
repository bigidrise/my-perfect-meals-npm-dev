import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { FlaskConical, Loader2, Save } from "lucide-react";

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
      ([k, v]) => k !== "notes" && v.trim() !== ""
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

      setLastSaved(new Date().toLocaleDateString(undefined, {
        month: "short", day: "numeric", year: "numeric",
      }));
      toast({ title: "Clinical Labs Saved", description: "Your lab values have been recorded." });
    } catch {
      toast({ title: "Failed to save labs", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
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
  );
}
