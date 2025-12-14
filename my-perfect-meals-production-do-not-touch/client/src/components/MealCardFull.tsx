import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RotateCcw, Clock, Users, Shield, AlertTriangle, CheckCircle, X, Plus, Eye } from "lucide-react";
import { useState } from "react";
import { formatIngredientWithGrams } from "@/utils/unitConversions";
// Shopping list functionality removed - import eliminated

export interface Ingredient {
  item: string;
  amount: number;
  unit: string;
  notes?: string;
}

export interface Meal {
  id: string;
  name: string;
  description?: string;
  ingredients: Ingredient[];
  instructions: string[];
  nutrition: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  };
  servings: number;
  imageUrl?: string | null;
  cookingTime?: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  medicalBadges?: string[];
  compliance?: {
    allergiesCleared: boolean;
    medicalCleared: boolean;
    unitsStandardized: boolean;
  };
}

// Dynamic Medical Badge System - generates badges based on onboarding data
function generateDynamicMedicalBadges(meal: Meal) {
  const userData = JSON.parse(localStorage.getItem('userOnboardingProfile') || '{}');
  const badges: Array<{badge: string, explanation: string, type: 'safe' | 'warning' | 'alert'}> = [];
  
  const allergies = userData.allergies || [];
  const healthConditions = userData.healthConditions || [];
  const dietaryRestrictions = userData.dietaryRestrictions || [];
  const mealIngredients = meal.ingredients?.map(i => (i.item || '').toLowerCase()) || [];
  
  // Allergy Checks
  allergies.forEach((allergy: string) => {
    const hasAllergen = mealIngredients.some(ingredient => 
      ingredient.includes(allergy.toLowerCase()) ||
      (allergy.toLowerCase().includes('dairy') && ['milk', 'cheese', 'butter', 'cream'].some(dairy => ingredient.includes(dairy))) ||
      (allergy.toLowerCase().includes('nuts') && ['peanut', 'almond', 'walnut', 'cashew'].some(nut => ingredient.includes(nut)))
    );
    
    if (hasAllergen) {
      badges.push({
        badge: `Contains ${allergy}`,
        explanation: `This meal contains ${allergy}. Avoid if you have a ${allergy} allergy.`,
        type: 'alert'
      });
    } else {
      badges.push({
        badge: `${allergy}-Free`,
        explanation: `This meal does not contain ${allergy}. Safe for individuals with ${allergy} allergies.`,
        type: 'safe'
      });
    }
  });
  
  // Health Condition Checks
  healthConditions.forEach((condition: string) => {
    if (condition.toLowerCase().includes('diabetes')) {
      const carbCount = meal.nutrition?.carbs_g || 0;
      if (carbCount <= 30) {
        badges.push({
          badge: 'Diabetic-Friendly',
          explanation: 'This meal is designed to help manage blood sugar levels. It is lower in simple carbs and includes balanced nutrition.',
          type: 'safe'
        });
      } else if (carbCount > 60) {
        badges.push({
          badge: 'High Carbs',
          explanation: 'This meal has high carbohydrate content. Monitor blood sugar carefully if you have diabetes.',
          type: 'warning'
        });
      }
    }
  });
  
  // Dietary Restriction Checks
  dietaryRestrictions.forEach((restriction: string) => {
    if (restriction.toLowerCase().includes('vegetarian')) {
      const hasMeat = mealIngredients.some(ingredient => 
        ['chicken', 'beef', 'pork', 'fish', 'turkey', 'lamb', 'meat'].some(meat => ingredient.includes(meat))
      );
      
      badges.push({
        badge: hasMeat ? 'Contains Meat' : 'Vegetarian',
        explanation: hasMeat 
          ? 'This meal contains meat. Not suitable for vegetarian diets.'
          : 'This meal contains no meat. Suitable for vegetarian diets.',
        type: hasMeat ? 'alert' : 'safe'
      });
    }
    
    if (restriction.toLowerCase().includes('gluten')) {
      const hasGluten = mealIngredients.some(ingredient => 
        ['wheat', 'bread', 'flour', 'pasta', 'barley', 'rye'].some(gluten => ingredient.includes(gluten))
      );
      
      badges.push({
        badge: hasGluten ? 'Contains Gluten' : 'Gluten-Free',
        explanation: hasGluten
          ? 'This meal contains gluten. Avoid if you have celiac disease or gluten sensitivity.'
          : 'This meal does not contain gluten. Suitable for individuals with celiac disease or gluten sensitivity.',
        type: hasGluten ? 'alert' : 'safe'
      });
    }
  });
  
  return badges;
}

