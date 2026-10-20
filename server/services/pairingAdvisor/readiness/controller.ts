import {
  AdvisorResponse, ContextLimits, type AdvisorRequest, type PolicyDecision,
} from "../../../../shared/pairingAdvisor/contracts";
import {
  CancelCommand, SessionCommand, TurnSubmission, TurnResult,
  type ContextAcknowledgement,
} from "../../../../shared/pairingAdvisor/readiness/transport";
import { decideAdvisorPolicy, developmentAdvisorAllowed } from "../policy";
import { CLARIFICATION_QUESTIONS, RESTRICTION_MESSAGES, validateAdvisorResponse } from "../validation";
import { createAdvisorRequestLimits } from "../requestLimits";
import { createStrictOwnerAuthority, type StrictOwnerPort } from "./authority";
import type { DeterministicValidation } from "./deterministic";
import { prepareEvidence, validateCandidate } from "./evidence";
import {
  OFFLINE_EXECUTION_LIMITS, ReadinessFailure, TurnExecution, type ExecutionLimits,
} from "./execution";
import { immutableCopy } from "./immutable";
import { createMockProviderAdapters, type MockProviderPort } from "./providers";
import { AdvisorSessions, type AuthenticatedOwner, type SessionState } from "./sessions";

export type OfflineReadinessOptions = {
  mode: "offline_readiness_only";
  getRuntime: () => { nodeEnv?: string; deploymentMarker?: string };
  authority: StrictOwnerPort;
  deterministic: DeterministicValidation;
  provider: MockProviderPort;
  limits?: ExecutionLimits;
  now?: () => number;
};
type ActiveTurn = { sessionId: string; requestId: string; execution: TurnExecution };

/**
 * Disconnected transport/controller for offline A–C verification.
 * No Express mount, application import, provider client or default authority loader.
 */
