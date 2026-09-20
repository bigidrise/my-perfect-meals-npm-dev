import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import type { MyPerfectMenuBuilderContext } from "@shared/builderNamespaces";

export function useMyPerfectMenuBuilder(subjectUserId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery<{ builder: MyPerfectMenuBuilderContext }>({
    queryKey: ["my-perfect-menu-effective-builder", user?.id, subjectUserId ?? null],
    queryFn: async () => {
      const params = subjectUserId ? `?subjectUserId=${encodeURIComponent(subjectUserId)}` : "";
      const response = await fetch(apiUrl(`/api/my-perfect-menu/effective-builder${params}`), {
        credentials: "include",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Unable to resolve your Menu Builder.");
      return response.json();
    },
    enabled: Boolean(user?.id),
    staleTime: 60_000,
  });

  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({
        queryKey: ["my-perfect-menu-effective-builder", user?.id],
      });
    };
    window.addEventListener("mpm:builderUpdated", refresh);
    return () => window.removeEventListener("mpm:builderUpdated", refresh);
  }, [queryClient, user?.id]);

  return query;
}