import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RotateCcw, Clock, Users, Shield, AlertTriangle, CheckCircle, X, Plus, Eye, Loader2, Wand2 } from "lucide-react";
import { useState } from "react";
import MealRefinementSheet from "@/components/MealRefinementSheet";
import { formatIngredientWithGrams } from "@/utils/unitConversions";
import { useTranslation } from "react-i18next";
import { useTranslatedMeal } from "@/hooks/useTranslatedMeal";
// Shopping list functionality removed - import eliminated

// Simple UUID v4 format check
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type { Ingredient } from "@/types/meal";
import type { Ingredient } from "@/types/meal";

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
  /** Saved-meal UUID — enables translation for non-English locales */
  mealId?: string;
  appliedDietLabel?: string;
  onReplace?: () => void;
  replacing?: boolean;
  showAddToList?: boolean;
  showDeleteMeal?: boolean;
  onDeleteMeal?: () => void;
  userId?: string;
  /** Called with the refined meal JSON when the user accepts a refinement */
  onRefined?: (refined: any) => void;
  builderType?: string;
}

export default function MealCardFull({
  meal,
  mealId,
  appliedDietLabel,
  onReplace,
  replacing = false,
  showAddToList = false,
  showDeleteMeal = false,
  onDeleteMeal,
  userId = "demo-user",
  onRefined,
  builderType,
}: MealCardFullProps) {
  const [adding, setAdding] = useState(false);
  const [addMessage, setAddMessage] = useState("");
  const [refineOpen, setRefineOpen] = useState(false);
  // Local meal state — updated on accepted refinements so the card re-renders without needing a parent callback
  const [currentMeal, setCurrentMeal] = useState<Meal>(() => meal);
  const [preRefineMeal, setPreRefineMeal] = useState<Meal | null>(null);
  const { t } = useTranslation("savedMeals");

  // Translation — only active for non-English locales and when a saved-meal UUID is provided
  const validMealId = mealId && UUID_RE.test(mealId) ? mealId : "";
  const { data: translation, isFetching: translating } = useTranslatedMeal(
    validMealId,
    /* enabled= */ Boolean(validMealId)
  );

  // Merge translated text over canonical data; amounts/units/nutrition stay untouched.
  // All display references use currentMeal so accepted refinements render immediately.
  const displayName = translation?.translatedName ?? currentMeal.name;
  const displayDescription = translation?.translatedDescription ?? currentMeal.description;
  const displayIngredients = currentMeal.ingredients?.map((ing, i) => ({
    ...ing,
    item: translation?.translatedIngredients?.[i]?.item ?? ing.item,
    notes: translation?.translatedIngredients?.[i]?.notes ?? ing.notes,
  }));
  const displayInstructions =
    translation?.translatedInstructions ?? currentMeal.instructions;

  // Generate dynamic medical badges based on user's onboarding profile
  const medicalBadges = generateDynamicMedicalBadges(currentMeal);
  
  // Debug: Check if medical badges are being generated
  console.log("MealCardFull - Medical badges for", meal.name, ":", medicalBadges);

  const handleAddToShoppingList = async () => {
    // Shopping list functionality removed
    setAddMessage("Shopping list functionality has been removed");
    setTimeout(() => setAddMessage(""), 3000);
  };
  return (
    <>
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h4 className="font-semibold text-lg text-slate-900 dark:text-white line-clamp-2">
            {displayName}
          </h4>
          {displayDescription && (
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
              {displayDescription}
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
          {currentMeal.compliance && (
            <div className="mt-2 flex flex-wrap gap-1">
              <ComplianceBadge 
                ok={currentMeal.compliance.allergiesCleared} 
                label="Allergy Safe" 
              />
              <ComplianceBadge 
                ok={currentMeal.compliance.medicalCleared} 
                label="Medical Safe" 
              />
              <ComplianceBadge 
                ok={currentMeal.compliance.unitsStandardized} 
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
      {currentMeal.imageUrl && (
        <div className="relative">
          <img
            src={currentMeal.imageUrl}
            alt={currentMeal.name}
            className="w-full h-48 object-cover rounded-lg"
            loading="lazy"
          />
          {currentMeal.difficulty && (
            <Badge 
              className={`absolute top-2 right-2 ${
                currentMeal.difficulty === 'Easy' 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300' 
                  : currentMeal.difficulty === 'Medium' 
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
              }`}
            >
              {currentMeal.difficulty}
            </Badge>
          )}
        </div>
      )}

      {/* Coaching line */}
      <div className="px-1 pt-2 pb-0">
        <p className="text-xs text-slate-500 dark:text-white/55 leading-relaxed border-l-2 border-slate-200 dark:border-white/20 pl-2.5">
          {t("builtFor")}
        </p>
      </div>

      {/* Nutrition & Meta */}
      <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
        <div className="space-y-2">
          <div className="text-center">
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {currentMeal.nutrition.calories}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{t("cal")}</div>
          </div>
          <div className="grid grid-cols-3 gap-1 text-center text-xs">
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">
                {currentMeal.nutrition.protein_g}g
              </div>
              <div className="text-slate-500 dark:text-slate-400">P</div>
            </div>
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">
                {currentMeal.nutrition.carbs_g}g
              </div>
              <div className="text-slate-500 dark:text-slate-400">C</div>
            </div>
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">
                {currentMeal.nutrition.fat_g}g
              </div>
              <div className="text-slate-500 dark:text-slate-400">F</div>
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
            <Users className="h-3 w-3" />
            {currentMeal.servings} {currentMeal.servings !== 1 ? t("servings") : t("serving")}
          </div>
          {currentMeal.cookingTime && (
            <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
              <Clock className="h-3 w-3" />
              {currentMeal.cookingTime} min
            </div>
          )}
          {currentMeal.medicalBadges && currentMeal.medicalBadges.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {currentMeal.medicalBadges.map((badge, i) => (
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
        <h5 className="font-semibold text-sm text-slate-900 dark:text-white mb-2 flex items-center gap-2">
          {t("ingredientsServes", { count: currentMeal.servings })}
          {translating && (
            <Loader2 className="h-3 w-3 animate-spin text-slate-400 dark:text-slate-500" />
          )}
        </h5>
        {displayIngredients?.length ? (
          <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
            {displayIngredients.map((ingredient, i) => (
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
            {t("noIngredients")}
          </p>
        )}
      </div>

      {/* Instructions */}
      <div>
        <h5 className="font-semibold text-sm text-slate-900 dark:text-white mb-2">
          {t("instructions")}
        </h5>
        {displayInstructions?.length ? (
          <ol className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
            {displayInstructions.map((instruction, i) => (
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
            {t("noInstructions")}
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

        {/* Refine Meal */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRefineOpen(true)}
          className="flex-1 border-violet-400/40 text-violet-300 hover:bg-violet-500/10"
        >
          <Wand2 className="w-4 h-4 mr-2" />
          Refine Meal
        </Button>
        
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

      {/* Undo banner — shown after a refinement is accepted */}
      {preRefineMeal && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
            padding: "8px 12px",
            background: "rgba(139,92,246,0.12)",
            borderRadius: 10,
            border: "1px solid rgba(139,92,246,0.25)",
          }}
        >
          <RotateCcw className="h-3.5 w-3.5 text-violet-400 shrink-0" />
          <span style={{ flex: 1, fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
            Showing refined version
          </span>
          <button
            onClick={() => {
              // Restore original by setting currentMeal back to the first snapshot
              setCurrentMeal(preRefineMeal!);
              if (onRefined) onRefined(preRefineMeal!);
              setPreRefineMeal(null);
            }}
            style={{
              fontSize: 12,
              color: "rgba(139,92,246,0.9)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            Restore original
          </button>
        </div>
      )}
      
      {/* Add to shopping list status message */}
      {addMessage && (
        <div className={`mt-2 text-sm text-center ${
          addMessage.includes("✅") ? "text-green-600" : "text-red-600"
        }`}>
          {addMessage}
        </div>
      )}
    </div>

    <MealRefinementSheet
      open={refineOpen}
      onOpenChange={setRefineOpen}
      meal={currentMeal as any}
      builderType={builderType ?? "builder"}
      onRefined={(refined) => {
        // Preserve the first original only
        if (!preRefineMeal) setPreRefineMeal({ ...currentMeal });
        const name = refined.name ?? refined.title ?? currentMeal.name;

        // Adapt the API response back to MealCardFull's schema:
        //   nutrition:   protein/carbs/fat → protein_g/carbs_g/fat_g
        //   ingredients: {name, quantity}  → {item, amount}
        const adaptedNutrition: Meal["nutrition"] = refined.nutrition
          ? {
              calories:  refined.nutrition.calories  ?? currentMeal.nutrition.calories,
              protein_g: refined.nutrition.protein_g ?? refined.nutrition.protein ?? currentMeal.nutrition.protein_g,
              carbs_g:   refined.nutrition.carbs_g   ?? refined.nutrition.carbs   ?? currentMeal.nutrition.carbs_g,
              fat_g:     refined.nutrition.fat_g     ?? refined.nutrition.fat     ?? currentMeal.nutrition.fat_g,
            }
          : currentMeal.nutrition;

        const adaptedIngredients: Meal["ingredients"] = Array.isArray(refined.ingredients)
          ? refined.ingredients.map((ing: any) => ({
              item:   ing.item   ?? ing.name     ?? "",
              amount: ing.amount ?? ing.quantity ?? 1,
              unit:   ing.unit   ?? "",
              notes:  ing.notes,
            }))
          : currentMeal.ingredients;

        const updated: Meal = {
          ...currentMeal,
          name,
          description: refined.description ?? currentMeal.description,
          instructions: refined.instructions ?? currentMeal.instructions,
          servings:     refined.servings     ?? currentMeal.servings,
          cookingTime:  refined.cookingTime  ?? currentMeal.cookingTime,
          difficulty:   refined.difficulty   ?? currentMeal.difficulty,
          nutrition: adaptedNutrition,
          ingredients: adaptedIngredients,
        };

        // Update local state so the card re-renders immediately
        setCurrentMeal(updated);
        // Also notify the parent if it needs to persist the change
        if (onRefined) onRefined(updated);
      }}
    />
    </>
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