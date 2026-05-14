import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingDown, CheckCircle2, BookOpen, ArrowLeft } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import type { LabDowngradeSignal } from "@shared/clinical/protocolDecision";

const CITATIONS: Record<string, string> = {
  "thyroid-support": "ATA / AACE / Endocrine Society Guidelines",
  "heart-failure":   "ACC / AHA Heart Failure Guidelines",
  "kidney-disease":  "KDIGO / NKF Clinical Practice Guidelines",
  "liver-disease":   "AASLD / EASL Liver Disease Guidelines",
  "liver-support":   "AASLD / NIH Nutritional Support Guidelines",
};

function labelNormalField(field: string): string {
  const map: Record<string, string> = {
    tsh:                      "TSH",
    free_t4:                  "Free T4",
    free_t3:                  "Free T3",
    tpo_antibodies:           "TPO Antibodies",
    thyroglobulin_antibodies: "Thyroglobulin Antibodies",
    ldl:                      "LDL Cholesterol",
    blood_pressure_systolic:  "Systolic Blood Pressure",
    ejection_fraction:        "Ejection Fraction",
    creatinine:               "Creatinine",
    bun:                      "BUN",
    alt:                      "ALT (liver enzyme)",
    ast:                      "AST (liver enzyme)",
    bilirubin:                "Bilirubin",
    albumin:                  "Albumin",
  };
  return map[field] ?? field;
}

interface ProtocolDowngradeModalProps {
  open: boolean;
  onClose: () => void;
  signal: LabDowngradeSignal;
  labId: number | null;
  onRemoved: () => void;
}

export default function ProtocolDowngradeModal({
  open,
  onClose,
  signal,
  labId,
  onRemoved,
}: ProtocolDowngradeModalProps) {
  const [busy, setBusy] = useState(false);

  const citation = CITATIONS[signal.protocol];

  async function postDecision(status: "removed" | "advisory") {
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/biometrics/labs/recommendation"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({
          protocol:   signal.protocol,
          status,
          labId:      labId ?? null,
          reason:     signal.reason,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
    } catch {
      // non-fatal — decision is advisory
    } finally {
      setBusy(false);
    }

    if (status === "removed") {
      onRemoved();
    } else {
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="bg-[#0a1a12] border border-emerald-500/20 text-white max-w-md rounded-2xl p-0 overflow-hidden shadow-2xl">

        {/* Header band — green/teal = good news */}
        <div className="bg-gradient-to-r from-emerald-900/50 to-teal-900/50 px-6 pt-6 pb-4 border-b border-emerald-500/15">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="text-[10px] font-semibold tracking-widest text-emerald-400/80 uppercase">
                Protocol Reassessment
              </span>
            </div>
            <DialogTitle className="text-white text-lg font-bold leading-snug">
              {signal.protocolLabel} — Your Markers Have Improved
            </DialogTitle>
            <DialogDescription className="text-white/50 text-sm mt-0.5">
              Based on your most recent lab values
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">

          {/* Advisory reason */}
          <p className="text-sm text-white/80 leading-relaxed">
            {signal.reason}
          </p>

          {/* Normalized markers */}
          {signal.normalFields.length > 0 && (
            <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-xl px-4 py-3 space-y-1">
              <p className="text-[10px] text-emerald-400/60 uppercase tracking-widest font-semibold mb-2">
                Markers now within normal range
              </p>
              {signal.normalFields.map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-xs text-white/70">{labelNormalField(f)}</span>
                </div>
              ))}
            </div>
          )}

          {/* What stepping down means */}
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <p className="text-xs text-white/60 leading-relaxed">
              Returning to the Anti-Inflammatory foundation means your meals will continue
              to be guided by broad anti-inflammatory principles, without the specialized
              modifications that were active for{" "}
              <span className="text-white/80">{signal.protocolLabel}</span>. You can
              re-activate the protocol at any time if your labs change.
            </p>
          </div>

          {/* Citation */}
          {citation && (
            <div className="flex items-start gap-2 text-xs text-white/40">
              <BookOpen className="w-3.5 h-3.5 mt-0.5 shrink-0 text-white/30" />
              <span>{citation}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 flex gap-3">
          <Button
            className="flex-1 bg-white/10 border border-white/20 text-white font-semibold hover:bg-white/20 active:bg-white/30 transition"
            disabled={busy}
            onClick={() => postDecision("advisory")}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Continue {signal.protocolLabel}
          </Button>
          <Button
            className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold gap-1.5"
            disabled={busy}
            onClick={() => postDecision("removed")}
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <ArrowLeft className="w-4 h-4 shrink-0" />
            )}
            Return to Anti-Inflammatory
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
