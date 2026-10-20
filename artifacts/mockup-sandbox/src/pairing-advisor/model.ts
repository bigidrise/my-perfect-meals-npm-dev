import {
  AdvisorResponse, ContextLimits, type AdvisorResponse as Response, type ConversationContext,
} from "../../../../shared/pairingAdvisor/contracts";
import {
  emptyConversation, acceptsResponse, replaceWineList, setExplicitPreference,
  type ActiveSubmission, type PreferenceKey,
} from "../../../../shared/pairingAdvisor/conversation";

export type Feature = "Drink Pairing" | "Wine List Translator" | "Chef Pairings";
export type RequestState = "ready" | "waiting" | "stopped" | "interrupted" | "unavailable";
export type Scenario = "natural" | "education" | "recommendation" | "clarification" | "restricted" | "unavailable" | "interrupted" | "invalid";
export type ChatMessage =
  | { id: string; role: "user"; text: string; revision: number }
  | { id: string; role: "assistant"; response: Response; revision: number };
export interface AdvisorState {
  accountId: string; workspaceId: string | null;
  feature: Feature; conversationId: string; contextRevision: number;
  context: ConversationContext; messages: ChatMessage[]; draft: string;
  status: RequestState; active: ActiveSubmission | null; lastQuestion: string | null;
  notice: string | null;
}
export type AdvisorAction =
  | { type: "draft"; value: string }
  | { type: "submit"; requestId: string; text: string; retry?: boolean }
  | { type: "response"; submission: ActiveSubmission; response: unknown }
  | { type: "interrupt"; submission: ActiveSubmission }
  | { type: "stop" }
  | { type: "edit"; key: PreferenceKey; value: string | null }
  | { type: "list"; text: string | null }
  | { type: "reset"; conversationId: string }
  | { type: "identity"; accountId: string; workspaceId: string | null; conversationId: string }
  | { type: "feature"; feature: Feature; conversationId: string };

export function createAdvisorState(
  conversationId = "synthetic-conversation-1",
  accountId = "synthetic-account-a", workspaceId: string | null = null,
): AdvisorState {
  return {
    accountId, workspaceId, conversationId, feature: "Drink Pairing", contextRevision: 0,
    context: emptyConversation(), messages: [], draft: "", status: "ready",
    active: null, lastQuestion: null, notice: null,
  };
}

function history(context: ConversationContext, role: "user" | "assistant", content: string): ConversationContext {
  const messages = [...context.history, { role, content: content.slice(0, ContextLimits.messageCharacters) }]
    .slice(-ContextLimits.historyMessages);
  while (messages.reduce((total, item) => total + item.content.length, 0) > ContextLimits.historyCharacters) messages.shift();
  return { ...context, history: messages };
}
function responseText(response: Response): string {
  switch (response.outcome) {
    case "education": return response.education.paragraphs.join("\n");
    case "recommendation": return [
      ...(response.education?.paragraphs ?? []), ...response.narrative.map(item => item.text),
      ...response.recommendations.map(item => `${item.name}: ${item.explanation}`),
    ].join("\n");
    case "clarification": return response.question;
    default: return response.message;
  }
}
function invalidate(state: AdvisorState, notice: string): AdvisorState {
  return {
    ...state, active: null, status: "ready", lastQuestion: null,
    contextRevision: state.contextRevision + 1, notice,
  };
}
function matches(state: AdvisorState, pending: ActiveSubmission): boolean {
  return !!state.active && acceptsResponse(pending, state.active, {
    requestId: pending.requestId, conversationId: pending.conversationId,
    contextRevision: pending.contextRevision,
  } as Response);
}

/** Display-shape/referential validation only. This is NOT a clinical safety engine. */
export function parseDisplayResponse(raw: unknown): Response | null {
  const parsed = AdvisorResponse.safeParse(raw);
  if (!parsed.success) return null;
  const response = parsed.data;
  if (response.outcome !== "recommendation") return response;
  const ids = new Set(response.recommendations.map(item => item.id));
  if (ids.size !== response.recommendations.length) return null;
  if (response.bestChoiceId !== null && !ids.has(response.bestChoiceId)) return null;
  if (response.recommendations.some(item => item.alternativeIds.some(id => !ids.has(id)))) return null;
  if ([...response.narrative, ...response.followUps].some(item => item.recommendationIds.some(id => !ids.has(id)))) return null;
  return response;
}

