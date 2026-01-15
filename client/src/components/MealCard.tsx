// client/src/components/MealCard.tsx
import * as React from "react";
import { BarChart3 } from "lucide-react";
import { generateMedicalBadges, getUserMedicalProfile, type MedicalBadge } from "@/utils/medicalBadges";
import HealthBadgesPopover from "@/components/badges/HealthBadgesPopover";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import MacroBridgeButton from "@/components/biometrics/MacroBridgeButton";
import TrashButton from "@/components/ui/TrashButton";
import { formatIngredientWithGrams } from "@/utils/unitConversions";
import MealCardActions from "@/components/MealCardActions";
import { StarchMealBadge } from "@/components/StarchMealBadge";

// Keep your Meal type colocated here (WeeklyMealBoard imports from this file)
export type Meal = {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  servings?: number;
  ingredients?: any[];
  instructions?: any[];
  nutrition?: { calories: number; protein: number; carbs: number; fat: number; starchyCarbs?: number; fibrousCarbs?: number };
  orderIndex?: number;
  entryType?: "quick" | "recipe";
  brand?: string;
  servingDesc?: string;
  includeInShoppingList?: boolean;
  badges?: string[];
  imageUrl?: string;
  cookingTime?: string;
  difficulty?: string;
  medicalBadges?: any[];
  starchyCarbs?: number;
  fibrousCarbs?: number;
};

type Slot = "breakfast" | "lunch" | "dinner" | "snacks";

function MacroPill({ label, value, suffix = "" }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-lg border border-white/15 bg-black/30 px-2 py-1 text-center">
      <div className="text-[10px] uppercase tracking-wide text-white/60">{label}</div>
      <div className="text-white font-medium">{Math.round(value)}{suffix}</div>
    </div>
  );
}

