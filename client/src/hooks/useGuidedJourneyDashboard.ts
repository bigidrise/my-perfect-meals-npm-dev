import { useEffect, useMemo, useRef, useState } from "react";
import type { JourneySnapshot } from "../../../shared/guidedJourney";
import {
  createGuidancePreferenceStore, type GuidancePreferenceCommand, type GuidancePreferenceResult,
} from "@/lib/guidedJourney/preferences";
import { fetchPersonalJourneyProgress } from "@/lib/guidedJourney/progress";
import { gettingStartedCardModel, manualJourneyDestination } from "@/lib/guidedJourney/dashboardModel";
import { journeyDestinationAllowed, type JourneyDashboardAccount } from "@/lib/guidedJourney/dashboardScope";

interface Input {
  account: JourneyDashboardAccount | null;
  contextKey: string;
  eligible: boolean;
  /** Recheck live workspace/location as well as render-time identity. */
  isCurrentContextPersonal: () => boolean;
  refreshAccount: () => Promise<JourneyDashboardAccount | null>;
  navigate: (route: string) => void;
}
interface State {
  key: string;
  snapshot: JourneySnapshot | null;
  preferences: GuidancePreferenceResult | null;
  loading: boolean;
  busy: boolean;
  error: boolean;
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
}

export function useGuidedJourneyDashboard(input: Input) {
  const generation = useMemo(() => ({}), [input.contextKey, input.eligible]);
  const inputRef = useRef(input);
  inputRef.current = input;
  const sessionRef = useRef<Session | null>(null);
  const [state, setState] = useState<State | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  function current(session: Session): boolean {
    const now = inputRef.current;
    return session.live && session.generation === generation
      && sessionRef.current === session && now.contextKey === session.key
      && now.account?.id === session.accountId && now.eligible && now.isCurrentContextPersonal();
  }
  async function load(session: Session): Promise<JourneySnapshot | null> {
    if (!current(session)) return null;
    session.abort?.abort();
    const abort = new AbortController();
    session.abort = abort;
    const request = ++session.request;
    setState({ key: session.key, snapshot: null, preferences: session.store.read(),
      loading: true, busy: session.busy, error: false });
    try {
      const snapshot = await fetchPersonalJourneyProgress(session.accountId, abort.signal);
      if (!current(session) || session.request !== request) return null;
      setState({ key: session.key, snapshot, preferences: session.store.read(),
        loading: false, busy: session.busy, error: false });
      return snapshot;
    } catch {
      if (current(session) && session.request === request) {
        setState({ key: session.key, snapshot: null, preferences: session.store.read(),
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
      live: true, busy: false, request: 0, abort: null,
    };
    sessionRef.current = session;
    void load(session);
    return () => {
      session.live = false;
      session.abort?.abort();
      session.store.dispose();
      if (sessionRef.current === session) sessionRef.current = null;
    };
    // A key represents account + workspace + subject + access/assignment. The
    // session object (not just a string) also prevents account A → B → A races.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.contextKey, input.eligible, generation]);

  function preference(command: GuidancePreferenceCommand) {
    const session = sessionRef.current;
    if (!session || !current(session) || session.busy) return;
    const preferences = session.store.apply(command);
    setState(previous => previous?.key === session.key ? { ...previous, preferences } : previous);
  }
  async function continueSetup() {
    const session = sessionRef.current;
    const previous = stateRef.current;
    if (!session || !current(session) || session.busy || !previous
      || previous.key !== session.key || previous.loading || !previous.snapshot
      || !journeyDestinationAllowed(previous.snapshot, inputRef.current.account)) return;
    session.busy = true; // Synchronous lock: rapid double-clicks cannot navigate twice.
    setState(previousState => previousState?.key === session.key ? { ...previousState, busy: true } : previousState);
    try {
      const account = await inputRef.current.refreshAccount();
      if (!current(session)) return;
      if (!account || account.id !== session.accountId) throw new Error("Account could not be verified.");
      const snapshot = await load(session);
      if (!snapshot || !current(session) || !journeyDestinationAllowed(snapshot, account)) return;
      const route = manualJourneyDestination(snapshot);
      if (!route) return;
      const preferences = session.store.read().preferences;
      // Manual work may start a not-yet-started journey, but never silently
      // resumes a paused one or re-enables disabled automatic explanations.
      if (preferences.mode === "not_started") session.store.apply("start");
      if (current(session)) inputRef.current.navigate(route);
    } catch {
      if (current(session)) setState({
        key: session.key, snapshot: null, preferences: session.store.read(),
        loading: false, busy: true, error: true,
      });
    } finally {
      session.busy = false;
      if (current(session)) setState(previousState => previousState?.key === session.key
        ? { ...previousState, busy: false, preferences: session.store.read() } : previousState);
    }
  }
  const active = input.eligible && state?.key === input.contextKey ? state : null;
  const destinationAllowed = !!active?.snapshot && journeyDestinationAllowed(active.snapshot, input.account);
  return {
    visible: input.eligible && active?.snapshot?.status !== "not_applicable",
    model: gettingStartedCardModel(active?.snapshot ?? null, active?.preferences ?? null, {
      loading: !active || active.loading, busy: active?.busy ?? false,
      error: active?.error ?? false, destinationAllowed,
    }),
    continueSetup,
    retry() { const session = sessionRef.current; if (session && !session.busy) void load(session); },
    pauseResume() {
      const session = sessionRef.current;
      if (session && current(session)) preference(session.store.read().preferences.mode === "paused" ? "resume" : "pause");
    },
    toggleAutomatic() {
      const session = sessionRef.current;
      if (session && current(session)) preference(session.store.read().preferences.automaticExplanationsEnabled
        ? "disable_automatic" : "enable_automatic");
    },
    restart() { preference("restart_explanations"); },
  };
}
