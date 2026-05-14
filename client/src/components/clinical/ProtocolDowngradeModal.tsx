import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, BookOpen, TrendingUp } from "lucide-react";
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
          protocol: signal.protocol,
          status,
          labId:    labId ?? null,
          reason:   signal.reason,
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
      <DialogContent className="bg-[#0a1a0e] border border-emerald-500/25 text-white max-w-md rounded-2xl p-0 overflow-hidden shadow-2xl">

        {/* Header band */}
        <div className="bg-gradient-to-r from-emerald-900/60 to-teal-900/40 px-6 pt-6 pb-4 border-b border-emerald-500/20">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="text-[10px] font-semibold tracking-widest text-emerald-400/80 uppercase">
                Great News
              </span>
            </div>
            <DialogTitle className="text-white text-xl font-bold leading-snug">
              Your numbers are back to normal range.
            </DialogTitle>
            <DialogDescription className="text-emerald-300/70 text-sm mt-1">
              {signal.protocolLabel} — based on your most recent lab values
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">

          {/* Plain language explanation */}
          <p className="text-sm text-white/80 leading-relaxed">
            Your recent lab results show that the markers used for{" "}
            <span className="text-emerald-300 font-medium">{signal.protocolLabel}</span> are
            now within a healthy range. You can choose to keep your current plan, or
            deactivate the protocol and return to your Anti-Inflammatory foundation.
          </p>

          {/* Normalized markers */}
          {signal.normalFields.length > 0 && (
            <div className="bg-emerald-900/25 border border-emerald-500/20 rounded-xl px-4 py-3 space-y-1.5">
              <p className="text-[10px] text-emerald-400/70 uppercase tracking-widest font-semibold mb-2">
                Markers now within normal range
              </p>
              {signal.normalFields.map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-xs text-white/75">{labelNormalField(f)}</span>
                </div>
              ))}
            </div>
          )}

          {/* What deactivating means */}
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <p className="text-xs text-white/55 leading-relaxed">
              Deactivating{" "}
              <span className="text-white/75">{signal.protocolLabel}</span> means your meals
              will follow the broad Anti-Inflammatory plan without the specialized
              modifications. You can re-activate it at any time if your numbers change.
            </p>
          </div>

          {/* Citation */}
          {citation && (
            <div className="flex items-start gap-2 text-xs text-white/35">
              <BookOpen className="w-3.5 h-3.5 mt-0.5 shrink-0 text-white/25" />
              <span>{citation}</span>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="px-6 pb-6 pt-2 flex gap-3">
          <Button
            className="flex-1 bg-white/10 border border-white/15 text-white font-semibold active:bg-white/20 transition"
            disabled={busy}
            onClick={() => postDecision("advisory")}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Stay the Same
          </Button>
          <Button
            className="flex-1 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold"
            disabled={busy}
            onClick={() => postDecision("removed")}
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Deactivate {signal.protocolLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
