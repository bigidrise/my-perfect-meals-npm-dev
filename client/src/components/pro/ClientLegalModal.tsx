import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { LEGAL_DOCUMENTS } from "../../../../shared/legalDocuments";
import { clientCoachingAgreement } from "@/legal/clientCoachingAgreement";
import { clientLiabilityWaiver } from "@/legal/clientLiabilityWaiver";
import { clientDataConsent } from "@/legal/clientDataConsent";
import { nutritionDisclaimer } from "@/legal/nutritionDisclaimer";

const CLIENT_DOCS = [
  { ...LEGAL_DOCUMENTS.client[0], ...clientCoachingAgreement },
  { ...LEGAL_DOCUMENTS.client[1], ...clientLiabilityWaiver },
  { ...LEGAL_DOCUMENTS.client[2], ...clientDataConsent },
  { ...LEGAL_DOCUMENTS.client[3], ...nutritionDisclaimer },
];

interface ClientLegalModalProps {
  open: boolean;
  onAccepted: () => void;
  onCancel?: () => void;
}

export default function ClientLegalModal({ open, onAccepted, onCancel }: ClientLegalModalProps) {
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const allAccepted = CLIENT_DOCS.every((doc) => accepted[doc.type]);

  const toggleAccepted = (type: string) => {
    setAccepted((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const toggleExpanded = (type: string) => {
    setExpanded((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const handleAcceptAll = async () => {
    setSaving(true);
    setError(null);
    try {
      for (const doc of CLIENT_DOCS) {
        const res = await fetch(apiUrl("/api/legal/accept"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          credentials: "include",
          body: JSON.stringify({ documentType: doc.type, version: doc.version }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to accept document");
        }
      }
      onAccepted();
    } catch (err: any) {
      setError(err.message || "Failed to save acceptance");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-emerald-500/20">
              <FileText className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Client Agreements</h2>
              <p className="text-sm text-white/60">Please review and accept before connecting with your coach.</p>
            </div>
          </div>

          <div className="space-y-3">
            {CLIENT_DOCS.map((doc) => (
              <div key={doc.type} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <button
                  onClick={() => toggleExpanded(doc.type)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <span className="text-sm font-semibold text-white">{doc.title}</span>
                  {expanded[doc.type] ? (
                    <ChevronUp className="w-4 h-4 text-white/40" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-white/40" />
                  )}
                </button>

                {expanded[doc.type] && (
                  <div className="px-4 pb-3">
                    <p className="text-xs text-white/60 leading-relaxed whitespace-pre-line">{doc.content.trim()}</p>
                  </div>
                )}

                <button
                  onClick={() => toggleAccepted(doc.type)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-t border-white/5"
                >
                  <div
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                      accepted[doc.type] ? "border-emerald-400 bg-emerald-500" : "border-white/30 bg-transparent"
                    }`}
                  >
                    {accepted[doc.type] && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs text-white/70">I have read and agree to this document</span>
                </button>
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-xl border border-red-400/30 bg-red-900/20">
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}

          <div className="flex gap-3 mt-6">
            {onCancel && (
      <Button
        onClick={onCancel}
        className="flex-1 h-12 text-sm font-semibold rounded-xl bg-black text-white border border-white/20 hover:bg-black"
      >
        Cancel
      </Button>
            )}
            <Button
              onClick={handleAcceptAll}
              disabled={!allAccepted || saving}
              className={`${onCancel ? "flex-1" : "w-full"} h-12 text-sm font-semibold rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white disabled:opacity-40`}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Accept All & Continue"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
