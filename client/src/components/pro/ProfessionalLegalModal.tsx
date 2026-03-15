import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Stethoscope, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { LEGAL_DOCUMENTS } from "../../../../shared/legalDocuments";
import { coachProfessionalAgreement } from "@/legal/coachProfessionalAgreement";
import { coachConductPolicy } from "@/legal/coachConductPolicy";
import { scopeOfPractice } from "@/legal/scopeOfPractice";
import { physicianProfessionalAgreement } from "@/legal/physicianProfessionalAgreement";
import { physicianConductPolicy } from "@/legal/physicianConductPolicy";
import { physicianScopeOfPractice } from "@/legal/physicianScopeOfPractice";

const COACH_DOCS = [
  { ...LEGAL_DOCUMENTS.professional[0], ...coachProfessionalAgreement },
  { ...LEGAL_DOCUMENTS.professional[1], ...coachConductPolicy },
  { ...LEGAL_DOCUMENTS.professional[2], ...scopeOfPractice },
];

const PHYSICIAN_DOCS = [
  { ...LEGAL_DOCUMENTS.physician[0], ...physicianProfessionalAgreement },
  { ...LEGAL_DOCUMENTS.physician[1], ...physicianConductPolicy },
  { ...LEGAL_DOCUMENTS.physician[2], ...physicianScopeOfPractice },
];

interface ProfessionalLegalModalProps {
  open: boolean;
  onAccepted: () => void;
  flow?: "professional" | "physician";
}

export default function ProfessionalLegalModal({ open, onAccepted, flow = "professional" }: ProfessionalLegalModalProps) {
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const isPhysicianFlow = flow === "physician";
  const DOCS = isPhysicianFlow ? PHYSICIAN_DOCS : COACH_DOCS;

  const allAccepted = DOCS.every((doc) => accepted[doc.type]);

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
      for (const doc of DOCS) {
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
            <div className={`p-2 rounded-xl ${isPhysicianFlow ? "bg-violet-500/20" : "bg-blue-500/20"}`}>
              {isPhysicianFlow
                ? <Stethoscope className="w-6 h-6 text-violet-400" />
                : <ShieldCheck className="w-6 h-6 text-blue-400" />
              }
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isPhysicianFlow ? "Physician Agreements" : "Professional Agreements"}
              </h2>
              <p className="text-sm text-white/60">Please review and accept each document to continue.</p>
            </div>
          </div>

          <div className="space-y-3">
            {DOCS.map((doc) => (
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
                      accepted[doc.type]
                        ? isPhysicianFlow
                          ? "border-violet-400 bg-violet-500"
                          : "border-blue-400 bg-blue-500"
                        : "border-white/30 bg-transparent"
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

          <Button
            onClick={handleAcceptAll}
            disabled={!allAccepted || saving}
            className={`w-full mt-6 h-12 text-sm font-semibold rounded-xl text-white disabled:opacity-40 ${
              isPhysicianFlow
                ? "bg-gradient-to-r from-violet-600 to-violet-700"
                : "bg-gradient-to-r from-blue-600 to-blue-700"
            }`}
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
  );
}
