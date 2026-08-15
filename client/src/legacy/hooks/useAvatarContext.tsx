import { useQuery } from '@tanstack/react-query';
import { apiUrl } from '@/lib/resolveApiBase';

interface AvatarContextData {
  user: {
    id: string;
    email: string;
    timezone: string;
    dietaryRestrictions: string[];
    healthConditions: string[];
    allergies: string[];
    fitnessGoal: string;
  };
  profile: Record<string, any>;
  shoppingList: {
    items: Array<{ name: string; quantity?: number; unit?: string }>;
  };
  today: {
    date: string;
    meals?: Array<{ slot: string; title: string; recipe?: any }>;
    instances?: Array<{ slot: string; title: string; recipe?: any }>;
  };
}

async function fetchAvatarContext(): Promise<AvatarContextData> {
  const response = await fetch(apiUrl('/api/avatar/context'));
  if (!response.ok) {
    throw new Error('Failed to fetch avatar context');
  }
  return response.json();
}

export function useAvatarContext() {
  return useQuery({
    queryKey: ['avatar-context'],
    queryFn: fetchAvatarContext,
    staleTime: 60000, // 1 minute
    retry: 1,
  });
}