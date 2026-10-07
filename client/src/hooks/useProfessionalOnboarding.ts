import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { professionalRequestsEnabled } from "@/lib/professionalOnboarding";
import type { ProfessionalDraftFields, ProfessionalOnboardingStatus } from "@shared/professionalOnboarding";

export function useProfessionalOnboarding(accountId?: string) {
  const cache = useQueryClient();
  const key = ["professional-onboarding", accountId];
  const query = useQuery<ProfessionalOnboardingStatus>({
    queryKey: key,
    enabled: !!accountId && professionalRequestsEnabled,
    queryFn: async () => {
      const status = await apiRequest<ProfessionalOnboardingStatus>("/api/professional-onboarding");
      if (status.accountId !== accountId) throw new Error("Your account changed. Please reload.");
      return status;
    },
    staleTime: 0,
    retry: false,
  });
  async function mutate(path: string, method: string, body: object) {
    if (!accountId) throw new Error("Sign in to save a professional request.");
    const status = await apiRequest<ProfessionalOnboardingStatus>("/api/professional-onboarding" + path, {
      method, body: JSON.stringify(body),
    });
    if (status.accountId !== accountId) throw new Error("Your account changed. Please reload.");
    cache.setQueryData(key, status);
    return status;
  }
  return {
    ...query,
    resume: () => mutate("/draft", "POST", {}),
    save: (fields: ProfessionalDraftFields, revision: number, requestId: string) => mutate("/draft", "PATCH", { ...fields, revision, requestId }),
    submit: (revision: number, requestId: string) => mutate("/submit", "POST", { revision, requestId }),
  };
}
