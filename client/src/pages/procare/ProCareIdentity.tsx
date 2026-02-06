import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Briefcase,
  UserCheck,
  ChevronDown,
  Check,
} from "lucide-react";

type ProfessionalCategory = "certified" | "experienced" | "non_certified";

const CREDENTIAL_BODIES = [
  "NASM",
  "ACE",
  "NSCA",
  "ISSA",
  "ACSM",
  "NCSF",
  "AFAA",
  "State License Board",
  "Other",
];

const CREDENTIAL_TYPES = [
  "Certified Personal Trainer",
  "Strength & Conditioning Coach",
  "Registered Dietitian",
  "Physician (MD/DO)",
  "Nurse Practitioner / PA",
  "Licensed Nutritionist",
  "Physical Therapist",
  "Chiropractor",
  "Other",
];

interface IdentityOption {
  id: ProfessionalCategory;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  borderColor: string;
}

const OPTIONS: IdentityOption[] = [
  {
    id: "certified",
    icon: <Award className="w-6 h-6" />,
    title: "Certified / Licensed Professional",
    description: "Currently certified trainer, licensed physician, registered dietitian, or other credentialed professional.",
    color: "text-emerald-400",
    borderColor: "border-emerald-400/30",
  },
  {
    id: "experienced",
    icon: <Briefcase className="w-6 h-6" />,
    title: "Professional Experience — No Current Certification",
    description: "Formerly certified, retired professional, or experience-based coach with real-world expertise.",
    color: "text-amber-400",
    borderColor: "border-amber-400/30",
  },
  {
    id: "non_certified",
    icon: <UserCheck className="w-6 h-6" />,
    title: "Using ProCare Without Professional Credentials",
    description: "Business owner, mentor, or advanced user looking for professional-level tools.",
    color: "text-blue-400",
    borderColor: "border-blue-400/30",
  },
];

