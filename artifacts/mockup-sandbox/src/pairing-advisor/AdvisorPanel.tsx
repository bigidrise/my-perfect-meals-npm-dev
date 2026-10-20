import { useEffect, useMemo, useRef } from "react";
import { MessageCircle, RotateCcw, Shield } from "lucide-react";
import type { AdvisorResponse } from "../../../../shared/pairingAdvisor/contracts";
import type { ChatMessage, Feature, Scenario } from "./model";
import { useSyntheticAdvisor } from "./useSyntheticAdvisor";
import {
  Composer, ContextEditor, PrototypeNotice, ResponseView, StatusIcon,
  StatusLive, SyntheticControls, Welcome,
} from "./components/AdvisorComponents";
import "./advisor.css";

export function AdvisorPanel() {
  const advisor = useSyntheticAdvisor();
  const { state } = advisor;
  const transcriptRef = useRef<HTMLDivElement>(null);
  const shouldFollowRef = useRef(true);
  const previousCount = useRef(state.messages.length);
  const scrollToLatest = () => {
    const node = transcriptRef.current;
    if (!node) return;
    shouldFollowRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 120;
  };
  useEffect(() => {
    if (state.messages.length !== previousCount.current) {
      previousCount.current = state.messages.length;
      const node = transcriptRef.current;
      if (node && shouldFollowRef.current) node.scrollTop = node.scrollHeight;
    }
  }, [state.messages.length]);
  const latestAssistant = [...state.messages].reverse().find(message => message.role === "assistant");
  const liveText = state.status === "waiting" ? "A synthetic response is being prepared."
    : state.status === "interrupted" ? "Synthetic connection interrupted."
        : state.status === "unavailable" ? "Synthetic response unavailable."
          : state.status === "stopped" ? "Response stopped."
            : latestAssistant ? `A synthetic ${latestAssistant.response.outcome} response is ready.` : "";
  const contextSummary = useMemo(() => {
    const values = [
      ["Meal", state.context.meal?.value], ["Preparation", state.context.preparation?.value],
      ["Sauce", state.context.sauce?.value], ["Taste", state.context.taste?.value],
      ["Budget", state.context.budget?.value], ["Currency", state.context.currency?.value],
      ["Location", state.context.location?.value],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]));
    return values;
  }, [state.context, state.contextRevision]);
  const clearConversation = () => {
    if (window.confirm("Start over? This clears the synthetic conversation and context for this feature.")) advisor.reset();
  };
  const identityName = state.accountId.endsWith("-a") ? "Sample diner A" : "Sample diner B";
  const renderResponse = (response: AdvisorResponse, historical: boolean) =>
    <ResponseView response={response} historical={historical} setDraft={advisor.setDraft} />;

  return <main className="advisor-shell">
    <div className="advisor-frame">
      <header className="advisor-topline">
        <div className="advisor-brand">
          <div className="advisor-mark"><MessageCircle size={20} strokeWidth={1.7} /></div>
          <div><h1>My Perfect Meals</h1><p>FOOD · WINE · GOOD COMPANY</p></div>
        </div>
        <PrototypeNotice />
      </header>
      <div className="advisor-grid">
        <section className="advisor-main" aria-label="Pairing conversation">
          <div className="advisor-heading">
            <div>
              <div className="advisor-eyebrow">{state.feature}</div>
              <h2>Let’s find a lovely match.</h2>
              <p>Ask in your own words. No form, no perfect phrasing needed.</p>
            </div>
            <div className="advisor-heading-actions">
              <button className="advisor-icon-button" type="button" onClick={clearConversation} aria-label="Start over">
                <RotateCcw size={14} /><span>Start over</span>
              </button>
            </div>
          </div>
          {state.notice && <p className="advisor-notice" role="status">{state.notice}</p>}
          <div className="advisor-transcript" ref={transcriptRef} onScroll={scrollToLatest} aria-label="Conversation" aria-live="off">
            {state.messages.length === 0 && <Welcome setDraft={advisor.setDraft} />}
            {state.messages.map((message: ChatMessage) => message.role === "user"
              ? <div className="advisor-message advisor-user" key={message.id}><div className="advisor-user-bubble">{message.text}</div></div>
              : <div className="advisor-message advisor-answer" key={message.id}>
                <div className="advisor-answer-mark"><MessageCircle size={15} /></div>
                {renderResponse(message.response, message.revision !== state.contextRevision)}
              </div>)}
            {state.status === "waiting" && <div className="advisor-message advisor-answer">
              <div className="advisor-answer-mark"><MessageCircle size={15} /></div><StatusIcon status="waiting" />
            </div>}
            {state.messages.length === 0 && state.status !== "waiting" && <div className="advisor-visually-hidden">Start a conversation by typing below.</div>}
          </div>
          {(contextSummary.length > 0 || state.context.wineList) && <div className="advisor-context-strip">
            <Shield size={13} />
            <span>{contextSummary.length ? contextSummary.map(([label, value]) => `${label}: ${value}`).join(" · ") : "Conversation context"}
              {state.context.wineList && " · supplied list"}</span>
          </div>}
          <Composer draft={state.draft} setDraft={advisor.setDraft} send={() => advisor.send()} waiting={state.status === "waiting"}
            stop={advisor.stop} retry={advisor.retry} status={state.status} lastQuestion={state.lastQuestion} />
        </section>
        <aside className="advisor-side" aria-label="Conversation options">
          <ContextEditor state={state} edit={advisor.edit} replaceList={advisor.replaceList} />
          <section className="advisor-side-section">
            <SyntheticControls scenario={advisor.scenario} setScenario={advisor.setScenario}
              feature={state.feature} changeFeature={(feature: Feature) => advisor.changeFeature(feature)}
              identity={identityName} changeIdentity={advisor.changeIdentity} />
            <p className="advisor-status"><Shield size={12} /> Local, deterministic sample only. No AI, paid calls, or customer profile.</p>
          </section>
        </aside>
      </div>
      <StatusLive message={liveText} />
    </div>
  </main>;
}
