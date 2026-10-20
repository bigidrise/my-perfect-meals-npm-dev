import { useEffect, useReducer, useRef, useState } from "react";
import { advisorReducer, createAdvisorState, type AdvisorAction, type Feature, type Scenario } from "./model";
import { syntheticContextEdits, syntheticResponse } from "./fixtures";
import type { PreferenceKey } from "../../../../shared/pairingAdvisor/conversation";

/** Only an in-memory timer. No network, storage, identity SDK or authority dependency. */
export function useSyntheticAdvisor() {
  const [state, dispatch] = useReducer(advisorReducer, undefined, () => createAdvisorState());
  const [scenario, setScenario] = useState<Scenario>("natural");
  const stateRef = useRef(state);
  const counter = useRef(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = (prefix: string) => `${prefix}-${++counter.current}`;
  const transition = (action: AdvisorAction) => {
    stateRef.current = advisorReducer(stateRef.current, action);
    dispatch(action);
  };
  const cancelTimer = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => () => cancelTimer(), []);

  function send(text = stateRef.current.draft, retry = false) {
    if (stateRef.current.active || !text.trim() || text.trim().length > 4000) return;
    cancelTimer();
    if (!retry) for (const action of syntheticContextEdits(text.trim())) transition(action);
    transition({ type: "submit", text, requestId: nextId("synthetic-request"), retry });
    const submission = stateRef.current.active;
    if (!submission) return;
    const context = stateRef.current.context;
    const selected = scenario;
    timer.current = setTimeout(() => {
      timer.current = null;
      if (selected === "interrupted") transition({ type: "interrupt", submission });
      else transition({ type: "response", submission, response: syntheticResponse(submission, context, text, selected) });
    }, 700);
  }
  function edit(key: PreferenceKey, value: string | null) {
    const pending = stateRef.current.active;
    transition({ type: "edit", key, value });
    if (stateRef.current.active !== pending) cancelTimer();
  }
  function replaceList(text: string | null) {
    const pending = stateRef.current.active;
    transition({ type: "list", text });
    if (stateRef.current.active !== pending) cancelTimer();
  }
  function reset() {
    cancelTimer(); transition({ type: "reset", conversationId: nextId("synthetic-conversation") });
  }
  function changeIdentity() {
    cancelTimer();
    transition({
      type: "identity", accountId: stateRef.current.accountId === "synthetic-account-a" ? "synthetic-account-b" : "synthetic-account-a",
      workspaceId: null, conversationId: nextId("synthetic-conversation"),
    });
  }
  function changeFeature(feature: Feature) {
    cancelTimer(); transition({ type: "feature", feature, conversationId: nextId("synthetic-conversation") });
  }
  return {
    state, scenario, setScenario, send, edit, replaceList, reset, changeIdentity, changeFeature,
    setDraft: (value: string) => transition({ type: "draft", value }),
    stop: () => { cancelTimer(); transition({ type: "stop" }); },
    retry: () => { if (stateRef.current.lastQuestion) send(stateRef.current.lastQuestion, true); },
  };
}
