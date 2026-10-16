import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/apiRequest";
import { PillButton } from "@/components/ui/pill-button";
import {
  STARCH_MEAL_COUNTS, STARCH_TIMING_OPTIONS, studioStarchDraft,
  studioStarchPreferencesSchema, starchPreviewGrams, type StudioStarchState,
} from "@shared/starchPreferences";

interface Props {
  clientUserId: string | null; legacyStrategy?: "one" | "flex";
  syntheticSource?: {
    state: StudioStarchState;
    save(value: import("@shared/starchPreferences").StarchPreferences): Promise<StudioStarchState>;
  };
}

export function StudioStarchGamePlan(props: Props) {
  const { user } = useAuth();
  if (!user) return null;
  // Account changes and route changes must discard all previous-client drafts.
  return <StarchEditor key={`${user.id}:${props.clientUserId ?? "unverified"}`} {...props} />;
}

function StarchEditor({ clientUserId, legacyStrategy, syntheticSource }: Props) {
  const [state, setState] = useState<StudioStarchState | null>(null);
  const [draft, setDraft] = useState<ReturnType<typeof studioStarchDraft> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const [retryAllowed, setRetryAllowed] = useState(true);
  const live = useRef(false);
  const savePending = useRef(false);
  const refreshAfterSave = useRef(false);
  const readGeneration = useRef(0);
  const currentState = useRef(state);
  currentState.current = state;
  const legacy = useRef(legacyStrategy);
  legacy.current = legacyStrategy;
  const path = `/api/pro/clients/${encodeURIComponent(clientUserId ?? "")}/starch-preferences`;
  const isolated = useRef(syntheticSource);
  isolated.current = syntheticSource;
  const syntheticTarget = syntheticSource?.state.currentPrescription.starchyCarbsTarget;
  const syntheticCount = syntheticSource?.state.savedPreferences.defaultStarchMealsPerDay;
  const syntheticTiming = syntheticSource?.state.savedPreferences.starchDistributionStrategy;

  useEffect(() => {
    live.current = true;
    const controller = new AbortController();
    const generation = ++readGeneration.current;
    setState(null); setDraft(null); setError(null); setRetryAllowed(true);
    if (clientUserId) {
      (isolated.current ? Promise.resolve(isolated.current.state) : apiRequest(path, { method: "GET", cache: "no-store", signal: controller.signal }))
        .then((value: StudioStarchState) => {
          if (!live.current || controller.signal.aborted || generation !== readGeneration.current) return;
          if (value.clientUserId !== clientUserId || !value.savedPreferences || !value.currentPrescription) {
            throw new Error("Client identity could not be confirmed");
          }
          setState(value);
          setDraft(studioStarchDraft(value.savedPreferences, legacy.current));
        }).catch((failure) => {
          if (!live.current || controller.signal.aborted || generation !== readGeneration.current) return;
          const denied = failure?.status === 401 || failure?.status === 403;
          setRetryAllowed(!denied);
          setError(denied
            ? `Access to this client's starch plan was not approved. ${failure.serverMessage ?? failure.message} No starch preferences have been changed.`
            : "Could not load this client's starch plan. No changes have been made.");
        });
    }
    return () => { live.current = false; controller.abort(); };
  }, [clientUserId, path, revision, syntheticTarget, syntheticCount, syntheticTiming]);

  useEffect(() => {
    if (!clientUserId || isolated.current) return;
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.source === "studio-starch-plan"
        || (detail?.userId && detail.userId !== clientUserId)) return;
      if (savePending.current) { refreshAfterSave.current = true; return; }
      const generation = ++readGeneration.current;
      apiRequest(path, { method: "GET", cache: "no-store" }).then((value: StudioStarchState) => {
        if (!live.current || generation !== readGeneration.current) return;
        if (value.clientUserId !== clientUserId || !value.savedPreferences || !value.currentPrescription) throw new Error("Client identity mismatch");
        const previous = currentState.current?.savedPreferences;
        setDraft(pending => {
          const edited = pending && previous && (
            pending.defaultStarchMealsPerDay !== previous.defaultStarchMealsPerDay
            || pending.starchDistributionStrategy !== previous.starchDistributionStrategy
          );
          return edited ? pending : studioStarchDraft(value.savedPreferences, legacy.current);
        });
        setState(value);
      }).catch(() => {
        if (live.current && generation === readGeneration.current) setError("Could not refresh this client's prescription. Reload before relying on the preview.");
      });
    };
    window.addEventListener("mpm:targetsUpdated", refresh);
    return () => window.removeEventListener("mpm:targetsUpdated", refresh);
  }, [clientUserId, path]);

  async function save() {
    if (!clientUserId || !draft || savePending.current) return;
    const parsed = studioStarchPreferencesSchema.safeParse({
      defaultStarchMealsPerDay: draft.defaultStarchMealsPerDay,
      starchDistributionStrategy: draft.starchDistributionStrategy,
    });
    if (!parsed.success) return;
    // The immutable client ID and payload are captured before any asynchronous
    // work. An unmounted A request can never be retargeted to client B.
    ++readGeneration.current; // A pre-save refresh must not undo a confirmed save.
    savePending.current = true; setSaving(true); setError(null); setNotice(null);
    try {
      const value = isolated.current ? await isolated.current.save(parsed.data)
        : await apiRequest(path, { method: "PATCH", body: JSON.stringify(parsed.data) }) as StudioStarchState;
      if (!live.current) return;
      if (value.clientUserId !== clientUserId
        || value.savedPreferences.defaultStarchMealsPerDay !== parsed.data.defaultStarchMealsPerDay
        || value.savedPreferences.starchDistributionStrategy !== parsed.data.starchDistributionStrategy) {
        throw new Error("Client save could not be confirmed");
      }
      setState(value);
      setDraft(studioStarchDraft(value.savedPreferences, legacy.current));
      setNotice(isolated.current ? "Synthetic starch preferences saved in Development only." : "Client starch plan saved and confirmed.");
      if (!isolated.current) {
        window.dispatchEvent(new CustomEvent("mpm:targetsUpdated", { detail: { userId: clientUserId, source: "studio-starch-plan" } }));
        window.dispatchEvent(new CustomEvent("macros:updated", { detail: { userId: clientUserId } }));
      }
    } catch {
      if (live.current) setError("The save was not confirmed. Reload or retry before relying on the new starch plan.");
    } finally {
      savePending.current = false;
      if (live.current) {
        setSaving(false);
        if (refreshAfterSave.current) {
          refreshAfterSave.current = false;
          window.dispatchEvent(new CustomEvent("mpm:targetsUpdated", { detail: { userId: clientUserId, source: "macro-refresh-after-save" } }));
        }
      }
    }
  }

  const valid = draft && studioStarchPreferencesSchema.safeParse({
    defaultStarchMealsPerDay: draft.defaultStarchMealsPerDay,
    starchDistributionStrategy: draft.starchDistributionStrategy,
  }).success;
  const dirty = state && draft && (
    draft.defaultStarchMealsPerDay !== state.savedPreferences.defaultStarchMealsPerDay
    || draft.starchDistributionStrategy !== state.savedPreferences.starchDistributionStrategy
  );

  return <section className="col-span-full mt-3 space-y-3" aria-label="Client Starch Game Plan" data-testid="studio-starch-plan">
    <h3 className="text-lg font-semibold text-white">Starch Game Plan</h3>
    {!clientUserId && <p role="status" className="text-sm text-white/70">Select a verified client to view their starch plan.</p>}
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    {clientUserId && !state && !error && <p role="status">Loading client starch plan…</p>}
    {clientUserId && error && !state && retryAllowed && <button type="button" onClick={() => setRevision(v => v + 1)} className="min-h-11 rounded-lg border border-white/30 px-3">Retry Starch Plan</button>}
    {state && draft && <>
      <p className="text-sm text-white/70">
        {syntheticSource ? "Saved synthetic test targets:" : "Current client prescription:"} <strong>{state.currentPrescription.starchyCarbsTarget}g</strong> daily starch,
        {" "}{state.currentPrescription.starchMealsAllowed} starch-containing meals.
      </p>
      {draft.legacyPreview && <p className="text-sm text-amber-200">
        Legacy {legacyStrategy === "flex" ? "Flex" : "One"} choice shown as an unsaved preview.
        Review the meal count and timing, then save explicitly. Existing records have not been migrated.
      </p>}
      {state.savedPreferences.defaultStarchMealsPerDay === null && !draft.legacyPreview && <p className="text-sm text-amber-200">No client starch-meal preference has been saved. Choose a count and timing to apply one.</p>}
      {state.savedPreferences.defaultStarchMealsPerDay !== null
        && !STARCH_MEAL_COUNTS.some(n => n === state.savedPreferences.defaultStarchMealsPerDay)
        && <p className="text-sm text-amber-200">Saved count: {state.savedPreferences.defaultStarchMealsPerDay}. It is preserved. Select 1–6 only if you intend to replace that preference.</p>}
      <fieldset disabled={saving} className="space-y-3">
        <legend className="mb-2 text-sm font-medium">How many meals a day will include starchy carbs?</legend>
        <div className="flex flex-wrap gap-2">
          {STARCH_MEAL_COUNTS.map(n => <PillButton key={n} active={draft.defaultStarchMealsPerDay === n} aria-pressed={draft.defaultStarchMealsPerDay === n}
            onClick={() => { setDraft({ ...draft, defaultStarchMealsPerDay: n }); setNotice(null); }}>{n} {n === 1 ? "meal" : "meals"}</PillButton>)}
        </div>
        <p className="text-sm font-medium">When should the client eat their starchy carbs?</p>
        <div className="flex flex-wrap gap-2">
          {STARCH_TIMING_OPTIONS.filter(option => option.value !== "workout" || state.workoutTimingAvailable || draft.starchDistributionStrategy === "workout").map(option =>
            <PillButton key={option.value} active={draft.starchDistributionStrategy === option.value} aria-pressed={draft.starchDistributionStrategy === option.value}
              onClick={() => { setDraft({ ...draft, starchDistributionStrategy: option.value }); setNotice(null); }}>{option.label}</PillButton>)}
        </div>
      </fieldset>
      {valid && <div className="rounded-xl border border-amber-400/20 bg-black/30 p-3 text-sm">
        <p className="font-semibold text-amber-200">{dirty ? "Unsaved distribution preview" : "Saved preference preview"}</p>
        {starchPreviewGrams(state.currentPrescription.starchyCarbsTarget, draft.defaultStarchMealsPerDay!).map((grams, i) =>
          <p key={i}>Meal {i + 1}: approximately {grams}g</p>)}
        <p className="mt-2 text-white/60">{syntheticSource ? "Illustrative synthetic split only. Live Builder execution is unavailable in this test workspace." : "Illustrative split only. Actual Builder allocation follows the saved timing and the client's clinical/performance prescription."}</p>
      </div>}
      <p className="text-xs text-white/60">Save starch preferences separately from macro targets. This does not change calories, macro totals, or clinical/performance settings.</p>
      <button type="button" disabled={!valid || !dirty || saving} onClick={() => { void save(); }}
        className="min-h-11 rounded-xl bg-orange-600 px-4 py-2 font-semibold text-white disabled:opacity-50">
        {saving ? "Saving Starch Plan…" : "Save Starch Plan"}
      </button>
      {notice && <p role="status" className="text-sm text-green-300">{notice}</p>}
    </>}
  </section>;
}
