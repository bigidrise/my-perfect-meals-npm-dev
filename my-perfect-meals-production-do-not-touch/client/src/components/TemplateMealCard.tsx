// client/src/components/TemplateMealCard.tsx
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { apiUrl } from '@/lib/resolveApiBase';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatIngredientWithGrams } from "@/utils/unitConversions";

// Centralized macro data availability check
function macroDataAvailable(meal: any): boolean {
  const kcal = Number(meal?.nutrition?.calories ?? meal?.calories ?? 0) || 0;
  const protein = Number(meal?.nutrition?.protein_g ?? meal?.protein ?? meal?.macros?.protein ?? 0) || 0;
  const carbs = Number(meal?.nutrition?.carbs_g ?? meal?.carbs ?? meal?.macros?.carbs ?? 0) || 0;
  const fat = Number(meal?.nutrition?.fat_g ?? meal?.fat ?? meal?.macros?.fat ?? 0) || 0;
  const fiber = Number(meal?.nutrition?.fiber_g ?? meal?.fiber ?? 0) || 0;
  return !!(kcal || protein || carbs || fat || fiber);
}

export function TemplateMealCard({
  meal,
  timeLabel,
  onReplace,
  onSendToMacros,
}: {
  meal: {
    id?: string;
    slug: string;
    name: string;
    type: "breakfast"|"lunch"|"dinner"|"snack";
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    vegetables?: number;
    badges?: string[];
    allergens?: string[];
    imageUrl?: string;
    prepTime?: number;
    cookTime?: number;
    difficulty?: "easy"|"medium"|"hard";
  };
  timeLabel?: string;
  onReplace?: () => void;
  onSendToMacros?: () => void;
}) {
  const [showInstructions, setShowInstructions] = useState(false);
  const totalTime = (meal.prepTime ?? 0) + (meal.cookTime ?? 0);

  return (
    <div className="rounded-2xl overflow-hidden bg-white/[0.04] border border-white/10 backdrop-blur-sm">
      {/* Image */}
      <div className="relative h-40 w-full bg-black/30">
        {/* Bulletproof image with triple fallback chain */}
        <img
          src={meal.imageUrl || `/assets/meals/default-${meal.type || "dinner"}.svg`}
          alt={meal.name}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={(e) => {
            const img = e.currentTarget;
            const course = meal.type || "dinner";
            const FALLBACK_DATA_URI = "data:image/svg+xml;utf8," + encodeURIComponent(
              `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'>
                 <rect width='100%' height='100%' fill='#111'/>
                 <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
                       fill='#888' font-family='system-ui, sans-serif' font-size='20'>
                   Image unavailable
                 </text>
               </svg>`
            );
            
            if (!img.dataset.fallbackTried) {
              img.dataset.fallbackTried = "course";
              img.src = `/assets/meals/default-${course}.svg`;
            } else {
              img.src = FALLBACK_DATA_URI;
            }
          }}
        />
        
        {/* Time label overlay */}
        {timeLabel && (
          <div className="absolute top-2 left-2 px-2 py-1 bg-black/70 text-white/90 text-xs rounded-md">
            {timeLabel}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <h3 className="font-semibold text-white/90 text-base leading-snug">
          {meal.name}
        </h3>

        {/* Macros */}
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div className="text-center">
            <div className="text-white/60">Cal</div>
            <div className="font-medium text-white/90">{meal.calories || "—"}</div>
          </div>
          <div className="text-center">
            <div className="text-white/60">Pro</div>
            <div className="font-medium text-white/90">{meal.protein || "—"}g</div>
          </div>
          <div className="text-center">
            <div className="text-white/60">Carb</div>
            <div className="font-medium text-white/90">{meal.carbs || "—"}g</div>
          </div>
          <div className="text-center">
            <div className="text-white/60">Fat</div>
            <div className="font-medium text-white/90">{meal.fat || "—"}g</div>
          </div>
        </div>

        {/* Time info */}
        {totalTime > 0 && (
          <div className="text-xs text-white/60">
            Total time: {totalTime} min
          </div>
        )}

        {/* Badges */}
        {!!meal.badges?.length && (
          <div className="flex flex-wrap gap-1">
            {meal.badges.slice(0, 4).map((badge, i) => (
              <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-white/10 text-white/70 border border-white/10">
                {badge}
              </span>
            ))}
            {meal.badges.length > 4 && (
              <span className="text-[10px] px-2 py-1 rounded-full bg-white/10 text-white/70 border border-white/10">
                +{meal.badges.length - 4} more
              </span>
            )}
          </div>
        )}

        {/* Allergens (warning) */}
        {!!meal.allergens?.length && (
          <div className="text-[11px] text-amber-300/90">
            Allergens: {meal.allergens.join(", ")}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <Button
            className="w-full"
            onClick={() => setShowInstructions(true)}
          >
            Cooking Instructions
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => onReplace?.()}
          >
            Replace This Meal
          </Button>
          {onSendToMacros && (
            <Button
              variant="outline"
              className="w-full bg-emerald-600/20 border-emerald-400/20 text-emerald-200 hover:bg-emerald-600/30"
              onClick={() => onSendToMacros()}
              disabled={!macroDataAvailable(meal)} // Centralized macro check
            >
              Log to Macros
            </Button>
          )}
        </div>
      </div>
      
      {/* Cooking Instructions Modal */}
      <CookingInstructionsModal 
        meal={meal}
        open={showInstructions}
        onClose={() => setShowInstructions(false)}
      />
    </div>
  );
}

// Crash-proof Cooking Instructions Modal Component  
function CookingInstructionsModal({ meal, open, onClose }: { meal: any, open: boolean, onClose: () => void }) {
  const [hydratedMeal, setHydratedMeal] = useState<any>(meal);
  const [loading, setLoading] = useState(false);
  
  const hydrateMeal = async () => {
    if (loading) return;
    setLoading(true);
    
    try {
      const res = await fetch(apiUrl('/api/cooking/hydrate-meal'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          meal: {
            title: meal.name || meal.title,
            ingredients: meal.ingredients || [
              { name: "protein source" },
              { name: "vegetables" },
              { name: "grain or starch" }
            ],
            servings: meal.servings || 2,
            tags: meal.badges || meal.tags || []
          }
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setHydratedMeal(data.meal);
      }
    } catch (error) {
      console.error('Failed to hydrate meal:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-zinc-900/95 text-zinc-100 border border-white/10 backdrop-blur-sm max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            🍳 Cooking Instructions — {meal.name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Ingredients */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-white">Ingredients</h3>
            <div className="grid gap-2">
              {hydratedMeal?.ingredients?.map((ingredient: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center bg-white/5 rounded-lg p-3">
                  <span className="text-zinc-200">
                    {ingredient.amount && ingredient.unit && ingredient.name 
                      ? formatIngredientWithGrams(ingredient.amount, ingredient.unit, ingredient.name)
                      : `${ingredient.amount || '—'} ${ingredient.name}`}
                  </span>
                </div>
              )) || (
                <div className="text-zinc-400 text-center py-4">
                  No detailed ingredients available
                </div>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-white">Instructions</h3>
            <div className="space-y-3">
              {hydratedMeal?.instructions?.map((step: string, idx: number) => (
                <div key={idx} className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-sm font-medium flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <p className="text-zinc-200 leading-relaxed">{step}</p>
                </div>
              )) || (
                <div className="text-zinc-400 text-center py-4">
                  Click "Get Detailed Instructions" for step-by-step guidance
                </div>
              )}
            </div>
          </div>

          {/* Action Button */}
          <div className="flex gap-3 pt-4">
            <Button 
              onClick={hydrateMeal}
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {loading ? 'Loading...' : 'Get Detailed Instructions'}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}