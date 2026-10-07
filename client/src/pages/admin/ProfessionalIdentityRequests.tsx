import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  getProfessionalReviewDetail,
  getProfessionalReviewQueue,
  saveProfessionalIdentityDecision,
} from "@/lib/professionalIdentityReview";
import { professionalRequestsEnabled } from "@/lib/professionalOnboarding";
import type { ProfessionalIdentityDecision, ProfessionalIdentityRequest, ProfessionalReadiness } from "@shared/professionalOnboarding";
import type { ProfessionalIdentityReviewDetail } from "@shared/professionalIdentityReview";

type DecisionChoice = ProfessionalIdentityDecision["decision"];

const roleLabels: Record<string, string> = {
  trainer: "Trainer",
  physician: "Physician",
  dietitian: "Dietitian",
  nurse_practitioner: "Nurse practitioner",
};

const categoryLabels: Record<string, string> = {
  certified: "Certified / licensed information",
  experienced: "Experienced practitioner information",
  non_certified: "Non-certified information",
};

const readinessLabels: Record<string, string> = {
  identity: "Account identity",
  credentials: "Credentials",
  training: "Training",
  agreements: "Professional agreements",
  entitlement: "Subscription entitlement",
  mfa: "MFA",
  organizationLocation: "Organization / location",
  relationshipConsent: "Relationship consent",
};

function prettyRole(value: string | null | undefined) {
  return value ? roleLabels[value] ?? value.replaceAll("_", " ") : "None";
}

function prettyDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "The request could not be completed. Try again.";
}

function errorNeedsSecurityAttention(message: string) {
  return /403|MFA_REQUIRED|mfa|required.*security|security.*required/i.test(message);
}

