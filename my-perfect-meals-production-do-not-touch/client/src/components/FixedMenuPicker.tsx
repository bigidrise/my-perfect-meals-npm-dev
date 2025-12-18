// client/src/components/FixedMenuPicker.tsx
// Lets users select 2–6 specific meals that cycle across the plan when mode === "fixed_menu".
import { useState } from "react";
import { apiUrl } from '@/lib/resolveApiBase';
import { Button } from "@/components/ui/button";
import { X, Plus, RefreshCw } from "lucide-react";
import MealCard from "@/components/MealCard";
import TrashButton from "@/components/ui/TrashButton";

type Ingredient = { name: string; amount: string };
export type FixedMeal = {
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

export default function FixedMenuPicker({ 
  open, 
  onClose, 
  onSave, 
  slotLabel = "Meal", 
  userId = "1" 
}: {
  open: boolean; 
  onClose: () => void; 
  onSave: (meals: FixedMeal[]) => void;
  slotLabel?: string; 
  userId?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<FixedMeal[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [showInfoModal, setShowInfoModal] = useState(false);

  if (!open) return null;

  async function addMeal() {
    setLoading(true); 
    setError(undefined);
    
    try {
      const res = await fetch(apiUrl("/api/meals/craving-creator"), {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId, 
          targetMealType: slotLabel.toLowerCase(),
          cravingInput: `${slotLabel} meal for fixed menu`,
          includeImage: true 
        })
      });
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const data = await res.json();
      const m = data.meal || data;
      
      const norm: FixedMeal = {
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
        badges: Array.isArray(m?.badges ?? m?.medicalBadges) 
          ? (m.badges ?? m.medicalBadges).map((s: any) => String(s)) 
          : [],
      };
      
      setItems(prev => [...prev, norm]);
    } catch (e: any) {
      setError(e.message || "Failed to generate meal");
    } finally { 
      setLoading(false); 
    }
  }

  function removeMeal(idx: number) { 
    setItems(prev => prev.filter((_, i) => i !== idx)); 
  }

  return (
    <div className="fixed inset-0 z-[1000] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 w-full max-w-5xl rounded-xl overflow-hidden flex flex-col shadow-xl max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="font-semibold text-gray-900 dark:text-white">
            Fixed Menu — Choose 2–6 Meals
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInfoModal(true)}
              className="bg-lime-700 hover:bg-lime-800 border-2 border-lime-600 text-white rounded-xl w-5 h-5 flex items-center justify-center text-sm font-bold flash-border"
              aria-label="How to use Fixed Menu Picker"
            >
              ?
            </button>
            <button 
              onClick={onClose} 
              aria-label="Close"
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-4 space-y-4 overflow-y-auto">
          <div className="flex items-center gap-3">
            <Button 
              onClick={addMeal} 
              disabled={loading || items.length >= 6}
              className="bg-green-600 hover:bg-green-700"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Meal
                </>
              )}
            </Button>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Pick at least 2 meals (max 6). We'll cycle them across your plan.
            </div>
            {error && (
              <div className="text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {items.map((m, idx) => (
              <div key={idx} className="relative">
                <MealCard 
                  item={{ 
                    ...m, 
                    slot: "meal" as const, 
                    label: slotLabel, 
                    time: "", 
                    dayIndex: 0,
                    order: idx + 1,
                    badges: m.badges ?? [] 
                  }} 
                  cravingCreatorHref="#" 
                />
                <div className="absolute top-2 right-2">
                  <TrashButton
                    size="sm"
                    onClick={() => removeMeal(idx)}
                    ariaLabel="Remove meal"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              disabled={items.length < 2} 
              onClick={() => onSave(items)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Use These Meals ({items.length})
            </Button>
          </div>
        </div>
      </div>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-black/30 backdrop-blur-lg border border-white/20 rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4">How to Use Fixed Menu Picker</h3>

            <div className="space-y-4 text-white/90 text-sm">
              <p>Create a rotating menu of 2-6 meals that will cycle throughout your week.</p>

              <ul className="space-y-2 text-white/80 text-sm">
                <li><strong className="text-white">Add meals:</strong> Click "Add Meal" to generate meals using AI</li>
                <li><strong className="text-white">Minimum 2, Maximum 6:</strong> Pick between 2-6 meals for variety</li>
                <li><strong className="text-white">Remove meals:</strong> Use the trash icon on any meal to remove it</li>
                <li><strong className="text-white">Automatic rotation:</strong> Your meals will cycle across all days in your plan</li>
              </ul>

              <div className="bg-black/20 border border-white/10 rounded-lg p-3">
                <p className="font-semibold text-white mb-1">💡 Tip:</p>
                <p className="text-white/70">
                  Fixed menus are perfect for meal prep! Choose your favorite meals and we'll rotate them for you.
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