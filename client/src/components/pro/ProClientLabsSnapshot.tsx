import { useState, useEffect } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { Loader2, FlaskConical, AlertTriangle, CheckCircle } from "lucide-react";

interface LabData {
  a1c: number | null;
  ldl: number | null;
  hdl: number | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  ejection_fraction: number | null;
  creatinine: number | null;
  bun: number | null;
  inr: number | null;
  notes: string | null;
  recorded_at: string;
}

interface ProClientLabsSnapshotProps {
  clientId: string;
}

type StatusLevel = "optimal" | "normal" | "borderline" | "high" | "low" | "critical";

interface LabStatus {
  label: string;
  level: StatusLevel;
}

function getA1cStatus(v: number): LabStatus {
  if (v < 5.7) return { label: "Normal", level: "optimal" };
  if (v < 6.5) return { label: "Prediabetic", level: "borderline" };
  return { label: "Diabetic Range", level: "critical" };
}

function getLdlStatus(v: number): LabStatus {
  if (v < 100) return { label: "Optimal", level: "optimal" };
  if (v < 130) return { label: "Near Optimal", level: "normal" };
  if (v < 160) return { label: "Borderline", level: "borderline" };
  if (v < 190) return { label: "High", level: "high" };
  return { label: "Very High", level: "critical" };
}

function getHdlStatus(v: number): LabStatus {
  if (v >= 60) return { label: "Protective", level: "optimal" };
  if (v >= 40) return { label: "Acceptable", level: "normal" };
  return { label: "Low Risk", level: "high" };
}

function getBpStatus(sys: number, dia: number): LabStatus {
  if (sys < 120 && dia < 80) return { label: "Normal", level: "optimal" };
  if (sys < 130 && dia < 80) return { label: "Elevated", level: "borderline" };
  if (sys < 140 || dia < 90) return { label: "Stage 1 HTN", level: "high" };
  return { label: "Stage 2 HTN", level: "critical" };
}

function getEfStatus(v: number): LabStatus {
  if (v >= 55) return { label: "Normal", level: "optimal" };
  if (v >= 40) return { label: "Mid-Range", level: "borderline" };
  return { label: "Reduced", level: "critical" };
}

function getCreatinineStatus(v: number): LabStatus {
  if (v <= 1.2) return { label: "Normal", level: "optimal" };
  if (v <= 1.5) return { label: "Mildly Elevated", level: "borderline" };
  return { label: "Elevated", level: "high" };
}

function getBunStatus(v: number): LabStatus {
  if (v >= 7 && v <= 20) return { label: "Normal", level: "optimal" };
  if (v <= 25) return { label: "Mildly High", level: "borderline" };
  return { label: "Elevated", level: "high" };
}

function getInrStatus(v: number): LabStatus {
  if (v >= 0.8 && v <= 1.2) return { label: "Normal", level: "optimal" };
  if (v <= 2.0) return { label: "Slightly Elevated", level: "borderline" };
  return { label: "Elevated", level: "high" };
}

const LEVEL_STYLES: Record<StatusLevel, string> = {
  optimal: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  normal: "bg-green-500/15 text-green-300 border-green-500/25",
  borderline: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  high: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  low: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  critical: "bg-red-500/20 text-red-300 border-red-500/30",
};

