import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/apiRequest";
import { ANTI_INFLAMMATORY_SUPPORT_DEVELOPMENT_ENABLED } from "@shared/personalFoodSupportFreeze";

/** Personal support is neither a diagnosis nor authority for another person. */
export function usePersonalAntiInflammatorySupport(input: {
  development: boolean;
  actorUserId?: string;
  subjectUserId?: string;
  householdProfileId?: string;
}) {
  const eligible = input.development && ANTI_INFLAMMATORY_SUPPORT_DEVELOPMENT_ENABLED &&
    !!input.actorUserId && input.actorUserId === input.subjectUserId && !input.householdProfileId;
  const client = useQueryClient();
  const queryKey = useMemo(() => [
    "personal-anti-inflammatory-support", input.actorUserId, input.subjectUserId, input.householdProfileId,
  ], [input.actorUserId, input.subjectUserId, input.householdProfileId]);
  const query = useQuery({
    queryKey, enabled: eligible, staleTime: 0, retry: false,
    queryFn: async () => {
      const result = await apiRequest("/api/health-context/support/anti_inflammatory", { cache: "no-store" });
      if (typeof result?.enabled !== "boolean") throw new Error("Support state could not be verified.");
      return { enabled: result.enabled as boolean };
    },
  });
  useEffect(() => {
    if (!eligible) return;
    const refresh = () => { void client.invalidateQueries({ queryKey }); };
    window.addEventListener("mpm:conditionsUpdated", refresh);
    return () => window.removeEventListener("mpm:conditionsUpdated", refresh);
  }, [eligible, client, queryKey]);
  return {
    enabled: eligible && query.data?.enabled === true,
    available: eligible && query.isSuccess,
    isLoading: eligible && query.isPending,
    error: eligible ? query.error : null,
  };
}
