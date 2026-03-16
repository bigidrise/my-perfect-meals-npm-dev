import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FlaskConical, ShieldCheck, BookOpen } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import type { LabProtocolSignal } from "@shared/clinical/protocolDecision";

// ---------------------------------------------------------------------------
// Citation map — protocol → authoritative guideline reference
// ---------------------------------------------------------------------------
const CITATIONS: Record<string, string> = {
  "kidney-disease":  "KDIGO / NKF Clinical Practice Guidelines",
  "heart-failure":   "ACC / AHA Heart Failure Guidelines",
  "liver-support":   "AASLD / NIH Nutritional Support Guidelines",
  "liver-disease":   "AASLD / EASL Liver Disease Guidelines",
};

// Protocol → human-readable title
const PROTOCOL_TITLE: Record<string, string> = {
  "kidney-disease":  "Kidney Support Nutrition Protocol",
  "heart-failure":   "Cardiac Health Nutrition Protocol",
  "liver-support":   "Liver Support Nutrition Protocol",
  "liver-disease":   "Liver Disease Nutrition Protocol",
};

// Confidence → colour classes
const CONFIDENCE_COLOR: Record<string, string> = {
  high:     "bg-red-500/20 text-red-300 border-red-500/30",
  moderate: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  low:      "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

// Trigger field → readable label
function labelTrigger(field: string): string {
  const map: Record<string, string> = {
    alt:                     "ALT (liver enzyme)",
    ast:                     "AST (liver enzyme)",
    bilirubin:               "Bilirubin",
    albumin:                 "Albumin",
    creatinine:              "Creatinine",
    bun:                     "BUN",
    ldl:                     "LDL cholesterol",
    blood_pressure_systolic: "Systolic blood pressure",
    ejection_fraction:       "Ejection fraction",
  };
  return map[field] ?? field;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface ProtocolRecommendationModalProps {
  open:            boolean;
  onClose:         () => void;
  signal:          LabProtocolSignal;
  labId:           number | null;
  physicianLocked: boolean;
  onAccepted:      () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ProtocolRecommendationModal({
  open,
  onClose,
  signal,
  labId,
  physicianLocked,
  onAccepted,
}: ProtocolRecommendationModalProps) {
  const [busy, setBusy] = useState(false);

  const title      = PROTOCOL_TITLE[signal.protocol] ?? signal.protocol;
  const citation   = CITATIONS[signal.protocol];
  const confColor  = CONFIDENCE_COLOR[signal.confidence] ?? CONFIDENCE_COLOR.low;

  async function postDecision(status: "accepted" | "rejected") {
    setBusy(true);
    try {
      await fetch(apiUrl("/api/biometrics/labs/recommendation"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({
          protocol:        signal.protocol,
          status,
          labId:           labId ?? null,
          triggerFields:   signal.triggerFields,
          confidenceLevel: signal.confidence,
          reason:          signal.reason,
        }),
      });

      if (status === "accepted") {
        onAccepted();
      }
      onClose();
    } catch {
      // silently ignore — audit is best-effort; UI proceeds
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function handleAdvisoryClose() {
    setBusy(true);
    try {
      await fetch(apiUrl("/api/biometrics/labs/recommendation"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({
          protocol:        signal.protocol,
          status:          "advisory",
          labId:           labId ?? null,
          triggerFields:   signal.triggerFields,
          confidenceLevel: signal.confidence,
          reason:          signal.reason,
        }),
      });
    } catch {
      // best-effort
    } finally {
      setBusy(false);
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !busy) onClose(); }}>
      <DialogContent className="bg-[#0d1117] border border-white/10 text-white max-w-md rounded-2xl p-0 overflow-hidden shadow-2xl">
        {/* Header band */}
        <div className="bg-gradient-to-r from-cyan-900/60 to-teal-900/60 px-6 pt-6 pb-4 border-b border-white/10">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <FlaskConical className="w-5 h-5 text-cyan-400 shrink-0" />
              <span className="text-[10px] font-semibold tracking-widest text-cyan-400/80 uppercase">
                Lab-Driven Recommendation
              </span>
            </div>
            <DialogTitle className="text-white text-lg font-bold leading-snug">
              {title}
            </DialogTitle>
            <DialogDescription className="text-white/50 text-sm mt-0.5">
              Based on your most recent lab values
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          {/* Confidence badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={`text-[10px] uppercase tracking-wider border ${confColor}`}
            >
              {signal.confidence} signal
            </Badge>
          </div>

          {/* Advisory reason */}
          <p className="text-sm text-white/75 leading-relaxed">{signal.reason}</p>

          {/* Triggered values */}
          {signal.triggerFields && signal.triggerFields.length > 0 && (
            <div className="bg-white/5 rounded-xl px-4 py-3 border border-white/10">
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-semibold mb-2">
                Values Outside Optimal Range
              </p>
              <ul className="space-y-1">
                {signal.triggerFields.map((t) => (
                  <li key={t} className="flex items-center gap-2 text-xs text-white/70">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    {labelTrigger(t)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Citation */}
          {citation && (
            <div className="flex items-start gap-2 text-xs text-white/40">
              <BookOpen className="w-3.5 h-3.5 mt-0.5 shrink-0 text-white/30" />
              <span>{citation}</span>
            </div>
          )}

          {/* Physician-locked advisory notice */}
          {physicianLocked && (
            <div className="flex items-start gap-2 bg-violet-900/20 border border-violet-500/20 rounded-xl px-4 py-3">
              <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-violet-400" />
              <p className="text-xs text-violet-300/80 leading-relaxed">
                Your care team has already selected a nutrition protocol for you.
                These lab results are visible to your provider.
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 pb-6 pt-2">
          {physicianLocked ? (
            <Button
              className="w-full bg-white/10 hover:bg-white/15 text-white"
              disabled={busy}
              onClick={handleAdvisoryClose}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Understood
            </Button>
          ) : (
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 border-white/15 text-white/70 hover:bg-white/10 hover:text-white"
                disabled={busy}
                onClick={() => postDecision("rejected")}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Keep Current Plan
              </Button>
              <Button
                className="flex-1 bg-cyan-700 hover:bg-cyan-600 text-white font-semibold"
                disabled={busy}
                onClick={() => postDecision("accepted")}
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Use Recommended Plan
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
