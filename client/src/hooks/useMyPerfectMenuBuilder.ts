import { useQuery } from "@tanstack/react-query";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import type { MyPerfectMenuBuilderContext } from "@shared/builderNamespaces";

export function useMyPerfectMenuBuilder(subjectUserId?: string) {
  const { user } = useAuth();
  return useQuery<{ builder: MyPerfectMenuBuilderContext }>({
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
}