export default function ProCareIdentity() {
  const [, setLocation] = useLocation();
  const [selected, setSelected] = useState<ProfessionalCategory | null>(null);
  const [credentialType, setCredentialType] = useState("");
  const [customCredentialType, setCustomCredentialType] = useState("");
  const [credentialBody, setCredentialBody] = useState("");
  const [customCredentialBody, setCustomCredentialBody] = useState("");
  const [credentialNumber, setCredentialNumber] = useState("");
  const [credentialYear, setCredentialYear] = useState("");
  const [showBodyDropdown, setShowBodyDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const bodyDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleTap(e: MouseEvent) {
      if (showTypeDropdown && typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
        setShowTypeDropdown(false);
      }
      if (showBodyDropdown && bodyDropdownRef.current && !bodyDropdownRef.current.contains(e.target as Node)) {
        setShowBodyDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleTap);
    return () => document.removeEventListener("mousedown", handleTap);
  }, [showTypeDropdown, showBodyDropdown]);

  const resolvedType = credentialType === "Other" ? customCredentialType : credentialType;
  const resolvedBody = credentialBody === "Other" ? customCredentialBody : credentialBody;

  const canContinue = selected !== null && (
    selected !== "certified" || (resolvedType && resolvedBody)
  );

  const handleContinue = () => {
    if (!canContinue || !selected) return;

    localStorage.setItem("procare_category", selected);
    if (selected === "certified") {
      localStorage.setItem("procare_credential_type", resolvedType);
      localStorage.setItem("procare_credential_body", resolvedBody);
      if (credentialNumber) localStorage.setItem("procare_credential_number", credentialNumber);
      if (credentialYear) localStorage.setItem("procare_credential_year", credentialYear);
    } else {
      localStorage.removeItem("procare_credential_type");
      localStorage.removeItem("procare_credential_body");
      localStorage.removeItem("procare_credential_number");
      localStorage.removeItem("procare_credential_year");
    }

    setLocation("/procare-attestation");
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 pb-32">
        {/* Header */}
        <div className="pt-6 pb-2">
          <button
            onClick={() => setLocation("/procare-welcome")}
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

            <h1 className="text-2xl font-bold mb-2">How Do You Identify Professionally?</h1>
            <p className="text-white/60 text-sm max-w-sm mx-auto">
              Select the option that best describes your current professional status. All paths are welcome.
            </p>
          </div>
        </div>

        {/* Identity Options */}
        <div className="space-y-3 mb-6">
          {OPTIONS.map((option) => {
            const isSelected = selected === option.id;
            return (
              <button
                key={option.id}
                onClick={() => setSelected(option.id)}
                className={`w-full text-left rounded-xl border p-4 transition-all active:scale-[0.98] ${
                  isSelected
                    ? `${option.borderColor} bg-white/10`
                    : "border-white/10 bg-white/5"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${option.color}`}>{option.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{option.title}</h3>
                      {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                    </div>
                    <p className="text-xs text-white/50 mt-1">{option.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Credential Entry (only for certified) */}
        {selected === "certified" && (
          <div className="space-y-4 p-4 rounded-xl border border-emerald-400/20 bg-emerald-900/10">
            <h3 className="text-sm font-semibold text-emerald-400 mb-2">Credential Information</h3>

            {/* Professional Role Dropdown + Other Input */}
            <div className="relative" ref={typeDropdownRef}>
              <label className="text-xs text-white/50 mb-1 block">Professional Role *</label>
              <button
                onClick={() => { setShowTypeDropdown(!showTypeDropdown); setShowBodyDropdown(false); }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-white/20 bg-white/5 text-sm active:scale-[0.98]"
              >
                <span className={credentialType ? "text-white" : "text-white/40"}>
                  {credentialType || "Select your role"}
                </span>
                <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${showTypeDropdown ? "rotate-180" : ""}`} />
              </button>
              {showTypeDropdown && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-white/20 bg-zinc-900 shadow-xl max-h-48 overflow-y-auto">
                  {CREDENTIAL_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => { setCredentialType(type); setShowTypeDropdown(false); if (type !== "Other") setCustomCredentialType(""); }}
                      className={`w-full text-left px-3 py-2.5 text-sm border-b border-white/5 last:border-0 active:bg-white/10 ${credentialType === type ? "text-emerald-400 bg-white/5" : "text-white/80"}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {credentialType === "Other" && (
              <div>
                <label className="text-xs text-white/50 mb-1 block">Enter Your Professional Role *</label>
                <Input
                  value={customCredentialType}
                  onChange={(e) => setCustomCredentialType(e.target.value)}
                  placeholder="e.g. Sports Nutritionist, Health Coach"
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/30"
                  autoFocus
                />
              </div>
            )}

            {/* Certification Body Dropdown + Other Input */}
            <div className="relative" ref={bodyDropdownRef}>
              <label className="text-xs text-white/50 mb-1 block">Certification Body / License State *</label>
              <button
                onClick={() => { setShowBodyDropdown(!showBodyDropdown); setShowTypeDropdown(false); }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-white/20 bg-white/5 text-sm active:scale-[0.98]"
              >
                <span className={credentialBody ? "text-white" : "text-white/40"}>
                  {credentialBody || "Select certification body"}
                </span>
                <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${showBodyDropdown ? "rotate-180" : ""}`} />
              </button>
              {showBodyDropdown && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-white/20 bg-zinc-900 shadow-xl max-h-48 overflow-y-auto">
                  {CREDENTIAL_BODIES.map((body) => (
                    <button
                      key={body}
                      onClick={() => { setCredentialBody(body); setShowBodyDropdown(false); if (body !== "Other") setCustomCredentialBody(""); }}
                      className={`w-full text-left px-3 py-2.5 text-sm border-b border-white/5 last:border-0 active:bg-white/10 ${credentialBody === body ? "text-emerald-400 bg-white/5" : "text-white/80"}`}
                    >
                      {body}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {credentialBody === "Other" && (
              <div>
                <label className="text-xs text-white/50 mb-1 block">Enter Your Certification Body *</label>
                <Input
                  value={customCredentialBody}
                  onChange={(e) => setCustomCredentialBody(e.target.value)}
                  placeholder="e.g. NESTA, Precision Nutrition, State of CA"
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/30"
                  autoFocus
                />
              </div>
            )}

            {/* License / Certification Date */}
            <div>
              <label className="text-xs text-white/50 mb-1 block">License / Certification Date (optional)</label>
              <Input
                value={credentialYear}
                onChange={(e) => setCredentialYear(e.target.value)}
                placeholder="e.g. 2019"
                className="bg-white/5 border-white/20 text-white placeholder:text-white/30"
                maxLength={4}
              />
            </div>

            {/* Certification / License Number */}
            <div>
              <label className="text-xs text-white/50 mb-1 block">Certification / License Number (optional)</label>
              <Input
                value={credentialNumber}
                onChange={(e) => setCredentialNumber(e.target.value)}
                placeholder="e.g. CPT-123456"
                className="bg-white/5 border-white/20 text-white placeholder:text-white/30"
              />
            </div>
          </div>
        )}
      </div>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
        <Button
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full h-14 text-md font-semibold rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40"
        >
          Continue
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
