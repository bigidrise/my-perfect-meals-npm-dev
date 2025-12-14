import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiUrl } from '@/lib/resolveApiBase';

export interface ScoreSubmission {
  userId: string;
  userAlias: string;
  score: number;
  durationMs?: number;
  meta?: any;
}

export async function submitScore(gameId: string, submission: ScoreSubmission) {
  const res = await fetch(apiUrl(`/api/games/${gameId}/score`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(submission),
  });
  
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Score submit failed");
  }
  
  return res.json();
}

export function useSubmitScore(gameId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (submission: ScoreSubmission) => submitScore(gameId, submission),
    onSuccess: () => {
      // Invalidate leaderboard queries for this game
      queryClient.invalidateQueries({ queryKey: ["leaderboard", gameId] });
      queryClient.invalidateQueries({ queryKey: ["rank", gameId] });
    },
  });
}

// Helper function for quick submissions with defaults
export async function submitQuickScore(
  gameId: string, 
  score: number, 
  options: {
    userId?: string;
    userAlias?: string;
    durationMs?: number;
    meta?: any;
  } = {}
) {
  // Use defaults or localStorage user data
  const defaultUserId = options.userId || localStorage.getItem("userId") || "anonymous";
  const defaultAlias = options.userAlias || localStorage.getItem("userAlias") || `Player${Math.floor(Math.random() * 1000)}`;
  
  return submitScore(gameId, {
    userId: defaultUserId,
    userAlias: defaultAlias,
    score,
    durationMs: options.durationMs,
    meta: options.meta,
  });
}