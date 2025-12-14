import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Target, Apple } from "lucide-react";

interface NutritionData {
  calories: { current: number; target: number };
  protein: { current: number; target: number };
  carbs: { current: number; target: number };
  fat: { current: number; target: number };
}

interface DailyNutritionTrackerProps {
  userId?: number;
  data?: NutritionData;
}

export const DailyNutritionTracker = ({ userId, data }: DailyNutritionTrackerProps) => {
  // Mock data for demonstration
  const nutritionData: NutritionData = data || {
    calories: { current: 1650, target: 2000 },
    protein: { current: 85, target: 120 },
    carbs: { current: 180, target: 250 },
    fat: { current: 65, target: 80 }
  };

  const calculatePercentage = (current: number, target: number) => 
    Math.min((current / target) * 100, 100);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Apple className="w-5 h-5 text-green-500" />
          Daily Nutrition Progress
        </CardTitle>
        <CardDescription>
          Track your daily nutritional intake
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Calories */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Calories</span>
            <span className="text-gray-600">
              {nutritionData.calories.current} / {nutritionData.calories.target} kcal
            </span>
          </div>
          <Progress 
            value={calculatePercentage(nutritionData.calories.current, nutritionData.calories.target)} 
            className="h-2"
          />
        </div>

        {/* Protein */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Protein</span>
            <span className="text-gray-600">
              {nutritionData.protein.current} / {nutritionData.protein.target} g
            </span>
          </div>
          <Progress 
            value={calculatePercentage(nutritionData.protein.current, nutritionData.protein.target)} 
            className="h-2"
          />
        </div>

        {/* Carbs */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Carbohydrates</span>
            <span className="text-gray-600">
              {nutritionData.carbs.current} / {nutritionData.carbs.target} g
            </span>
          </div>
          <Progress 
            value={calculatePercentage(nutritionData.carbs.current, nutritionData.carbs.target)} 
            className="h-2"
          />
        </div>

        {/* Fat */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Fat</span>
            <span className="text-gray-600">
              {nutritionData.fat.current} / {nutritionData.fat.target} g
            </span>
          </div>
          <Progress 
            value={calculatePercentage(nutritionData.fat.current, nutritionData.fat.target)} 
            className="h-2"
          />
        </div>

        <div className="pt-2 border-t">
          <div className="flex items-center gap-2 text-sm text-green-600">
            <TrendingUp className="w-4 h-4" />
            <span>On track with your daily goals!</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};