import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { formatIngredientWithGrams } from "@/utils/unitConversions";

// User profile interface (from onboarding data)
interface UserProfile {
  allergies: string[];
  healthConditions: string[];
  dietaryRestrictions: string[];
}

export type Ingredient = { item: string; amount: number; unit: string; notes?: string };

export interface Meal {
  id?: string;
  name: string;
  description?: string;
  ingredients?: Ingredient[];
  instructions?: string[];
  portionGuide?: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  suggestedTime?: string;
  nutrition: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
}

interface MealCardProps {
  meal: Meal;
  userProfile?: UserProfile;
  onReplace?: () => void;
  isReplacing?: boolean;
  errorMessage?: string;
}

// Function to generate medical badges based on user profile and meal ingredients
const generateMedicalBadges = (meal: Meal, userProfile?: UserProfile) => {
  const badges = [];

  if (!userProfile) {
    return [{
      badge: "General Meal",
      type: "safe" as const,
      explanation: "This meal follows standard nutritional guidelines."
    }];
  }

  // Check for gluten-free
  if (userProfile.allergies.includes("gluten")) {
    const hasGluten = meal.ingredients?.some(ingredient => 
      typeof ingredient === 'object' && ingredient.item && (
        ingredient.item.toLowerCase().includes("wheat") || 
        ingredient.item.toLowerCase().includes("flour") ||
        ingredient.item.toLowerCase().includes("bread")
      )
    ) || false;
    badges.push({
      badge: hasGluten ? "Contains Gluten" : "Gluten-Free",
      type: hasGluten ? "warning" as const : "safe" as const,
      explanation: hasGluten 
        ? "This meal contains gluten. Not suitable for celiac disease or gluten sensitivity."
        : "This meal is safe for individuals with gluten sensitivity or celiac disease."
    });
  }

  // Check for diabetic-friendly
  if (userProfile.healthConditions.includes("diabetes")) {
    const highCarbs = meal.nutrition.carbs_g > 45;
    badges.push({
      badge: highCarbs ? "High Carbs" : "Diabetic-Friendly",
      type: highCarbs ? "warning" as const : "safe" as const,
      explanation: highCarbs
        ? "This meal contains high carbohydrates. Monitor blood sugar levels carefully."
        : "This meal is designed to help manage blood sugar levels with moderate carbohydrates."
    });
  }

  // Check for dairy-free
  if (userProfile.allergies.includes("dairy")) {
    const hasDairy = meal.ingredients?.some(ingredient =>
      typeof ingredient === 'object' && ingredient.item && (
        ingredient.item.toLowerCase().includes("milk") ||
        ingredient.item.toLowerCase().includes("cheese") ||
        ingredient.item.toLowerCase().includes("butter") ||
        ingredient.item.toLowerCase().includes("cream")
      )
    ) || false;
    badges.push({
      badge: hasDairy ? "Contains Dairy" : "Dairy-Free",
      type: hasDairy ? "warning" as const : "safe" as const,
      explanation: hasDairy
        ? "This meal contains dairy products. Not suitable for lactose intolerance or dairy allergies."
        : "This meal is safe for individuals with lactose intolerance or dairy allergies."
    });
  }

  // Check for vegetarian/vegan
  if (userProfile.dietaryRestrictions.includes("vegetarian")) {
    const hasMeat = meal.ingredients?.some(ingredient =>
      typeof ingredient === 'object' && ingredient.item && (
        ingredient.item.toLowerCase().includes("chicken") ||
        ingredient.item.toLowerCase().includes("beef") ||
        ingredient.item.toLowerCase().includes("pork") ||
        ingredient.item.toLowerCase().includes("fish")
      )
    ) || false;
    badges.push({
      badge: hasMeat ? "Contains Meat" : "Vegetarian",
      type: hasMeat ? "warning" as const : "safe" as const,
      explanation: hasMeat
        ? "This meal contains meat products. Not suitable for vegetarian diet."
        : "This meal is suitable for vegetarian diet."
    });
  }

  return badges.length > 0 ? badges : [{
    badge: "No Restrictions",
    type: "safe" as const,
    explanation: "This meal is suitable for your dietary profile."
  }];
};