interface MealCardFullProps {
  meal: Meal;
  appliedDietLabel?: string;
  onReplace?: () => void;
  replacing?: boolean;
  showAddToList?: boolean;
  showDeleteMeal?: boolean;
  onDeleteMeal?: () => void;
  userId?: string;
}

export default function MealCardFull({
  meal,
  appliedDietLabel,
  onReplace,
  replacing = false,
  showAddToList = false,
  showDeleteMeal = false,
  onDeleteMeal,
  userId = "demo-user",
}: MealCardFullProps) {
  const [adding, setAdding] = useState(false);
  const [addMessage, setAddMessage] = useState("");
  
  // Generate dynamic medical badges based on user's onboarding profile
  const medicalBadges = generateDynamicMedicalBadges(meal);
  
  // Debug: Check if medical badges are being generated
  console.log("MealCardFull - Medical badges for", meal.name, ":", medicalBadges);

  const handleAddToShoppingList = async () => {
    // Shopping list functionality removed
    setAddMessage("Shopping list functionality has been removed");
    setTimeout(() => setAddMessage(""), 3000);
  };
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="font-semibold text-lg text-slate-900 dark:text-white line-clamp-2">
            {meal.name}
          </h4>
          {meal.description && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
              {meal.description}
            </p>
          )}
          {appliedDietLabel && (
            <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
              Applied diet: {appliedDietLabel}
            </p>
          )}
          
          {/* Dynamic Medical Badges with Hover Explanations */}
          <div className="flex flex-wrap gap-2 mt-3">
            {medicalBadges.map((badgeData, index) => (
              <div key={index} className="group relative">
                <Badge 
                  variant={badgeData.type === 'safe' ? "default" : badgeData.type === 'warning' ? "secondary" : "destructive"}
                  className={`flex items-center gap-1 cursor-help ${
                    badgeData.type === 'safe' 
                      ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/20 dark:text-green-300' 
                      : badgeData.type === 'warning'
                      ? 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/20 dark:text-yellow-300'
                      : 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/20 dark:text-red-300'
                  }`}
                >
                  {badgeData.type === 'safe' ? <CheckCircle className="w-3 h-3" /> : 
                   badgeData.type === 'warning' ? <AlertTriangle className="w-3 h-3" /> : 
                   <AlertTriangle className="w-3 h-3" />}
                  {badgeData.badge}
                </Badge>
                
                {/* Hover Explanation Tooltip */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                  <div className="relative">
                    {badgeData.explanation}
                    {/* Arrow pointing down */}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Compliance Badges */}
          {meal.compliance && (
            <div className="mt-2 flex flex-wrap gap-1">
              <ComplianceBadge 
                ok={meal.compliance.allergiesCleared} 
                label="Allergy Safe" 
              />
              <ComplianceBadge 
                ok={meal.compliance.medicalCleared} 
                label="Medical Safe" 
              />
              <ComplianceBadge 
                ok={meal.compliance.unitsStandardized} 
                label="Units OK" 
              />
            </div>
          )}
        </div>
        
        {onReplace && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReplace}
            disabled={replacing}
            className="shrink-0"
          >
            {replacing ? (
              <RotateCcw className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <RotateCcw className="h-3 w-3 mr-1" />
            )}
            Replace
          </Button>
        )}
      </div>

      {/* Image */}
      {meal.imageUrl && (
        <div className="relative">
          <img
            src={meal.imageUrl}
            alt={meal.name}
            className="w-full h-48 object-cover rounded-lg"
            loading="lazy"
          />
          {meal.difficulty && (
            <Badge 
              className={`absolute top-2 right-2 ${
                meal.difficulty === 'Easy' 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' 
                  : meal.difficulty === 'Medium' 
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
              }`}
            >
              {meal.difficulty}
            </Badge>
          )}
        </div>
      )}

      {/* Nutrition & Meta */}
      <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
        <div className="space-y-2">
          <div className="text-center">
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {meal.nutrition.calories}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">calories</div>
          </div>
          <div className="grid grid-cols-3 gap-1 text-center text-xs">
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">
                {meal.nutrition.protein_g}g
              </div>
              <div className="text-slate-500 dark:text-slate-400">P</div>
            </div>
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">
                {meal.nutrition.carbs_g}g
              </div>
              <div className="text-slate-500 dark:text-slate-400">C</div>
            </div>
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">
                {meal.nutrition.fat_g}g
              </div>
              <div className="text-slate-500 dark:text-slate-400">F</div>
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
            <Users className="h-3 w-3" />
            {meal.servings} serving{meal.servings !== 1 ? 's' : ''}
          </div>
          {meal.cookingTime && (
            <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
              <Clock className="h-3 w-3" />
              {meal.cookingTime} min
            </div>
          )}
          {meal.medicalBadges && meal.medicalBadges.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {meal.medicalBadges.map((badge, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {badge}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ingredients */}
      <div>
        <h5 className="font-semibold text-sm text-slate-900 dark:text-white mb-2">
          Ingredients (serves {meal.servings})
        </h5>
        {meal.ingredients?.length ? (
          <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
            {meal.ingredients.map((ingredient, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-2 h-2 bg-slate-400 rounded-full shrink-0 mt-2"></span>
                <span>
                  {formatIngredientWithGrams(ingredient.amount, ingredient.unit, ingredient.item)}
                  {ingredient.notes && (
                    <span className="text-slate-500 dark:text-slate-400">
                      {" "}— {ingredient.notes}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400 italic">
            No ingredients provided
          </p>
        )}
      </div>

      {/* Instructions */}
      <div>
        <h5 className="font-semibold text-sm text-slate-900 dark:text-white mb-2">
          Instructions
        </h5>
        {meal.instructions?.length ? (
          <ol className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
            {meal.instructions.map((instruction, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span>{instruction}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400 italic">
            No instructions provided
          </p>
        )}
      </div>

      {/* Meal Action Buttons */}
      <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
        {showAddToList && (
          <Button
            disabled
            size="sm"
            variant="outline"
            className="flex-1 cursor-not-allowed opacity-60"
          >
            <Plus className="w-4 h-4 mr-2" />
            Coming Soon
          </Button>
        )}
        
        {onReplace && (
          <Button
            variant="outline"
            size="sm"
            onClick={onReplace}
            disabled={replacing}
            className="flex-1"
          >
            {replacing ? (
              <>
                <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                Replacing...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-2" />
                Replace Meal
              </>
            )}
          </Button>
        )}
        
        {showDeleteMeal && onDeleteMeal && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onDeleteMeal}
            className="flex-1"
          >
            <X className="w-4 h-4 mr-2" />
            Delete Meal
          </Button>
        )}
      </div>
      
      {/* Add to shopping list status message */}
      {addMessage && (
        <div className={`mt-2 text-sm text-center ${
          addMessage.includes("✅") ? "text-green-600" : "text-red-600"
        }`}>
          {addMessage}
        </div>
      )}
    </div>
  );
}

function ComplianceBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Badge 
      className={`text-xs ${
        ok 
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-300' 
          : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
      }`}
    >
      {ok ? "✅ " : "⚠️ "}{label}
    </Badge>
  );
}