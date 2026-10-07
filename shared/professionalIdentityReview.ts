import type { ProfessionalIdentityRequest, ProfessionalReadiness } from "./professionalOnboarding";
export interface ProfessionalIdentityReviewDetail {
  request: ProfessionalIdentityRequest;
  currentAuthorizedRole: string | null;
  currentProfessionalCategory: string | null;
  reviewedStateHash: string;
  readiness: ProfessionalReadiness | null;
  readinessError?: string;
  events: { id: string; actorUserId: string; eventType: string; requestRevision: number; metadata: Record<string, unknown>; createdAt: string }[];
}
