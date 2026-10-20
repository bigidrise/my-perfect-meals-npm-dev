import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUpRight, CircleHelp, FlaskConical, GlassWater, History, RotateCcw, Send, Square, Utensils, Wine } from "lucide-react";
import type { AdvisorResponse } from "../../../../../shared/pairingAdvisor/contracts";
import type { PreferenceKey } from "../../../../../shared/pairingAdvisor/conversation";
import type { AdvisorState, Feature, Scenario } from "../model";
import { OPTIONAL_QUESTIONS, SYNTHETIC_LIST } from "../fixtures";

type EditPreference = (key: PreferenceKey, value: string | null) => void;

export function ContextEditor({ state, edit, replaceList }: {
  state: AdvisorState; edit: EditPreference; replaceList: (text: string | null) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [listText, setListText] = useState("");
  const context = state.context;
  useEffect(() => {
    setValues({
      meal: context.meal?.value ?? "", preparation: context.preparation?.value ?? "",
      sauce: context.sauce?.value ?? "", taste: context.taste?.value ?? "",
      budget: context.budget?.value ?? "", currency: context.currency?.value ?? "",
      location: context.location?.value ?? "",
    });
  }, [state.contextRevision]);
  useEffect(() => {
    setListText(context.wineList?.text ?? "");
  }, [context.wineList?.text, state.conversationId, state.accountId, state.workspaceId]);
  const fields: { key: PreferenceKey; label: string; placeholder: string }[] = [
    { key: "meal", label: "Meal", placeholder: "What’s on the table?" },
    { key: "preparation", label: "Preparation", placeholder: "Roasted, grilled, raw…" },
    { key: "sauce", label: "Sauce", placeholder: "A bright citrus dressing…" },
    { key: "taste", label: "Taste", placeholder: "A little drier, more aromatic…" },
    { key: "budget", label: "Budget", placeholder: "Optional amount per bottle or glass" },
    { key: "currency", label: "Currency", placeholder: "USD, EUR, GBP…" },
    { key: "location", label: "Location", placeholder: "Optional region or city" },
  ];
  const present = fields.filter(field => context[field.key]?.value);
  return <section className="advisor-side-section" aria-labelledby="advisor-context-title">
    <h3 className="advisor-side-title" id="advisor-context-title"><span><Utensils size={15} /> Table context</span><span className="advisor-response-label">Optional</span></h3>
    <p className="advisor-small-note">A few details can help shape the conversation. Leave everything blank to simply ask.</p>
    {present.length > 0 && <div className="advisor-context-summary" aria-label="Current context summary">
      <strong>In the conversation:</strong> {present.map(field => `${field.label.toLowerCase()}: ${context[field.key]?.value}`).join(" · ")}
      {context.wineList && " · supplied list"}
    </div>}
    <details className="advisor-context-details">
    <summary>Edit context or supplied list</summary>
    <div className="advisor-context-grid" style={{ marginTop: 11 }}>
      {fields.map(field => <div className="advisor-field" key={field.key}>
        <label htmlFor={`context-${field.key}`}>{field.label}</label>
        <input id={`context-${field.key}`} value={values[field.key] ?? ""} placeholder={field.placeholder} maxLength={500}
          onChange={event => setValues(current => ({ ...current, [field.key]: event.target.value }))}
          onBlur={event => {
            const next = event.currentTarget.value.trim();
            if (next !== (context[field.key]?.value ?? "")) edit(field.key, next || null);
          }} />
      </div>)}
    </div>
    <div className="advisor-side-section">
      <h3 className="advisor-side-title"><span><Wine size={15} /> Supplied wine list</span></h3>
      <p className="advisor-small-note">A list you provide for this synthetic conversation. Examples are not verified as list members.</p>
      <div className="advisor-field">
        <label htmlFor="advisor-wine-list">Paste list entries</label>
        <textarea id="advisor-wine-list" value={listText} placeholder="One entry per line" maxLength={12000}
          onChange={event => setListText(event.target.value)} />
      </div>
      <div className="advisor-list-actions" style={{ marginTop: 8 }}>
        <button className="advisor-button secondary advisor-full" type="button" onClick={() => {
          if (context.wineList && !window.confirm("Replace the existing supplied list? Earlier list claims will no longer apply.")) return;
          setListText(SYNTHETIC_LIST);
          replaceList(SYNTHETIC_LIST);
        }}>Load synthetic sample list</button>
        <button className="advisor-button secondary advisor-full" type="button" disabled={listText === (context.wineList?.text ?? "")}
          onClick={() => {
            if (context.wineList && !window.confirm("Replace the existing supplied list with these entries?")) return;
            replaceList(listText || null);
          }}>{context.wineList ? "Replace supplied list" : "Add supplied list"}</button>
        {context.wineList && <button className="advisor-link-button" type="button" onClick={() => {
          if (window.confirm("Remove the supplied list? Earlier list claims will no longer apply.")) {
            replaceList(null); setListText("");
          }
        }}>Remove supplied list</button>}
      </div>
    </div>
    </details>
  </section>;
}

export function Composer({ draft, setDraft, send, waiting, stop, retry, status, lastQuestion }: {
  draft: string; setDraft: (value: string) => void; send: () => void; waiting: boolean;
  stop: () => void; retry: () => void; status: AdvisorState["status"]; lastQuestion: string | null;
}) {
  const canSend = draft.trim().length > 0 && !waiting;
  return <div className="advisor-composer-wrap">
    <form className="advisor-composer" onSubmit={event => { event.preventDefault(); if (canSend) send(); }}>
      <label className="advisor-visually-hidden" htmlFor="advisor-message">Your message</label>
      <textarea id="advisor-message" aria-label="Your message" value={draft} maxLength={4000}
        placeholder="Tell me what you’re cooking, or ask anything about pairing…"
        onChange={event => setDraft(event.target.value)}
        onKeyDown={event => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault(); if (canSend) send();
          }
        }} />
      {waiting
        ? <button className="advisor-button secondary" type="button" aria-label="Stop response" onClick={stop}><Square size={14} /> Stop</button>
        : <button className="advisor-button" type="submit" aria-label="Send message" disabled={!canSend}><Send size={14} /> Send</button>}
    </form>
    <div className="advisor-compose-hint"><span>Enter to send · Shift + Enter for a new line</span><span>{draft.length}/4000</span></div>
    {(status === "interrupted" || status === "unavailable" || status === "stopped") && lastQuestion &&
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 5 }}>
        <button className="advisor-link-button" aria-label="Retry question" type="button" onClick={retry}><RotateCcw size={12} /> Retry question</button>
      </div>}
  </div>;
}

