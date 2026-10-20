import { randomUUID } from "node:crypto";
import type { AdvisorRequest, ConversationContext, IntentAssessment } from "../../../../shared/pairingAdvisor/contracts";
import { emptyConversation } from "../../../../shared/pairingAdvisor/conversation";
import type { ContextAcknowledgement, TurnSubmission } from "../../../../shared/pairingAdvisor/readiness/transport";
import { immutableCopy } from "./immutable";
import { ReadinessFailure } from "./execution";

/** Obtained from future authenticated middleware, never parsed from the request body. */
export type AuthenticatedOwner = {
  accountId: string; authSessionId: string; activeAccess: boolean; proAccess: boolean;
};
export type SessionState = {
  id: string; accountId: string; authSessionId: string; conversationId: string;
  revision: number; expiresAt: number; context: ConversationContext;
  unresolvedInput: boolean; seenRequests: Set<string>; sealed: boolean;
};
export const SESSION_BOUNDS = Object.freeze({
  ttlMilliseconds: 30 * 60 * 1000, sessions: 100, requests: 128, risks: 20,
});

/** Memory-only. Expiry never silently creates a replacement session or discards risk in-place. */
export class AdvisorSessions {
  private readonly entries = new Map<string, SessionState>();
  constructor(private readonly now: () => number = Date.now) {}
  open(owner: AuthenticatedOwner): ContextAcknowledgement {
    for (const [key, entry] of this.entries) if (entry.expiresAt <= this.now()) this.entries.delete(key);
    // One supported session per authenticated login: opening again cannot clear its risks.
    const current = [...this.entries.values()].find(s =>
      s.accountId === owner.accountId && s.authSessionId === owner.authSessionId);
    if (current) return this.ack(current);
    if (this.entries.size >= SESSION_BOUNDS.sessions) throw new ReadinessFailure("SESSION_CAPACITY");
    const entry: SessionState = {
      id: randomUUID(), conversationId: randomUUID(),
      accountId: owner.accountId, authSessionId: owner.authSessionId,
      revision: 0, expiresAt: this.now() + SESSION_BOUNDS.ttlMilliseconds,
      context: emptyConversation(), unresolvedInput: false, seenRequests: new Set(), sealed: false,
    };
    this.entries.set(entry.id, entry);
    return this.ack(entry);
  }
  get(owner: AuthenticatedOwner, sessionId: string): SessionState {
    const state = this.entries.get(sessionId);
    if (!state || state.accountId !== owner.accountId || state.authSessionId !== owner.authSessionId
      || state.expiresAt <= this.now()) throw new ReadinessFailure("SESSION_UNAVAILABLE");
    if (state.sealed) throw new ReadinessFailure("SESSION_LIMIT");
    return state;
  }
  ack(state: SessionState): ContextAcknowledgement {
    return {
      sessionId: state.id, conversationId: state.conversationId, revision: state.revision,
      expiresAt: state.expiresAt, retainedRiskCount: state.context.risks.length,
      unresolvedInput: state.unresolvedInput, continuity: "process_local_session",
    };
  }
  private retain(state: SessionState, risks: ConversationContext["risks"]): void {
    const merged = [...state.context.risks];
    for (const risk of risks) {
      if (!merged.some(r => r.description === risk.description)) merged.push({ ...risk });
    }
    if (merged.length > SESSION_BOUNDS.risks) {
      state.sealed = true;
      throw new ReadinessFailure("SESSION_LIMIT");
    }
    state.context = { ...state.context, risks: merged };
  }
  accept(state: SessionState, turn: TurnSubmission): {
    request: AdvisorRequest; priorUnresolved: boolean;
  } {
    if (state.conversationId !== turn.conversationId || state.revision !== turn.expectedRevision) {
      throw new ReadinessFailure("CONTEXT_CONFLICT");
    }
    if (state.seenRequests.has(turn.requestId)) throw new ReadinessFailure("REPLAY");
    if (state.seenRequests.size >= SESSION_BOUNDS.requests) {
      state.sealed = true; throw new ReadinessFailure("SESSION_LIMIT");
    }
    state.seenRequests.add(turn.requestId);
    this.retain(state, turn.context.risks);
    // Preferences/history/list may be replaced or removed, but retained risks may not.
    state.context = immutableCopy({ ...turn.context, risks: state.context.risks });
    const priorUnresolved = state.unresolvedInput;
    state.unresolvedInput = true; // Failure before interpretation cannot silently clear a disclosure.
    state.revision++;
    return {
      priorUnresolved,
      request: immutableCopy({
        requestId: turn.requestId, conversationId: state.conversationId,
        contextRevision: state.revision, message: turn.message, context: state.context,
      }),
    };
  }
  interpreted(state: SessionState, assessment: IntentAssessment, priorUnresolved: boolean): void {
    this.retain(state, assessment.newRisks);
    state.unresolvedInput = priorUnresolved;
  }
  reset(state: SessionState): ContextAcknowledgement {
    state.conversationId = randomUUID();
    state.revision++;
    state.context = { ...emptyConversation(), risks: state.context.risks };
    return this.ack(state);
  }
}
