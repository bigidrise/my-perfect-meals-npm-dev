import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// Progress component implementation
const Progress = ({ value, className }: { value: number; className?: string }) => (
  <div className={`w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 ${className || ''}`}>
    <div 
      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
      style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
    />
  </div>
);
import { Brain, ShoppingCart, TrendingUp, Star, AlertCircle } from "lucide-react";

interface GroupedItem {
  name: string;
  totalQuantity: string;
  items: any[];
}

interface ConsolidatedCategory {
  category: string;
  items: GroupedItem[];
}

interface AIInsights {
  ingredientAnalysis?: Record<string, any>;
  mealReadiness?: {
    completeMeals: string[];
    nutritionBalance: {
      overall: string;
      protein: string;
      vegetables: string;
      variety: string;
      recommendations: string[];
    };
  };
  insights?: {
    totalIngredients: number;
    uniqueCategories: number;
    nutritionScore: number;
    recommendations: string[];
    smartSubstitutions?: Array<{
      original: string;
      alternative: string;
      reason: string;
    }>;
    budgetOptimization?: Array<{
      item: string;
      suggestion: string;
      potentialSavings: string;
    }>;
  };
}

interface IntelligentGroupingProps {
  groups: ConsolidatedCategory[];
  insights?: AIInsights;
  isLoading?: boolean;
}

const categoryIcons: Record<string, string> = {
  'Produce': '🥬',
  'Meats': '🥩', 
  'Seafood': '🐟',
  'Dairy': '🥛',
  'Grains': '🌾',
  'Pantry': '🧄',
  'Extras': '🛒'
};

const NutritionIndicator = ({ label, value, level }: { label: string; value: string; level: 'High' | 'Adequate' | 'Low' | 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Limited' }) => {
  const getColor = (level: string) => {
    switch (level) {
      case 'Excellent':
      case 'High': return 'bg-green-500';
      case 'Good':
      case 'Adequate': return 'bg-yellow-500';
      case 'Fair':
      case 'Low': return 'bg-orange-500';
      case 'Poor':
      case 'Limited': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getProgress = (level: string) => {
    switch (level) {
      case 'Excellent': return 95;
      case 'High': return 85;
      case 'Good': return 75;
      case 'Adequate': return 65;
      case 'Fair': return 50;
      case 'Low': return 35;
      case 'Poor': return 20;
      case 'Limited': return 25;
      default: return 50;
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <Progress value={getProgress(level)} className="h-2" />
    </div>
  );
};

export default function IntelligentGrouping({ groups, insights, isLoading }: IntelligentGroupingProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <Brain className="h-5 w-5 animate-spin text-blue-500" />
            <span>Analyzing your shopping list with AI...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (groups.length === 0) {
    return (
      <Card className="bg-black/30 backdrop-blur-lg border-white/20 rounded-2xl">
        <CardContent className="p-6 text-center">
          <ShoppingCart className="h-12 w-12 text-white/60 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2 text-white">Your Smart Shopping List is Empty</h3>
          <p className="text-white/80">Add ingredients to see intelligent grouping and AI insights!</p>
        </CardContent>
      </Card>
    );
  }

  const totalItems = groups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <div className="space-y-6">
      {/* AI Insights Panel */}
      {insights && (
        <Card className="bg-black/30 backdrop-blur-lg border-white/20 rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Brain className="h-5 w-5 text-blue-400" />
              AI Shopping Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-blue-400">{insights.insights?.totalIngredients || totalItems}</div>
                <div className="text-sm text-white/80">Total Items</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-green-400">{insights.insights?.uniqueCategories || groups.length}</div>
                <div className="text-sm text-white/80">Categories</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-purple-400 flex items-center justify-center gap-1">
                  {insights.insights?.nutritionScore || 8}
                  <Star className="h-4 w-4" />
                </div>
                <div className="text-sm text-white/80">Nutrition Score</div>
              </div>
            </div>

            {insights.mealReadiness && (
              <div className="space-y-3 pt-4 border-t">
                <h4 className="font-semibold flex items-center gap-2 text-white">
                  <TrendingUp className="h-4 w-4 text-green-400" />
                  Nutrition Balance Analysis
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <NutritionIndicator 
                    label="Overall Balance" 
                    value={insights.mealReadiness.nutritionBalance.overall}
                    level={insights.mealReadiness.nutritionBalance.overall as any}
                  />
                  <NutritionIndicator 
                    label="Protein Sources" 
                    value={insights.mealReadiness.nutritionBalance.protein}
                    level={insights.mealReadiness.nutritionBalance.protein as any}
                  />
                  <NutritionIndicator 
                    label="Vegetables" 
                    value={insights.mealReadiness.nutritionBalance.vegetables}
                    level={insights.mealReadiness.nutritionBalance.vegetables as any}
                  />
                  <NutritionIndicator 
                    label="Variety" 
                    value={insights.mealReadiness.nutritionBalance.variety}
                    level={insights.mealReadiness.nutritionBalance.variety as any}
                  />
                </div>
              </div>
            )}

            {insights.mealReadiness?.completeMeals && insights.mealReadiness.completeMeals.length > 0 && (
              <div className="pt-4 border-t">
                <h4 className="font-semibold mb-2 text-white">🍽️ Complete Meals You Can Make:</h4>
                <div className="flex flex-wrap gap-2">
                  {insights.mealReadiness.completeMeals.map((meal, index) => (
                    <Badge key={index} variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      {meal}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {insights.insights?.smartSubstitutions && insights.insights.smartSubstitutions.length > 0 && (
              <div className="pt-4 border-t">
                <h4 className="font-semibold mb-2 text-white">💡 Smart Substitutions:</h4>
                <div className="space-y-2">
                  {insights.insights.smartSubstitutions.slice(0, 2).map((sub, index) => (
                    <div key={index} className="text-sm p-2 bg-yellow-900/30 rounded">
                      <span className="font-medium text-white">{sub.original}</span> → <span className="text-green-400 font-medium">{sub.alternative}</span>
                      <div className="text-white/70 text-xs mt-1">{sub.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {insights.insights?.recommendations && insights.insights.recommendations.length > 0 && (
              <div className="pt-4 border-t">
                <h4 className="font-semibold mb-2 flex items-center gap-2 text-white">
                  <AlertCircle className="h-4 w-4 text-blue-400" />
                  AI Recommendations:
                </h4>
                <div className="space-y-1">
                  {insights.insights.recommendations.slice(0, 3).map((rec, index) => (
                    <div key={index} className="text-sm text-white/80 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full flex-shrink-0" />
                      {rec}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Grouped Shopping List */}
      <div className="grid gap-4">
        {groups.map((group, groupIndex) => (
          <Card key={groupIndex} className="overflow-hidden bg-black/30 backdrop-blur-lg border-white/20 rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white">
                <span className="text-lg">{categoryIcons[group.category] || '📦'}</span>
                <span>{group.category}</span>
                <Badge variant="outline" className="ml-auto bg-white/10 border-white/20 text-white">
                  {group.items.length} items
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {group.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium text-white">{item.name}</div>
                      {item.items.length > 1 && (
                        <div className="text-sm text-white/70">
                          Consolidated from {item.items.length} sources
                        </div>
                      )}
                    </div>
                    <Badge variant="secondary" className="font-mono bg-white/20 text-white">
                      {item.totalQuantity}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}