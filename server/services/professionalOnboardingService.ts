import type { ProfessionalDraftFields, ProfessionalIdentityRequest, ProfessionalOnboardingStatus, ProfessionalLifecycleEvent } from "@shared/professionalOnboarding";
import { completeProfessionalDraft } from "@shared/professionalOnboarding";

export class ProfessionalRequestError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export interface ProfessionalRequestTransaction {
  lockAccount(userId: string): Promise<void>;
  accountRole(userId: string): Promise<{ professionalRole: string | null } | null>;
  request(userId: string): Promise<ProfessionalIdentityRequest | null>;
  create(userId: string): Promise<ProfessionalIdentityRequest>;
  save(row: ProfessionalIdentityRequest): Promise<ProfessionalIdentityRequest>;
  event(row: ProfessionalIdentityRequest, kind: ProfessionalLifecycleEvent, changedFields: string[]): Promise<void>;
}
export interface ProfessionalRequestRepository {
  transaction<T>(work: (tx: ProfessionalRequestTransaction) => Promise<T>): Promise<T>;
}
const draftKeys = ["requestedRole", "professionalCategory", "credentialType", "credentialBody", "credentialNumber", "credentialYear"] as const;

/**
 * Deliberately has NO identity/entitlement/verification/legal/training writer.
 * The only mutation capabilities are this account's request and its ledger.
 */
export function createProfessionalOnboardingService(repository: ProfessionalRequestRepository) {
  async function operation(
    userId: string,
    action: "status" | "resume" | "update" | "submit",
    input?: ProfessionalDraftFields & { revision: number; requestId?: string },
  ): Promise<ProfessionalOnboardingStatus> {
    return repository.transaction(async tx => {
      await tx.lockAccount(userId);
      const account = await tx.accountRole(userId);
      if (!account) throw new ProfessionalRequestError(401, "AUTH_REQUIRED", "Account not found.");
      let row = await tx.request(userId);
      if (!row && action === "resume") {
        row = await tx.create(userId);
        await tx.event(row, "draft_created", []);
      }
      if (row?.state === "needs_correction" && action === "resume") {
        row = await tx.save({ ...row, state: "draft", submittedAt: null, revision: row.revision + 1 });
        await tx.event(row, "correction_resumed", ["state"]);
      }
      if (action === "update" || action === "submit") {
        if (!row || (input?.requestId && row.id !== input.requestId)) {
          throw new ProfessionalRequestError(404, "REQUEST_NOT_FOUND", "Your onboarding request was not found.");
        }
        if (row.state !== "draft") {
          if (action === "update") throw new ProfessionalRequestError(409, "REQUEST_ALREADY_SUBMITTED", "This request is read-only. Resume a request needing correction before editing.");
          return { accountId: userId, currentAuthorizedRole: account.professionalRole, request: row, decisionAvailable: false };
        }
        if (input?.revision !== row.revision) {
          throw new ProfessionalRequestError(409, "DRAFT_VERSION_CONFLICT", "This draft changed on another page or device. Reload to resume its current version.");
        }
        if (action === "submit") {
          const validation = completeProfessionalDraft.safeParse(row);
          if (!validation.success) throw new ProfessionalRequestError(400, "REQUEST_INCOMPLETE", validation.error.issues.map(issue => issue.message).join(" "));
          row = await tx.save({ ...row, state: "submitted", revision: row.revision + 1, submittedAt: new Date().toISOString() });
          await tx.event(row, "request_submitted", []);
        } else {
          const patch: ProfessionalDraftFields = {};
          const changed: string[] = [];
          for (const key of draftKeys) {
            if (input && Object.prototype.hasOwnProperty.call(input, key)) {
              const value = input[key] === "" ? null : input[key]!;
              if (row[key] !== value) { patch[key] = value as never; changed.push(key); }
            }
          }
          if (changed.length) {
            row = await tx.save({ ...row, ...patch, revision: row.revision + 1 });
            await tx.event(row, "draft_updated", changed);
          }
        }
      }
      return { accountId: userId, currentAuthorizedRole: account.professionalRole, request: row, decisionAvailable: false };
    });
  }
  return {
    status: (id: string) => operation(id, "status"),
    resume: (id: string) => operation(id, "resume"),
    update: (id: string, input: ProfessionalDraftFields & { revision: number; requestId?: string }) => operation(id, "update", input),
    submit: (id: string, input: { revision: number; requestId?: string }) => operation(id, "submit", input),
  };
}
