import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flame, Calendar, Trophy } from "lucide-react";

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActivity: string;
  totalDays: number;
}

interface StreakCardProps {
  data?: StreakData;
  userId?: number;
}

export const StreakCard = ({ data, userId }: StreakCardProps) => {
  // Mock data for demonstration
  const streakData: StreakData = data || {
    currentStreak: 7,
    longestStreak: 21,
    lastActivity: "Today",
    totalDays: 45
  };

  const getStreakLevel = (streak: number) => {
    if (streak >= 30) return { level: "Legend", color: "bg-purple-500", icon: "🏆" };
    if (streak >= 21) return { level: "Master", color: "bg-gold-500", icon: "👑" };
    if (streak >= 14) return { level: "Expert", color: "bg-blue-500", icon: "⭐" };
    if (streak >= 7) return { level: "Champion", color: "bg-green-500", icon: "🔥" };
    if (streak >= 3) return { level: "Rising", color: "bg-orange-500", icon: "📈" };
    return { level: "Getting Started", color: "bg-gray-500", icon: "🌱" };
  };

  const level = getStreakLevel(streakData.currentStreak);

  return (
    <Card className="w-full bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          Meal Planning Streak
        </CardTitle>
        <CardDescription>
          Keep the momentum going!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Streak */}
        <div className="text-center">
          <div className="text-4xl font-bold text-orange-600 dark:text-orange-400">
            {streakData.currentStreak}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300">
            Days in a row
          </div>
          <Badge className={`mt-2 ${level.color} text-white`}>
            {level.icon} {level.level}
          </Badge>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-sm text-gray-600 dark:text-gray-300">
              <Trophy className="w-4 h-4" />
              Best Streak
            </div>
            <div className="text-xl font-semibold text-gray-800 dark:text-gray-200">
              {streakData.longestStreak}
            </div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-sm text-gray-600 dark:text-gray-300">
              <Calendar className="w-4 h-4" />
              Total Days
            </div>
            <div className="text-xl font-semibold text-gray-800 dark:text-gray-200">
              {streakData.totalDays}
            </div>
          </div>
        </div>

        {/* Last Activity */}
        <div className="text-center text-sm text-gray-600 dark:text-gray-300">
          Last activity: {streakData.lastActivity}
        </div>
      </CardContent>
    </Card>
  );
};