export function ResponseView({ response, historical, setDraft }: {
  response: AdvisorResponse; historical: boolean; setDraft: (text: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const recommendations = response.outcome === "recommendation" ? response.recommendations : [];
  const title = {
    education: "A little context", recommendation: "A pairing conversation",
    clarification: "One small question", restricted: "A boundary in this example", unavailable: "A pause in the conversation",
  }[response.outcome];
  const followUps = response.outcome === "education" ? response.education.followUps
    : response.outcome === "recommendation" ? response.followUps.map(item => item.text) : [];
  const cardMap = useMemo(() => new Map(recommendations.map(item => [item.id, item])), [response]);
  const outcomeLabel = { education: "Education", recommendation: "Recommendation", clarification: "Clarification", restricted: "Restricted", unavailable: "Unavailable" }[response.outcome];
  return <div className="advisor-answer-content">
    {historical && <div className="advisor-history-label"><History size={12} /> Earlier context · recommendations are historical</div>}
    <div className="advisor-response-label">{outcomeLabel} · {title}</div>
    {response.outcome === "education" && response.education.paragraphs.map((text, index) => <p className="advisor-prose" key={index}>{text}</p>)}
    {response.outcome === "recommendation" && <>
      {response.education?.paragraphs.map((text, index) => <p className="advisor-prose" key={`edu-${index}`}>{text}</p>)}
      {response.narrative.map((item, index) => <p className="advisor-prose" key={`narrative-${index}`}>{item.text}</p>)}
      <div className="advisor-card-list">
        {recommendations.map(item => <RecommendationCard key={item.id} recommendation={item} prefix={response.requestId}
          highlighted={item.id === response.bestChoiceId} selected={selected === item.id} />)}
      </div>
      {recommendations.some(item => item.alternativeIds.length > 0) && <div className="advisor-related" aria-label="Referenced alternatives">
        {recommendations.flatMap(item => item.alternativeIds.map(id => ({ from: item, target: cardMap.get(id) })))
          .filter(reference => reference.target)
          .map((reference, index) => <button className="advisor-link-button" type="button" key={`${reference.from.id}-${reference.target?.id}-${index}`}
            disabled={historical} onClick={() => {
              const id = reference.target!.id; setSelected(id);
              document.getElementById(`recommendation-${response.requestId}-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            }}>See alternative: {reference.target!.name} <ArrowDown size={12} /></button>)}
      </div>}
    </>}
    {response.outcome === "clarification" && <><div className="advisor-response-reason">Fixture reason · {response.reason}</div><p className="advisor-prose">{response.question}</p></>}
    {response.outcome === "restricted" && <><div className="advisor-response-reason">Fixture reason · {response.reason}</div><p className="advisor-prose">{response.message}</p>
      {response.education?.paragraphs.map((text, index) => <p className="advisor-prose" key={index}>{text}</p>)}</>}
    {response.outcome === "unavailable" && <><div className="advisor-response-reason">Fixture reason · {response.reason}</div><p className="advisor-prose">{response.message}</p></>}
    {followUps.length > 0 && <div className="advisor-followups" aria-label="Optional questions">
      {followUps.map((text, index) => <button type="button" className="advisor-chip" key={`${text}-${index}`} disabled={historical}
        onClick={() => setDraft(text)}>{text}<ArrowUpRight size={12} /></button>)}
    </div>}
  </div>;
}

type Recommendation = Extract<AdvisorResponse, { outcome: "recommendation" }>["recommendations"][number];
export function RecommendationCard({ recommendation: item, prefix, highlighted, selected }: {
  recommendation: Recommendation; prefix: string; highlighted: boolean; selected: boolean;
}) {
  return <article className={`advisor-rec-card ${highlighted || selected ? "is-best" : ""}`}
    id={`recommendation-${prefix}-${item.id}`} aria-labelledby={`recommendation-title-${prefix}-${item.id}`}>
    {highlighted && <div className="advisor-best-tag">Example highlighted</div>}
    <h4 id={`recommendation-title-${prefix}-${item.id}`}>{item.name}</h4><p>{item.explanation}</p>
    {item.servingAdvice && <p className="advisor-serving">{item.servingAdvice}</p>}
  </article>;
}

export function SyntheticControls({ scenario, setScenario, feature, changeFeature, identity, changeIdentity }: {
  scenario: Scenario; setScenario: (scenario: Scenario) => void; feature: Feature;
  changeFeature: (feature: Feature) => void; identity: string; changeIdentity: () => void;
}) {
  const scenarios: { value: Scenario; label: string }[] = [
    { value: "natural", label: "Natural conversation" }, { value: "education", label: "Education" },
    { value: "recommendation", label: "Recommendation" }, { value: "clarification", label: "Clarification" },
    { value: "restricted", label: "Restricted example" }, { value: "unavailable", label: "Unavailable" },
    { value: "interrupted", label: "Interrupted" }, { value: "invalid", label: "Invalid display data" },
  ];
  return <details className="advisor-controls">
    <summary><span style={{ display: "flex", gap: 7, alignItems: "center" }}><FlaskConical size={14} /> Synthetic test controls</span><ArrowDown size={13} /></summary>
    <div className="advisor-controls-body">
      <p className="advisor-small-note">Local scripted fixtures only. Feature and identity changes clear the conversation; the response scenario controls the next example.</p>
      <div className="advisor-field"><label htmlFor="advisor-scenario">Response scenario</label>
        <select id="advisor-scenario" value={scenario} onChange={event => setScenario(event.target.value as Scenario)}>
          {scenarios.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}
        </select>
      </div>
      <div className="advisor-field"><label htmlFor="advisor-feature">Starting feature</label>
        <select id="advisor-feature" value={feature} onChange={event => changeFeature(event.target.value as Feature)}>
          {(["Drink Pairing", "Wine List Translator", "Chef Pairings"] as Feature[]).map(value => <option key={value}>{value}</option>)}
        </select>
      </div>
      <div className="advisor-switch"><span>Synthetic identity · {identity}</span>
        <button type="button" className="advisor-icon-button" onClick={changeIdentity}>Switch</button>
      </div>
    </div>
  </details>;
}

export function Welcome({ setDraft }: { setDraft: (text: string) => void }) {
  return <div className="advisor-welcome">
    <div className="advisor-welcome-mark"><GlassWater size={25} strokeWidth={1.6} /></div>
    <h3>Good food deserves a good conversation.</h3>
    <p>Tell me what’s cooking, what you enjoy, or what’s on the table. We can start with as much—or as little—detail as you like.</p>
    <div className="advisor-question-chips" aria-label="Optional question starters">
      {OPTIONAL_QUESTIONS.map(question => <button type="button" className="advisor-chip" key={question} onClick={() => setDraft(question)}>{question}</button>)}
    </div>
  </div>;
}

export function StatusIcon({ status }: { status: AdvisorState["status"] }) {
  if (status === "waiting") return <span className="advisor-waiting"><span /><span /><span /> Preparing a synthetic example…</span>;
  if (status === "unavailable") return <span className="advisor-response-reason"><CircleHelp size={12} /> Synthetic service unavailable</span>;
  if (status === "stopped") return <span className="advisor-response-reason"><Square size={11} /> Response stopped</span>;
  if (status === "interrupted") return <span className="advisor-response-reason"><CircleHelp size={12} /> Synthetic connection interrupted</span>;
  return null;
}

export function PrototypeNotice() {
  return <div className="advisor-prototype" role="note"><i aria-hidden="true" /> Synthetic prototype <span aria-hidden="true">/</span> No live AI or customer data</div>;
}

export function StatusLive({ message }: { message: string }) {
  return <div className="advisor-visually-hidden" aria-live="polite" aria-atomic="true">{message}</div>;
}

