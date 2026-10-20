import { z } from "zod";
import { AdvisorResponse, ConversationContext } from "../contracts";

const id = z.string().min(1).max(120);
export const TurnSubmission = z.object({
  sessionId: id,
  conversationId: id,
  requestId: id,
  expectedRevision: z.number().int().nonnegative(),
  message: z.string().trim().min(1).max(4000),
  context: ConversationContext,
}).strict();
export type TurnSubmission = z.infer<typeof TurnSubmission>;
export const SessionCommand = z.object({ sessionId: id, conversationId: id }).strict();
export const CancelCommand = SessionCommand.extend({ requestId: id }).strict();
export const ContextAcknowledgement = z.object({
  sessionId: id, conversationId: id,
  revision: z.number().int().nonnegative(),
  retainedRiskCount: z.number().int().min(0).max(20),
  unresolvedInput: z.boolean(),
  continuity: z.literal("process_local_session"),
  expiresAt: z.number().finite(),
}).strict();
export type ContextAcknowledgement = z.infer<typeof ContextAcknowledgement>;
export const TransportErrorCode = z.enum([
  "DISABLED", "UNAUTHORIZED", "FORBIDDEN", "INVALID_REQUEST", "SESSION_UNAVAILABLE",
  "SESSION_CAPACITY", "CONTEXT_CONFLICT", "REPLAY", "SESSION_LIMIT",
  "RATE_LIMITED", "IN_FLIGHT", "CANCELLED", "DEADLINE_EXCEEDED",
  "ATTEMPT_LIMIT", "AUTHORITY_UNAVAILABLE", "VALIDATION_FAILED", "PROVIDER_UNAVAILABLE",
]);
export type TransportErrorCode = z.infer<typeof TransportErrorCode>;
export const TurnResult = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("accepted"), acknowledgement: ContextAcknowledgement,
    response: AdvisorResponse,
  }).strict(),
  z.object({
    status: z.literal("error"), code: TransportErrorCode,
    acknowledgement: ContextAcknowledgement.nullable(),
  }).strict(),
]);
export type TurnResult = z.infer<typeof TurnResult>;

/** Proposed mappings for the disconnected transport, not changes to an HTTP route. */
export const ERROR_HTTP_STATUS: Record<TransportErrorCode, number> = {
  DISABLED: 404, UNAUTHORIZED: 401, FORBIDDEN: 403, INVALID_REQUEST: 400,
  SESSION_UNAVAILABLE: 409, SESSION_CAPACITY: 503, CONTEXT_CONFLICT: 409,
  REPLAY: 409, SESSION_LIMIT: 409, RATE_LIMITED: 429, IN_FLIGHT: 409,
  CANCELLED: 409, DEADLINE_EXCEEDED: 504, ATTEMPT_LIMIT: 503,
  AUTHORITY_UNAVAILABLE: 503, VALIDATION_FAILED: 503, PROVIDER_UNAVAILABLE: 503,
};
