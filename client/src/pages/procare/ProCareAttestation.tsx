import { BackNavigationLabel } from "@/components/navigation/BackNavigationLabel";
import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, ShieldCheck, FileCheck, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthHeaders } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";
import { LEGAL_DOCUMENTS } from "../../../../shared/legalDocuments";
import ProfessionalLegalModal from "@/components/pro/ProfessionalLegalModal";
import { useTranslation } from "react-i18next";
import {
  clearProfessionalLegalRecovery,
  readProfessionalLegalRecovery,
} from "@/lib/professionalLegalRecovery";
import { isCanonicalPractitionerRole } from "@shared/professionalRoles";
import ProfessionalRequestReview from "./ProfessionalRequestReview";
import { useProfessionalOnboarding } from "@/hooks/useProfessionalOnboarding";
import { professionalRequestsEnabled } from "@/lib/professionalOnboarding";
import { professionalAgreementsAreCurrent } from "@/lib/professionalLegalStatus";

type ProfessionalCategory = "certified" | "experienced" | "non_certified";

// CLINICAL — do not translate without legal review
const ATTESTATION_V1 = {
  certified: "By continuing, you attest that the credential information you provided is accurate and current. All professional credentials submitted through My Perfect Meals are subject to manual verification by our team. Your account will be marked as Pending until your credentials are confirmed. Verified providers are marked accordingly and any misrepresentation of credentials will result in immediate removal.",
  experienced: "By continuing, you acknowledge that you are responsible for the guidance you provide to clients. You acknowledge that you are not currently maintaining an active professional certification and that My Perfect Meals does not verify experience-based credentials. You are responsible for the accuracy of any professional background you represent.",
  non_certified: "By continuing, you acknowledge that you are not currently a licensed or certified healthcare or fitness professional and that you will not represent yourself as one within the platform. You are responsible for the guidance you provide to clients.",
};

// i18n: leave for content team
const CATEGORY_LABELS: Record<ProfessionalCategory, string> = {
  certified: "Certified / Licensed Professional",
  experienced: "Professional Experience — No Current Certification",
  non_certified: "Using ProCare Without Professional Credentials",
};

export default function ProCareAttestation() {
  const { user } = useAuth();
  const requestStatus = useProfessionalOnboarding(user?.id);
  const search = useSearch();
  const explicitLegal = new URLSearchParams(search).get("legalOnly") === "true";
  const established = user?.isProCare && isCanonicalPractitionerRole(user.professionalRole);
  if (established && professionalRequestsEnabled && !explicitLegal) {
    if (requestStatus.isLoading) return <p role="status">Loading professional request status…</p>;
    if (requestStatus.error) return <div role="alert">Unable to load request status. <Button onClick={() => void requestStatus.refetch()}>Retry</Button></div>;
    if (requestStatus.data?.request) return <ProfessionalRequestReview />;
  }
  return established
    ? <EstablishedProfessionalLegalContinuation key={user?.id} />
    : <ProfessionalRequestReview />;
}