function StatusBadge({ status }: { status: LabStatus }) {
  return (
    <span
      className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${LEVEL_STYLES[status.level]}`}
    >
      {status.label}
    </span>
  );
}

function LabRow({
  label,
  value,
  unit,
  status,
}: {
  label: string;
  value: number | string | null;
  unit?: string;
  status?: LabStatus;
}) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-white/5 last:border-0 gap-2">
      <span className="text-[11px] text-white/50 shrink-0">{label}</span>
      <div className="flex items-center gap-1.5">
        {status && <StatusBadge status={status} />}
        <span className="text-[11px] font-medium text-white">
          {value != null ? `${value}${unit ? ` ${unit}` : ""}` : (
            <span className="text-white/20">—</span>
          )}
        </span>
      </div>
    </div>
  );
}

function buildClinicalSummary(labs: LabData): { warnings: string[]; normals: string[] } {
  const warnings: string[] = [];
  const normals: string[] = [];

  if (labs.a1c != null) {
    const s = getA1cStatus(labs.a1c);
    if (s.level === "critical") warnings.push("Diabetic Range A1C");
    else if (s.level === "borderline") warnings.push("Prediabetic A1C");
    else normals.push("A1C normal");
  }
  if (labs.ldl != null) {
    const s = getLdlStatus(labs.ldl);
    if (s.level === "critical" || s.level === "high") warnings.push("Elevated LDL Cholesterol");
    else if (s.level === "borderline") warnings.push("Borderline LDL");
    else normals.push("LDL within range");
  }
  if (labs.hdl != null) {
    const s = getHdlStatus(labs.hdl);
    if (s.level === "high") warnings.push("Low HDL — cardiac risk factor");
    else normals.push("HDL acceptable");
  }
  if (labs.blood_pressure_systolic != null && labs.blood_pressure_diastolic != null) {
    const s = getBpStatus(labs.blood_pressure_systolic, labs.blood_pressure_diastolic);
    if (s.level === "critical") warnings.push("Stage 2 Hypertension");
    else if (s.level === "high") warnings.push("Stage 1 Hypertension");
    else if (s.level === "borderline") warnings.push("Elevated Blood Pressure");
    else normals.push("BP normal");
  }
  if (labs.ejection_fraction != null) {
    const s = getEfStatus(labs.ejection_fraction);
    if (s.level === "critical") warnings.push("Reduced Ejection Fraction");
    else if (s.level === "borderline") warnings.push("Mid-Range Ejection Fraction");
    else normals.push("EF normal");
  }
  if (labs.creatinine != null) {
    const s = getCreatinineStatus(labs.creatinine);
    if (s.level !== "optimal") warnings.push("Elevated Creatinine");
    else normals.push("Kidney markers normal");
  }
  if (labs.bun != null) {
    const s = getBunStatus(labs.bun);
    if (s.level !== "optimal") warnings.push("Elevated BUN");
    else normals.push("BUN normal");
  }
  if (labs.inr != null) {
    const s = getInrStatus(labs.inr);
    if (s.level !== "optimal") warnings.push("INR out of range");
    else normals.push("Coagulation normal");
  }

  return { warnings, normals };
}

export default function ProClientLabsSnapshot({ clientId }: ProClientLabsSnapshotProps) {
  const [labs, setLabs] = useState<LabData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    const fetchLabs = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(apiUrl(`/api/biometrics/labs/${clientId}`), {
          headers: { ...getAuthHeaders() },
          credentials: "include",
        });
        if (cancelled) return;
        if (!res.ok) {
          setError("Unable to load lab data");
          return;
        }
        const data = await res.json();
        setLabs(data.labs || null);
      } catch {
        if (!cancelled) setError("Failed to load labs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchLabs();
    return () => { cancelled = true; };
  }, [clientId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin text-white/30" />
      </div>
    );
  }

  if (error) {
    return <p className="text-[11px] text-red-400/70 py-1">{error}</p>;
  }

  if (!labs) {
    return (
      <div className="bg-white/5 rounded-lg p-3 border border-white/10">
        <h4 className="text-xs font-medium text-white/60 flex items-center gap-1.5 mb-1">
          <FlaskConical className="w-3.5 h-3.5" /> Clinical Labs
        </h4>
        <p className="text-[10px] text-white/30 italic">No lab data on file</p>
      </div>
    );
  }

  const recordedDate = new Date(labs.recorded_at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const bp =
    labs.blood_pressure_systolic != null && labs.blood_pressure_diastolic != null
      ? `${labs.blood_pressure_systolic}/${labs.blood_pressure_diastolic}`
      : null;

  const bpStatus =
    labs.blood_pressure_systolic != null && labs.blood_pressure_diastolic != null
      ? getBpStatus(labs.blood_pressure_systolic, labs.blood_pressure_diastolic)
      : undefined;

  const { warnings, normals } = buildClinicalSummary(labs);

  return (
    <div className="bg-white/5 rounded-lg p-3 border border-white/10 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-white/60 flex items-center gap-1.5">
          <FlaskConical className="w-3.5 h-3.5 text-cyan-400" /> Clinical Labs
        </h4>
        <span className="text-[9px] text-white/25">Labs: {recordedDate}</span>
      </div>

      {/* Clinical Summary Banner */}
      {(warnings.length > 0 || normals.length > 0) && (
        <div className="rounded-md bg-black/30 border border-white/10 px-2.5 py-2 space-y-1">
          <p className="text-[9px] font-semibold text-white/40 uppercase tracking-wider mb-1">
            Clinical Summary
          </p>
          {warnings.map((w) => (
            <div key={w} className="flex items-center gap-1.5">
              <AlertTriangle className="w-2.5 h-2.5 text-orange-400 shrink-0" />
              <span className="text-[10px] text-orange-300">{w}</span>
            </div>
          ))}
          {normals.slice(0, 3).map((n) => (
            <div key={n} className="flex items-center gap-1.5">
              <CheckCircle className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
              <span className="text-[10px] text-emerald-300/70">{n}</span>
            </div>
          ))}
        </div>
      )}

      {/* Lab Values with Badges */}
      <div className="space-y-0">
        <LabRow
          label="A1C"
          value={labs.a1c}
          unit="%"
          status={labs.a1c != null ? getA1cStatus(labs.a1c) : undefined}
        />
        <LabRow
          label="LDL"
          value={labs.ldl}
          unit="mg/dL"
          status={labs.ldl != null ? getLdlStatus(labs.ldl) : undefined}
        />
        <LabRow
          label="HDL"
          value={labs.hdl}
          unit="mg/dL"
          status={labs.hdl != null ? getHdlStatus(labs.hdl) : undefined}
        />
        <LabRow
          label="Blood Pressure"
          value={bp}
          unit="mmHg"
          status={bpStatus}
        />
        <LabRow
          label="Ejection Fraction"
          value={labs.ejection_fraction}
          unit="%"
          status={labs.ejection_fraction != null ? getEfStatus(labs.ejection_fraction) : undefined}
        />
        <LabRow
          label="Creatinine"
          value={labs.creatinine}
          unit="mg/dL"
          status={labs.creatinine != null ? getCreatinineStatus(labs.creatinine) : undefined}
        />
        <LabRow
          label="BUN"
          value={labs.bun}
          unit="mg/dL"
          status={labs.bun != null ? getBunStatus(labs.bun) : undefined}
        />
        <LabRow
          label="INR"
          value={labs.inr}
          status={labs.inr != null ? getInrStatus(labs.inr) : undefined}
        />
      </div>

      {labs.notes && (
        <p className="text-[10px] text-white/40 italic pt-1.5 border-t border-white/5">
          Note: {labs.notes}
        </p>
      )}
    </div>
  );
}