function StatusPill({ status }: { status: string }) {
  const style: Record<string, string> = {
    ready: "border-teal-300/50 bg-teal-50 text-teal-900",
    blocked: "border-rose-300/60 bg-rose-50 text-rose-900",
    unavailable: "border-amber-300/60 bg-amber-50 text-amber-950",
    not_applicable: "border-stone-300 bg-stone-100 text-stone-700",
    not_evaluated: "border-stone-300 bg-stone-100 text-stone-700",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${style[status] ?? style.not_evaluated}`}>{status.replaceAll("_", " ")}</span>;
}

function ReadinessPanel({ readiness, readinessError }: { readiness: ProfessionalReadiness | null; readinessError?: string }) {
  if (!readiness) {
    return (
      <section className="rounded-2xl border border-amber-300/70 bg-amber-50 p-5 text-amber-950" aria-labelledby="readiness-heading">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800">Separate assessment</p>
        <h3 id="readiness-heading" className="mt-1 text-lg font-semibold">Clinical readiness unavailable</h3>
        <p className="mt-2 text-sm leading-6">No readiness conclusion is available for this account. Identity review must not be treated as clinical clearance.</p>
        {readinessError && <p className="mt-2 break-words text-xs text-amber-900">Assessment detail: {readinessError}</p>}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#c9d6cf] bg-[#f4f7f2] p-5" aria-labelledby="readiness-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#4f695b]">Separate assessment</p>
          <h3 id="readiness-heading" className="mt-1 text-lg font-semibold text-[#24372f]">Clinical readiness</h3>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${readiness.accountPrerequisitesReady ? "bg-[#d7e8dc] text-[#244a35]" : "bg-[#f3e7ca] text-[#684f1c]"}`}>
          Account prerequisites {readiness.accountPrerequisitesReady ? "ready" : "not ready"}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-[#53645b]">Readiness is not established by this identity decision; client access is not evaluated here.</p>
      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        {Object.entries(readiness.checks).map(([key, check]) => (
          <div key={key} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#dce5de] bg-white/75 px-3 py-2.5">
            <div className="min-w-0">
              <dt className="text-sm font-medium text-[#2e4037]">{readinessLabels[key] ?? key}</dt>
              <dd className="mt-0.5 break-words text-xs text-[#64736a]">Reason code: {check.code}</dd>
            </div>
            <StatusPill status={check.status} />
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function ProfessionalIdentityRequests() {
  const { user, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<ProfessionalIdentityRequest[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<ProfessionalIdentityReviewDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailRetry, setDetailRetry] = useState(0);
  const [choice, setChoice] = useState<DecisionChoice | "">("");
  const [reason, setReason] = useState("");
  const [identityAcknowledged, setIdentityAcknowledged] = useState(false);
  const [sharedDataAcknowledged, setSharedDataAcknowledged] = useState(false);
  const [recoveryAcknowledged, setRecoveryAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const [successResult, setSuccessResult] = useState<{ decision: DecisionChoice; reason: string; reauthenticationRequired: boolean } | null>(null);
  const detailSequence = useRef(0);
  const queueSequence = useRef(0);

  const authorized = Boolean(user?.isAdmin);
  const activeDetail = detail?.request.id === selectedId ? detail : null;
  const selectedRequest = activeDetail?.request ?? requests.find(request => request.id === selectedId) ?? null;
  const identityWouldChange = Boolean(
    activeDetail && selectedRequest &&
    ((activeDetail.currentAuthorizedRole && (
      activeDetail.currentAuthorizedRole !== selectedRequest.requestedRole ||
      activeDetail.currentProfessionalCategory !== selectedRequest.professionalCategory
    )) || (!activeDetail.currentAuthorizedRole && activeDetail.currentProfessionalCategory &&
      activeDetail.currentProfessionalCategory !== selectedRequest.professionalCategory)),
  );
  const changesPreviousIdentity = choice === "approve" && identityWouldChange;
  const trimmedReason = reason.trim();
  const canSubmit = Boolean(
    activeDetail && selectedRequest?.state === "submitted" && choice &&
    trimmedReason.length >= 5 && trimmedReason.length <= 1000 &&
    identityAcknowledged && sharedDataAcknowledged &&
    (!changesPreviousIdentity || recoveryAcknowledged) &&
    selectedRequest.ownerUserId !== user?.id && !busy,
  );

  async function reloadQueue() {
    const sequence = ++queueSequence.current;
    setQueueLoading(true);
    setQueueError("");
    try {
      const result = await getProfessionalReviewQueue();
      if (sequence === queueSequence.current) setRequests(result.requests);
    } catch (error) {
      if (sequence === queueSequence.current) setQueueError(errorMessage(error));
    } finally {
      if (sequence === queueSequence.current) setQueueLoading(false);
    }
  }

  useEffect(() => {
    if (!authorized || !professionalRequestsEnabled) return;
    void reloadQueue();
    return () => { queueSequence.current += 1; };
  }, [authorized, user?.id]);

  useEffect(() => {
    const sequence = ++detailSequence.current;
    setDetail(null);
    setDetailError("");
    setChoice("");
    setReason("");
    setIdentityAcknowledged(false);
    setSharedDataAcknowledged(false);
    setRecoveryAcknowledged(false);
    setDecisionError("");
    setSuccessResult(null);

    if (!selectedId || !authorized || !professionalRequestsEnabled) {
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    getProfessionalReviewDetail(selectedId).then(result => {
      if (sequence === detailSequence.current) setDetail(result);
    }).catch(error => {
      if (sequence === detailSequence.current) setDetailError(errorMessage(error));
    }).finally(() => {
      if (sequence === detailSequence.current) setDetailLoading(false);
    });
    return () => { detailSequence.current += 1; };
  }, [selectedId, authorized, user?.id, detailRetry]);

  async function submitDecision() {
    if (!canSubmit || !activeDetail || !selectedRequest || !choice) return;
    setBusy(true);
    setDecisionError("");
    const submittedReason = trimmedReason;
    const submittedChoice = choice;
    const targetId = selectedRequest.id;
    const targetSequence = detailSequence.current;
    try {
      const result = await saveProfessionalIdentityDecision(targetId, {
        revision: selectedRequest.revision,
        reviewedStateHash: activeDetail.reviewedStateHash,
        decision: submittedChoice,
        ...(submittedChoice === "approve" ? { approvedRole: selectedRequest.requestedRole! } : {}),
        reason: submittedReason,
        recovery: changesPreviousIdentity ? recoveryAcknowledged : false,
        identityOnlyAcknowledged: true,
        sharedDataAcknowledged: true,
      });
      setSuccessResult({
        decision: submittedChoice,
        reason: submittedReason,
        reauthenticationRequired: result.reauthenticationRequired,
      });
      setChoice("");
      setReason("");
      setIdentityAcknowledged(false);
      setSharedDataAcknowledged(false);
      setRecoveryAcknowledged(false);

      const detailRefresh = getProfessionalReviewDetail(targetId).then(refreshed => {
        if (detailSequence.current === targetSequence) setDetail(refreshed);
      }).catch(error => {
        if (detailSequence.current === targetSequence) setDetailError(`Decision saved; refreshed detail unavailable. ${errorMessage(error)}`);
      });
      const queueRefresh = reloadQueue();
      await Promise.all([detailRefresh, queueRefresh]);
    } catch (error) {
      setDecisionError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function chooseTarget(id: string) {
    detailSequence.current += 1;
    setDetail(null);
    setDetailError("");
    setChoice("");
    setReason("");
    setIdentityAcknowledged(false);
    setSharedDataAcknowledged(false);
    setRecoveryAcknowledged(false);
    setDecisionError("");
    setSuccessResult(null);
    setDetailLoading(true);
    setSelectedId(id);
  }

  const isSelfReview = Boolean(selectedRequest && user && selectedRequest.ownerUserId === user.id);

  return (
    <main className="min-h-[100dvh] bg-[#edf1ec] text-[#25342d]">
      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-7 sm:py-9">
        <header className="mb-7 border-b border-[#ccd6cf] pb-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#587463]">MPM · Reviewer workspace</p>
              <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">Professional identity requests</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#58675f]">Review the submitted claim, the account’s current identity, and readiness as distinct records.</p>
            </div>
            <span className="rounded-full border border-[#c8d4cb] bg-[#f8faf7] px-3 py-1.5 text-xs font-semibold text-[#53685b]">
              Admin review · max 50 submitted
            </span>
          </div>
        </header>

        {authLoading ? (
          <div className="grid gap-5 lg:grid-cols-[330px_1fr]">
            <div className="h-72 animate-pulse rounded-2xl bg-[#dce4dd]" />
            <div className="h-[34rem] animate-pulse rounded-2xl bg-[#dce4dd]" />
          </div>
        ) : !authorized ? (
          <section className="mx-auto max-w-xl rounded-2xl border border-[#d3c8b5] bg-[#f8f5ee] p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#846d43]">Restricted workspace</p>
            <h2 className="mt-2 text-2xl font-semibold">Administrator access required</h2>
            <p className="mt-3 text-sm leading-6 text-[#5e5b52]">This review queue is available only to authenticated administrators. The server also validates role, MFA, and request version for every action.</p>
            <Link href="/auth" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#304c3d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#233b2e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#304c3d]">Go to sign in</Link>
            <p className="mt-3 text-xs text-[#66655d]">Complete MFA through the existing sign-in or account security flow; this page does not enroll MFA.</p>
          </section>
        ) : !professionalRequestsEnabled ? (
          <section className="rounded-2xl border border-[#d3c8b5] bg-[#f8f5ee] p-6" role="status">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#846d43]">Environment gate</p>
            <h2 className="mt-2 text-xl font-semibold">Professional request review is disabled here</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5e5b52]">No queue or review actions are available in this environment. Production functionality remains gated.</p>
          </section>
        ) : (
          <div className="grid items-start gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">
            <aside className="overflow-hidden rounded-2xl border border-[#d2dbd4] bg-[#f8faf7] shadow-[0_12px_30px_rgba(39,62,48,0.06)]" aria-label="Submitted requests">
              <div className="flex items-center justify-between border-b border-[#dfe6e0] px-4 py-4">
                <div>
                  <h2 className="font-semibold">Submitted queue</h2>
                  <p className="mt-0.5 text-xs text-[#738078]">{requests.length} {requests.length === 1 ? "request" : "requests"}</p>
                </div>
                <button type="button" onClick={() => void reloadQueue()} disabled={queueLoading} className="rounded-lg border border-[#ccd8cf] px-3 py-2 text-xs font-semibold text-[#385542] hover:bg-[#eaf0eb] disabled:opacity-50">
                  {queueLoading ? "Loading…" : "Refresh"}
                </button>
              </div>
              {queueError && (
                <div className="m-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-950" role="alert">
                  <p>{queueError}</p>
                  {errorNeedsSecurityAttention(queueError) && <p className="mt-2 text-xs">The server denied this request. Re-authenticate at <Link href="/auth" className="underline">/auth</Link> and use existing account security settings for MFA. No bypass is available here.</p>}
                  <button type="button" className="mt-2 font-semibold underline" onClick={() => void reloadQueue()}>Retry queue</button>
                </div>
              )}
              {queueLoading && requests.length === 0 ? (
                <div className="space-y-2 p-4" aria-label="Loading queue">
                  {[0, 1, 2].map(item => <div key={item} className="h-20 animate-pulse rounded-xl bg-[#e8eee9]" />)}
                </div>
              ) : requests.length === 0 && !queueError ? (
                <div className="px-5 py-10 text-center">
                  <span className="mx-auto grid h-10 w-10 place-items-center rounded-full border border-[#cdd9d0] text-sm font-serif text-[#53705d]" aria-hidden="true">—</span>
                  <h3 className="mt-3 font-semibold">No submitted requests</h3>
                  <p className="mt-1 text-sm leading-5 text-[#748078]">New submissions will appear here for review.</p>
                </div>
              ) : (
                <ul className="max-h-[70vh] divide-y divide-[#e2e8e3] overflow-y-auto">
                  {requests.map(request => {
                    const self = request.ownerUserId === user?.id;
                    return (
                      <li key={request.id}>
                        <button
                          type="button"
                          onClick={() => chooseTarget(request.id)}
                          aria-current={selectedId === request.id ? "true" : undefined}
                          className={`w-full px-4 py-4 text-left transition-colors hover:bg-[#eef3ee] focus-visible:outline focus-visible:outline-inset focus-visible:outline-2 focus-visible:outline-[#55745f] ${selectedId === request.id ? "bg-[#e8efe9]" : ""}`}
                        >
                          <span className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-[#2b3c32]">{prettyRole(request.requestedRole)}</span>
                            {self && <span className="rounded-full bg-rose-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-900">Self</span>}
                          </span>
                          <span className="mt-1 block text-xs text-[#66756b]">{request.professionalCategory ? categoryLabels[request.professionalCategory] ?? request.professionalCategory : "Category not supplied"}</span>
                          <span className="mt-2 block text-[11px] text-[#849087]">Submitted {prettyDate(request.submittedAt)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </aside>

            <section className="min-w-0 space-y-5" aria-live="polite">
              {!selectedId ? (
                <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-[#bdcbc0] bg-[#f7f9f6] p-8 text-center">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#718276]">Review one record at a time</p>
                    <h2 className="mt-2 text-2xl font-semibold">Choose a submitted request</h2>
                    <p className="mt-2 max-w-md text-sm leading-6 text-[#65736a]">The review panel keeps claimed information, existing account identity, and readiness visibly separate.</p>
                  </div>
                </div>
              ) : detailLoading ? (
                <div className="space-y-4" aria-label="Loading request detail">
                  <div className="h-52 animate-pulse rounded-2xl bg-[#dce4dd]" />
                  <div className="h-64 animate-pulse rounded-2xl bg-[#dce4dd]" />
                </div>
              ) : detailError && !detail ? (
                <div className="rounded-2xl border border-rose-300 bg-rose-50 p-5 text-rose-950" role="alert">
                  <h2 className="font-semibold">Unable to load request detail</h2>
                  <p className="mt-2 break-words text-sm">{detailError}</p>
                  {errorNeedsSecurityAttention(detailError) && <p className="mt-2 text-sm">Server security checks cannot be bypassed. Go to <Link href="/auth" className="underline">/auth</Link> to establish a verified session, and use existing account security settings for MFA.</p>}
                  <button type="button" onClick={() => setDetailRetry(value => value + 1)} className="mt-4 rounded-lg border border-rose-400 px-3 py-2 text-sm font-semibold hover:bg-rose-100">Retry detail</button>
                </div>
              ) : activeDetail && selectedRequest ? (
                <>
                  {successResult && (
                    <div className="rounded-2xl border border-[#a9c7b0] bg-[#e6f1e8] p-4 text-[#264a31]" role="status">
                      <p className="font-semibold">Decision saved: {successResult.decision.replaceAll("_", " ")}</p>
                      <p className="mt-1 break-words text-sm">Reviewer reason: {successResult.reason}</p>
                      {successResult.reauthenticationRequired && <p className="mt-1 text-sm font-medium">The identity change requires reauthentication. Affected sessions may be revoked.</p>}
                    </div>
                  )}
                  {detailError && <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status">{detailError}</p>}
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
                    <div className="space-y-5">
                      <section className="rounded-2xl border border-[#d2dbd4] bg-[#f9fbf8] p-5 shadow-[0_12px_30px_rgba(39,62,48,0.05)]">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#62786a]">01 · Submitted claim</p>
                            <h2 className="mt-1 text-2xl font-semibold">{prettyRole(selectedRequest.requestedRole)}</h2>
                            <p className="mt-1 text-sm text-[#617067]">{selectedRequest.professionalCategory ? categoryLabels[selectedRequest.professionalCategory] ?? selectedRequest.professionalCategory : "Information category not supplied"}</p>
                          </div>
                          <span className="rounded-full border border-[#d6c99f] bg-[#f8f2df] px-3 py-1.5 text-xs font-bold text-[#685627]">Unverified claim</span>
                        </div>
                        <dl className="mt-5 grid gap-x-5 gap-y-3 sm:grid-cols-2">
                          <div><dt className="text-xs font-semibold uppercase tracking-wide text-[#819087]">Credential type</dt><dd className="mt-1 break-words text-sm">{selectedRequest.credentialType || "Not provided"}</dd></div>
                          <div><dt className="text-xs font-semibold uppercase tracking-wide text-[#819087]">Issuing body / state</dt><dd className="mt-1 break-words text-sm">{selectedRequest.credentialBody || "Not provided"}</dd></div>
                          <div><dt className="text-xs font-semibold uppercase tracking-wide text-[#819087]">Credential number</dt><dd className="mt-1 break-words font-mono text-sm">{selectedRequest.credentialNumber || "Not provided"}</dd></div>
                          <div><dt className="text-xs font-semibold uppercase tracking-wide text-[#819087]">Credential year</dt><dd className="mt-1 text-sm">{selectedRequest.credentialYear || "Not provided"}</dd></div>
                          <div><dt className="text-xs font-semibold uppercase tracking-wide text-[#819087]">Submitted</dt><dd className="mt-1 text-sm">{prettyDate(selectedRequest.submittedAt)}</dd></div>
                          <div><dt className="text-xs font-semibold uppercase tracking-wide text-[#819087]">Request revision</dt><dd className="mt-1 font-mono text-sm">{selectedRequest.revision}</dd></div>
                        </dl>
                        <p className="mt-4 rounded-xl bg-[#f0eee6] px-3 py-2.5 text-xs leading-5 text-[#696550]">Submission is applicant-provided information. It is not credential verification, training completion, or clinical authorization.</p>
                      </section>

                      <section className="rounded-2xl border border-[#d2dbd4] bg-[#f9fbf8] p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#62786a]">02 · Current account identity</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-xl border border-[#dce4dd] bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#819087]">Authorized role now</p>
                          <p className="mt-1 text-lg font-semibold">{prettyRole(activeDetail.currentAuthorizedRole)}</p>
                          </div>
                          <div className="rounded-xl border border-[#dce4dd] bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#819087]">Professional category now</p>
                            <p className="mt-1 text-sm font-semibold">{activeDetail.currentProfessionalCategory ? categoryLabels[activeDetail.currentProfessionalCategory] ?? activeDetail.currentProfessionalCategory : "None"}</p>
                          </div>
                        </div>
                        <p className="mt-3 text-xs leading-5 text-[#68766d]">Approval changes account identity globally. This is distinct from readiness and does not establish the claimed credential.</p>
                      </section>

                      <ReadinessPanel readiness={activeDetail.readiness} readinessError={activeDetail.readinessError} />

                      <section className="rounded-2xl border border-[#d2dbd4] bg-[#f9fbf8] p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#62786a]">Review history</p>
                        {activeDetail.events.length ? (
                          <ol className="mt-3 space-y-2">
                            {activeDetail.events.map(event => (
                              <li key={event.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-[#e2e8e3] pt-2 text-xs">
                                <span className="font-semibold text-[#43574a]">{event.eventType.replaceAll("_", " ")}</span>
                                <span className="text-[#718078]">Revision {event.requestRevision} · {prettyDate(event.createdAt)}</span>
                              </li>
                            ))}
                          </ol>
                        ) : <p className="mt-3 text-sm text-[#748078]">No prior events recorded.</p>}
                        <p className="mt-2 text-[11px] text-[#88938b]">Append-only event metadata. Sensitive event payloads are not expanded here.</p>
                      </section>
                    </div>

                    <div className="space-y-5">
                      <section className="rounded-2xl border border-[#c8d5cb] bg-white p-5 shadow-[0_12px_30px_rgba(39,62,48,0.07)]">
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#62786a]">03 · Explicit decision</p>
                        <h2 className="mt-1 text-xl font-semibold">Record review outcome</h2>
                        {isSelfReview ? (
                          <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm leading-6 text-rose-950" role="alert">
                            Self-review is forbidden. You can inspect the record, but no decision can be submitted for your own account.
                          </div>
                        ) : selectedRequest.state !== "submitted" ? (
                          <div className="mt-4 rounded-xl border border-[#d6d9ce] bg-[#f1f2ed] p-4 text-sm leading-6 text-[#555d52]">
                            This request is no longer submitted ({selectedRequest.state.replaceAll("_", " ")}). Refresh the queue before taking any action.
                          </div>
                        ) : (
                          <>
                            <fieldset className="mt-4">
                              <legend className="text-sm font-semibold">Choose one outcome</legend>
                              <div className="mt-2 grid gap-2">
                                {([
                                  ["approve", "Approve identity request"],
                                  ["needs_correction", "Return for correction"],
                                  ["reject", "Reject request"],
                                ] as [DecisionChoice, string][]).map(([value, label]) => (
                                  <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm font-medium ${choice === value ? "border-[#63826b] bg-[#eef4ee] text-[#2d4a35]" : "border-[#dce3dd] hover:bg-[#f6f8f5]"}`}>
                                    <input type="radio" name="professional-decision" value={value} checked={choice === value} onChange={() => setChoice(value)} className="accent-[#355a40]" />
                                    {label}
                                  </label>
                                ))}
                              </div>
                            </fieldset>
                            {choice === "approve" && (
                              <div className="mt-3 rounded-xl border border-[#e2d7b3] bg-[#fbf7e9] p-3 text-sm text-[#61532c]">
                                The approved role will be the requested role: <strong>{prettyRole(selectedRequest.requestedRole)}</strong>. No other role can be assigned through this review.
                              </div>
                            )}
                            {changesPreviousIdentity && (
                              <label className="mt-3 flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm leading-5 text-amber-950">
                                <input type="checkbox" checked={recoveryAcknowledged} onChange={event => setRecoveryAcknowledged(event.target.checked)} className="mt-1 accent-[#725c25]" />
                                <span><strong>Recovery acknowledgment required.</strong> This approval changes a non-null existing identity. I understand target sessions will be revoked and affected users may need to reauthenticate.</span>
                              </label>
                            )}
                            <label htmlFor="review-reason" className="mt-4 block text-sm font-semibold">Reviewer reason <span className="font-normal text-[#748078]">(required, 5–1000 characters)</span></label>
                            <textarea id="review-reason" value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} rows={4} placeholder="Record the evidence or policy basis for this decision." className="mt-2 w-full resize-y rounded-xl border border-[#cad6cd] bg-[#fbfcfa] px-3 py-3 text-sm leading-5 outline-none focus:border-[#58755f] focus:ring-2 focus:ring-[#58755f]/20" />
                            <p className="mt-1 text-right text-xs text-[#839087]">{trimmedReason.length}/1000 · at least 5 non-space characters</p>

                            <div className="mt-4 space-y-3">
                              <label className="flex gap-3 text-sm leading-5">
                                <input type="checkbox" checked={identityAcknowledged} onChange={event => setIdentityAcknowledged(event.target.checked)} className="mt-1 accent-[#355a40]" />
                                <span>I acknowledge this decision concerns account identity only. It does not verify credentials or training, establish legal standing, activate subscription, or grant Studio, organization, client, or clinical authority.</span>
                              </label>
                              <label className="flex gap-3 rounded-xl border border-amber-300 bg-[#fff6de] p-3 text-sm leading-5 text-[#5d4b21]">
                                <input type="checkbox" checked={sharedDataAcknowledged} onChange={event => setSharedDataAcknowledged(event.target.checked)} className="mt-1 accent-[#725c25]" />
                                <span><strong>Shared Neon data warning:</strong> Development and Production share account data; approving changes the account identity globally. I acknowledge this impact and am authorized to proceed.</span>
                              </label>
                            </div>
                            {decisionError && (
                              <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-950" role="alert">
                                <p className="break-words">{decisionError}</p>
                                {errorNeedsSecurityAttention(decisionError) && <p className="mt-2">The server requires valid administrator MFA or another security condition. This page will not bypass that check. Go to <Link href="/auth" className="underline">/auth</Link>; use existing account security settings for MFA.</p>}
                              </div>
                            )}
                            <button type="button" onClick={() => void submitDecision()} disabled={!canSubmit} className="mt-5 min-h-12 w-full rounded-xl bg-[#304c3d] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#233b2e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#304c3d] disabled:cursor-not-allowed disabled:bg-[#aab8ad]">
                              {busy ? "Saving decision…" : "Confirm and save decision"}
                            </button>
                            <p className="mt-2 text-center text-xs leading-5 text-[#7a857d]">All decisions require a reason and both acknowledgments. The server rechecks role, MFA, and reviewed version.</p>
                          </>
                        )}
                      </section>
                      <aside className="rounded-2xl border border-[#d7c99f] bg-[#f8f2df] p-4 text-sm leading-6 text-[#5e512d]">
                        <p className="font-semibold">Identity is not readiness</p>
                        <p className="mt-1">No decision on this screen grants verified credentials, training, legal status, subscription, Studio access, organization authority, client access, or clinical authority.</p>
                      </aside>
                    </div>
                  </div>
                </>
              ) : null}
            </section>
          </div>
        )}
        <footer className="mt-8 border-t border-[#ccd6cf] pt-4 text-xs leading-5 text-[#76837a]">
          Reviewer actions are server-authorized and version-checked. Identity updates may revoke target sessions.
        </footer>
      </div>
    </main>
  );
}
