import { AdvisorRequest, ContextLimits, type AdvisorResponse, type ConversationContext } from "./contracts";

export function emptyConversation(): ConversationContext {
  return {
    meal: null, preparation: null, sauce: null, budget: null, currency: null,
    location: null, taste: null, wineList: null, risks: [], history: [],
  };
}

/** Pure boundary only; no browser state, persistence, profile writes, or network access. */
export function parseAdvisorRequest(raw: unknown): AdvisorRequest {
  const serialized = JSON.stringify(raw);
  if (!serialized || new TextEncoder().encode(serialized).length > ContextLimits.requestBytes) {
    throw new Error("Advisor request exceeds the byte limit or is not JSON");
  }
  const parsed = AdvisorRequest.parse(raw);
  if (parsed.context.wineList) {
    // Membership parsing is performed separately by the server-owned evidence adapter.
    const lines = parsed.context.wineList.text.split(/[\n;\u2022]+/).filter(line => line.trim());
    if (lines.length > ContextLimits.listEntries) throw new Error("Too many supplied-list entries");
  }
  return parsed;
}

export type PreferenceKey = "meal" | "preparation" | "sauce" | "budget" | "currency" | "location" | "taste";

export function setExplicitPreference(
  context: ConversationContext, key: PreferenceKey, value: string | null,
): ConversationContext {
  return { ...context, [key]: value === null ? null : { source: "explicit_user", value } };
}

export function replaceWineList(context: ConversationContext, text: string | null): ConversationContext {
  // Clearing history prevents earlier index-based references from silently resolving to a new list.
  return {
    ...context, history: [],
    wineList: text === null ? null : {
      source: "explicit_user", revision: (context.wineList?.revision ?? 0) + 1, text,
    },
  };
}

export function retainRiskDisclosures(
  context: ConversationContext, risks: ConversationContext["risks"],
): ConversationContext {
  const byDescription = new Map(context.risks.map(risk => [risk.description, risk]));
  for (const risk of risks) byDescription.set(risk.description, risk);
  // Never silently discard old risks to fit the bound.
  if (byDescription.size > 20) throw new Error("Risk context requires a new suitability review");
  return { ...context, risks: [...byDescription.values()] };
}

export type ActiveSubmission = {
  accountId: string; workspaceId: string | null; requestId: string;
  conversationId: string; contextRevision: number;
};

export function acceptsResponse(
  pending: ActiveSubmission, active: ActiveSubmission, response: AdvisorResponse,
): boolean {
  return pending.accountId === active.accountId && pending.workspaceId === active.workspaceId
    && pending.requestId === active.requestId && pending.conversationId === active.conversationId
    && pending.contextRevision === active.contextRevision
    && response.requestId === active.requestId && response.conversationId === active.conversationId
    && response.contextRevision === active.contextRevision;
}