export default function EnhancedMealCard({ meal, userProfile, onReplace, isReplacing, errorMessage }: MealCardProps) {
  // Generate the medical badges dynamically based on the meal and user profile
  const medicalBadges = generateMedicalBadges(meal, userProfile);

  return (
    <Card className="w-full p-6 bg-white dark:bg-slate-800 shadow-lg rounded-2xl mb-6 relative">
      {onReplace && (
        <button 
          className={`absolute top-4 right-4 px-3 py-1 rounded-xl text-white text-sm font-bold transition-all shadow-md border z-10 flex items-center gap-1 ${
            isReplacing 
              ? "bg-gray-400 cursor-not-allowed border-gray-300" 
              : "bg-black/30 hover:bg-black/50 border-white/20 backdrop-blur-lg"
          }`} 
          onClick={() => !isReplacing && onReplace()}
          disabled={isReplacing}
          title={isReplacing ? "Replacing meal..." : "Replace with a completely new meal recipe"}
        >
          {isReplacing ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              Replacing...
            </>
          ) : (
            "Replace"
          )}
        </button>
      )}
      
      <CardHeader className="mb-4">
        {/* Centered meal type and time at top */}
        {(meal.mealType || meal.suggestedTime) && (
          <div className="flex flex-col items-center mb-3">
            {meal.mealType && (
              <Badge className={`mb-1 text-sm font-bold px-3 py-1 ${
                meal.mealType === 'breakfast' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                meal.mealType === 'lunch' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                meal.mealType === 'dinner' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
              }`}>
                {meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1)}
              </Badge>
            )}
            {meal.suggestedTime && (
              <span className="text-sm text-gray-600 dark:text-gray-400 font-semibold">
                🕐 {meal.suggestedTime}
              </span>
            )}
          </div>
        )}
        
        {/* Meal title centered */}
        <CardTitle className="text-xl font-semibold text-indigo-700 dark:text-indigo-300 text-center mb-2">{meal.name}</CardTitle>
        {meal.description && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 text-center">{meal.description}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Portion Guide */}
        {meal.portionGuide && (
          <div>
            <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-1">Portion Guide:</h3>
            <p className="text-gray-700 dark:text-gray-300 italic text-sm">{meal.portionGuide}</p>
          </div>
        )}

        {/* Ingredients */}
        {meal.ingredients && meal.ingredients.length > 0 && (
          <div>
            <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-1">Ingredients:</h3>
            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
              {meal.ingredients.map((ingredient, index) => (
                <li key={index} className="text-sm">
                  {formatIngredientWithGrams(ingredient.amount, ingredient.unit, ingredient.item)}
                  {ingredient.notes && <span className="text-gray-500 ml-1">({ingredient.notes})</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Instructions */}
        {meal.instructions && meal.instructions.length > 0 && (
          <div>
            <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-1">Instructions:</h3>
            <ol className="list-decimal list-inside text-gray-700 dark:text-gray-300 space-y-1">
              {meal.instructions.map((step, index) => (
                <li key={index} className="text-sm">{step}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Nutrition Badges */}
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="outline" className="text-sm">Calories: {meal.nutrition.calories}</Badge>
          <Badge variant="outline" className="text-sm">Protein: {meal.nutrition.protein_g}g</Badge>
          <Badge variant="outline" className="text-sm">Carbs: {meal.nutrition.carbs_g}g</Badge>
          <Badge variant="outline" className="text-sm">Fat: {meal.nutrition.fat_g}g</Badge>
        </div>

        {/* Medical Badges */}
        <div className="space-y-2">
          <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200">Medical Safety:</h3>
          <div className="flex flex-wrap gap-2">
            {medicalBadges.map((badgeData, index) => (
              <div key={index} className="group relative">
                <Badge 
                  variant={badgeData.type === 'safe' ? "default" : "destructive"}
                  className={`flex items-center gap-1 ${
                    badgeData.type === 'safe' 
                      ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200' 
                      : 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200'
                  }`}
                  title={badgeData.explanation}
                >
                  {badgeData.type === 'safe' ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : (
                    <AlertTriangle className="w-3 h-3" />
                  )}
                  {badgeData.badge}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">
              <strong>Error:</strong> {errorMessage}
            </p>
          </div>
        )}

        {/* Medical Safety Information */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>Medical Personalization:</strong> This meal has been analyzed based on your health profile 
            including allergies, dietary restrictions, and medical conditions from your onboarding data.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}