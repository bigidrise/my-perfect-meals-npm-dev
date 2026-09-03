import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { apiUrl } from '@/lib/resolveApiBase';

type LeaderboardItem = { 
  userId: string; 
  userAlias: string; 
  score: number; 
  bestAt: string;
};

type LeaderboardScope = "day" | "week" | "all";

interface LeaderboardResponse {
  items: LeaderboardItem[];
  scopeKey?: string;
  scope: string;
}

export interface LeaderboardCardProps {
  gameId: string;
  title?: string;
  showMyRank?: boolean;
  currentUserId?: string;
  className?: string;
}

export default function LeaderboardCard({ 
  gameId, 
  title = "Leaderboard",
  showMyRank = false,
  currentUserId,
  className = ""
}: LeaderboardCardProps) {
  const [scope, setScope] = useState<LeaderboardScope>("week");

  const { data, isLoading, error } = useQuery({
    queryKey: ["leaderboard", gameId, scope],
    queryFn: async (): Promise<LeaderboardResponse> => {
      const res = await fetch(apiUrl(`/api/games/${gameId}/leaderboard?scope=${scope}`));
      if (!res.ok) throw new Error("Failed to load leaderboard");
      return res.json();
    },
  });

  const { data: myRank } = useQuery({
    queryKey: ["rank", gameId, scope, currentUserId],
    queryFn: async () => {
      if (!currentUserId) return null;
      const res = await fetch(apiUrl(`/api/games/${gameId}/rank/${currentUserId}?scope=${scope}`));
      if (!res.ok) return null;
      return res.json();
    },
    enabled: showMyRank && !!currentUserId,
  });

  const getScopeLabel = (s: LeaderboardScope) => {
    switch (s) {
      case "day": return "Today";
      case "week": return "This Week";
      case "all": return "All Time";
      default: return s;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className={`p-6 rounded-2xl shadow-card bg-white dark:bg-gray-800 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-heading text-gray-900 dark:text-white">{title}</h3>
        <div className="flex gap-1">
          {(["day", "week", "all"] as const).map(s => (
            <button
              key={s}
              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                scope === s
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              }`}
              onClick={() => setScope(s)}
            >
              {getScopeLabel(s)}
            </button>
          ))}
        </div>
      </div>

      {showMyRank && myRank && (
        <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
          <div className="text-sm text-indigo-700 dark:text-indigo-300">
            Your Rank: #{myRank.rank} with {myRank.score} points
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Loading leaderboard...
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-600 dark:text-red-400">
          Failed to load leaderboard
        </div>
      ) : (
        <div className="space-y-2">
          {data?.items && data.items.length > 0 ? (
            <ol className="space-y-2">
              {data.items.map((item, index) => (
                <li 
                  key={`${item.userId}-${item.score}`}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    index === 0 
                      ? "bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700"
                      : index === 1
                      ? "bg-gray-50 border border-gray-200 dark:bg-gray-700/50 dark:border-gray-600"
                      : index === 2
                      ? "bg-orange-50 border border-orange-200 dark:bg-orange-900/20 dark:border-orange-700"
                      : "bg-gray-50 dark:bg-gray-700/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`font-bold text-lg ${
                      index === 0 ? "text-yellow-600 dark:text-yellow-400" :
                      index === 1 ? "text-gray-600 dark:text-gray-400" :
                      index === 2 ? "text-orange-600 dark:text-orange-400" :
                      "text-gray-500 dark:text-gray-500"
                    }`}>
                      {index === 0 ? "🏆" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                    </span>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {item.userAlias}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(item.bestAt)}
                      </div>
                    </div>
                  </div>
                  <div className="font-bold text-lg text-gray-900 dark:text-white">
                    {item.score.toLocaleString()}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No scores yet. Be the first to play!
            </div>
          )}
          
          {data?.scopeKey && scope !== "all" && (
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
              {scope === "week" ? `Week ${data.scopeKey}` : `Day ${data.scopeKey}`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}