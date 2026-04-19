import React, { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertTriangle, RotateCcw, Plus, Clock, Users, Eye } from "lucide-react";
import { Meal, UserProfile } from "@/services/mealEngineService";
import TrashButton from "@/components/ui/TrashButton";
import { formatIngredientWithGrams } from "@/utils/unitConversions";

interface MedicalBadge {
  badge: string;
  explanation: string;
  type: 'safe' | 'warning' | 'alert';
}

// Dynamic Medical Badge System - generates badges based on onboarding data
function generateDynamicMedicalBadges(meal: Meal, userProfile: UserProfile): MedicalBadge[] {
  const badges: MedicalBadge[] = [];

  const allergies = userProfile?.allergies || [];
  const healthConditions = userProfile?.healthConditions || [];
  const dietaryRestrictions = userProfile?.dietaryRestrictions || [];
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

interface MealCardDynamicProps {
  meal: Meal;
  userProfile: UserProfile;
  onDelete: (mealId: string) => void;
  onReplace: (mealId: string) => void;
  onAddToList?: (mealId: string) => void;
  replacing?: boolean;
  adding?: boolean;
}

const MealCardDynamic: React.FC<MealCardDynamicProps> = ({ 
  meal, 
  userProfile, 
  onDelete, 
  onReplace, 
  onAddToList,
  replacing = false,
  adding = false
}) => {
  const [showFullIngredients, setShowFullIngredients] = useState(false);
  const [showFullInstructions, setShowFullInstructions] = useState(false);

  // Generate dynamic medical badges based on user's onboarding profile
  const medicalBadges = generateDynamicMedicalBadges(meal, userProfile);

  // Debug: Check if medical badges are being generated
  console.log("MealCardDynamic - Medical badges for", meal.name, ":", medicalBadges);

  const renderMedicalBadges = () => {
    return (
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
    );
  };

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-semibold text-lg text-slate-900 dark:text-white line-clamp-2">
            {meal.name}
          </h4>
          {meal.difficulty && (
            <Badge 
              className={`${
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

        {meal.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
            {meal.description}
          </p>
        )}

        {/* Dynamic Medical Badges with Hover Explanations */}
        {renderMedicalBadges()}
      </div>

      {/* Image */}
      {meal.imageUrl && (
        <img
          src={meal.imageUrl}
          alt={meal.name}
          className="w-full h-48 object-cover rounded-lg"
          loading="lazy"
        />
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
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Users className="w-4 h-4" />
            <span>{meal.servings} servings</span>
          </div>
          {meal.cookingTime && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Clock className="w-4 h-4" />
              <span>{meal.cookingTime}m</span>
            </div>
          )}
        </div>
      </div>

      {/* Ingredients */}
      <div className="space-y-2">
        <h5 className="font-semibold text-slate-900 dark:text-white">Ingredients</h5>
        <ul className="list-disc pl-6 space-y-1">
          {meal.ingredients && meal.ingredients.slice(0, showFullIngredients ? meal.ingredients.length : 5).map((ingredient, index) => (
            <li key={index} className="text-sm text-slate-700 dark:text-slate-300">
              {formatIngredientWithGrams(ingredient.amount, ingredient.unit, ingredient.item)}
              {ingredient.notes && <span className="text-slate-500"> — {ingredient.notes}</span>}
            </li>
          ))}
        </ul>
        {meal.ingredients && meal.ingredients.length > 5 && (
          <button
            onClick={() => setShowFullIngredients(!showFullIngredients)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showFullIngredients ? 'Show less' : `Show ${meal.ingredients.length - 5} more ingredients`}
          </button>
        )}
      </div>

      {/* Instructions */}
      <div className="space-y-2">
        <h5 className="font-semibold text-slate-900 dark:text-white">Instructions</h5>
        <ol className="list-decimal pl-6 space-y-2">
          {meal.instructions && meal.instructions.slice(0, showFullInstructions ? meal.instructions.length : 3).map((step, index) => (
            <li key={index} className="text-sm text-slate-700 dark:text-slate-300">
              {step}
            </li>
          ))}
        </ol>
        {meal.instructions && meal.instructions.length > 3 && (
          <button
            onClick={() => setShowFullInstructions(!showFullInstructions)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showFullInstructions ? 'Show less' : `Show ${meal.instructions.length - 3} more steps`}
          </button>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
        {onAddToList && (
          <Button
            onClick={() => onAddToList(meal.id)}
            disabled={adding}
            size="sm"
            variant="outline"
            className="flex-1"
          >
            {adding ? (
              <>
                <Plus className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Add to List
              </>
            )}
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => onReplace(meal.id)}
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
              Replace
            </>
          )}
        </Button>

        <TrashButton
          size="sm"
          onClick={() => onDelete(meal.id)}
          ariaLabel="Delete meal"
          title="Delete meal"
          className="flex-1"
        />
      </div>
    </div>
  );
};

export default MealCardDynamic;