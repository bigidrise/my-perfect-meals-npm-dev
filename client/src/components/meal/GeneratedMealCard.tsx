import { Sparkles, Users, Brain } from "lucide-react";
import AddToMealPlanButton from "@/components/AddToMealPlanButton";
import MealCardActions from "@/components/MealCardActions";
import HealthBadgesPopover from "@/components/badges/HealthBadgesPopover";
import { generateMedicalBadges, getUserMedicalProfile } from "@/utils/medicalPersonalization";

export interface GeneratedMealData {
  id: string;
  name: string;
  description?: string;
  mealType?: string;
  ingredients: Array<{
    name: string;
    quantity?: string;
    amount?: number;
    unit?: string;
    notes?: string;
  }>;
  instructions: string[] | string;
  imageUrl?: string | null;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  medicalBadges?: string[];
  flags?: string[];
  servingSize?: string;
  servings?: number;
  reasoning?: string;
}

interface GeneratedMealCardProps {
  generatedMeal: GeneratedMealData;
  mealToShow: GeneratedMealData;
  servings: number;
  onRestart: () => void;
  onContentUpdate?: (updated: Partial<GeneratedMealData>) => void;
  source?: string;
}

export default function GeneratedMealCard({
  generatedMeal,
  mealToShow,
  servings,
  onRestart,
  onContentUpdate,
  source = "unknown",
}: GeneratedMealCardProps) {
  const profile = getUserMedicalProfile(1);
  const mealForBadges = {
    name: generatedMeal.name,
    calories: generatedMeal.calories || 0,
    protein: generatedMeal.protein || 0,
    carbs: generatedMeal.carbs || 0,
    fat: generatedMeal.fat || 0,
    ingredients: generatedMeal.ingredients.map((ing) => ({
      name: ing.name,
      amount: ing.amount ?? 1,
      unit: (ing.unit ?? "serving").toLowerCase(),
    })),
  };
  const medicalBadges = generatedMeal.medicalBadges?.length
    ? generatedMeal.medicalBadges
    : generateMedicalBadges(mealForBadges as any, profile);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-yellow-600" />
          <h3 className="text-xl font-bold text-white">
            {mealToShow.name}
          </h3>
        </div>
        <button
          onClick={onRestart}
          className="text-sm text-white/70 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg transition-colors"
        >
          Create New
        </button>
      </div>

      {mealToShow.description && (
        <p className="text-white/90">{mealToShow.description}</p>
      )}

      {mealToShow.imageUrl && (
        <div className="rounded-lg overflow-hidden">
          <img
            src={mealToShow.imageUrl}
            alt={mealToShow.name}
            className="w-full h-64 object-cover"
          />
        </div>
      )}

      <div className="p-3 bg-black/40 backdrop-blur-md border border-white/20 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-white">
          <Users className="h-4 w-4" />
          <span className="font-medium">Serving Size:</span>
          <span>
            {mealToShow.servingSize ||
              `${servings} ${servings === 1 ? "serving" : "servings"}`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 text-center">
        <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
          <div className="text-lg font-bold text-white">
            {mealToShow.calories || 0}
          </div>
          <div className="text-xs text-white">Calories</div>
        </div>
        <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
          <div className="text-lg font-bold text-white">
            {mealToShow.protein || 0}g
          </div>
          <div className="text-xs text-white">Protein</div>
        </div>
        <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
          <div className="text-lg font-bold text-white">
            {mealToShow.carbs || 0}g
          </div>
          <div className="text-xs text-white">Carbs</div>
        </div>
        <div className="bg-black/40 backdrop-blur-md border border-white/20 p-3 rounded-md">
          <div className="text-lg font-bold text-white">
            {mealToShow.fat || 0}g
          </div>
          <div className="text-xs text-white">Fat</div>
        </div>
      </div>

      <div className="flex gap-2">
        <AddToMealPlanButton meal={generatedMeal as any} />
        <MealCardActions
          meal={{
            name: generatedMeal.name,
            description: generatedMeal.description,
            ingredients: generatedMeal.ingredients.map((ing) => ({
              name: ing.name,
              amount: String(ing.amount ?? ing.quantity ?? ""),
              unit: ing.unit,
            })),
            instructions: generatedMeal.instructions,
            nutrition: generatedMeal.nutrition,
          }}
          onContentUpdate={onContentUpdate ? (updated) => {
            onContentUpdate({
              name: updated.name || generatedMeal.name,
              description: updated.description || generatedMeal.description,
              instructions: updated.instructions || generatedMeal.instructions,
            });
          } : undefined}
          source={source}
        />
      </div>

      {medicalBadges && medicalBadges.length > 0 && (
        <div className="flex items-center gap-3">
          <HealthBadgesPopover
            badges={medicalBadges.map((b: any) =>
              typeof b === "string"
                ? b
                : b.badge || b.id || b.condition || b.label,
            )}
          />
          <h3 className="font-semibold text-white">
            Medical Safety
          </h3>
        </div>
      )}

      {generatedMeal.ingredients?.length > 0 && (
        <div>
          <h4 className="font-semibold mb-2 text-white">
            Ingredients:
          </h4>
          <ul className="text-sm text-white/80 space-y-1">
            {generatedMeal.ingredients.map((ing, i) => (
              <li key={i}>
                {ing.amount ?? ing.quantity} {ing.unit} {ing.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {mealToShow.instructions && (
        <div>
          <h4 className="font-semibold mb-2 text-white">
            Instructions:
          </h4>
          <div className="text-sm text-white/80 whitespace-pre-line max-h-40 overflow-y-auto">
            {Array.isArray(mealToShow.instructions)
              ? mealToShow.instructions.join("\n")
              : mealToShow.instructions}
          </div>
        </div>
      )}

      {mealToShow.reasoning && (
        <div>
          <h4 className="font-semibold mb-2 flex items-center gap-2 text-white">
            <Brain className="h-4 w-4" />
            Why This Works For You:
          </h4>
          <p className="text-sm text-white/80">
            {mealToShow.reasoning}
          </p>
        </div>
      )}
    </div>
  );
}
