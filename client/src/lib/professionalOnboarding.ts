import { apiRequest } from "./queryClient";
import { professionalDraftFields, type ProfessionalDraftFields, type ProfessionalOnboardingStatus } from "@shared/professionalOnboarding";
import { resolveCareTeamRequestedRole } from "@shared/professionalRoles";
import { clearProCareSignupData } from "./auth";

export const professionalRequestsEnabled = import.meta.env.DEV;

// Anonymous input buffer only. Never hydrate an authenticated draft from this
// automatically: it may belong to a previous person using the same browser.
export function readLocalProfessionalDraft(): ProfessionalDraftFields | null {
  const requestedRole = resolveCareTeamRequestedRole(localStorage.getItem("procare_role"));
  if (!requestedRole) return null;
  const parsed = professionalDraftFields.safeParse({
    requestedRole,
    professionalCategory: localStorage.getItem("procare_category"),
    credentialType: localStorage.getItem("procare_credential_type"),
    credentialBody: localStorage.getItem("procare_credential_body"),
    credentialNumber: localStorage.getItem("procare_credential_number"),
    credentialYear: localStorage.getItem("procare_credential_year"),
  });
  return parsed.success ? parsed.data : null;
}

export async function saveNewAccountProfessionalDraft(
  accountId: string,
  fields: ProfessionalDraftFields,
): Promise<ProfessionalOnboardingStatus> {
  const resumed = await apiRequest<ProfessionalOnboardingStatus>("/api/professional-onboarding/draft", { method: "POST", body: "{}" });
  if (resumed.accountId !== accountId) throw new Error("Your account changed. Please reload before saving professional information.");
  if (!resumed.request || resumed.request.state === "submitted") return resumed;
  const saved = await apiRequest<ProfessionalOnboardingStatus>("/api/professional-onboarding/draft", {
    method: "PATCH",
    body: JSON.stringify({ ...fields, revision: resumed.request.revision, requestId: resumed.request.id }),
  });
  if (saved.accountId !== accountId) throw new Error("Your account changed. Please reload.");
  clearProCareSignupData();
  return saved;
}
