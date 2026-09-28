import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { apiRequest } from "@/lib/apiRequest";
import { PillButton } from "@/components/ui/pill-button";
import type { HealthProtocol } from "@shared/healthProtocolState";
import type { HealthContextView, HealthSupportSummary, HealthSupportSource } from "@shared/healthContextControl";
import { NUTRITION_SUPPORT_OPTIONS } from "@shared/nutritionSupportOptions";
import { PERSONAL_FOOD_SUPPORT_OVERLAYS_ENABLED } from "@shared/personalFoodSupportFreeze";

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
  const [exactSourceId, setExactSourceId] = useState<string | null>(null);
  const [exactIngredient, setExactIngredient] = useState("");
  const [exactNutrient, setExactNutrient] = useState<"sodium" | "potassium" | "phosphorus" | "carbohydrate" | "protein" | "saturated_fat">("sodium");
  const [exactAmount, setExactAmount] = useState("");
  const [exactScope, setExactScope] = useState<"per_serving" | "per_day">("per_serving");
  const [exactKind, setExactKind] = useState<"avoid_ingredient" | "nutrient_bound">("avoid_ingredient");
  const scopeVersion = useRef(0);

  useEffect(() => {
    if (view) onPersonalAntiStatus?.(PERSONAL_FOOD_SUPPORT_OVERLAYS_ENABLED &&
      view.supports.find((item) => item.protocol === "anti_inflammatory")?.personalEnabled === true);
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
    setExactSourceId(null);
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
        setNotice(next.message || (PERSONAL_FOOD_SUPPORT_OVERLAYS_ENABLED
          ? "Your support preference was saved for Development meal guidance."
          : "Your review was recorded. Current meal safety rules remain unchanged until the authority cutover."));
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
    if (source.kind === "you" && source.status === "active") return (
      <PillButton key={source.id} disabled={busy} className="mt-2"
        onClick={() => {
          if (window.confirm("Mark this personal guidance and its exact restrictions as past? Its review history will be retained. Current meal rules will not change until cutover.")) {
            void change(`/api/health-context/source/${source.id}/review`, "POST", { decision: "historical" });
          }
        }}>
        My recorded guidance or restriction is no longer current
      </PillButton>
    );
    if (source.status !== "needs_confirmation") return null;
    if (source.kind === "earlier_profile") return (
      <div key={source.id} className="mt-3 rounded-lg border border-amber-400/30 bg-amber-950/20 p-3 text-xs">
        <p className="text-amber-100 mb-2">
          Your earlier profile mentioned this support. Is it relevant to you now?
          {item.protocol === "glp1" && " Choosing yes does not say you take GLP-1 medication."}
        </p>
        <div className="flex flex-wrap gap-2">
          <PillButton disabled={busy} active={false}
            onClick={() => change(`/api/health-context/source/${source.id}/review`, "POST", { decision: "current_guidance" })}>
            Current nutrition guidance
          </PillButton>
          <PillButton disabled={busy}
            onClick={() => change(`/api/health-context/source/${source.id}/review`, "POST", { decision: "history_only" })}>
            Health history only
          </PillButton>
          <PillButton disabled={busy}
            onClick={() => change(`/api/health-context/source/${source.id}/review`, "POST", { decision: "unresolved" })}>
            Need more information
          </PillButton>
          <PillButton disabled={busy} onClick={() => setExactSourceId(
            exactSourceId === source.id ? null : source.id)}>
            Confirm an exact restriction
          </PillButton>
        </div>
        {exactSourceId === source.id && (
          <div className="mt-3 space-y-2 rounded-lg border border-amber-400/30 p-3 text-white/80">
            <p>A condition name alone is not a food rule. Record only an exact restriction you can confirm. Your current meal rules will not change yet.</p>
            <label className="block">Rule type
              <select value={exactKind} onChange={(event) => setExactKind(event.target.value as typeof exactKind)}
                className="block w-full rounded bg-neutral-900 p-2 text-white">
                <option value="avoid_ingredient">Avoid exact ingredient</option>
                <option value="nutrient_bound">Measurable nutrient bound</option>
              </select>
            </label>
            {exactKind === "avoid_ingredient" ? (
              <label className="block">Ingredient
                <input value={exactIngredient} onChange={(event) => setExactIngredient(event.target.value)}
                  placeholder="e.g. peanut" className="block w-full rounded bg-neutral-900 p-2 text-white" />
              </label>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <label>Nutrient
                  <select value={exactNutrient} onChange={(event) => setExactNutrient(event.target.value as typeof exactNutrient)}
                    className="block w-full rounded bg-neutral-900 p-2 text-white">
                    {["sodium", "potassium", "phosphorus", "carbohydrate", "protein", "saturated_fat"].map((value) =>
                      <option key={value} value={value}>{value.replace("_", " ")}</option>)}
                  </select>
                </label>
                <label>At most
                  <input type="number" min="0.01" step="any" value={exactAmount}
                    onChange={(event) => setExactAmount(event.target.value)}
                    className="block w-full rounded bg-neutral-900 p-2 text-white" />
                </label>
                <label>Unit
                  <span className="block p-2">{["sodium", "potassium", "phosphorus"].includes(exactNutrient) ? "mg" : "g"}</span>
                </label>
                <label>Scope
                  <select value={exactScope} onChange={(event) => setExactScope(event.target.value as typeof exactScope)}
                    className="block w-full rounded bg-neutral-900 p-2 text-white">
                    <option value="per_serving">Per serving</option><option value="per_day">Per day</option>
                  </select>
                </label>
              </div>
            )}
            <PillButton disabled={busy || (exactKind === "avoid_ingredient" ? !exactIngredient.trim() : !Number(exactAmount))}
              onClick={() => change(`/api/health-context/source/${source.id}/review`, "POST", {
                decision: "current_hard_restriction",
                rule: exactKind === "avoid_ingredient"
                  ? { kind: exactKind, ingredientKey: exactIngredient.trim().toLowerCase().replace(/\s+/g, "_") }
                  : {
                    kind: exactKind, nutrient: exactNutrient, comparator: "at_most",
                    amount: Number(exactAmount),
                    unit: ["sodium", "potassium", "phosphorus"].includes(exactNutrient) ? "mg" : "g",
                    scope: exactScope,
                  },
              })}>
              Record exact restriction
            </PillButton>
          </div>
        )}
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

  if (!PERSONAL_FOOD_SUPPORT_OVERLAYS_ENABLED) {
    const pendingClinicalReview = view?.supports.filter((item) =>
      item.sources.some((source) => source.status === "needs_confirmation" &&
        (source.kind === "earlier_profile" || source.kind === "care_team" ||
          source.kind === "medication_information" || source.kind === "lab_recommendation") ||
          (source.kind === "you" && source.status === "active"))) ?? [];
    return (
      <section className="rounded-xl border border-amber-400/40 bg-amber-950/20 p-3 space-y-3" aria-label="Health and nutrition support settings">
        <p className="text-amber-200 text-sm font-bold">Health &amp; Nutrition Support</p>
        <p className="text-white/70 text-xs">Your selected Builder remains your nutrition strategy. Optional personal support choices are paused. This review records your answer, but does not change the current meal safety rules yet.</p>
        {loading && <p role="status" className="text-white/70 text-xs">Loading health context…</p>}
        {busy && <p role="status" className="text-amber-200 text-xs">Saving your review…</p>}
        {error && <p role="alert" className="text-red-200 text-xs">{error} <PillButton onClick={() => void reload()}>Retry</PillButton></p>}
        {view && (
          <>
            <p className="text-white/70 text-xs">Your current meal strategy: {BUILDER_LABELS[view.builder || ""] || "Selected Builder"}.</p>
            {pendingClinicalReview.length > 0 && (
              <div className="rounded-lg border border-amber-400/40 bg-amber-950/30 p-3 space-y-3" aria-label="Health information needing review">
                <p className="text-amber-100 text-sm font-semibold">Health information needing review</p>
                <p className="text-white/70 text-xs">Earlier profile entries do not prove a current diagnosis or care-team instruction. Review each one for the future health-context model. Until that model is connected to meals, existing conservative safety rules remain in place. Your choice does not change your Builder or confirm medication use.</p>
                {pendingClinicalReview.map((item) => (
                  <div key={item.protocol} className="rounded-lg border border-white/20 bg-black/30 p-3">
                    <p className="text-white font-semibold text-sm">{LABELS[item.protocol]}</p>
                    <SourceList item={{ ...item, sources: item.sources.filter((source) =>
                       (source.kind === "you" && source.status === "active") ||
                       (source.status === "needs_confirmation" &&
                      (source.kind === "earlier_profile" || source.kind === "care_team" ||
                         source.kind === "medication_information" || source.kind === "lab_recommendation"))) }} />
                    {renderReviewActions(item)}
                    {item.sources.filter((source) => source.kind === "medication_information" &&
                      source.status === "needs_confirmation").map((source) => (
                      <PillButton key={source.id} disabled={busy} className="mt-2"
                        onClick={() => change(`/api/health-context/medication/${source.id}/past`, "POST", {})}>
                        This medication information is no longer current
                      </PillButton>
                    ))}
                    {item.sources.some((source) => source.kind === "care_team" && source.status === "needs_confirmation") &&
                      <p className="mt-2 text-amber-100 text-xs">This care-team guidance needs review with your care team. A personal choice cannot remove a provider-owned instruction.</p>}
                    {item.sources.some((source) => source.kind === "lab_recommendation" && source.status === "needs_confirmation") &&
                      <p className="mt-2 text-amber-100 text-xs">A past lab result alone cannot establish current meal guidance. Ask your care team to review this recommendation.</p>}
                  </div>
                ))}
              </div>
            )}
            {view.supports.map((item) => {
              const clinicalSources = item.sources.filter((source) =>
                source.kind === "care_team" || source.kind === "lab_recommendation" ||
                source.kind === "medication_information").filter((source) =>
                  source.status !== "needs_confirmation");
              if (!clinicalSources.length) return null;
              return (
                <div key={item.protocol} className="rounded-lg border border-white/20 bg-black/30 p-3">
                  <p className="text-white font-semibold text-sm">{LABELS[item.protocol]}</p>
                  <SourceList item={{ ...item, sources: clinicalSources }} />
                  {clinicalSources.filter((source) => source.kind === "medication_information" &&
                    (source.status === "active" || source.status === "needs_confirmation")).map((source) => (
                    <PillButton key={source.id} disabled={busy} className="mt-2"
                      onClick={() => change(`/api/health-context/medication/${source.id}/past`, "POST", {})}>
                      This medication information is no longer current
                    </PillButton>
                  ))}
                  {clinicalSources.some((source) => source.kind === "lab_recommendation" && source.status === "active") && (
                    <PillButton disabled={busy} className="mt-2"
                      onClick={() => change(`/api/health-context/lab/${item.protocol}/discontinue`, "POST", {})}>
                      Stop my accepted lab-based support
                    </PillButton>
                  )}
                </div>
              );
            })}
            {(view.history?.length > 0 || view.supports.some((item) => item.sources.some((source) => source.kind === "you"))) && (
              <details className="rounded-lg border border-white/20 bg-black/30 p-3">
                <summary className="cursor-pointer text-white/90 text-xs font-semibold">Earlier support information</summary>
                <p className="mt-2 text-white/70 text-xs">Saved personal support choices are retained but paused for meal guidance.</p>
              </details>
            )}
          </>
        )}
        {notice && <p role="status" className="text-green-200 text-xs">{notice}</p>}
      </section>
    );
  }

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