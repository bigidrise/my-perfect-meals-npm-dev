import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Target, Calendar, Award } from "lucide-react";

interface ProgressMetrics {
  weeklyGoalProgress: number;
  calorieAdherence: number;
  mealPlanCompletion: number;
  streakDays: number;
}

interface ProgressDashboardProps {
  userId?: number;
  metrics?: ProgressMetrics;
}

export default function ProgressDashboard({ userId, metrics }: ProgressDashboardProps) {
  // Mock data for demonstration
  const progressData: ProgressMetrics = metrics || {
    weeklyGoalProgress: 78,
    calorieAdherence: 92,
    mealPlanCompletion: 85,
    streakDays: 7
  };

  return (
    <Card className="w-full bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-500" />
          Weekly Progress Overview
        </CardTitle>
        <CardDescription>
          Your nutrition and meal planning achievements this week
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Weekly Goal Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-500" />
              Weekly Goal Progress
            </span>
            <span className="text-sm text-gray-600">{progressData.weeklyGoalProgress}%</span>
          </div>
          <Progress value={progressData.weeklyGoalProgress} className="h-3" />
        </div>

        {/* Calorie Adherence */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-500" />
              Calorie Target Adherence
            </span>
            <span className="text-sm text-gray-600">{progressData.calorieAdherence}%</span>
          </div>
          <Progress value={progressData.calorieAdherence} className="h-3" />
        </div>

        {/* Meal Plan Completion */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-orange-500" />
              Meal Plan Completion
            </span>
            <span className="text-sm text-gray-600">{progressData.mealPlanCompletion}%</span>
          </div>
          <Progress value={progressData.mealPlanCompletion} className="h-3" />
        </div>

        {/* Achievement Summary */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{progressData.streakDays}</div>
            <div className="text-xs text-gray-600">Day Streak</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">A+</div>
            <div className="text-xs text-gray-600">This Week</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
