import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { z } from 'zod';
import { get, put } from '@/lib/api';

// User preferences schema
const UserPreferencesSchema = z.object({
  // Basic info
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  age: z.number().optional(),
  height: z.number().optional(),
  weight: z.number().optional(),
  activityLevel: z.string().optional(),
  fitnessGoal: z.string().optional(),
  
  // Health info
  healthConditions: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  
  // Food preferences
  likedFoods: z.array(z.string()).optional(),
  avoidedFoods: z.array(z.string()).optional(),
  dislikedFoods: z.array(z.string()).optional(),
  
  // Notification preferences
  phone: z.string().optional(),
  smsOptIn: z.boolean().optional(),
  timezone: z.string().optional(),
  
  // Other preferences
  autoGenerateWeeklyPlan: z.boolean().optional(),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

// Get user preferences
export function useGetPreferences(userId: string) {
  return useQuery({
    queryKey: ['/api/users', userId, 'preferences'],
    queryFn: async (): Promise<UserPreferences> => {
      try {
        return await get<UserPreferences>(`/api/users/${userId}/preferences`);
      } catch (error: any) {
        if (error.message?.includes('404')) {
          return {};
        }
        throw new Error('Failed to fetch user preferences');
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Update user preferences (partial updates)
export function useUpdatePreferences(userId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (preferences: Partial<UserPreferences>) => {
      return put<UserPreferences>(`/api/users/${userId}/preferences`, preferences);
    },
    onSuccess: () => {
      // Invalidate and refetch preferences
      queryClient.invalidateQueries({
        queryKey: ['/api/users', userId, 'preferences'],
      });
    },
  });
}

// Batch save multiple preference fields
export function useBatchSavePreferences(userId: string) {
  const updateMutation = useUpdatePreferences(userId);
  
  const batchSave = async (preferences: Partial<UserPreferences>) => {
    try {
      await updateMutation.mutateAsync(preferences);
      return { success: true };
    } catch (error) {
      console.error('Failed to save preferences:', error);
      return { success: false, error };
    }
  };
  
  return {
    batchSave,
    isLoading: updateMutation.isPending,
    error: updateMutation.error,
  };
}