export function MealCard({
  date, slot, meal, onUpdated, showStarchBadge = false,
}: {
  date: string; // "board" or "YYYY-MM-DD"
  slot: Slot;
  meal: Meal;
  onUpdated: (m: Meal | null) => void; // null = delete
  showStarchBadge?: boolean; // Show starch/fiber classification badge on meal boards
}) {
  const { toast } = useToast();
  const [macrosLogged, setMacrosLogged] = React.useState(false);
  const [ingredientsExpanded, setIngredientsExpanded] = React.useState(false);
  
  const title = meal.title || meal.name || "Meal";
  const kcal = meal.nutrition?.calories ?? 0;
  const protein = meal.nutrition?.protein ?? 0;
  const carbs = meal.nutrition?.carbs ?? 0;
  const fat = meal.nutrition?.fat ?? 0;
  const starchyCarbs = meal.starchyCarbs ?? meal.nutrition?.starchyCarbs;
  const fibrousCarbs = meal.fibrousCarbs ?? meal.nutrition?.fibrousCarbs;
  const hasStarchyFibrous = typeof starchyCarbs === "number" && typeof fibrousCarbs === "number";

  const onDelete = () => { if (confirm("Remove this meal from the board?")) onUpdated(null); };

  const handleLogMacros = async () => {
    try {
      const { post } = await import("@/lib/api");
      const logEntry = {
        mealName: title,
        calories: kcal,
        protein,
        carbs,
        fat,
        starchyCarbs: starchyCarbs || 0,
        fibrousCarbs: fibrousCarbs || 0,
        servings: meal.servings || 1,
        source: "weekly-meal-board"
      };

      await post("/api/macros/log", logEntry);

      queryClient.invalidateQueries({ queryKey: ["macros"] });
      window.dispatchEvent(new Event("macros:updated"));

      setMacrosLogged(true);
      toast({
        title: "Logged Successfully",
        description: `${title} has been logged to your macros.`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to log macros. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Detect Create With Chef meals for special styling
  const isChefMeal = meal.id?.startsWith("chef-");
  
  return (
    <div className={`relative rounded-2xl border bg-white/5 backdrop-blur-xl overflow-hidden hover:bg-white/10 transition-colors ${isChefMeal ? "flash-border" : "border-white/20"}`}>
      {/* Image at top if available (EXACT COPY FROM FRIDGE RESCUE) */}
      {(meal as any).imageUrl && (
        <div className="relative">
          <img
            src={(meal as any).imageUrl}
            alt={title}
            className="w-full h-48 object-cover"
            onError={(e) => {
              e.currentTarget.src = `https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=300&fit=crop&auto=format`;
            }}
          />
        </div>
      )}

      <div className="p-4">
        <div className="absolute top-2 right-2 z-50" onClick={(e) => e.stopPropagation()}>
          <TrashButton
            size="sm"
            onClick={() => onUpdated(null)}
            ariaLabel="Delete meal"
            title="Delete meal"
            confirm={true}
            confirmMessage="Remove this meal from the board?"
            className="touch-manipulation"
          />
        </div>

        <div className="pr-12">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-white font-semibold leading-snug text-lg flex-1">
              {title.includes('(') ? (
                <>
                  {title.split('(')[0].trim()}
                  <br />
                  ({title.split('(')[1]}
                </>
              ) : (
                title
              )}
            </h3>
            {showStarchBadge && (
              <StarchMealBadge meal={{ name: title, ingredients: meal.ingredients }} />
            )}
          </div>
          
          {/* Description (EXACT COPY FROM FRIDGE RESCUE) */}
          {(meal as any).description && (
            <p className="text-sm text-white/80 mt-1">{(meal as any).description}</p>
          )}

          {/* Medical Badges - RESTORED DROPDOWN (EXACT COPY FROM FRIDGE RESCUE) */}
          {(() => {
            const userProfile = getUserMedicalProfile(1);
            const mealForBadges = {
              name: title,
              nutrition: meal.nutrition,
              ingredients: meal.ingredients || [],
              description: meal.description || ''
            };
            const medicalBadges = generateMedicalBadges(mealForBadges, userProfile);
            const badgeIds = medicalBadges.map(b => b.badge);
            
            return medicalBadges && medicalBadges.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <HealthBadgesPopover badges={badgeIds} />
                <h3 className="font-semibold text-white text-sm">Medical Safety</h3>
              </div>
            );
          })()}
          
          {/* Nutrition Grid - Showing Protein | Total Carbs | Fat */}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-2 rounded-md">
              <div className="text-sm font-bold text-blue-400">{Math.round(protein)}g</div>
              <div className="text-xs text-white/70">Protein</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-2 rounded-md">
              <div className="text-sm font-bold text-amber-400">{Math.round(carbs)}g</div>
              <div className="text-xs text-white/70">Carbs</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-2 rounded-md">
              <div className="text-sm font-bold text-purple-400">{Math.round(fat)}g</div>
              <div className="text-xs text-white/70">Fat</div>
            </div>
          </div>
        
        {(meal.brand || meal.servingDesc) && (
          <div className="mt-2 text-[11px] text-white/60">
            {meal.brand && <span className="mr-2">{meal.brand}</span>}
            {meal.servingDesc && <span>• {meal.servingDesc}</span>}
          </div>
        )}

        {/* Ingredients - Expandable */}
        {Array.isArray(meal?.ingredients) && meal.ingredients.length > 0 && (
          <div className="mt-3 space-y-2">
            <h4 className="text-sm font-semibold text-white">Ingredients:</h4>
            <ul className="text-xs text-white/80 space-y-1">
              {(ingredientsExpanded ? meal.ingredients : meal.ingredients.slice(0, 4)).map((ing: any, i: number) => {
                if (typeof ing === "string") {
                  return (
                    <li key={i} className="flex items-start">
                      <span className="text-green-400 mr-1">•</span>
                      <span>{ing}</span>
                    </li>
                  );
                }
                const name = ing.name || ing.item || "Ingredient";
                const qty = ing.quantity || ing.amount || "";
                const unit = ing.unit || "";
                
                // Use formatIngredientWithGrams for proper display
                const displayText = qty && unit 
                  ? formatIngredientWithGrams(qty, unit, name)
                  : name;
                
                return (
                  <li key={i} className="flex items-start">
                    <span className="text-green-400 mr-1">•</span>
                    <span>{displayText}</span>
                  </li>
                );
              })}
              {meal.ingredients.length > 4 && (
                <li 
                  className="text-xs text-orange-400 cursor-pointer active:text-orange-300 select-none"
                  onClick={() => setIngredientsExpanded(!ingredientsExpanded)}
                >
                  {ingredientsExpanded 
                    ? "Show less" 
                    : `+ ${meal.ingredients.length - 4} more...`}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Cooking Instructions - handles both string and array formats */}
        {meal?.instructions && (
          <div className="mt-3 space-y-2">
            <h4 className="text-sm font-semibold text-white">Instructions:</h4>
            <div className="text-xs text-white/80">
              {typeof meal.instructions === "string" ? (
                <p>{meal.instructions}</p>
              ) : Array.isArray(meal.instructions) ? (
                <ol className="list-decimal list-inside space-y-1">
                  {meal.instructions.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              ) : null}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-3 flex gap-2">
          {date !== "board" && (
            <MacroBridgeButton
              meal={{
                protein: protein || 0,
                carbs: carbs || 0,
                starchyCarbs: starchyCarbs || 0,
                fibrousCarbs: fibrousCarbs || 0,
                fat: fat || 0,
                calories: kcal || 0,
                dateISO: date,
                mealSlot: slot,
                servings: meal.servings || 1,
              }}
              label="Add to Macros"
            />
          )}
          <MealCardActions
            meal={{
              name: title,
              description: meal.description,
              ingredients: (meal.ingredients ?? []).map((ing: any) => ({
                name: typeof ing === "string" ? ing : (ing.name || ing.item),
                amount: typeof ing === "string" ? "" : (ing.quantity || ing.amount),
                unit: typeof ing === "string" ? "" : ing.unit,
              })),
              instructions: meal.instructions || [],
              nutrition: meal.nutrition,
            }}
          />
        </div>
        </div>
      </div>
    </div>
  );
}
