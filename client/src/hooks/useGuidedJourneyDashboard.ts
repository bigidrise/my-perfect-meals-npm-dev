import { useEffect, useMemo, useRef, useState } from "react";
import type { JourneySnapshot, JourneyStepId } from "../../../shared/guidedJourney";
import {
  createGuidancePreferenceStore, type GuidancePreferenceCommand, type GuidancePreferenceResult,
} from "@/lib/guidedJourney/preferences";
import { fetchPersonalJourneyProgress } from "@/lib/guidedJourney/progress";
import { gettingStartedCardModel, manualJourneyDestination } from "@/lib/guidedJourney/dashboardModel";
import { journeyDestinationAllowed, type JourneyDashboardAccount } from "@/lib/guidedJourney/dashboardScope";
import { explanationJourneyAllowed, explanationModel, explanationStages } from "@/lib/guidedJourney/explanation";
import { confirmWorkflowSave, observeWorkflowSaves, workflowHandoff } from "@/lib/guidedJourney/workflow";
import type { ConfirmedBoardPlan } from "@/lib/guidedJourney/mealBoard";
import {
  guidanceInteractionBlocked, observeGuidanceInteractions, guidancePausedForSession,
  pauseGuidanceForSession, resumeGuidanceForSession,
} from "@/lib/guidedJourney/presentation";

interface Input {
  account: JourneyDashboardAccount | null;
  contextKey: string;
  eligible: boolean;
  /** Recheck live workspace/location as well as render-time identity. */
  isCurrentContextPersonal: () => boolean;
  refreshAccount: () => Promise<JourneyDashboardAccount | null>;
  navigate: (route: string) => void;
  workflowBusy?: boolean;
  mealBoard?: {
    pending: boolean; failed: boolean; revision: number; localSignature: string;
    confirm: (snapshot: JourneySnapshot, signal: AbortSignal) => Promise<ConfirmedBoardPlan | null>;
    retry: () => void;
  };
}
interface State {
  generation: object;
  key: string;
  snapshot: JourneySnapshot | null;
  preferences: GuidancePreferenceResult | null;
  loading: boolean;
  busy: boolean;
  error: boolean;
  confirmedPlan?: ConfirmedBoardPlan | null;
}
interface Session {
  key: string;
  generation: object;
  accountId: string;
  store: ReturnType<typeof createGuidancePreferenceStore>;
  live: boolean;
  busy: boolean;
  request: number;
  abort: AbortController | null;
  presentationRequest: number;
}
interface Explanation {
  generation: object;
  snapshot: JourneySnapshot;
  stageId: JourneyStepId;
  replay: boolean;
  completionPlan?: ConfirmedBoardPlan;
  builderIntro?: boolean;
}

