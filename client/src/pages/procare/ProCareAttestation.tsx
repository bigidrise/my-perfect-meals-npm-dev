import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, ShieldCheck, FileCheck } from "lucide-react";

type ProfessionalCategory = "certified" | "experienced" | "non_certified";

const ATTESTATION_V1 = {
  certified: "By continuing, you acknowledge that you are responsible for the guidance you provide to clients and that My Perfect Meals does not verify professional credentials at this time. You attest that the credential information you provided is accurate.",
  experienced: "By continuing, you acknowledge that you are responsible for the guidance you provide to clients. You acknowledge that you are not currently maintaining an active professional certification and that My Perfect Meals does not verify professional credentials at this time.",
  non_certified: "By continuing, you acknowledge that you are not currently a licensed or certified healthcare or fitness professional and that you will not represent yourself as one within the platform. You are responsible for the guidance you provide to clients.",
};

const CATEGORY_LABELS: Record<ProfessionalCategory, string> = {
  certified: "Certified / Licensed Professional",
  experienced: "Professional Experience — No Current Certification",
  non_certified: "Using ProCare Without Professional Credentials",
};

export default function ProCareAttestation() {
  const [, setLocation] = useLocation();
  const [accepted, setAccepted] = useState(false);
  const [category, setCategory] = useState<ProfessionalCategory | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("procare_category") as ProfessionalCategory | null;
    if (!stored) {
      setLocation("/procare-identity");
      return;
    }
    setCategory(stored);
  }, [setLocation]);

  if (!category) return null;

  const attestationText = ATTESTATION_V1[category];

  const handleContinue = () => {
    if (!accepted) return;

    localStorage.setItem("procare_attestation_text", attestationText);
    localStorage.setItem("procare_attestation_version", "v1");
    localStorage.setItem("procare_attested_at", new Date().toISOString());
    localStorage.setItem("procare_entry_path", category);

    setLocation("/auth?procare=true");
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 pb-32">
        {/* Header */}
        <div className="pt-6 pb-2">
          <button
            onClick={() => setLocation("/procare-identity")}
            className="flex items-center gap-1 text-white/60 text-sm mb-4 active:scale-[0.98]"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-900/40 to-blue-800/40 rounded-2xl border border-blue-400/30 mb-4">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              <span className="text-white font-semibold text-sm">ProCare Professional</span>
            </div>

            <h1 className="text-2xl font-bold mb-2">Professional Acknowledgment</h1>
            <p className="text-white/60 text-sm max-w-sm mx-auto">
              Please review and accept the following before creating your professional account.
            </p>
          </div>
        </div>

        {/* Selected Role Summary */}
        <div className="mb-6 p-4 rounded-xl border border-white/10 bg-white/5">
          <div className="flex items-center gap-2 mb-1">
            <FileCheck className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-white/50">Your selected role</span>
          </div>
          <p className="text-sm font-semibold">{CATEGORY_LABELS[category]}</p>
        </div>

        {/* Attestation Text */}
        <div className="mb-6 p-5 rounded-xl border border-blue-400/20 bg-blue-900/10">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-semibold text-blue-400">Professional Attestation</span>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            {attestationText}
          </p>
        </div>

        {/* Acceptance Checkbox */}
        <button
          onClick={() => setAccepted(!accepted)}
          className="w-full flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/5 active:scale-[0.98] transition-transform"
        >
          <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
            accepted ? "border-blue-400 bg-blue-500" : "border-white/30 bg-transparent"
          }`}>
            {accepted && (
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <p className="text-sm text-white/70 text-left">
            I have read and understand the above acknowledgment. I accept responsibility for the professional guidance I provide through My Perfect Meals.
          </p>
        </button>

        {/* Trust Message */}
        <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border border-blue-400/10">
          <p className="text-xs text-white/50 text-center">
            This acknowledgment is recorded for platform safety and clarity. My Perfect Meals values your professional expertise and is designed to support — not replace — your judgment.
          </p>
        </div>
      </div>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
        <Button
          onClick={handleContinue}
          disabled={!accepted}
          className="w-full h-14 text-md font-semibold rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40"
        >
          Create Professional Account
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
