import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { apiRequest } from "@/lib/apiRequest";
import { PillButton } from "@/components/ui/pill-button";
import type { HealthProtocol } from "@shared/healthProtocolState";
import type { HealthContextView, HealthSupportSummary, HealthSupportSource } from "@shared/healthContextControl";
import { NUTRITION_SUPPORT_OPTIONS } from "@shared/nutritionSupportOptions";

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
  active: "recorded as current",
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

export function HealthContextControls({
  userId, placement = "profile", onStatusChange, onPersonalAntiStatus, profilePreferenceCard,
}: {
  userId: string;
  placement?: "profile" | "onboarding";
  onStatusChange?: (status: "loading" | "ready" | "saving" | "error") => void;
  onPersonalAntiStatus?: (enabled: boolean) => void;
  profilePreferenceCard?: ReactNode;
}) {
  const [view, setView] = useState<HealthContextView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const scopeVersion = useRef(0);

  useEffect(() => {
    if (view) onPersonalAntiStatus?.(
      view.supports.find((item) => item.protocol === "anti_inflammatory")?.personalEnabled === true,
    );
  }, [view, onPersonalAntiStatus]);

  const reload = useCallback(async () => {
    const version = ++scopeVersion.current;
    setLoading(true);
    setError("");
    onStatusChange?.("loading");
    try {
      const next = await apiRequest("/api/health-context") as HealthContextView;
      if (!next?.shadowOnly || !Array.isArray(next.supports)) throw new Error("Support settings unavailable.");
      if (scopeVersion.current === version) {
        setView(next);
        onStatusChange?.("ready");
      }
    } catch (err) {
      if (scopeVersion.current === version) {
        setView(null);
        setError(err instanceof Error ? err.message : "Unable to load support settings.");
        onStatusChange?.("error");
      }
    } finally {
      if (scopeVersion.current === version) setLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    setView(null);
    setNotice("");
    setBusy(false);
    setPendingPath(null);
    void reload();
    return () => { scopeVersion.current++; };
  }, [userId, reload]);

  const change = async (path: string, method: "POST" | "PUT", body: object) => {
    if (busy) return;
    const version = scopeVersion.current;
    setBusy(true);
    setPendingPath(path);
    setError("");
    setNotice("");
    onStatusChange?.("saving");
    try {
      const next = await apiRequest(path, { method, body: JSON.stringify(body) }) as HealthContextView & { message?: string };
      if (!next?.shadowOnly || !Array.isArray(next.supports)) throw new Error("Support settings could not be verified.");
      if (scopeVersion.current === version) {
        setView(next);
        setNotice(next.message || "Your support preference was saved for Development meal guidance.");
        onStatusChange?.("ready");
      }
    } catch (err) {
      if (scopeVersion.current === version) {
        setError(err instanceof Error ? err.message : "Unable to save your choice.");
        onStatusChange?.("error");
      }
    } finally {
      if (scopeVersion.current === version) {
        setBusy(false);
        setPendingPath(null);
      }
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
          <PillButton disabled={busy} active={false}
            onClick={() => change(`/api/health-context/earlier-profile/${source.id}/decision`, "POST", { current: true })}>
            Yes, keep support
          </PillButton>
          <PillButton disabled={busy}
            onClick={() => change(`/api/health-context/earlier-profile/${source.id}/decision`, "POST", { current: false })}>
            No, this is past
          </PillButton>
        </div>
      </div>
    );
    if (source.kind === "suggestion") return (
      <div key={source.id} className="mt-3 flex flex-wrap gap-2 text-xs">
        <PillButton disabled={busy}
          onClick={() => change(`/api/health-context/suggestion/${source.id}/decision`, "POST", { accept: true })}>
          Add to my support
        </PillButton>
        <PillButton disabled={busy}
          onClick={() => change(`/api/health-context/suggestion/${source.id}/decision`, "POST", { accept: false })}>
          Not for me
        </PillButton>
      </div>
    );
    return null;
  });

  return (
    <section className="rounded-xl border border-amber-400/40 bg-amber-950/20 p-3 space-y-3" aria-label="Health and nutrition support settings">
      <div>
        <p className="text-amber-200 text-sm font-bold">Health &amp; Nutrition Support</p>
        <p className="text-white/70 text-xs mt-1">
          {placement === "onboarding"
            ? "You can choose GLP-1-oriented nutrition support here and review it later in Edit Profile. This choice is separate from your Builder and does not record a diagnosis or medication use."
            : "Choose your nutrition support preferences here. In Development, a new confirmed choice contributes to meal guidance without switching your Builder or recording a diagnosis or medication use."}
        </p>
      </div>
      {loading && <p role="status" className="text-white/70 text-xs">Loading support settings…</p>}
      {busy && <p role="status" className="text-amber-200 text-xs">Saving your support choice…</p>}
      {error && <p role="alert" className="text-red-200 text-xs">{error} <PillButton onClick={() => void reload()}>Retry</PillButton></p>}
      {notice && <p role="status" className="text-green-200 text-xs">{notice}</p>}
      {view && (
        <>
          <p className="text-white/70 text-xs">Your current meal strategy: {BUILDER_LABELS[view.builder || ""] || "Selected Builder"}. These support settings do not switch it.</p>
        </>
      )}
      {(profilePreferenceCard || view) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {profilePreferenceCard}
          {view && NUTRITION_SUPPORT_OPTIONS.map((option) => {
              const { protocol, label, description } = option;
              const item = view.supports.find((entry) => entry.protocol === protocol);
              if (!item) return null;
              return (
                <div key={protocol} className="rounded-lg border border-white/20 bg-black/30 p-3">
                  <p className="text-white font-semibold text-sm">{label}</p>
                  <p className="text-white/70 text-xs mt-1">{description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <PillButton disabled={busy} active={item.personalEnabled}
                      onClick={() => change(`/api/health-context/support/${protocol}`, "PUT", { enabled: !item.personalEnabled })}>
                      {pendingPath === `/api/health-context/support/${protocol}`
                        ? "Saving…"
                        : item.personalEnabled ? "My support is on · turn off" : "Turn on my support"}
                    </PillButton>
                  </div>
                  <SourceList item={item} />
                  {item.status === "active" && !item.personalEnabled && (
                    <p className="text-amber-200 text-xs mt-2">Another source still includes this support. Your choice only controls your own preference; care-team guidance stays separate.</p>
                  )}
                  {renderReviewActions(item)}
                  {protocol === "glp1" && item.sources
                    .filter((source) => source.kind === "medication_information" &&
                      (source.status === "active" || source.status === "needs_confirmation"))
                    .map((source) => (
                      <PillButton key={source.id} disabled={busy} className="mt-2"
                        onClick={() => change(`/api/health-context/medication/${source.id}/past`, "POST", {})}>
                        This medication information is no longer current
                      </PillButton>
                    ))}
                  {item.sources.some((source) => source.kind === "lab_recommendation" && source.status === "active") && (
                    <PillButton disabled={busy} className="mt-2"
                      onClick={() => change(`/api/health-context/lab/${protocol}/discontinue`, "POST", {})}>
                      Stop my accepted lab-based support
                    </PillButton>
                  )}
                </div>
              );
            })}
        </div>
      )}
      {view && (
        <>
          {(view.supports.some((item) => item.protocol !== "glp1" && item.sources.length > 0)
            || view.legacyAntiPreferenceNeedsReview || view.labReviews?.length > 0 || view.history?.length > 0) && (
            <details className="rounded-lg border border-white/20 bg-black/30 p-3">
              <summary className="cursor-pointer text-white/90 text-xs font-semibold">Earlier support information</summary>
              <div className="mt-2 space-y-3 text-xs text-white/70">
                <p>These records are kept for reference. They do not change current meals or replace your clinical settings.</p>
                {view.legacyAntiPreferenceNeedsReview && <p>An earlier Anti-Inflammatory preference was noted. Use the preference control above to manage it.</p>}
                {view.labReviews?.map((recommendation) => (
                  <p key={recommendation.id}>Earlier lab recommendation: {LABELS[recommendation.protocol]} — {recommendation.earlierDecision === "accepted" ? "previously accepted" : "previously declined"}.</p>
                ))}
                {view.supports.filter((item) => item.protocol !== "glp1" && item.sources.length > 0).map((item) => (
                  <div key={item.protocol}>
                    <p className="font-semibold">{LABELS[item.protocol]}</p>
                    <SourceList item={item} />
                  </div>
                ))}
              </div>
              {view.history?.length > 0 && <ul className="mt-3 space-y-2 text-xs text-white/70">
                {view.history.map((event, index) => (
                  <li key={`${event.occurredAt}-${index}`}>
                    {LABELS[event.protocol]} · {event.activity} · {new Date(event.occurredAt).toLocaleDateString()}
                  </li>
                ))}
              </ul>}
            </details>
          )}
        </>
      )}
    </section>
  );
}