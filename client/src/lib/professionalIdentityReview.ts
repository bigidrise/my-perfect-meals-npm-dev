import { apiRequest } from "./queryClient";
import type { ProfessionalIdentityRequest, ProfessionalIdentityDecision, ProfessionalReadiness } from "@shared/professionalOnboarding";
import type { ProfessionalIdentityReviewDetail } from "@shared/professionalIdentityReview";

export async function getProfessionalReviewQueue(): Promise<{ requests: ProfessionalIdentityRequest[] }> {
  return apiRequest("/api/admin/professional-requests");
}
export async function getProfessionalReviewDetail(id: string): Promise<ProfessionalIdentityReviewDetail> {
  return apiRequest(`/api/admin/professional-requests/${encodeURIComponent(id)}`);
}
export async function saveProfessionalIdentityDecision(id: string, decision: ProfessionalIdentityDecision): Promise<{
  request: ProfessionalIdentityRequest; decisionSaved: true; reauthenticationRequired: boolean;
  currentAuthorizedRole: string | null; readiness: ProfessionalReadiness | null; readinessError?: string;
}> {
  return apiRequest(`/api/admin/professional-requests/${encodeURIComponent(id)}/decision`, {
    method: "POST", body: JSON.stringify(decision),
  });
}
export async function getOwnProfessionalReadiness(): Promise<ProfessionalReadiness> {
  return apiRequest("/api/professional-onboarding/readiness");
}