export function createOfflineReadinessController(options: OfflineReadinessOptions) {
  const now = options.now ?? Date.now;
  const sessions = new AdvisorSessions(now);
  const requestLimits = createAdvisorRequestLimits(now);
  const resolveAuthority = createStrictOwnerAuthority(options.authority);
  const active = new Map<string, ActiveTurn>();
  function authorize(owner: AuthenticatedOwner): void {
    if (options.mode !== "offline_readiness_only"
      || !developmentAdvisorAllowed(options.getRuntime())) throw new ReadinessFailure("DISABLED");
    if (!owner?.accountId || !owner.authSessionId) throw new ReadinessFailure("UNAUTHORIZED");
    if (owner.activeAccess !== true || owner.proAccess !== true) throw new ReadinessFailure("FORBIDDEN");
  }
  function current(owner: AuthenticatedOwner, state: SessionState, request: AdvisorRequest): void {
    authorize(owner);
    const found = sessions.get(owner, state.id);
    if (found !== state || state.conversationId !== request.conversationId
      || state.revision !== request.contextRevision) throw new ReadinessFailure("CONTEXT_CONFLICT");
  }
  return {
    open(owner: AuthenticatedOwner): ContextAcknowledgement {
      authorize(owner); return sessions.open(owner);
    },
    resetHistory(owner: AuthenticatedOwner, raw: unknown): ContextAcknowledgement {
      authorize(owner);
      const command = SessionCommand.safeParse(raw);
      if (!command.success) throw new ReadinessFailure("INVALID_REQUEST");
      const state = sessions.get(owner, command.data.sessionId);
      if (state.conversationId !== command.data.conversationId) throw new ReadinessFailure("CONTEXT_CONFLICT");
      const running = active.get(owner.accountId);
      if (running?.sessionId === state.id) running.execution.stop("CANCELLED");
      return sessions.reset(state);
    },
    cancel(owner: AuthenticatedOwner, raw: unknown): { status: "cancelled" | "not_in_flight" } {
      authorize(owner);
      const command = CancelCommand.safeParse(raw);
      if (!command.success) throw new ReadinessFailure("INVALID_REQUEST");
      const state = sessions.get(owner, command.data.sessionId);
      if (state.conversationId !== command.data.conversationId) throw new ReadinessFailure("CONTEXT_CONFLICT");
      const running = active.get(owner.accountId);
      if (!running || running.sessionId !== state.id || running.requestId !== command.data.requestId) {
        return { status: "not_in_flight" };
      }
      running.execution.stop("CANCELLED");
      return { status: "cancelled" };
    },
    async submit(owner: AuthenticatedOwner, raw: unknown, signal?: AbortSignal): Promise<TurnResult> {
      let state: SessionState | undefined;
      let execution: TurnExecution | undefined;
      let release: (() => void) | undefined;
      try {
        authorize(owner);
        const lease = requestLimits.acquire(owner.accountId);
        if (!lease.accepted) throw new ReadinessFailure(lease.reason);
        release = lease.release;
        // Bound before parsing, cloning, storing or interpreting. Never echo parser/provider errors.
        if (Buffer.byteLength(JSON.stringify(raw) ?? "", "utf8") > ContextLimits.requestBytes) {
          throw new ReadinessFailure("INVALID_REQUEST");
        }
        const parsed = TurnSubmission.safeParse(raw);
        if (!parsed.success) throw new ReadinessFailure("INVALID_REQUEST");
        state = sessions.get(owner, parsed.data.sessionId);
        const accepted = sessions.accept(state, parsed.data);
        execution = new TurnExecution(options.limits ?? OFFLINE_EXECUTION_LIMITS, now, signal);
        active.set(owner.accountId, { sessionId: state.id, requestId: parsed.data.requestId, execution });
        const originalRequest = accepted.request;
        const providers = createMockProviderAdapters(options.provider, execution);
        // Resolve authoritative owner context afresh before any model attempt.
        const authority = await execution.wait(abort => resolveAuthority(owner.accountId, abort));
        current(owner, state, originalRequest);
        const assessment = await providers.interpret(originalRequest);
        current(owner, state, originalRequest);
        sessions.interpreted(state, assessment, accepted.priorUnresolved);
        const request = immutableCopy({ ...originalRequest, context: state.context });
        let decision = decideAdvisorPolicy({
          enabled: true, access: "authorized", accountId: owner.accountId,
          authority: authority.authority, assessment, context: request.context,
        });
        if (decision.kind === "generate_recommendation" && state.unresolvedInput) {
          decision = { kind: "restricted", reason: "NEW_RISK_UNRESOLVED", allowEducation: decision.includeEducation };
        }
        if (decision.kind === "generate_recommendation") {
          const safety = await execution.wait(async () => options.deterministic.checkInput(request, authority));
          if (safety === "unavailable") throw new ReadinessFailure("AUTHORITY_UNAVAILABLE");
          if (safety !== "pass") decision = {
            kind: "restricted", reason: "ACTIVE_SAFETY_RESTRICTION", allowEducation: decision.includeEducation,
          };
        }
        const policy: PolicyDecision = immutableCopy(decision);
        const evidence = prepareEvidence(request);
        const meta = {
          version: 1 as const, requestId: request.requestId,
          conversationId: request.conversationId, contextRevision: request.contextRevision,
        };
        let rawCandidate: unknown;
        if (policy.kind === "clarification") {
          rawCandidate = { ...meta, outcome: "clarification", reason: policy.reason, question: CLARIFICATION_QUESTIONS[policy.reason] };
        } else if (policy.kind === "restricted" && !policy.allowEducation) {
          rawCandidate = { ...meta, outcome: "restricted", reason: policy.reason, message: RESTRICTION_MESSAGES[policy.reason], education: null };
        } else if (policy.kind === "generate_education" || policy.kind === "generate_recommendation"
          || (policy.kind === "restricted" && policy.allowEducation)) {
          const generated = await providers.generate({
            request, policy, evidence,
            ownerConstraints: policy.kind === "generate_recommendation" ? authority.constraints : null,
          });
          if (!generated || typeof generated !== "object" || Array.isArray(generated)) {
            throw new ReadinessFailure("VALIDATION_FAILED");
          }
          const parsedResponse = AdvisorResponse.safeParse({ ...generated, ...meta });
          if (!parsedResponse.success) throw new ReadinessFailure("VALIDATION_FAILED");
          if (policy.kind === "restricted") {
            if (parsedResponse.data.outcome !== "education") throw new ReadinessFailure("VALIDATION_FAILED");
            rawCandidate = {
              ...meta, outcome: "restricted", reason: policy.reason,
              message: RESTRICTION_MESSAGES[policy.reason], education: parsedResponse.data.education,
            };
          } else rawCandidate = parsedResponse.data;
        } else throw new ReadinessFailure("AUTHORITY_UNAVAILABLE");
        const candidate = validateCandidate(rawCandidate, policy, evidence);
        const exactPayload = JSON.stringify(candidate);
        if (candidate.outcome === "recommendation") {
          const safe = await execution.wait(async () => options.deterministic.scanFinal(candidate, authority));
          if (safe !== true) throw new ReadinessFailure("VALIDATION_FAILED");
        }
        const generatedContent = candidate.outcome === "education" || candidate.outcome === "recommendation"
          || (candidate.outcome === "restricted" && candidate.education !== null);
        const review = generatedContent ? await providers.review({
          originalRequest, policy, evidence, candidate, exactPayload,
        }) : null;
        const final = validateAdvisorResponse(candidate, policy, evidence, review);
        execution.assertActive();
        current(owner, state, request);
        if (final.status !== "accepted" || JSON.stringify(candidate) !== exactPayload
          || JSON.stringify(final.response) !== exactPayload) throw new ReadinessFailure("VALIDATION_FAILED");
        return immutableCopy(TurnResult.parse({
          status: "accepted", acknowledgement: sessions.ack(state), response: final.response,
        }));
      } catch (error) {
        const code = error instanceof ReadinessFailure ? error.code : "PROVIDER_UNAVAILABLE";
        // An unauthorized account must never receive another owner's acknowledgement.
        let acknowledgement: ContextAcknowledgement | null = null;
        if (state) {
          try { authorize(owner); sessions.get(owner, state.id); acknowledgement = sessions.ack(state); } catch { /* no session disclosure */ }
        }
        return { status: "error", code, acknowledgement };
      } finally {
        if (execution) {
          execution.close();
          const finished = execution;
          const releaseLease = release;
          const cleanup = () => {
            if (active.get(owner.accountId)?.execution === finished) active.delete(owner.accountId);
            releaseLease?.();
          };
          // An aborted provider may ignore AbortSignal. Do not start overlapping physical
          // work for the account until the outstanding operation actually settles.
          if (execution.hasPendingWork) void execution.whenDrained().then(cleanup);
          else cleanup();
        } else {
          release?.();
        }
      }
    },
  };
}
