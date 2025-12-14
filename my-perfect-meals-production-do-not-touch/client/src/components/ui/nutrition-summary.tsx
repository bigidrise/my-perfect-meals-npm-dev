import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Target, Calendar, Zap } from "lucide-react";
import type { MealPlan, User } from "@shared/schema";

interface NutritionSummaryProps {
  mealPlan?: MealPlan;
  user?: User;
}

export default function NutritionSummary({ mealPlan, user }: NutritionSummaryProps) {
  if (!mealPlan || !user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Target className="mr-2 h-5 w-5" />
            Nutrition Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Generate a meal plan to see your nutrition summary</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate daily averages
  const dailyCalories = Math.round((mealPlan.totalCalories || 0) / 7);
  const dailyProtein = Math.round((mealPlan.totalProtein || 0) / 7);
  const dailyCarbs = Math.round((mealPlan.totalCarbs || 0) / 7);
  const dailyFat = Math.round((mealPlan.totalFat || 0) / 7);

  // Calculate targets
  const calorieTarget = user.dailyCalorieTarget || 2200;
  const proteinTarget = Math.round(calorieTarget * 0.25 / 4); // 25% of calories from protein
  const carbTarget = Math.round(calorieTarget * 0.45 / 4); // 45% of calories from carbs
  const fatTarget = Math.round(calorieTarget * 0.30 / 9); // 30% of calories from fat

  // Calculate percentages
  const calorieProgress = Math.min((dailyCalories / calorieTarget) * 100, 100);
  const proteinProgress = Math.min((dailyProtein / proteinTarget) * 100, 100);
  const carbProgress = Math.min((dailyCarbs / carbTarget) * 100, 100);
  const fatProgress = Math.min((dailyFat / fatTarget) * 100, 100);

  return (
    <div className="space-y-6">
      {/* Weekly Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Calendar className="mr-2 h-5 w-5" />
            Weekly Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{mealPlan.totalCalories?.toLocaleString() || "0"}</div>
              <div className="text-sm text-muted-foreground">Total Calories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-secondary">{Math.round(dailyCalories)}</div>
              <div className="text-sm text-muted-foreground">Daily Average</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">{mealPlan.totalProtein || 0}g</div>
              <div className="text-sm text-muted-foreground">Total Protein</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">7</div>
              <div className="text-sm text-muted-foreground">Days Planned</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Nutrition Targets */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Target className="mr-2 h-5 w-5" />
            Daily Targets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Calories */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-foreground">Calories</span>
              <span className="text-sm text-muted-foreground">
                {dailyCalories} / {calorieTarget}
              </span>
            </div>
            <Progress value={calorieProgress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{Math.round(calorieProgress)}% of target</span>
              <span className="flex items-center">
                <Zap className="h-3 w-3 mr-1" />
                {calorieTarget - dailyCalories > 0 ? `${calorieTarget - dailyCalories} remaining` : 'Target met'}
              </span>
            </div>
          </div>

          {/* Protein */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-foreground">Protein</span>
              <span className="text-sm text-muted-foreground">
                {dailyProtein}g / {proteinTarget}g
              </span>
            </div>
            <Progress value={proteinProgress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{Math.round(proteinProgress)}% of target</span>
              <span>{proteinTarget - dailyProtein > 0 ? `${proteinTarget - dailyProtein}g remaining` : 'Target met'}</span>
            </div>
          </div>

          {/* Carbohydrates */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-foreground">Carbohydrates</span>
              <span className="text-sm text-muted-foreground">
                {dailyCarbs}g / {carbTarget}g
              </span>
            </div>
            <Progress value={carbProgress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{Math.round(carbProgress)}% of target</span>
              <span>{carbTarget - dailyCarbs > 0 ? `${carbTarget - dailyCarbs}g remaining` : 'Target met'}</span>
            </div>
          </div>

          {/* Fat */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-foreground">Fat</span>
              <span className="text-sm text-muted-foreground">
                {dailyFat}g / {fatTarget}g
              </span>
            </div>
            <Progress value={fatProgress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{Math.round(fatProgress)}% of target</span>
              <span>{fatTarget - dailyFat > 0 ? `${fatTarget - dailyFat}g remaining` : 'Target met'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Goal Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <TrendingUp className="mr-2 h-5 w-5" />
            Goal Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Fitness Goal</span>
              <Badge variant="outline" className="capitalize">
                {user.fitnessGoal?.replace("_", " ") || "Not set"}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Activity Level</span>
              <Badge variant="secondary" className="capitalize">
                {user.activityLevel?.replace("_", " ") || "Not set"}
              </Badge>
            </div>
            
            {user.dietaryRestrictions && user.dietaryRestrictions.length > 0 && (
              <div>
                <span className="text-sm text-foreground block mb-2">Dietary Preferences</span>
                <div className="flex flex-wrap gap-1">
                  {user.dietaryRestrictions.slice(0, 3).map((restriction, index) => (
                    <Badge key={index} variant="outline" className="text-xs capitalize">
                      {restriction.replace("-", " ")}
                    </Badge>
                  ))}
                  {user.dietaryRestrictions.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{user.dietaryRestrictions.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
            
            {/* Nutrition Balance Score */}
            <div className="pt-4 border-t">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Balance Score</span>
                <span className="text-lg font-bold text-primary">
                  {Math.round((calorieProgress + proteinProgress + carbProgress + fatProgress) / 4)}%
                </span>
              </div>
              <Progress 
                value={(calorieProgress + proteinProgress + carbProgress + fatProgress) / 4} 
                className="h-2" 
              />
              <p className="text-xs text-muted-foreground mt-1">
                Based on how well your plan meets your nutritional targets
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
