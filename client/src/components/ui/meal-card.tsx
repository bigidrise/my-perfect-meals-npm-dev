import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiUrl } from '@/lib/resolveApiBase';
import { Button } from "@/components/ui/button";
import { Clock, Users, Zap, ChefHat } from "lucide-react";
import type { Recipe } from "@shared/schema";
import MedicalInfoBubble from "@/components/MedicalInfoBubble";
import { generateMedicalBadges, getUserMedicalProfile } from "@/utils/medicalPersonalization";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { isFeatureEnabled } from "@/lib/productionGates";

interface MealCardProps {
  recipe?: Recipe;
  compact?: boolean;
  onSelect?: () => void;
  onViewRecipe?: () => void;
  onSendToShoppingList?: () => void;
  onCreateMeal?: () => void;
  onReplace?: () => void;
}

export default function MealCard({ recipe, compact = false, onSelect, onViewRecipe, onSendToShoppingList, onCreateMeal, onReplace }: MealCardProps) {
  const { user } = useAuth();
  const userId = user?.id?.toString() || "";
  const [, setLocation] = useLocation();
  
  const hasInstructions = recipe?.instructions && recipe.instructions.length > 0;
  
  const handlePrepareWithChef = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!recipe || !hasInstructions) return;
    
    const mealData = {
      id: recipe.id?.toString() || crypto.randomUUID(),
      name: recipe.name,
      description: recipe.description,
      mealType: recipe.mealType,
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions,
      imageUrl: recipe.imageUrl,
      calories: recipe.calories,
      protein: recipe.protein,
      carbs: recipe.carbs,
      fat: recipe.fat,
      servings: recipe.servings,
      servingSize: (recipe as any).servingSize,
      medicalBadges: (recipe as any).medicalBadges || [],
    };
    
    // Store meal in Chef's Kitchen format + flag to enter prepare mode
    localStorage.setItem("mpm_chefs_kitchen_meal", JSON.stringify(mealData));
    localStorage.setItem("mpm_chefs_kitchen_external_prepare", "true");
    
    setLocation("/lifestyle/chefs-kitchen");
  };
  
  if (!recipe) {
    return (
      <Card className="border-dashed">
        <CardContent className={`${compact ? 'p-3' : 'p-4'} text-center`}>
          <div className="text-muted-foreground">
            <div className={`w-full ${compact ? 'h-16' : 'h-32'} bg-muted rounded-lg mb-2 flex items-center justify-center`}>
              <span className="text-xs">No recipe</span>
            </div>
            <p className="text-xs">Add a meal</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Generate medical badges based on user profile
  const userProfile = getUserMedicalProfile(1); // Replace with actual user ID
  const medicalBadges = generateMedicalBadges(recipe, userProfile);
  
  return (
    <Card className="shadow-lg hover:shadow-green-500/50 hover:shadow-xl transition-all duration-300 cursor-pointer" onClick={onSelect}>
      <CardContent className={compact ? "p-3" : "p-4"}>
        {/* Recipe Name and Meal Type */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-1">
            <h3 className={`font-medium text-foreground ${compact ? 'text-sm' : 'text-base'}`}>
              {recipe.name}
            </h3>
            {/* Medical Info Bubble - positioned near title */}
            {!compact && <MedicalInfoBubble badges={medicalBadges} description="This recipe supports your health goals and dietary needs." />}
          </div>
          {recipe.mealType && (
            <span className="text-sm text-green-600 dark:text-green-400 font-medium capitalize px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded-full">
              {recipe.mealType}
            </span>
          )}
        </div>
        
        {/* Recipe Stats */}
        <div className={`flex items-center justify-between mb-2 ${compact ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
          <div className="flex items-center space-x-3">
            {recipe.prepTime && (
              <div className="flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                <span>{recipe.prepTime}m</span>
              </div>
            )}
            {recipe.servings && (
              <div className="flex items-center">
                <Users className="h-3 w-3 mr-1" />
                <span>{recipe.servings}</span>
              </div>
            )}
          </div>
          {recipe.calories && (
            <div className="flex items-center">
              <Zap className="h-3 w-3 mr-1" />
              <span className="font-medium">{recipe.calories} cal</span>
            </div>
          )}
        </div>

        {/* Serving Size - ALWAYS DISPLAY */}
        <div className={`mb-2 ${compact ? 'text-xs' : 'text-sm'} text-muted-foreground`}>
          <span className="font-medium text-foreground">Serving:</span> {(recipe as any).servingSize || recipe.servings || '1 serving'}
        </div>
        
        {/* Nutrition Info */}
        {!compact && (
          <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
            {recipe.protein && (
              <div className="text-center">
                <div className="font-medium text-foreground">{recipe.protein}g</div>
                <div className="text-muted-foreground">Protein</div>
              </div>
            )}
            {recipe.carbs && (
              <div className="text-center">
                <div className="font-medium text-foreground">{recipe.carbs}g</div>
                <div className="text-muted-foreground">Carbs</div>
              </div>
            )}
            {recipe.fat && (
              <div className="text-center">
                <div className="font-medium text-foreground">{recipe.fat}g</div>
                <div className="text-muted-foreground">Fat</div>
              </div>
            )}
          </div>
        )}
        
        {/* Tags */}
        {recipe.tags && recipe.tags.length > 0 && (
          <div className={`flex flex-wrap gap-1 mb-3 ${compact ? 'hidden' : ''}`}>
            {recipe.tags.slice(0, compact ? 2 : 3).map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        
        {/* Dietary Restrictions */}
        {recipe.dietaryRestrictions && recipe.dietaryRestrictions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mb-3 ${compact ? 'hidden' : ''}`}>
            {recipe.dietaryRestrictions.slice(0, 2).map((restriction, index) => (
              <Badge key={index} variant="outline" className="text-xs capitalize">
                {restriction.replace("-", " ")}
              </Badge>
            ))}
          </div>
        )}
        
        {/* Full Ingredients List */}
        {!compact && recipe.ingredients && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-foreground mb-2">Ingredients:</h4>
            <div className="space-y-1 text-xs text-muted-foreground max-h-32 overflow-y-auto">
              {recipe.ingredients.map((ingredient, index) => (
                <div key={index} className="flex justify-between">
                  <span>{ingredient.name}</span>
                  <span className="font-medium">{ingredient.amount} {ingredient.unit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full Cooking Instructions */}
        {!compact && recipe.instructions && (
          <div className="mb-4">
            <h4 className="text-sm font-medium text-foreground mb-2">Cooking Instructions:</h4>
            <div className="text-xs text-muted-foreground space-y-2 max-h-40 overflow-y-auto">
              {recipe.instructions.map((instruction, index) => (
                <div key={index} className="flex">
                  <span className="mr-2 text-primary font-medium min-w-[16px]">{index + 1}.</span>
                  <span>{instruction}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {!compact && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button 
                size="sm" 
                className="flex-1 text-xs bg-gray-400 text-white opacity-50 cursor-not-allowed"
                disabled={true}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                Under Construction
              </Button>
              <Button 
                size="sm" 
                className="flex-1 text-xs bg-purple-500 hover:bg-purple-600 text-white shadow-md hover:shadow-lg active:scale-95 transition-all duration-200"
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateMeal?.();
                }}
              >
                Create a Meal
              </Button>
            </div>
            <div className="flex justify-center">
              <Button 
                size="sm" 
                className="text-xs bg-green-500 hover:bg-green-600 text-white shadow-md hover:shadow-lg active:scale-95 transition-all duration-200"
                onClick={async (e) => {
                  e.stopPropagation();
                  // Log meal to food log
                  try {
                    const response = await fetch(apiUrl('/api/meal-logs'), {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        userId,
                        recipeId: recipe.id,
                        date: new Date(),
                        mealType: "meal",
                        servings: 1,
                        notes: `Logged from meal card: ${recipe.name}`
                      })
                    });
                    
                    if (response.ok) {
                      // Show success toast
                      const event = new CustomEvent('show-toast', {
                        detail: {
                          title: "Logged to Food Diary",
                          description: `${recipe.name} has been added to your food log.`,
                        }
                      });
                      window.dispatchEvent(event);
                    }
                  } catch (error) {
                    console.error('Failed to log meal:', error);
                  }
                }}
              >
                Mark as Eaten
              </Button>
            </div>
            {hasInstructions && isFeatureEnabled('chefsKitchen') && (
              <div className="flex justify-center">
                <Button 
                  size="sm" 
                  className="text-xs bg-lime-600 hover:bg-lime-500 text-black font-semibold shadow-md hover:shadow-lg active:scale-95 transition-all duration-200 flex items-center gap-1.5"
                  onClick={handlePrepareWithChef}
                >
                  <ChefHat className="h-3.5 w-3.5" />
                  Cook w/ Chef
                </Button>
              </div>
            )}
          </div>
        )}
        
        {compact && recipe.calories && (
          <div className="text-xs text-muted-foreground text-center">
            {recipe.calories} cal
          </div>
        )}
      </CardContent>
    </Card>
  );
}
