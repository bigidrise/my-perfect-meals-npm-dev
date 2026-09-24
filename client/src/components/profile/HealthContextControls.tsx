import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/apiRequest";
import { PillButton } from "@/components/ui/pill-button";
import type { HealthProtocol } from "@shared/healthProtocolState";
import type { HealthContextView, HealthSupportSummary, HealthSupportSource } from "@shared/healthContextControl";

const LABELS: Record<HealthProtocol, string> = {
  glp1: "GLP-1 Support",
  diabetes: "Diabetes Nutrition Support",
  renal: "Kidney Nutrition Support",
  cardiac: "Heart Nutrition Support",
  anti_inflammatory: "Anti-Inflammatory Support",
  thyroid: "Thyroid Nutrition Support",
  oncology: "Oncology Nutrition Support",
  hormone_optimization: "Hormone Nutrition Support",
  performance: "Performance Nutrition Support",
  liver_disease: "Liver Nutrition Support",
  liver_support: "Liver Nutrition Support",
  hashimotos: "Thyroid Nutrition Support",
  hypothyroid: "Thyroid Nutrition Support",
  hyperthyroid: "Thyroid Nutrition Support",
  menopause: "Menopause Nutrition Support",
  perimenopause: "Perimenopause Nutrition Support",
  metabolic_recovery: "Metabolic Nutrition Support",
  pregnancy_support: "Pregnancy Nutrition Support",
};
const BUILDER_LABELS: Record<string, string> = {
  glp1: "GLP-1 Builder",
  anti_inflammatory: "Anti-Inflammatory Builder",
  "anti-inflammatory": "Anti-Inflammatory Builder",
  diabetic: "Diabetic Builder",
  standard: "Standard Builder",
};
const SOURCE_LABELS: Record<HealthSupportSource["kind"], string> = {
  you: "Your choice",
  care_team: "Care team",
  lab_recommendation: "Lab recommendation",
  medication_information: "Medication information",
  earlier_profile: "Earlier profile information",
  suggestion: "Suggested support",
};
const STATUS_LABELS: Record<HealthSupportSource["status"], string> = {
  active: "currently included",
  needs_confirmation: "needs a check-in",
  previous: "previously noted",
  off: "off",
};

function SourceList({ item }: { item: HealthSupportSummary }) {
  if (!item.sources.length) return null;
  return (
    <ul className="mt-3 space-y-1 text-xs text-white/70">
      {item.sources.map((source) => (
        <li key={source.id}>
          {SOURCE_LABELS[source.kind]} — {STATUS_LABELS[source.status]}
          {source.note && <span className="block pl-3 text-amber-200/80">{source.note}</span>}
        </li>
      ))}
    </ul>
  );
}