export function useGuidedJourneyDashboard(input: Input) {
  const generation = useMemo(() => ({}), [input.contextKey, input.eligible]);
  const liveGeneration = useRef(generation);
  liveGeneration.current = generation;
  const inputRef = useRef(input);
  inputRef.current = input;
  const sessionRef = useRef<Session | null>(null);
  const [state, setState] = useState<State | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const explanationRef = useRef(explanation);
  explanationRef.current = explanation;
  const [presentationNotice, setPresentationNotice] = useState<{ generation: object; message: string } | null>(null);

  function current(session: Session): boolean {
    const now = inputRef.current;
    return session.live && session.generation === generation && session.generation === liveGeneration.current
      && sessionRef.current === session && now.contextKey === session.key
      && now.account?.id === session.accountId && now.eligible && now.isCurrentContextPersonal();
  }
  async function load(session: Session): Promise<JourneySnapshot | null> {
    if (!current(session)) return null;
    session.abort?.abort();
    const abort = new AbortController();
    session.abort = abort;
    const request = ++session.request;
    setState({ generation: session.generation, key: session.key, snapshot: null, preferences: session.store.read(),
      loading: true, busy: session.busy, error: false });
    try {
      const snapshot = await fetchPersonalJourneyProgress(session.accountId, abort.signal);
      if (!current(session) || session.request !== request) return null;
      await confirmWorkflowSave(snapshot, session.accountId, abort.signal);
      const confirmedPlan = inputRef.current.mealBoard && !inputRef.current.mealBoard.pending && !inputRef.current.mealBoard.failed
        ? await inputRef.current.mealBoard.confirm(snapshot, abort.signal) : null;
      if (!current(session) || session.request !== request) return null;
      setState({ generation: session.generation, key: session.key, snapshot, preferences: session.store.read(),
        loading: false, busy: session.busy, error: false, confirmedPlan });
      const shownPlan = explanationRef.current?.completionPlan;
      if (!explanationJourneyAllowed(snapshot, inputRef.current.account)
        || (shownPlan && (!confirmedPlan || shownPlan.weekStartISO !== confirmedPlan.weekStartISO
          || (inputRef.current.mealBoard?.localSignature && inputRef.current.mealBoard.localSignature !== confirmedPlan.signature)))) {
        if (explanationRef.current?.generation === session.generation) pauseGuidanceForSession(session.accountId);
        setExplanation(null);
      } else setExplanation(previous => previous?.generation === session.generation ? { ...previous, snapshot } : previous);
      return snapshot;
    } catch {
      if (current(session) && session.request === request) {
        if (explanationRef.current?.generation === session.generation) pauseGuidanceForSession(session.accountId);
        setExplanation(null);
        setState({ generation: session.generation, key: session.key, snapshot: null, preferences: session.store.read(),
          loading: false, busy: session.busy, error: true });
      }
      return null;
    }
  }

  useEffect(() => {
    if (!input.eligible || !input.account) return;
    const session: Session = {
      key: input.contextKey, generation, accountId: input.account.id,
      store: createGuidancePreferenceStore({ accountId: input.account.id }),
      live: true, busy: false, request: 0, abort: null, presentationRequest: 0,
    };
    sessionRef.current = session;
    const stopObserving = observeWorkflowSaves(accountId => {
      if (accountId === session.accountId && current(session)) void load(session);
    });
    void load(session);
    return () => {
      session.live = false;
      stopObserving();
      session.abort?.abort();
      session.store.dispose();
      if (sessionRef.current === session) sessionRef.current = null;
    };
    // A key represents account + workspace + subject + access/assignment. The
    // session object (not just a string) also prevents account A → B → A races.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.contextKey, input.eligible, generation]);

  useEffect(() => {
    const session = sessionRef.current;
    if (input.mealBoard?.revision && session && current(session)) void load(session);
    // Native receipts only wake fresh reads; they are never completion authority.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.mealBoard?.revision]);
  useEffect(() => {
    if ((input.mealBoard?.pending || input.mealBoard?.failed) && explanationRef.current) dismissExplanation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.mealBoard?.pending, input.mealBoard?.failed]);

  function preference(command: GuidancePreferenceCommand) {
    const session = sessionRef.current;
    if (!session || !current(session) || session.busy) return;
    const preferences = session.store.apply(command);
    setState(previous => previous?.key === session.key ? { ...previous, preferences } : previous);
  }
  async function continueSetup(expectedStage?: JourneyStepId) {
    const session = sessionRef.current;
    const previous = stateRef.current;
    if (!session || !current(session) || session.busy || inputRef.current.workflowBusy || !previous
      || previous.key !== session.key || previous.loading || !previous.snapshot
      || !journeyDestinationAllowed(previous.snapshot, inputRef.current.account)) return;
    session.busy = true; // Synchronous lock: rapid double-clicks cannot navigate twice.
    const presentationRequest = session.presentationRequest;
    setState(previousState => previousState?.key === session.key ? { ...previousState, busy: true } : previousState);
    try {
      const account = await inputRef.current.refreshAccount();
      if (!current(session)) return;
      if (!account || account.id !== session.accountId) throw new Error("Account could not be verified.");
      const snapshot = await load(session);
      if (!snapshot || !current(session) || !journeyDestinationAllowed(snapshot, account)) return;
      if (expectedStage && (snapshot.nextStep !== expectedStage
        || session.presentationRequest !== presentationRequest || guidanceInteractionBlocked())) return;
      const route = manualJourneyDestination(snapshot);
      if (!route) return;
      const preferences = session.store.read().preferences;
      // Manual work may start a not-yet-started journey, but never silently
      // resumes a paused one or re-enables disabled automatic explanations.
      if (preferences.mode === "not_started") session.store.apply("start");
      if (current(session)) {
        setExplanation(null);
        inputRef.current.navigate(route);
        return true;
      }
    } catch {
      if (current(session)) {
        if (explanationRef.current?.generation === session.generation) pauseGuidanceForSession(session.accountId);
        setExplanation(null);
        setState({
          generation: session.generation,
          key: session.key, snapshot: null, preferences: session.store.read(),
          loading: false, busy: true, error: true,
        });
      }
    } finally {
      session.busy = false;
      if (current(session)) setState(previousState => previousState?.key === session.key
        ? { ...previousState, busy: false, preferences: session.store.read() } : previousState);
    }
  }
  function dismissExplanation() {
    const session = sessionRef.current;
    if (!session || !current(session)) return;
    ++session.presentationRequest; // Cancel even a pending manual launch/handoff.
    pauseGuidanceForSession(session.accountId);
    setExplanation(null);
  }
  async function openExplanation(replay = false, handoff = false) {
    const session = sessionRef.current;
    const previous = stateRef.current;
    if (!session || !current(session) || session.busy || inputRef.current.workflowBusy || !previous?.snapshot
      || previous.key !== session.key
      || !explanationJourneyAllowed(previous.snapshot, inputRef.current.account)) return;
    if (guidanceInteractionBlocked()) {
      setPresentationNotice({ generation, message: "Finish the current interaction, then open the explanation again." });
      return;
    }
    session.busy = true;
    const request = ++session.presentationRequest;
    setState(value => value?.key === session.key ? { ...value, busy: true } : value);
    setPresentationNotice(null);
    try {
      const account = await inputRef.current.refreshAccount();
      if (!current(session) || session.presentationRequest !== request) return;
      if (!account || account.id !== session.accountId) throw new Error("Account could not be verified.");
      const snapshot = await load(session);
      if (!snapshot || !current(session) || session.presentationRequest !== request
        || !explanationJourneyAllowed(snapshot, account)) return;
      if (guidanceInteractionBlocked()) {
        setPresentationNotice({ generation, message: "Finish the current interaction, then open the explanation again." });
        return;
      }
      if (handoff) {
        const offer = workflowHandoff(snapshot, account);
        if (!offer) return;
        if (offer.destination === "dashboard") {
          setExplanation(null);
          inputRef.current.navigate("/dashboard");
          return;
        }
      }
      const isReplay = !handoff && (replay || session.store.read().preferences.replayRequested);
      const stageId = isReplay || snapshot.status === "complete"
        ? explanationStages(snapshot)[0]?.id : snapshot.nextStep;
      if (stageId) setExplanation({ generation, snapshot, stageId, replay: isReplay || snapshot.status === "complete" });
    } catch {
      if (current(session)) {
        setExplanation(null);
        setState({ generation: session.generation, key: session.key, snapshot: null, preferences: session.store.read(),
          loading: false, busy: true, error: true });
        setPresentationNotice({ generation, message: "We couldn't verify your account. Retry before opening an explanation." });
      }
    } finally {
      session.busy = false;
      if (current(session)) setState(value => value?.key === session.key ? { ...value, busy: false } : value);
    }
  }
  async function openBoardExplanation() {
    const session = sessionRef.current;
    if (!inputRef.current.mealBoard || !session || !current(session) || session.busy
      || inputRef.current.workflowBusy) return;
    if (guidanceInteractionBlocked()) {
      setPresentationNotice({ generation, message: "Finish the current interaction, then open the explanation again." });
      return;
    }
    session.busy = true;
    const request = ++session.presentationRequest;
    setState(value => value?.key === session.key ? { ...value, busy: true } : value);
    setPresentationNotice(null);
    try {
      const account = await inputRef.current.refreshAccount();
      if (!current(session) || session.presentationRequest !== request) return;
      if (!account || account.id !== session.accountId) throw new Error("Account could not be verified.");
      const snapshot = await load(session);
      if (!snapshot || !current(session) || request !== session.presentationRequest
        || guidanceInteractionBlocked() || !explanationJourneyAllowed(snapshot, account)) return;
      // load's state commits asynchronously; re-confirm under this exact live scope.
      const proof = await inputRef.current.mealBoard.confirm(snapshot, session.abort!.signal);
      if (!current(session) || request !== session.presentationRequest || guidanceInteractionBlocked()
        || inputRef.current.mealBoard.pending || inputRef.current.mealBoard.failed) return;
      const local = inputRef.current.mealBoard.localSignature;
      const completionPlan = proof && (!local || local === proof.signature) ? proof : undefined;
      if (!completionPlan && snapshot.steps[2].evidence.state !== "incomplete") return;
      setExplanation({ generation, snapshot, stageId: "saved_meal_plan", replay: false,
        completionPlan, builderIntro: !completionPlan });
    } catch {
      if (current(session)) {
        setExplanation(null);
        setState(value => value?.key === session.key ? { ...value, snapshot: null, confirmedPlan: null, error: true, loading: false } : value);
      }
    } finally {
      session.busy = false;
      if (current(session)) setState(value => value?.key === session.key ? { ...value, busy: false } : value);
    }
  }
  async function boardExplanationAction(dashboard = false) {
    const view = explanationRef.current, session = sessionRef.current;
    if (!view || !session || !current(session) || session.busy || inputRef.current.workflowBusy
      || view.generation !== generation || guidanceInteractionBlocked()) return;
    session.busy = true;
    const request = session.presentationRequest;
    setState(value => value?.key === session.key ? { ...value, busy: true } : value);
    try {
      const account = await inputRef.current.refreshAccount();
      const snapshot = current(session) ? await load(session) : null;
      if (!account || account.id !== session.accountId || !snapshot || !current(session)
        || request !== session.presentationRequest || guidanceInteractionBlocked()
        || !explanationJourneyAllowed(snapshot, account)) return;
      if (view.completionPlan) {
        const proof = await inputRef.current.mealBoard!.confirm(snapshot, session.abort!.signal);
        const local = inputRef.current.mealBoard!.localSignature;
        if (!proof || proof.weekStartISO !== view.completionPlan.weekStartISO
          || (local && local !== proof.signature) || !current(session)
          || request !== session.presentationRequest || guidanceInteractionBlocked()
          || inputRef.current.mealBoard!.pending || inputRef.current.mealBoard!.failed) return;
        setExplanation(null);
        inputRef.current.navigate(dashboard ? "/dashboard"
          : `/general-nutrition-builder/build?week=${encodeURIComponent(proof.weekStartISO)}&view=week`);
      } else if (view.builderIntro && snapshot.steps[2].evidence.state === "incomplete") {
        setExplanation(null); // Already in the Builder; do not restart or redirect it.
        document.querySelector<HTMLElement>('[data-guided-board-content]')?.scrollIntoView({ block: "start" });
      }
    } catch {
      if (current(session)) {
        setExplanation(null);
        setState(value => value?.key === session.key ? { ...value, confirmedPlan: null, snapshot: null, error: true, loading: false } : value);
        setPresentationNotice({ generation, message: "Saved plan could not be verified. Retry before continuing." });
      }
    } finally {
      session.busy = false;
      if (current(session)) setState(value => value?.key === session.key ? { ...value, busy: false } : value);
    }
  }
  const validExplanation = input.eligible && !input.mealBoard?.pending && !input.mealBoard?.failed
    && explanation?.generation === generation ? explanation : null;
  useEffect(() => {
    if (!validExplanation) return;
    return observeGuidanceInteractions(() => {
      const session = sessionRef.current;
      if (!session || !current(session)) return;
      dismissExplanation();
      setPresentationNotice({ generation, message: "Guidance paused for the current interaction. Open the explanation again when you're ready." });
    });
    // Scoped callback is invalidated on account/workspace/access changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validExplanation, generation]);

  function explanationSecondary() {
    const session = sessionRef.current;
    const view = explanationRef.current;
    if (!session || !current(session) || session.busy || view?.generation !== generation) return;
    if (view.completionPlan) { void boardExplanationAction(true); return; }
    if (!view.replay) { dismissExplanation(); return; }
    if (guidanceInteractionBlocked()) { dismissExplanation(); return; }
    const steps = explanationStages(view.snapshot);
    const next = steps[steps.findIndex(step => step.id === view.stageId) + 1];
    if (next) setExplanation({ ...view, stageId: next.id });
    else {
      preference("finish_replay");
      dismissExplanation();
    }
  }
  const active = input.eligible && state?.generation === generation && state.key === input.contextKey ? state : null;
  const destinationAllowed = !!active?.snapshot && journeyDestinationAllowed(active.snapshot, input.account);
  const handoff = !active?.loading && !active?.error && !active?.busy && !input.workflowBusy
    ? workflowHandoff(active?.snapshot ?? null, input.account) : null;
  return {
    confirmedPlan: input.mealBoard && !input.mealBoard.pending && !input.mealBoard.failed && !active?.loading && !active?.error
      && active?.snapshot && explanationJourneyAllowed(active.snapshot, input.account)
      && (!input.mealBoard.localSignature || input.mealBoard.localSignature === active?.confirmedPlan?.signature)
      ? active?.confirmedPlan ?? null : null,
    openBoardExplanation,
    handoff,
    async nextStep() {
      const session = sessionRef.current;
      const latest = stateRef.current;
      if (!session || !current(session) || !handoff || session.busy || inputRef.current.workflowBusy
        || latest?.loading || latest?.error
        || !workflowHandoff(latest?.snapshot ?? null, inputRef.current.account)) return;
      return openExplanation(false, true);
    },
    visible: input.eligible && active?.snapshot?.status !== "not_applicable"
      && (!input.mealBoard || active?.snapshot?.completionGoal !== "personal_setup"),
    model: gettingStartedCardModel(active?.snapshot ?? null, active?.preferences ?? null, {
      loading: !active || active.loading, busy: active?.busy ?? false,
      error: active?.error ?? false, destinationAllowed,
      sessionPaused: guidancePausedForSession(input.account?.id ?? ""),
    }),
    explanation: validExplanation?.completionPlan ? {
      stageId: "saved_meal_plan" as const, title: "Your Meal Plan Is Saved",
      description: "You've added your first meal to your plan. You can come back to your Meal Builder anytime to add, replace, or change meals.",
      indicator: "Stage 3 of 3", builderName: "General Nutrition Meal Builder",
      primaryLabel: "Open My Plan", secondaryLabel: "Go to Dashboard", activityNotice: null,
      canPerform: !active?.busy && !input.workflowBusy,
    } : validExplanation?.builderIntro ? {
      stageId: "saved_meal_plan" as const, title: "Let's Create Your First Meal",
      description: "Use Create With Chef or select a meal from Favorites. Add it to a day and meal slot on your board. A generated recipe or Favorite isn't a saved plan. Meals added here autosave; guidance confirms the server result without requiring another Save Plan click.",
      indicator: "Stage 3 of 3", builderName: "General Nutrition Meal Builder",
      primaryLabel: "Continue in Builder", secondaryLabel: "Close & Pause", activityNotice: null,
      canPerform: !active?.busy && !input.workflowBusy,
    } : validExplanation
      ? explanationModel(validExplanation.snapshot, validExplanation.stageId, validExplanation.replay, active?.busy ?? false) : null,
    canExplain: !!active?.snapshot && !!active.preferences && !active.loading && !active.busy
      && explanationJourneyAllowed(active.snapshot, input.account),
    presentationNotice: presentationNotice?.generation === generation ? presentationNotice.message : null,
    openExplanation() { return openExplanation(); },
    dismissExplanation,
    restoreExplanationFocus(selector = '[data-testid="guided-journey-explain"]') {
      const session = sessionRef.current;
      if (session && current(session) && !guidanceInteractionBlocked()) {
        document.querySelector<HTMLButtonElement>(selector)?.focus();
      }
    },
    explanationSecondary,
    async explanationPrimary() {
      const view = explanationRef.current;
      const session = sessionRef.current;
      if (!view || view.generation !== generation || !session || !current(session)
        || guidanceInteractionBlocked()) return;
      if (view.completionPlan || view.builderIntro) return boardExplanationAction();
      return continueSetup(view.stageId);
    },
    continueSetup,
    retry() { const session = sessionRef.current; if (session && !session.busy) {
      if (inputRef.current.mealBoard) inputRef.current.mealBoard.retry();
      else void load(session);
    } },
    pauseResume() {
      const session = sessionRef.current;
      if (session && current(session)) {
        const resume = session.store.read().preferences.mode === "paused" || guidancePausedForSession(session.accountId);
        if (resume) resumeGuidanceForSession(session.accountId);
        preference(resume ? "resume" : "pause");
      }
    },
    toggleAutomatic() {
      const session = sessionRef.current;
      if (session && current(session)) preference(session.store.read().preferences.automaticExplanationsEnabled
        ? "disable_automatic" : "enable_automatic");
    },
    restart() {
      const session = sessionRef.current;
      if (!session || !current(session) || session.busy) return;
      preference("restart_explanations");
      return openExplanation(true);
    },
  };
}