export function advisorReducer(state: AdvisorState, action: AdvisorAction): AdvisorState {
  switch (action.type) {
    case "draft": return { ...state, draft: action.value.slice(0, ContextLimits.messageCharacters) };
    case "submit": {
      const text = action.text.trim();
      if (state.active || !text || text.length > ContextLimits.messageCharacters) return state;
      const active: ActiveSubmission = {
        accountId: state.accountId, workspaceId: state.workspaceId, conversationId: state.conversationId,
        contextRevision: state.contextRevision, requestId: action.requestId,
      };
      return {
        ...state, active, status: "waiting", draft: "", lastQuestion: text, notice: null,
        context: action.retry ? state.context : history(state.context, "user", text),
        messages: action.retry ? state.messages : [...state.messages, { id: action.requestId, role: "user", text, revision: state.contextRevision }],
      };
    }
    case "response": {
      if (!matches(state, action.submission)) return state;
      const response = parseDisplayResponse(action.response);
      if (!response || !state.active || !acceptsResponse(action.submission, state.active, response)) {
        // A different response identity is stale, not a replacement answer.
        if (response) return state;
        return { ...state, active: null, status: "unavailable", notice: "The synthetic response could not be validated. Nothing was displayed." };
      }
      return {
        ...state, active: null, status: response.outcome === "unavailable" ? "unavailable" : "ready",
        context: history(state.context, "assistant", responseText(response)),
        messages: [...state.messages, { id: `${response.requestId}-answer`, role: "assistant", response, revision: state.contextRevision }],
      };
    }
    case "interrupt":
      return matches(state, action.submission)
        ? { ...state, active: null, status: "interrupted", notice: "Synthetic connection interrupted. Your question and context are retained." }
        : state;
    case "stop":
      return state.active ? { ...state, active: null, status: "stopped", notice: "Response stopped. No partial answer was displayed." } : state;
    case "edit": {
      const value = action.value?.trim() || null;
      if (value && value.length > 500) return state;
      return {
        ...invalidate(state, "Context updated. Previous answers are historical; send a question to reassess."),
        context: { ...setExplicitPreference(state.context, action.key, value), history: [] },
      };
    }
    case "list": {
      const text = action.text?.trim() || null;
      if (text && (text.length > ContextLimits.listCharacters ||
        text.split(/[\n;\u2022]+/).filter(line => line.trim()).length > ContextLimits.listEntries)) {
        return { ...state, notice: "The list exceeds the synthetic prototype limit. Use up to 100 entries and 12,000 characters." };
      }
      return {
        ...invalidate(state, text ? "Wine list replaced. Earlier list claims no longer apply." : "Wine list removed. Earlier list claims no longer apply."),
        context: replaceWineList(state.context, text),
      };
    }
    case "reset": {
      // Same synthetic identity retains disclosures; never implement safety policy here.
      const fresh = createAdvisorState(action.conversationId, state.accountId, state.workspaceId);
      return {
        ...fresh, feature: state.feature, contextRevision: state.contextRevision + 1,
        context: { ...fresh.context, risks: state.context.risks },
        notice: "Started over. Conversation details cleared; safety disclosures are not a resettable preference.",
      };
    }
    case "identity": {
      if (action.accountId === state.accountId && action.workspaceId === state.workspaceId) return state;
      return {
        ...createAdvisorState(action.conversationId, action.accountId, action.workspaceId),
        contextRevision: state.contextRevision + 1, notice: "Synthetic identity changed. Previous conversation and draft cleared.",
      };
    }
    case "feature": {
      const fresh = advisorReducer(state, { type: "reset", conversationId: action.conversationId });
      return { ...fresh, feature: action.feature, notice: "Synthetic starting feature changed. No real screen or account was accessed." };
    }
  }
}
