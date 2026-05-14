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
import { Loader2, FlaskConical, BookOpen, Activity } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import type { ThyroidLabSignal } from "@shared/clinical/protocolDecision";

const CITATION = "ATA / AACE / Endocrine Society Guidelines";

const CONFIDENCE_COLOR: Record<string, string> = {
  high:     "bg-red-500/20 text-red-300 border-red-500/30",
  moderate: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  low:      "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

function labelTrigger(field: string): string {
  const map: Record<string, string> = {
    tsh_high:                 "TSH (elevated)",
    tsh_low:                  "TSH (suppressed)",
    free_t4_low:              "Free T4 (low)",
    free_t3_low:              "Free T3 (low)",
    tpo_antibodies:           "TPO Antibodies",
    thyroglobulin_antibodies: "Thyroglobulin Antibodies",
  };
  return map[field] ?? field;
}

interface ThyroidRecommendationModalProps {
  open: boolean;
  onClose: () => void;
  signal: ThyroidLabSignal;
  labId: number | null;
  onAccepted: () => void;
}

export default function ThyroidRecommendationModal({
  open,
  onClose,
  signal,
  labId,
  onAccepted,
}: ThyroidRecommendationModalProps) {
  const [busy, setBusy] = useState(false);

  const confColor = CONFIDENCE_COLOR[signal.confidence] ?? CONFIDENCE_COLOR.low;

  async function postDecision(status: "accepted" | "rejected") {
    setBusy(true);
    try {
      await fetch(apiUrl("/api/biometrics/labs/recommendation"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({
          protocol: "thyroid-support",
          status,
          labId: labId ?? null,
          triggerFields: signal.triggerFields,
          confidenceLevel: signal.confidence,
          reason: signal.reason,
        }),
      });
    } catch {
      // non-fatal — recommendation is advisory
    } finally {
      setBusy(false);
    }

    if (status === "accepted") {
      onAccepted();
    } else {
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <DialogContent className="bg-[#0e1a1a] border border-teal-500/20 text-white max-w-md rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <FlaskConical className="w-4 h-4 text-teal-400 shrink-0" />
            <DialogTitle className="text-base font-semibold text-white leading-snug">
              Thyroid Support Nutrition Modifier
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-white/50">
            Lab-based modifier — additive to your current nutrition protocol
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4 space-y-4">
          {/* Confidence + autoimmune badges */}
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className={`text-[10px] font-medium border px-2 py-0.5 rounded-full ${confColor}`}
            >
              {signal.confidence.charAt(0).toUpperCase() + signal.confidence.slice(1)} confidence
            </Badge>
            {signal.isAutoimmune && (
              <Badge
                variant="outline"
                className="text-[10px] font-medium border px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-300 border-teal-500/30"
              >
                Autoimmune Pattern
              </Badge>
            )}
          </div>

          {/* Reason text */}
          <p className="text-sm text-white/80 leading-relaxed">{signal.reason}</p>

          {/* Trigger fields */}
          {signal.triggerFields.length > 0 && (
            <div className="bg-white/5 rounded-xl p-3 space-y-1">
              <p className="text-[10px] text-white/40 uppercase tracking-wide mb-1">
                Markers detected
              </p>
              {signal.triggerFields.map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <Activity className="w-3 h-3 text-teal-400 shrink-0" />
                  <span className="text-xs text-white/70">{labelTrigger(f)}</span>
                </div>
              ))}
            </div>
          )}

          {/* What happens on accept */}
          <div className="bg-teal-900/20 border border-teal-500/20 rounded-xl px-4 py-3">
            <p className="text-xs text-teal-300/80 leading-relaxed">
              Activating Thyroid Support adds selenium-rich foods, anti-inflammatory meal
              patterns, and medication-timing awareness to your meal guidance — without
              changing your current meal builder.
            </p>
          </div>

          {/* Citation */}
          <div className="flex items-start gap-2 text-xs text-white/40">
            <BookOpen className="w-3.5 h-3.5 mt-0.5 shrink-0 text-white/30" />
            <span>{CITATION}</span>
          </div>
        </div>

        <div className="px-6 pb-6 pt-2 flex gap-3">
          <Button
            className="flex-1 bg-white/10 border border-white/20 text-white hover:bg-white/20 active:bg-white/30 transition"
            disabled={busy}
            onClick={() => postDecision("rejected")}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Keep Current Plan
          </Button>
          <Button
            className="flex-1 bg-teal-700 hover:bg-teal-600 text-white font-semibold"
            disabled={busy}
            onClick={() => postDecision("accepted")}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Activate Thyroid Support
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