// Preserve the existing actual legal-only continuation. An application never
// invokes this path or writes legal evidence.
function EstablishedProfessionalLegalContinuation() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { user, refreshUser } = useAuth();
  const { t } = useTranslation();
  const [accepted, setAccepted] = useState(false);
  const [category, setCategory] = useState<ProfessionalCategory | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProfessionalModal, setShowProfessionalModal] = useState(false);

  const isLoggedIn = !!user;
  const recovery = readProfessionalLegalRecovery(search, user?.id);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const isExistingProfessionalRecovery =
    !!user?.isProCare &&
    !!user?.professionalRole &&
    user.professionalRole !== "business";

  const professionalRole =
    isExistingProfessionalRecovery
      ? user!.professionalRole as "trainer" | "physician"
      : (localStorage.getItem("procare_role") as "trainer" | "physician" | null) ||
        user?.professionalRole ||
        "trainer";
  const proFlow = professionalRole === "physician" ? "physician" : "professional";
  const recoveryActionLabel = recovery?.action === "client-invite"
    ? "your client invitation"
    : recovery?.action === "studio-creation"
      ? "Studio creation"
      : "your professional workspace";

  useEffect(() => {
    const stored = (
      isExistingProfessionalRecovery
        ? user?.professionalCategory
        : localStorage.getItem("procare_category") || user?.professionalCategory
    ) as ProfessionalCategory | null;
    setCategory(stored && Object.hasOwn(CATEGORY_LABELS, stored) ? stored : null);
    setAccepted(false);
  }, [setLocation, user?.professionalCategory, isExistingProfessionalRecovery]);

  if (!category) return <div className="mx-auto max-w-lg p-6 text-white">
    <label htmlFor="professional-legal-category">Choose your professional category to review the attestation</label>
    <select id="professional-legal-category" value="" className="mt-3 block w-full rounded border border-white/30 bg-zinc-900 p-3"
      onChange={event => {
        const selected = event.target.value;
        if (Object.hasOwn(CATEGORY_LABELS, selected)) { setAccepted(false); setCategory(selected as ProfessionalCategory); }
      }}>
      <option value="" disabled>Select a category</option>
      {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  </div>;

  const attestationText = ATTESTATION_V1[category];

  const acceptAttestationInDB = async () => {
    const res = await fetch(apiUrl("/api/legal/accept"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      credentials: "include",
      body: JSON.stringify({
        documentType: "professional_attestation",
        version: LEGAL_DOCUMENTS.attestation[0].version,
        expectedUserId: user?.id,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to record attestation");
    }
  };

  const checkProfessionalDocs = async (): Promise<boolean> => {
    const res = await fetch(apiUrl(`/api/legal/status?flow=${proFlow}`), {
      headers: { ...getAuthHeaders() },
      credentials: "include",
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.allAccepted === true;
  };

  const finishExistingRecovery = async () => {
    if (!(await professionalAgreementsAreCurrent(professionalRole))) {
      throw new Error("The required agreements are not current. Please review them again.");
    }
    if (!active.current) return;
    await refreshUser();
    if (!active.current) return;
    const returnTo = recovery?.returnTo ||
      (professionalRole === "physician" ? "/care-team/physician" : "/care-team/trainer");
    clearProfessionalLegalRecovery();
    setLocation(returnTo);
  };

  const handleContinue = async () => {
    if (!accepted) return;

    localStorage.setItem("procare_entry_path", category);

    if (isLoggedIn) {
      setUpgrading(true);
      setError(null);
      try {
        await acceptAttestationInDB();

        const proDocsAccepted = await checkProfessionalDocs();
        if (!proDocsAccepted) {
          setShowProfessionalModal(true);
          setUpgrading(false);
          return;
        }

        await finishExistingRecovery();
      } catch (err: any) {
        setError(err.message || "Failed to process attestation. Please try again.");
        setUpgrading(false);
      }
    } else {
      setLocation("/auth?procare=true");
    }
  };

  const handleProfessionalDocsAccepted = async () => {
    await finishExistingRecovery();
    if (active.current) setShowProfessionalModal(false);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="flex-1 overflow-y-auto px-4 pb-32">
        <div className="pt-6 pb-2">
          <button
            onClick={() => setLocation("/procare-rewards")}
            className="flex items-center gap-1 text-white/60 text-sm mb-4 active:scale-[0.98]"
          >
            <ArrowLeft className="w-4 h-4" />
            <BackNavigationLabel />
          </button>

          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-900/40 to-blue-800/40 rounded-2xl border border-blue-400/30 mb-4">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
              <span className="text-white font-semibold text-sm">ProCare Professional</span>
            </div>

            <h1 className="text-2xl font-bold mb-2">Professional Acknowledgment</h1>
            <p className="text-white/60 text-sm max-w-sm mx-auto">
              {isLoggedIn
                ? "Please review and accept the required professional agreements to continue."
                : "Please review and accept the following before creating your professional account."}
            </p>
          </div>

          {recovery && (
            <div className="mb-5 rounded-xl border border-blue-400/30 bg-blue-900/20 p-4">
              <p className="text-sm text-blue-100">
                Complete the required professional agreements and you will return to {recoveryActionLabel}.
              </p>
            </div>
          )}
        </div>

        {isLoggedIn && (
          <div className="mb-6 p-4 rounded-xl border border-emerald-400/20 bg-emerald-900/10">
            <p className="text-sm text-emerald-300">
                Signed in as <span className="font-semibold">{user.email}</span>.
            </p>
          </div>
        )}

        <div className="mb-6 p-4 rounded-xl border border-white/10 bg-white/5">
          <div className="flex items-center gap-2 mb-1">
            <FileCheck className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-white/50">{t("procare.attestation.categoryLabel")}</span>
          </div>
          <p className="text-sm font-semibold">{CATEGORY_LABELS[category]}</p>
        </div>

        <div className="mb-6 p-5 rounded-xl border border-blue-400/20 bg-blue-900/10">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-semibold text-blue-400">Professional Attestation</span>
          </div>
          <p className="text-sm text-white/70 leading-relaxed">
            {attestationText}
          </p>
        </div>

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
            {t("procare.attestation.checkboxLabel")}
          </p>
        </button>

        {error && (
          <div className="mt-4 p-3 rounded-xl border border-red-400/30 bg-red-900/20">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {category === "certified" && (
          <div className="mt-4 p-4 rounded-xl bg-amber-900/20 border border-amber-500/30">
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 shrink-0 animate-pulse" />
              <div>
                <p className="text-xs font-semibold text-amber-300 mb-1">{t("procare.attestation.pendingVerification")}</p>
                <p className="text-xs text-amber-200/70 leading-relaxed">
                  Your account will be active immediately, but will show as <strong>Pending</strong> until our team manually confirms your credentials. Physicians and licensed providers are prioritized for verification. You will not be endorsed as a Verified Provider until this is complete.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border border-blue-400/10">
          <p className="text-xs text-white/50 text-center">
            {t("procare.attestation.platformSafety")}
          </p>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
        <Button
          onClick={handleContinue}
          disabled={!accepted || upgrading}
          className="w-full h-14 text-md font-semibold rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40"
        >
          {upgrading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {t("procare.attestation.upgrading")}
            </>
          ) : isExistingProfessionalRecovery ? (
            <>
              Accept Agreements and Continue
              <ArrowRight className="w-5 h-5" />
            </>
          ) : isLoggedIn ? (
            <>
              {t("procare.attestation.upgradeToPro")}
              <ArrowRight className="w-5 h-5" />
            </>
          ) : (
            <>
              {t("procare.attestation.createAccount")}
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </Button>
      </div>

      <ProfessionalLegalModal
        open={showProfessionalModal}
        flow={proFlow}
        onAccepted={handleProfessionalDocsAccepted}
      />
    </div>
  );
}
