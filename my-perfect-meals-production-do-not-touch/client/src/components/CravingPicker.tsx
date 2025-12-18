// client/src/components/CravingPicker.tsx
// Full-screen modal that uses the same backend as Craving Creator
// and returns a meal object to the caller without leaving the page.
import { useState, useEffect } from "react";
import { apiUrl } from '@/lib/resolveApiBase';
import { Button } from "@/components/ui/button";
import { X, RefreshCcw } from "lucide-react";
import MealCard from "@/components/MealCard";

type Ingredient = { name: string; amount: string };

export type PickerMeal = {
  name: string; 
  description?: string; 
  imageUrl?: string;
  ingredients: Ingredient[]; 
  instructions: string[];
  calories?: number; 
  protein?: number; 
  carbs?: number; 
  fats?: number;
  labels?: string[]; 
  badges: string[];
};

export default function CravingPicker({
  open,
  slotLabel,
  onClose,
  onUse,
  userId = "1",
}: {
  open: boolean;
  slotLabel: string; // e.g., "Breakfast" | "Lunch" | "Dinner" | "Snack"
  onClose: () => void;
  onUse: (meal: PickerMeal) => void;
  userId?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [meal, setMeal] = useState<PickerMeal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => { 
    if (open) { 
      setMeal(null); 
      setError(null); 
    } 
  }, [open]);

  async function generate() {
    setLoading(true); 
    setError(null);
    
    try {
      const res = await fetch(apiUrl("/api/meals/craving-creator"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId, 
          targetMealType: slotLabel.toLowerCase(),
          cravingInput: `${slotLabel} meal`,
          includeImage: true 
        }),
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data = await res.json();
      const m = data.meal || data;
      
      const normalized: PickerMeal = {
        name: String(m?.name ?? m?.title ?? "Chef's Choice"),
        description: m?.description ?? m?.summary ?? undefined,
        imageUrl: m?.imageUrl ?? m?.imageURL ?? m?.image ?? undefined,
        ingredients: Array.isArray(m?.ingredients)
          ? m.ingredients.map((x: any) => ({ 
              name: String(x.name ?? x.ingredient ?? "").trim(), 
              amount: String(x.amount ?? x.quantity ?? x.qty ?? "").trim() 
            }))
          : [],
        instructions: Array.isArray(m?.instructions)
          ? m.instructions.map((s: any) => String(s).trim()).filter(Boolean)
          : [],
        calories: m?.calories != null ? Number(m.calories) : undefined,
        protein: m?.protein != null ? Number(m.protein) : undefined,
        carbs: m?.carbs != null ? Number(m.carbs) : undefined,
        fats: m?.fats != null ? Number(m.fats) : (m?.fat != null ? Number(m.fat) : undefined),
        labels: Array.isArray(m?.labels) ? m.labels.map((s: any) => String(s)) : [],
        badges: Array.isArray(m?.badges ?? m?.medicalBadges) ? (m.badges ?? m.medicalBadges).map((s: any) => String(s)) : [],
      };
      
      setMeal(normalized);
    } catch (e: any) {
      setError(e.message || "Failed to generate meal");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-[1000] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-3xl rounded-xl overflow-hidden flex flex-col shadow-xl max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="font-semibold text-gray-900 dark:text-white">
            Craving Picker — {slotLabel}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInfoModal(true)}
              className="bg-lime-700 hover:bg-lime-800 border-2 border-lime-600 text-white rounded-xl w-5 h-5 flex items-center justify-center text-sm font-bold flash-border"
              aria-label="How to use Craving Picker"
            >
              ?
            </button>
            <button 
              onClick={onClose} 
              aria-label="Close"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5"/>
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {!meal ? (
            <div className="flex items-center gap-3">
              <Button onClick={generate} disabled={loading}>
                {loading ? (
                  <>
                    <RefreshCcw className="w-4 h-4 mr-2 animate-spin"/>
                    Generating...
                  </>
                ) : (
                  <>Generate {slotLabel} Option</>
                )}
              </Button>
              {error && (
                <div className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}
            </div>
          ) : (
            <>
              <MealCard
                item={{
                  ...meal,
                  slot: "meal" as const,
                  label: slotLabel,
                  time: "",
                  dayIndex: 0,
                  order: 0,
                  badges: meal.badges ?? [],
                }}
                onRegenerate={generate}
                cravingCreatorHref="#"
              />
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={generate} disabled={loading}>
                  <RefreshCcw className="w-4 h-4 mr-2"/>
                  Different Option
                </Button>
                <Button onClick={() => onUse(meal)}>
                  Use This Meal
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-black/30 backdrop-blur-lg border border-white/20 rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4">How to Use Craving Picker</h3>

            <div className="space-y-4 text-white/90 text-sm">
              <p>Generate AI-powered meals instantly for any meal slot in your plan.</p>

              <ul className="space-y-2 text-white/80 text-sm">
                <li><strong className="text-white">Generate meal:</strong> Click "Generate" to create a custom {slotLabel} option</li>
                <li><strong className="text-white">Review details:</strong> Check ingredients, macros, and instructions</li>
                <li><strong className="text-white">Try different:</strong> Not satisfied? Click "Different Option" for a new suggestion</li>
                <li><strong className="text-white">Add to plan:</strong> Click "Use This Meal" when you find one you like</li>
              </ul>

              <div className="bg-black/20 border border-white/10 rounded-lg p-3">
                <p className="font-semibold text-white mb-1">💡 Tip:</p>
                <p className="text-white/70">
                  Each meal is personalized based on your dietary preferences and restrictions!
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowInfoModal(false)}
              className="mt-6 w-full bg-lime-700 hover:bg-lime-800 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}