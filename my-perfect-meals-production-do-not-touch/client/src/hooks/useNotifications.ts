import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, put } from "@/lib/api";

export type UserNotificationPrefs = {
  enabled: boolean;
  defaultLeadTimeMinutes: number;
  channels: string[]; // e.g., ["push","email"] (future use)
  quietHours?: { start: string; end: string };
};

export function useGetUserNotifications(userId: string) {
  return useQuery({
    queryKey: ["userPrefs", userId, "notifications"],
    queryFn: async () => {
      const json = await get<any>(`/api/users/${userId}/preferences`);
      return (json.notifications || {
        enabled: false,
        defaultLeadTimeMinutes: 30,
        channels: [],
      }) as UserNotificationPrefs;
    },
  });
}

export function useUpdateUserNotifications(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<UserNotificationPrefs>) =>
      put(`/api/users/${userId}/preferences`, { notifications: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["userPrefs", userId, "notifications"] });
    },
  });
}

export function useUpdateMealNotifications(mealId: string) {
  return useMutation({
    mutationFn: (payload: { enabled: boolean; leadTimeMinutes?: number | null }) =>
      put(`/api/meals/${mealId}/notifications`, payload),
  });
}