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
import DietStyleBadge from "@/components/DietStyleBadge";
import MealClassificationPill, { type DietClassification } from "@/components/MealClassificationPill";
import KosherProTip from "@/components/KosherProTip";
import BuilderSourcePill from "@/components/BuilderSourcePill";
import { normalizeInstructions } from "@/utils/normalizeInstructions";

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
  dietClassification?: DietClassification | null;
  builderType?: string;
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
  date, slot, meal, onUpdated, showStarchBadge = false, coachingLine,
}: {
  date: string; // "board" or "YYYY-MM-DD"
  slot: Slot;
  meal: Meal;
  onUpdated: (m: Meal | null) => void; // null = delete
  showStarchBadge?: boolean; // Show starch/fiber classification badge on meal boards
  coachingLine?: string; // Optional coaching confirmation line shown below the meal image
}) {
  const { toast } = useToast();
  const [macrosLogged, setMacrosLogged] = React.useState(false);
  const [ingredientsExpanded, setIngredientsExpanded] = React.useState(false);
  const [instructionsExpanded, setInstructionsExpanded] = React.useState(false);
  const [activeStep, setActiveStep] = React.useState<number | null>(null);
  const [translatedContent, setTranslatedContent] = React.useState<{
    name?: string;
    description?: string;
    ingredients?: any[];
    instructions?: any[] | string;
  }>({});

  React.useEffect(() => {
    setTranslatedContent({});
    setInstructionsExpanded(false);
    setActiveStep(null);
  }, [meal.id]);

  const title = meal.title || meal.name || "Meal";
  const displayTitle = translatedContent.name ?? title;
  const displayDescription = translatedContent.description ?? (meal as any).description;
  const displayIngredients = translatedContent.ingredients ?? meal.ingredients;
  const displayInstructions = translatedContent.instructions ?? meal.instructions;
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
  const isAIMeal = isChefMeal || meal.id?.startsWith("ai-meal-");
  const imageUrl = (meal as any).imageUrl as string | null | undefined;
  const [imageRevealed, setImageRevealed] = React.useState(false);

  return (
    <div className={`relative rounded-2xl border bg-white/5 backdrop-blur-xl overflow-hidden hover:bg-white/10 transition-colors ${isChefMeal ? "flash-border" : "border-white/20"}`}>
      {/* Image slot — always rendered for AI/chef meals so shimmer shows while loading */}
      {(isAIMeal || imageUrl) && (
        <div
          className="relative w-full h-48 overflow-hidden"
          style={{ background: "linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%)" }}
        >
          {/* Shimmer — visible while imageUrl is absent */}
          {!imageUrl && (
            <div
              className="mpm-shimmer-bar absolute inset-0"
              style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
                animation: "mpm-shimmer 1.8s ease-in-out infinite",
              }}
            />
          )}
          {/* Image — fades in once loaded */}
          {imageUrl && (
            <>
              {!imageRevealed && (
                <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #1c1c1e 0%, #2c2c2e 100%)" }} />
              )}
              <img
                src={imageUrl}
                alt={title}
                className={`w-full h-48 object-cover transition-opacity duration-300 ${imageRevealed ? "opacity-100" : "opacity-0"}`}
                onLoad={() => setImageRevealed(true)}
                onError={(e) => {
                  e.currentTarget.src = `https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=300&fit=crop&auto=format`;
                  setImageRevealed(true);
                }}
              />
            </>
          )}
        </div>
      )}

      {/* Coaching confirmation line — specific line from builder, or universal fallback */}
      <div className="px-4 pt-3 pb-0">
        <p className="text-xs text-white/55 leading-relaxed border-l-2 border-white/20 pl-2.5">
          {coachingLine || "Built for your current plan and targets."}
        </p>
      </div>

      <div className="p-4">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-white font-semibold leading-snug text-lg flex-1">
              {displayTitle.includes('(') ? (
                <>
                  {displayTitle.split('(')[0].trim()}
                  <br />
                  ({displayTitle.split('(')[1]}
                </>
              ) : (
                displayTitle
              )}
            </h3>
            {showStarchBadge && (
              <StarchMealBadge meal={{ name: displayTitle, ingredients: displayIngredients }} />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <DietStyleBadge />
            <BuilderSourcePill source={meal.builderType} />
            <MealClassificationPill dietClassification={meal.dietClassification} />
            <KosherProTip dietClassification={meal.dietClassification} />
          </div>

          {/* Description */}
          {displayDescription && (
            <p className="text-sm text-white/80 mt-1">{displayDescription}</p>
          )}

          {/* Medical Safety row — always rendered, trash anchored to the right */}
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
            
            return (
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {medicalBadges.length > 0 && (
                    <>
                      <HealthBadgesPopover badges={badgeIds} />
                      <h3 className="font-semibold text-white text-sm">Medical Safety</h3>
                    </>
                  )}
                </div>
                <div onClick={(e) => e.stopPropagation()}>
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
        {Array.isArray(displayIngredients) && displayIngredients.length > 0 && (
          <div className="mt-3 space-y-2">
            <h4 className="text-sm font-semibold text-white">Ingredients:</h4>
            <ul className="text-xs text-white/80 space-y-1">
              {(ingredientsExpanded ? displayIngredients : displayIngredients.slice(0, 4)).map((ing: any, i: number) => {
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
                const ingDisplayText = qty && unit 
                  ? formatIngredientWithGrams(qty, unit, name)
                  : name;
                
                return (
                  <li key={i} className="flex items-start">
                    <span className="text-green-400 mr-1">•</span>
                    <span>{ingDisplayText}</span>
                  </li>
                );
              })}
              {displayIngredients.length > 4 && (
                <li 
                  className="text-xs text-orange-400 cursor-pointer active:text-orange-300 select-none"
                  onClick={() => setIngredientsExpanded(!ingredientsExpanded)}
                >
                  {ingredientsExpanded 
                    ? "Show less" 
                    : `+ ${displayIngredients.length - 4} more...`}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Cooking Instructions - step-by-step, collapsible, tap-to-highlight */}
        {(() => {
          const steps = normalizeInstructions(displayInstructions);
          if (steps.length === 0) return null;
          const visibleSteps = instructionsExpanded ? steps : steps.slice(0, 3);
          return (
            <div className="mt-3">
              <h4 className="text-sm font-semibold text-white mb-2">Instructions:</h4>
              <div className="space-y-2">
                {visibleSteps.map((step, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors select-none ${
                      activeStep === index
                        ? "bg-orange-500/20 border border-orange-500/40"
                        : "hover:bg-white/5"
                    }`}
                    onClick={() => setActiveStep(activeStep === index ? null : index)}
                  >
                    <div className="min-w-[26px] h-[26px] w-[26px] rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                      {index + 1}
                    </div>
                    <p className="text-sm leading-relaxed text-white/85">{step}</p>
                  </div>
                ))}
              </div>
              {steps.length > 3 && (
                <button
                  className="mt-2 text-xs text-orange-400 font-medium cursor-pointer active:text-orange-300 select-none"
                  onClick={() => {
                    setInstructionsExpanded(!instructionsExpanded);
                    if (instructionsExpanded) setActiveStep(null);
                  }}
                >
                  {instructionsExpanded ? "Show less" : `Show all ${steps.length} steps`}
                </button>
              )}
            </div>
          );
        })()}

        {/* Action Buttons */}
        <div className="mt-3 flex flex-col gap-2">
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
              name: displayTitle,
              description: displayDescription,
              ingredients: (displayIngredients ?? []).map((ing: any) => ({
                name: typeof ing === "string" ? ing : (ing.name || ing.item),
                amount: typeof ing === "string" ? "" : (ing.quantity || ing.amount),
                unit: typeof ing === "string" ? "" : ing.unit,
              })),
              instructions: displayInstructions || [],
              nutrition: meal.nutrition,
            }}
            onContentUpdate={(updated) => setTranslatedContent((prev) => ({ ...prev, ...updated }))}
          />
        </div>
        </div>
      </div>
    </div>
  );
}
