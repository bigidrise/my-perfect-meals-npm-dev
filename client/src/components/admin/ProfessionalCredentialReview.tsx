import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCredentialReview,
  getProfessionalReviewDetail,
  saveCredentialDecision,
} from "@/lib/professionalIdentityReview";
import type { CredentialReviewStatus, ProfessionalCredentialDecision } from "@shared/professionalCredentialReview";

type Decision = ProfessionalCredentialDecision["decision"];

const licensedRoles = new Set(["physician", "dietitian", "nurse_practitioner"]);

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function localDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function datetimeWithOffset(value: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function messageFor(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "The save outcome could not be confirmed. Reload the current status before retrying.";
}

function isConflictOrStale(error: unknown) {
  const message = messageFor(error);
  return /(^|\D)409(\D|$)|conflict|stale|revision|credential.*changed/i.test(message);
}

function statusLabel(status: CredentialReviewStatus["status"]) {
  return status.replaceAll("_", " ");
}

export default function ProfessionalCredentialReview({
  requestId,
  onSaved,
}: {
  requestId: string;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [review, setReview] = useState<CredentialReviewStatus | null>(null);
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [detailLoaded, setDetailLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [decision, setDecision] = useState<Decision | "">("");
  const [authority, setAuthority] = useState("");
  const [sourceReference, setSourceReference] = useState("");
  const [findings, setFindings] = useState("");
  const [checkedAt, setCheckedAt] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [independentAcknowledged, setIndependentAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [projectionWarning, setProjectionWarning] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [reloadRequired, setReloadRequired] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    setSaveError("");
    setSavedMessage("");
    setProjectionWarning("");
    setDecision("");
    setAuthority("");
    setSourceReference("");
    setFindings("");
    setCheckedAt("");
    setValidUntil("");
    setIndependentAcknowledged(false);
    try {
      const [freshReview, detail] = await Promise.all([
        getCredentialReview(requestId),
        getProfessionalReviewDetail(requestId),
      ]);
      setReview(freshReview);
      setReloadRequired(false);
      setOwnerUserId(detail.request.ownerUserId);
      setDetailLoaded(true);
    } catch (error) {
      setReview(null);
      setDetailLoaded(false);
      setLoadError(messageFor(error));
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    void reload();
  }, [reload, reloadKey]);

  const selfReview = Boolean(review?.selfReview || (user && ownerUserId === user.id));
  const eligibilityOkay = Boolean(review?.required && detailLoaded && !selfReview);
  // "stale" describes prior evidence, not the freshly loaded review snapshot.
  // A reviewer must be able to replace expired/identity-invalidated evidence.
  const serverEligible = review?.status === "pending" || review?.status === "verified" || review?.status === "rejected" || review?.status === "stale";
  const basis = `Authority: ${authority.trim()}\nSource reference: ${sourceReference.trim()}\nFindings: ${findings.trim()}`;
  const validCredentialSnapshot = Boolean(
    review?.reviewedCredentialHash && /^[a-f0-9]{64}$/.test(review.reviewedCredentialHash) &&
    review.approvalEventId,
  );
  const canSubmit = Boolean(
    eligibilityOkay && serverEligible && validCredentialSnapshot && decision &&
    authority.trim().length > 0 && sourceReference.trim().length > 0 && findings.trim().length > 0 &&
    basis.trim().length >= 10 && basis.trim().length <= 2000 &&
    independentAcknowledged &&
    (decision !== "verified" || (checkedAt && validUntil && datetimeWithOffset(checkedAt) && datetimeWithOffset(validUntil))) &&
    !busy && !loading && !reloadRequired,
  );

  async function submit() {
    if (!canSubmit || !review || !decision || !review.approvalEventId) return;
    setBusy(true);
    setSaveError("");
    setSavedMessage("");
    setProjectionWarning("");
    try {
      const result = await saveCredentialDecision(requestId, {
        revision: review.revision,
        reviewedCredentialHash: review.reviewedCredentialHash,
        approvalEventId: review.approvalEventId!,
        decision,
        verificationBasis: basis.trim(),
        ...(decision === "verified" ? {
          checkedAt: datetimeWithOffset(checkedAt)!,
          validUntil: datetimeWithOffset(validUntil)!,
        } : {}),
        independentVerificationAcknowledged: true,
      });
      if (result?.decisionSaved !== true) {
        setReloadRequired(true);
        setSaveError("The server did not confirm that this decision was saved. Reload the current status before retrying.");
        return;
      }

      setSavedMessage(`Credential decision committed: ${decision}.`);
      if (result.review) {
        setReview(result.review);
      } else {
        setReloadRequired(true);
        setProjectionWarning(result.reviewError
          ? `The decision was saved, but the current review projection is unavailable: ${result.reviewError}`
          : "The decision was saved, but the refreshed review status was unavailable. Reload to confirm the latest projection.");
      }
      setDecision("");
      setAuthority("");
      setSourceReference("");
      setFindings("");
      setCheckedAt("");
      setValidUntil("");
      setIndependentAcknowledged(false);
      onSaved();
    } catch (error) {
      setReloadRequired(true);
      const conflict = isConflictOrStale(error);
      setSaveError(conflict
        ? `The credential review is stale or conflicted (${messageFor(error)}). Reload the latest status before making another decision.`
        : `The save outcome is uncertain or unavailable (${messageFor(error)}). Reload the latest status before retrying; do not assume it was saved.`);
    } finally {
      setBusy(false);
    }
  }

  const latest = review?.latestDecision;
  const disabledReason = selfReview
    ? "Self-review is forbidden. You may inspect this status, but cannot record a credential decision."
    : review?.status === "demo_only"
      ? "This is a demonstration record. Credential decisions are disabled."
      : review?.status === "not_eligible" || review?.status === "legacy" || !review?.required
        ? "The server does not mark this request as eligible for credential review."
        : review && (!review.approvalEventId || !/^[a-f0-9]{64}$/.test(review.reviewedCredentialHash))
            ? "The server review is missing a valid approval event or credential snapshot. Reload status; no local identity data will be substituted."
            : "";

  return (
    <section className="rounded-2xl border border-[#c8d5cb] bg-[#f9fbf8] p-5 shadow-[0_12px_30px_rgba(39,62,48,0.05)]" aria-labelledby="credential-review-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#62786a]">04 · Credential verification</p>
          <h2 id="credential-review-heading" className="mt-1 text-xl font-semibold">Review the professional credential</h2>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-[#65736a]">This is separate from the identity decision. Record evidence actually checked; never infer verification from the submitted claim.</p>
        </div>
        <button type="button" onClick={() => setReloadKey(value => value + 1)} disabled={loading || busy} className="rounded-lg border border-[#ccd8cf] px-3 py-2 text-xs font-semibold text-[#385542] hover:bg-[#eaf0eb] disabled:opacity-50">
          {loading ? "Loading…" : "Reload status"}
        </button>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2" aria-label="Loading credential review status">
          <div className="h-12 animate-pulse rounded-xl bg-[#e5ece6]" />
          <div className="h-24 animate-pulse rounded-xl bg-[#e5ece6]" />
        </div>
      ) : loadError ? (
        <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950" role="alert">
          <p>Credential review status could not be loaded.</p>
          <p className="mt-1 break-words">{loadError}</p>
          <button type="button" onClick={() => setReloadKey(value => value + 1)} className="mt-3 font-semibold underline">Retry status load</button>
        </div>
      ) : review ? (
        <>
          {review.evidence && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {([
                ["Approved licensed claims — verify these against the authority", review.evidence.approvedClaims],
                ["Current profile credentials — may belong to an earlier identity", review.evidence.accountCredentials],
              ] as const).map(([title, fields]) => (
                <div key={title} className="rounded-xl border border-[#d7e0d8] bg-white p-3 text-xs">
                  <p className="font-semibold">{title}</p>
                  <dl className="mt-2 space-y-1">
                    {Object.entries(fields).map(([field, value]) => <div key={field}><dt className="inline font-medium">{field}: </dt><dd className="inline break-words">{value || "Not provided"}</dd></div>)}
                  </dl>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs">Evidence must establish that the credential belongs to this account and approved licensed identity, not merely that a license number exists.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr]">
            <div className="flex items-center gap-2 rounded-xl border border-[#d7e0d8] bg-white px-3 py-2.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#758279]">Current status</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${
                review.status === "verified" ? "bg-[#e1efe4] text-[#31583b]" :
                review.status === "rejected" ? "bg-rose-100 text-rose-900" :
                review.status === "pending" ? "bg-[#f6efd9] text-[#66531e]" :
                "bg-[#ecefe9] text-[#59645b]"
              }`}>{statusLabel(review.status)}</span>
            </div>
            <div className="rounded-xl border border-[#d7e0d8] bg-white px-3 py-2.5 text-xs leading-5 text-[#66746b]">
              Source version <span className="font-mono text-[#35493b]">r{review.revision}</span>
              <span className="px-2 text-[#b0bab2]">·</span>
              Approval event <span className="font-mono break-all text-[#35493b]">{review.approvalEventId || "unavailable"}</span>
            </div>
          </div>

          {latest && (
            <div className="mt-3 rounded-xl border border-[#dce4dd] bg-[#f1f5f1] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#64766a]">Latest recorded decision</p>
              <dl className="mt-2 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-[#7b887f]">Decision</dt><dd className="mt-0.5 font-semibold capitalize">{latest.decision.replaceAll("_", " ")}</dd></div>
                <div><dt className="text-xs text-[#7b887f]">Recorded</dt><dd className="mt-0.5">{formatDate(latest.decidedAt)}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs text-[#7b887f]">Reviewer</dt><dd className="mt-0.5 break-all font-mono text-xs">{latest.reviewerId}</dd></div>
                <div className="sm:col-span-2"><dt className="text-xs text-[#7b887f]">Verification basis</dt><dd className="mt-0.5 whitespace-pre-wrap break-words">{latest.verificationBasis || "No basis recorded."}</dd></div>
                {latest.checkedAt && <div><dt className="text-xs text-[#7b887f]">Checked at</dt><dd className="mt-0.5">{formatDate(latest.checkedAt)}</dd></div>}
                {latest.validUntil && <div><dt className="text-xs text-[#7b887f]">Evidence valid until</dt><dd className="mt-0.5">{formatDate(latest.validUntil)}</dd></div>}
              </dl>
            </div>
          )}

          {review.status === "stale" && !disabledReason && (
            <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">
              Prior credential evidence is expired or no longer matches this identity. Review the freshly loaded current claims and record a new explicit decision.
            </p>
          )}
          {disabledReason ? (
            <div className={`mt-4 rounded-xl border p-4 text-sm leading-6 ${selfReview ? "border-rose-300 bg-rose-50 text-rose-950" : "border-[#d8ddcf] bg-[#f1f2ed] text-[#555d52]"}`} role={selfReview ? "alert" : "status"}>
              {disabledReason}
            </div>
          ) : (
            <div className="mt-4 border-t border-[#dfe6e0] pt-4">
              <fieldset disabled={!eligibilityOkay || !serverEligible || busy}>
                <legend className="text-sm font-semibold">Choose an explicit credential outcome</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {([
                    ["verified", "Verified"],
                    ["rejected", "Rejected"],
                    ["pending", "Pending"],
                  ] as [Decision, string][]).map(([value, label]) => (
                    <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium ${decision === value ? "border-[#63826b] bg-[#eef4ee] text-[#2d4a35]" : "border-[#dce3dd] bg-white hover:bg-[#f6f8f5]"}`}>
                      <input type="radio" name={`credential-decision-${requestId}`} value={value} checked={decision === value} onChange={() => setDecision(value)} className="accent-[#355a40]" />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="mt-4 space-y-3">
                <legend className="text-sm font-semibold">Actual verification basis <span className="font-normal text-[#748078]">(all required)</span></legend>
                <label className="block text-sm font-medium" htmlFor={`credential-authority-${requestId}`}>
                  Issuing authority
                  <input id={`credential-authority-${requestId}`} value={authority} onChange={event => setAuthority(event.target.value)} maxLength={500} disabled={busy} placeholder="Licensing board or issuing organization" className="mt-1.5 block min-h-11 w-full rounded-xl border border-[#cad6cd] bg-white px-3 text-sm font-normal outline-none focus:border-[#58755f] focus:ring-2 focus:ring-[#58755f]/20 disabled:bg-[#f0f2ee]" />
                </label>
                <label className="block text-sm font-medium" htmlFor={`credential-source-${requestId}`}>
                  Source reference checked
                  <input id={`credential-source-${requestId}`} value={sourceReference} onChange={event => setSourceReference(event.target.value)} maxLength={700} disabled={busy} placeholder="Public register URL, record ID, or verification reference" className="mt-1.5 block min-h-11 w-full rounded-xl border border-[#cad6cd] bg-white px-3 text-sm font-normal outline-none focus:border-[#58755f] focus:ring-2 focus:ring-[#58755f]/20 disabled:bg-[#f0f2ee]" />
                </label>
                <label className="block text-sm font-medium" htmlFor={`credential-findings-${requestId}`}>
                  Findings
                  <textarea id={`credential-findings-${requestId}`} value={findings} onChange={event => setFindings(event.target.value)} maxLength={1200} rows={3} disabled={busy} placeholder="Record what the independent source established, including any limitations." className="mt-1.5 block w-full resize-y rounded-xl border border-[#cad6cd] bg-white px-3 py-3 text-sm font-normal leading-5 outline-none focus:border-[#58755f] focus:ring-2 focus:ring-[#58755f]/20 disabled:bg-[#f0f2ee]" />
                </label>
              </fieldset>
              <p className="mt-1 text-right text-xs text-[#839087]">{basis.trim().length}/2000 · authority, reference, and findings are submitted together</p>
              {decision === "verified" && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-semibold" htmlFor={`credential-checked-${requestId}`}>
                    Actual check time <span className="font-normal text-[#748078]">(required)</span>
                    <input id={`credential-checked-${requestId}`} type="datetime-local" required value={checkedAt} onChange={event => setCheckedAt(event.target.value)} disabled={busy} className="mt-1.5 block min-h-11 w-full rounded-xl border border-[#cad6cd] bg-white px-3 text-sm font-normal outline-none focus:border-[#58755f] focus:ring-2 focus:ring-[#58755f]/20 disabled:bg-[#f0f2ee]" />
                  </label>
                  <label className="text-sm font-semibold" htmlFor={`credential-valid-until-${requestId}`}>
                    Evidence valid until <span className="font-normal text-[#748078]">(required)</span>
                    <input id={`credential-valid-until-${requestId}`} type="datetime-local" required value={validUntil} onChange={event => setValidUntil(event.target.value)} disabled={busy} className="mt-1.5 block min-h-11 w-full rounded-xl border border-[#cad6cd] bg-white px-3 text-sm font-normal outline-none focus:border-[#58755f] focus:ring-2 focus:ring-[#58755f]/20 disabled:bg-[#f0f2ee]" />
                  </label>
                </div>
              )}
              <label className="mt-4 flex gap-3 rounded-xl border border-[#dce4dd] bg-white p-3 text-sm leading-5">
                <input type="checkbox" checked={independentAcknowledged} onChange={event => setIndependentAcknowledged(event.target.checked)} disabled={busy} className="mt-1 accent-[#355a40]" />
                <span>I independently checked the named source and findings. This decision is not based solely on the applicant’s submitted information.</span>
              </label>
              {saveError && (
                <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-950" role="alert">
                  <p className="break-words">{saveError}</p>
                  <button type="button" onClick={() => setReloadKey(value => value + 1)} disabled={busy} className="mt-2 font-semibold underline">Reload latest status</button>
                </div>
              )}
              {savedMessage && <p className="mt-4 rounded-xl border border-[#a9c7b0] bg-[#e6f1e8] p-3 text-sm font-semibold text-[#264a31]" role="status">{savedMessage}</p>}
              {projectionWarning && (
                <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status">
                  <p>{projectionWarning}</p>
                  <button type="button" onClick={() => setReloadKey(value => value + 1)} disabled={busy} className="mt-2 font-semibold underline">Reload current review</button>
                </div>
              )}
              <button type="button" onClick={() => void submit()} disabled={!canSubmit} className="mt-4 min-h-12 w-full rounded-xl bg-[#304c3d] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#233b2e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#304c3d] disabled:cursor-not-allowed disabled:bg-[#aab8ad]">
                {busy ? "Saving credential decision…" : "Save credential decision"}
              </button>
              <p className="mt-2 text-center text-xs leading-5 text-[#7a857d]">No decision is selected by default. Save is explicit, version-bound, and independent from account identity changes.</p>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
