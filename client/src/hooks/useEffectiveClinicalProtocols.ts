import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export interface EffectiveClinicalProtocolResponse {
  subjectUserId: string;
  protocols: string[];
}
const NO_PROTOCOLS: string[] = [];

/** Subject-partitioned, status-only query. No polling and no raw medical records. */
export function useEffectiveClinicalProtocols(subjectUserId?: string | null) {
  const result = useQuery<EffectiveClinicalProtocolResponse>({
    queryKey: ["/api/clinical-protocols", subjectUserId],
    enabled: !!subjectUserId,
    queryFn: () => apiRequest(`/api/clinical-protocols/${encodeURIComponent(subjectUserId!)}`),
    staleTime: 0,
    refetchOnWindowFocus: true,
    placeholderData: undefined,
    retry: false,
  });
  return {
    ...result,
    // Never carry a prior subject's data or unverified macro flags into a new view.
    protocols: result.data && result.data.subjectUserId === subjectUserId && !result.isError
      ? result.data.protocols : NO_PROTOCOLS,
  };
}

export function refreshClinicalProtocols() {
  void queryClient.invalidateQueries({ queryKey: ["/api/clinical-protocols"] });
}
