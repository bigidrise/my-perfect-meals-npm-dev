import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useProfessionalOnboarding } from "@/hooks/useProfessionalOnboarding";
import { readLocalProfessionalDraft, professionalRequestsEnabled } from "@/lib/professionalOnboarding";
import { getOwnProfessionalReadiness } from "@/lib/professionalIdentityReview";
import type { ProfessionalReadiness } from "@shared/professionalOnboarding";
import { isCanonicalPractitionerRole } from "@shared/professionalRoles";

const roleLabels: Record<string, string> = {
  trainer: "Trainer", physician: "Physician", dietitian: "Dietitian", nurse_practitioner: "Nurse Practitioner",
};

export default function ProfessionalRequestReview() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const status = useProfessionalOnboarding(user?.id);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [readiness, setReadiness] = useState<ProfessionalReadiness | null>(null);
  const [readinessError, setReadinessError] = useState("");
  const readinessAccount = useRef(user?.id);
  readinessAccount.current = user?.id;
  useEffect(() => { setReadiness(null); setReadinessError(""); setAcknowledged(false); }, [user?.id]);
  const anonymous = !user ? readLocalProfessionalDraft() : null;
  const request = user ? status.data?.request : anonymous;
  const submitted = user && status.data?.request?.state === "submitted";
  const savedRequest = status.data?.request;
  const decided = savedRequest && ["approved", "rejected", "needs_correction"].includes(savedRequest.state);
  async function loadReadiness() {
    const accountId = user?.id;
    setReadiness(null); setReadinessError("");
    try {
      const next = await getOwnProfessionalReadiness();
      if (readinessAccount.current === accountId) setReadiness(next);
    }
    catch (cause) { if (readinessAccount.current === accountId) setReadinessError(cause instanceof Error ? cause.message : "Readiness unavailable."); }
  }
  async function resumeCorrection() {
    setBusy(true); setError("");
    try { await status.resume(); navigate("/procare-identity"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to resume corrections."); }
    finally { setBusy(false); }
  }
  async function submit() {
    if (!status.data?.request || !acknowledged || busy) return;
    setBusy(true); setError("");
    try {
      await status.submit(status.data.request.revision, status.data.request.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to submit your request."); }
    finally { setBusy(false); }
  }
  return (
    <div className="min-h-screen bg-black text-white px-4 pt-8 pb-24">
      <div className="max-w-lg mx-auto space-y-6">
        <button className="text-sm text-white/60" onClick={() => navigate("/procare-identity")}>Back to professional information</button>
        <h1 className="text-2xl font-bold">Professional application</h1>
        <p className="text-white/70">An application or identity approval does not establish professional readiness.</p>
        {user?.isProCare && isCanonicalPractitionerRole(user.professionalRole) && <a className="block underline text-sm" href="/procare-attestation?legalOnly=true">Review required professional agreements separately</a>}
        {!professionalRequestsEnabled ? <p role="status">Professional applications are not enabled in this environment.</p> : <>
          {user && status.isLoading && <p role="status">Loading your saved request…</p>}
          {(error || status.error) && <div role="alert" className="text-red-300">{error || status.error?.message}<Button variant="outline" className="ml-2" onClick={() => { setError(""); void status.refetch(); }}>Reload status</Button></div>}
          {request && <div className="rounded-2xl border border-white/20 bg-white/5 p-5 space-y-3">
            <p><span className="text-white/60">Requested role:</span> {roleLabels[request.requestedRole ?? ""] || "Not selected"}</p>
            <p><span className="text-white/60">Information category:</span> {request.professionalCategory?.replaceAll("_", " ") || "Not selected"}</p>
            {request.credentialBody && <p>Issuing body / state: {request.credentialBody}</p>}
            {request.credentialNumber && <p>Credential number: {request.credentialNumber}</p>}
            {request.credentialType && <p>Credential type: {request.credentialType}</p>}
            {request.credentialYear && <p>Credential year: {request.credentialYear}</p>}
            {user && <p>Current authorized identity: {status.data?.currentAuthorizedRole || "No practitioner identity"}</p>}
          </div>}
          <div className="rounded-2xl border border-amber-400/30 p-5 text-sm text-amber-100">
            Submitting does not verify credentials, complete Academy training, accept professional agreements, activate a subscription, grant Studio or clinical access, or establish organization or Care Team authority.
          </div>
          {decided ? <div className="space-y-3">
            <h2 role="status" className="text-xl font-semibold">{savedRequest.state === "approved" ? "Identity approved — readiness is separate" : savedRequest.state === "rejected" ? "Request rejected — identity unchanged" : "Corrections requested — identity unchanged"}</h2>
            {savedRequest.decisionReason && <p className="text-white/70">Decision reason: {savedRequest.decisionReason}</p>}
            <p>Approval does not verify credentials or establish training, agreements, payment, Studio verification, organization access or client relationships.</p>
            {savedRequest.state === "needs_correction" && <Button disabled={busy} onClick={resumeCorrection}>Make corrections</Button>}
            <Button variant="outline" onClick={loadReadiness}>Check current readiness</Button>
            {readinessError && <p role="alert" className="text-red-300">{readinessError}</p>}
            {readiness && <div className="space-y-2 text-sm">
              <p>Account prerequisites: {readiness.accountPrerequisitesReady ? "satisfied" : "incomplete"}. Client access has not been evaluated.</p>
              {Object.entries(readiness.checks).map(([key, value]) => <p key={key}>{key}: {value.status} — {value.code}</p>)}
            </div>}
            <Button onClick={() => navigate("/more")}>Return to your account</Button>
          </div> : submitted ? <div role="status" className="space-y-3">
            <h2 className="text-xl font-semibold">Request submitted — access unchanged</h2>
            <p className="text-white/70">Your request is awaiting an authorized review. Submitting has not changed your identity or access.</p>
            <Button onClick={() => navigate("/more")}>Return to your account</Button>
          </div> : user ? <>
            {request && !status.isLoading && !status.error ? <>
              <label className="flex gap-3 text-sm"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} />I understand this submits a request only and does not change my account access.</label>
              <Button className="w-full bg-blue-600" disabled={!acknowledged || busy} onClick={submit}>{busy ? "Submitting…" : "Submit application"}</Button>
            </> : !status.isLoading && !status.error && <Button onClick={() => navigate("/procare-identity")}>Enter professional information</Button>}
          </> : <Button className="w-full bg-blue-600" onClick={() => {
            if (anonymous?.professionalCategory) localStorage.setItem("procare_entry_path", anonymous.professionalCategory);
            navigate("/auth?procare=true&returnTo=/procare-attestation");
          }}>Sign in or create an account to save your request</Button>}
        </>}
      </div>
    </div>
  );
}
