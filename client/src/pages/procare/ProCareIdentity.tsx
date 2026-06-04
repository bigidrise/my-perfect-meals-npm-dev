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

type ProfessionalRole = "trainer" | "physician" | "dietitian" | "nurse_practitioner" | null;
type ProfessionalCategory = "certified" | "experienced" | "non_certified";

// Roles that REQUIRE a license number + state to continue
const LICENSED_ROLES: ProfessionalRole[] = ["physician", "dietitian", "nurse_practitioner"];

const TRAINER_CERT_BODIES = [
  "NASM",
  "ISSA",
  "ACE",
  "ACSM",
  "NCSF",
  "NSCA",
  "AFAA",
  "IYCA",
  "NFPT",
  "Other",
];

const ROLE_OPTIONS: { id: ProfessionalRole; label: string; sub: string }[] = [
  { id: "trainer",           label: "Trainer / Coach",                 sub: "Personal trainer, fitness coach, nutrition coach, lifestyle coach" },
  { id: "physician",         label: "Physician (MD / DO)",             sub: "Licensed physician, medical doctor, doctor of osteopathy" },
  { id: "dietitian",         label: "Dietitian / Nutritionist",        sub: "Registered Dietitian (RD/RDN), Licensed Nutritionist" },
  { id: "nurse_practitioner",label: "Nurse Practitioner / PA",         sub: "Nurse Practitioner, Physician Assistant, Advanced Practice RN" },
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
  const [role, setRole] = useState<ProfessionalRole>(
    (localStorage.getItem("procare_role") as ProfessionalRole) || null
  );
  const [selected, setSelected] = useState<ProfessionalCategory | null>(null);

  // Trainer fields (all optional)
  const [certBody, setCertBody]     = useState("");
  const [certNumber, setCertNumber] = useState("");
  const [certYear, setCertYear]     = useState("");
  const [showCertDropdown, setShowCertDropdown] = useState(false);
  const certDropdownRef = useRef<HTMLDivElement>(null);

  // Licensed-role fields (required for physician / dietitian / NP-PA)
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseState, setLicenseState]   = useState("");
  const [credentialType, setCredentialType] = useState(""); // e.g. MD, DO, RD, RDN, NP, PA

  const isLicensedRole = LICENSED_ROLES.includes(role);

  // Licensed roles are always "certified" — auto-select and lock
  useEffect(() => {
    if (isLicensedRole && selected !== "certified") {
      setSelected("certified");
    }
  }, [isLicensedRole]);

  // Close cert dropdown on outside tap
  useEffect(() => {
    function handleTap(e: MouseEvent) {
      if (showCertDropdown && certDropdownRef.current && !certDropdownRef.current.contains(e.target as Node)) {
        setShowCertDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleTap);
    return () => document.removeEventListener("mousedown", handleTap);
  }, [showCertDropdown]);

  // ── canContinue logic ──────────────────────────────────────────────────────
  // Physician / Dietitian / NP-PA: REQUIRE license number + license state
  // Trainer / Coach: NO license required — cert body is optional
  const canContinue = (() => {
    if (!role || !selected) return false;
    if (selected !== "certified") return true; // experience / non-cert paths: no docs needed
    if (isLicensedRole) {
      return licenseNumber.trim().length > 0 && licenseState.trim().length > 0;
    }
    return true; // trainer certified path: all fields optional
  })();

  const handleContinue = () => {
    if (!canContinue || !selected || !role) return;

    localStorage.setItem("procare_role", role);
    localStorage.setItem("procare_category", selected);

    if (selected === "certified") {
      if (isLicensedRole) {
        // Licensed roles: store license number in credentialNumber, state in credentialBody
        localStorage.setItem("procare_credential_number", licenseNumber.trim());
        localStorage.setItem("procare_credential_body",   licenseState.trim());
        if (credentialType.trim()) localStorage.setItem("procare_credential_type", credentialType.trim());
      } else {
        // Trainer: store optional cert body
        if (certBody.trim())   localStorage.setItem("procare_credential_body",   certBody.trim());
        if (certNumber.trim()) localStorage.setItem("procare_credential_number", certNumber.trim());
        if (certYear.trim())   localStorage.setItem("procare_credential_year",   certYear.trim());
      }
    } else {
      localStorage.removeItem("procare_credential_type");
      localStorage.removeItem("procare_credential_body");
      localStorage.removeItem("procare_credential_number");
      localStorage.removeItem("procare_credential_year");
    }

    setLocation("/procare-rewards");
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
            <h1 className="text-2xl font-bold mb-2">Professional Identity</h1>
            <p className="text-white/60 text-sm max-w-sm mx-auto">
              Tell us about your professional role and credentials.
            </p>
          </div>
        </div>

        {/* ── Role Selection ── */}
        <p className="text-xs text-white/50 uppercase tracking-wider mb-3 px-1">Your Professional Role</p>
        <div className="space-y-2 mb-6">
          {ROLE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => { setRole(opt.id); setSelected(null); }}
              className={`w-full text-left rounded-xl border p-3.5 transition-all active:scale-[0.98] ${
                role === opt.id
                  ? "border-white/40 bg-white/10 ring-1 ring-white/20"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className="text-xs text-white/45 mt-0.5">{opt.sub}</p>
                </div>
                {role === opt.id && <Check className="w-4 h-4 text-emerald-400 shrink-0 ml-3" />}
              </div>
            </button>
          ))}
        </div>

        {/* ── Credential Status (trainers only see all 3; licensed roles locked to "certified") ── */}
        {role && (
          <>
            <p className="text-xs text-white/50 uppercase tracking-wider mb-3 px-1">Your Credential Status</p>
            <div className="space-y-3 mb-6">
              {OPTIONS.filter((o) => !isLicensedRole || o.id === "certified").map((option) => {
                const isOptionSelected = selected === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => setSelected(option.id)}
                    className={`w-full text-left rounded-xl border p-4 transition-all active:scale-[0.98] ${
                      isOptionSelected
                        ? `${option.borderColor} bg-white/10`
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 ${option.color}`}>{option.icon}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold">{option.title}</h3>
                          {isOptionSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                        </div>
                        <p className="text-xs text-white/50 mt-1">{option.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════════════════════
            CREDENTIAL ENTRY — LICENSED ROLES (Physician / Dietitian / NP-PA)
            License number + state are REQUIRED
        ════════════════════════════════════════════════════════════ */}
        {role && isLicensedRole && selected === "certified" && (
          <div className="space-y-4 p-4 rounded-xl border border-blue-400/20 bg-blue-900/10">
            <h3 className="text-sm font-semibold text-blue-400 mb-1">License Information</h3>

            {/* License Number — REQUIRED */}
            <div>
              <label className="text-xs text-white/50 mb-1 block">
                License Number <span className="text-red-400">*</span>
              </label>
              <Input
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder={
                  role === "physician"          ? "e.g. MD-123456 or NPI number" :
                  role === "dietitian"          ? "e.g. RD-789012 or state license #" :
                                                 "e.g. NP-345678 or DEA number"
                }
                className="bg-white/5 border-white/20 text-white placeholder:text-white/30"
              />
            </div>

            {/* License State — REQUIRED */}
            <div>
              <label className="text-xs text-white/50 mb-1 block">
                License State <span className="text-red-400">*</span>
              </label>
              <Input
                value={licenseState}
                onChange={(e) => setLicenseState(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="e.g. CA, TX, NY"
                maxLength={2}
                className="bg-white/5 border-white/20 text-white placeholder:text-white/30 uppercase"
              />
            </div>

            {/* Professional Credentials — optional but helpful */}
            <div>
              <label className="text-xs text-white/50 mb-1 block">
                Professional Credentials{" "}
                <span className="text-white/30">(optional — e.g. MD, DO, RD, RDN, NP, PA)</span>
              </label>
              <Input
                value={credentialType}
                onChange={(e) => setCredentialType(e.target.value)}
                placeholder={
                  role === "physician"           ? "e.g. MD, DO, FACP" :
                  role === "dietitian"           ? "e.g. RD, RDN, LD" :
                                                  "e.g. NP, PA-C, APRN"
                }
                className="bg-white/5 border-white/20 text-white placeholder:text-white/30"
              />
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            CREDENTIAL ENTRY — TRAINER / COACH
            All fields are OPTIONAL — no license required
        ════════════════════════════════════════════════════════════ */}
        {role === "trainer" && selected === "certified" && (
          <div className="space-y-4 p-4 rounded-xl border border-emerald-400/20 bg-emerald-900/10">
            <div>
              <h3 className="text-sm font-semibold text-emerald-400 mb-0.5">Certification Information</h3>
              <p className="text-xs text-white/40">All fields are optional for trainers and coaches.</p>
            </div>

            {/* Certification Body — optional dropdown */}
            <div className="relative" ref={certDropdownRef}>
              <label className="text-xs text-white/50 mb-1 block">
                Certification Body <span className="text-white/30">(optional)</span>
              </label>
              <div className="relative">
                <Input
                  value={certBody}
                  onChange={(e) => { setCertBody(e.target.value); setShowCertDropdown(false); }}
                  onFocus={() => setShowCertDropdown(true)}
                  placeholder="e.g. NASM, ISSA, ACE, ACSM…"
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/30 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowCertDropdown(!showCertDropdown)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 active:scale-[0.95]"
                >
                  <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${showCertDropdown ? "rotate-180" : ""}`} />
                </button>
              </div>
              {showCertDropdown && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-white/20 bg-zinc-900 shadow-xl max-h-48 overflow-y-auto">
                  {TRAINER_CERT_BODIES.filter((b) => !certBody || b.toLowerCase().includes(certBody.toLowerCase())).map((body) => (
                    <button
                      key={body}
                      onClick={() => { setCertBody(body); setShowCertDropdown(false); }}
                      className={`w-full text-left px-3 py-2.5 text-sm border-b border-white/5 last:border-0 active:bg-white/10 ${certBody === body ? "text-emerald-400 bg-white/5" : "text-white/80"}`}
                    >
                      {body}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cert Number — optional */}
            <div>
              <label className="text-xs text-white/50 mb-1 block">
                Certification Number <span className="text-white/30">(optional)</span>
              </label>
              <Input
                value={certNumber}
                onChange={(e) => setCertNumber(e.target.value)}
                placeholder="e.g. CPT-123456"
                className="bg-white/5 border-white/20 text-white placeholder:text-white/30"
              />
            </div>

            {/* Cert Year — optional */}
            <div>
              <label className="text-xs text-white/50 mb-1 block">
                Year Certified <span className="text-white/30">(optional)</span>
              </label>
              <Input
                value={certYear}
                onChange={(e) => setCertYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="e.g. 2021"
                maxLength={4}
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