export function HealthContextControls({ userId }: { userId: string }) {
  const [view, setView] = useState<HealthContextView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const scopeVersion = useRef(0);

  const reload = useCallback(async () => {
    const version = ++scopeVersion.current;
    setLoading(true);
    setError("");
    try {
      const next = await apiRequest("/api/health-context") as HealthContextView;
      if (!next?.shadowOnly || !Array.isArray(next.supports)) throw new Error("Support settings unavailable.");
      if (scopeVersion.current === version) setView(next);
    } catch (err) {
      if (scopeVersion.current === version) {
        setView(null);
        setError(err instanceof Error ? err.message : "Unable to load support settings.");
      }
    } finally {
      if (scopeVersion.current === version) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setView(null);
    setNotice("");
    setBusy(false);
    void reload();
    return () => { scopeVersion.current++; };
  }, [userId, reload]);

  const change = async (path: string, method: "POST" | "PUT", body: object) => {
    if (busy) return;
    const version = scopeVersion.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await apiRequest(path, { method, body: JSON.stringify(body) }) as HealthContextView & { message?: string };
      if (!next?.shadowOnly || !Array.isArray(next.supports)) throw new Error("Support settings could not be verified.");
      if (scopeVersion.current === version) {
        setView(next);
        setNotice(next.message || "Your future support settings were saved. Current meals are unchanged.");
      }
    } catch (err) {
      if (scopeVersion.current === version) {
        setError(err instanceof Error ? err.message : "Unable to save your choice.");
      }
    } finally {
      if (scopeVersion.current === version) setBusy(false);
    }
  };

  const renderReviewActions = (item: HealthSupportSummary) => item.sources.map((source) => {
    if (source.status !== "needs_confirmation") return null;
    if (source.kind === "earlier_profile") return (
      <div key={source.id} className="mt-3 rounded-lg border border-amber-400/30 bg-amber-950/20 p-3 text-xs">
        <p className="text-amber-100 mb-2">
          Your earlier profile mentioned this support. Is it relevant to you now?
          {item.protocol === "glp1" && " Choosing yes does not say you take GLP-1 medication."}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} className="rounded-full bg-emerald-700 px-3 py-1.5 text-white disabled:opacity-50"
            onClick={() => change(`/api/health-context/earlier-profile/${source.id}/decision`, "POST", { current: true })}>
            Yes, keep support
          </button>
          <button type="button" disabled={busy} className="rounded-full border border-white/40 px-3 py-1.5 text-white disabled:opacity-50"
            onClick={() => change(`/api/health-context/earlier-profile/${source.id}/decision`, "POST", { current: false })}>
            No, this is past
          </button>
        </div>
      </div>
    );
    if (source.kind === "suggestion") return (
      <div key={source.id} className="mt-3 flex flex-wrap gap-2 text-xs">
        <button type="button" disabled={busy} className="rounded-full bg-emerald-700 px-3 py-1.5 disabled:opacity-50"
          onClick={() => change(`/api/health-context/suggestion/${source.id}/decision`, "POST", { accept: true })}>
          Add to my future support
        </button>
        <button type="button" disabled={busy} className="rounded-full border border-white/40 px-3 py-1.5 disabled:opacity-50"
          onClick={() => change(`/api/health-context/suggestion/${source.id}/decision`, "POST", { accept: false })}>
          Not for me
        </button>
      </div>
    );
    return null;
  });

  const renderOther = (item: HealthSupportSummary) => (
    <div key={item.protocol} className="rounded-xl border border-white/15 bg-black/30 p-3">
      <div className="flex justify-between gap-3">
        <p className="font-semibold text-white text-sm">{LABELS[item.protocol]}</p>
        <span className="text-xs text-amber-200">
          {item.status === "active" ? "Included for future settings"
            : item.status === "needs_confirmation" ? "Needs a check-in"
              : item.status === "previous" ? "Previously noted" : "Off"}
        </span>
      </div>
      <SourceList item={item} />
      {renderReviewActions(item)}
      {item.sources.some((source) => source.kind === "you") && (
        <button type="button" disabled={busy} className="mt-3 text-xs underline text-white/90 disabled:opacity-50"
          onClick={() => change(`/api/health-context/support/${item.protocol}`, "PUT", { enabled: !item.personalEnabled })}>
          {item.personalEnabled ? "Turn off my support" : "Use my support again"}
        </button>
      )}
      {item.sources.some((source) => source.kind === "lab_recommendation" && source.status === "active") && (
        <button type="button" disabled={busy} className="block mt-2 text-xs underline text-white/90 disabled:opacity-50"
          onClick={() => change(`/api/health-context/lab/${item.protocol}/discontinue`, "POST", {})}>
          Stop my accepted lab-based support
        </button>
      )}
    </div>
  );

  return (
    <section className="rounded-xl border border-amber-400/40 bg-amber-950/20 p-3 space-y-3" aria-label="Future health and nutrition support settings">
      <div>
        <p className="text-amber-200 text-xs font-bold">Health &amp; nutrition support · DEV preview</p>
        <p className="text-white/70 text-xs mt-1">
          These choices are saved for the new support system. They do not yet change meals or your current meal settings.
          Your selected Builder stays separate.
        </p>
      </div>
      {loading && <p role="status" className="text-white/70 text-xs">Loading support settings…</p>}
      {error && <p role="alert" className="text-red-200 text-xs">{error} <button type="button" className="underline" onClick={() => void reload()}>Retry</button></p>}
      {notice && <p role="status" className="text-green-200 text-xs">{notice}</p>}
      {view && (
        <>
          <p className="text-white/60 text-xs">Your current meal strategy: {BUILDER_LABELS[view.builder || ""] || "Selected Builder"}. These support settings do not switch it.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["anti_inflammatory", "glp1"] as const).map((protocol) => {
              const item = view.supports.find((entry) => entry.protocol === protocol)!;
              return (
                <div key={protocol} className="rounded-lg border border-white/20 bg-black/30 p-3">
                  <p className="text-white font-semibold text-sm">{LABELS[protocol]}</p>
                  <p className="text-white/60 text-xs mt-1">
                    {protocol === "glp1"
                      ? "Nutrition support only. This does not record current medication use."
                      : "Optional food-quality support, separate from Anti-Inflammatory Builder."}
                  </p>
                  <div className="mt-3">
                    <PillButton disabled={busy} active={item.personalEnabled}
                      onClick={() => change(`/api/health-context/support/${protocol}`, "PUT", { enabled: !item.personalEnabled })}>
                      {item.personalEnabled ? "My support is on" : "Turn on my support"}
                    </PillButton>
                  </div>
                  <SourceList item={item} />
                  {item.status === "active" && !item.personalEnabled && (
                    <p className="text-amber-200 text-xs mt-2">Another source still includes this support. Your switch only controls your choice.</p>
                  )}
                  {renderReviewActions(item)}
                  {protocol === "glp1" && item.sources
                    .filter((source) => source.kind === "medication_information" &&
                      (source.status === "active" || source.status === "needs_confirmation"))
                    .map((source) => (
                      <button key={source.id} type="button" disabled={busy}
                        className="block mt-2 text-xs underline text-white/90 disabled:opacity-50"
                        onClick={() => change(`/api/health-context/medication/${source.id}/past`, "POST", {})}>
                        This medication information is no longer current
                      </button>
                    ))}
                  {item.sources.some((source) => source.kind === "lab_recommendation" && source.status === "active") && (
                    <button type="button" disabled={busy} className="block mt-2 text-xs underline text-white/90 disabled:opacity-50"
                      onClick={() => change(`/api/health-context/lab/${protocol}/discontinue`, "POST", {})}>
                      Stop my accepted lab-based support
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {view.legacyAntiPreferenceNeedsReview && (
            <div className="rounded-lg border border-amber-400/40 bg-amber-950/25 p-3 text-xs text-amber-100">
              <p>Your current Anti-Inflammatory meal preference is on. Is this support still relevant for your future settings?</p>
              <p className="mt-1 text-white/60">This choice will not change the meal preference above or switch your Builder.</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <button type="button" disabled={busy} className="rounded-full bg-emerald-700 px-3 py-1.5 disabled:opacity-50"
                  onClick={() => change("/api/health-context/earlier-anti-preference/decision", "POST", { current: true })}>
                  Yes, keep support
                </button>
                <button type="button" disabled={busy} className="rounded-full border border-white/40 px-3 py-1.5 disabled:opacity-50"
                  onClick={() => change("/api/health-context/earlier-anti-preference/decision", "POST", { current: false })}>
                  No, this is past
                </button>
              </div>
            </div>
          )}
          {view.labReviews?.map((recommendation) => (
            <div key={recommendation.id} className="rounded-lg border border-white/20 bg-black/30 p-3 text-xs text-white/80">
              <p>Earlier lab recommendation: {LABELS[recommendation.protocol]} — {recommendation.earlierDecision === "accepted" ? "previously accepted" : "previously declined"}.</p>
              <p className="mt-1 text-white/60">
                This past decision is not treated as current support unless you review it here.
              </p>
              <button type="button" disabled={busy}
                className="mt-2 underline text-amber-200 disabled:opacity-50"
                onClick={() => change(`/api/health-context/lab-recommendation/${recommendation.id}/review`, "POST", {})}>
                {recommendation.earlierDecision === "accepted"
                  ? "Confirm this accepted support for future settings"
                  : "Keep this declined recommendation as previous information"}
              </button>
            </div>
          ))}
          {view.supports.filter((item) =>
            item.protocol !== "glp1" && item.protocol !== "anti_inflammatory" && item.sources.length > 0
          ).map(renderOther)}
          {view.history?.length > 0 && (
            <details className="rounded-lg border border-white/20 bg-black/30 p-3">
              <summary className="cursor-pointer text-white/90 text-xs font-semibold">Recent support history</summary>
              <ul className="mt-2 space-y-2 text-xs text-white/70">
                {view.history.map((event, index) => (
                  <li key={`${event.occurredAt}-${index}`}>
                    {LABELS[event.protocol]} · {event.activity} · {new Date(event.occurredAt).toLocaleDateString()}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}