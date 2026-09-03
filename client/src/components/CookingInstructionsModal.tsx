import { useState } from 'react';
import { apiUrl } from '@/lib/resolveApiBase';
import { InformationModal } from "@/components/ui/universal-modal";
import { Button } from '@/components/ui/button';
import { formatIngredientWithGrams } from '@/utils/unitConversions';

export default function CookingInstructionsModal({ 
  meal, 
  open, 
  onOpenChange 
}: { 
  meal: any; 
  open: boolean; 
  onOpenChange: (o: boolean) => void 
}) {
  const [hydrated, setHydrated] = useState<any>(meal);
  const [isHydrating, setIsHydrating] = useState(false);

  async function ensureHydrated() {
    if (hydrated?.instructions?.length && hydrated?.ingredients?.every((i: any) => !!i.amount)) return;
    
    setIsHydrating(true);
    try {
      const res = await fetch(apiUrl('/api/cooking/hydrate-meal'), { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ meal }) 
      });
      const data = await res.json();
      setHydrated(data.meal);
    } catch (error) {
      console.error('Failed to hydrate meal:', error);
    } finally {
      setIsHydrating(false);
    }
  }

  return (
    <InformationModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Cooking Instructions — ${hydrated?.title || meal?.title}`}
      className="bg-zinc-900 text-zinc-100 border-zinc-800 max-w-2xl"
    >
        <div className="space-y-6">
          <div>
            <div className="text-sm font-semibold mb-2 text-zinc-300">
              Ingredients (serves {hydrated?.servings ?? meal.servings ?? 2})
            </div>
            <ul className="list-disc ml-5 text-sm space-y-1">
              {(hydrated?.ingredients || meal.ingredients || []).map((i: any, idx: number) => (
                <li key={idx} className="text-zinc-200">
                  {i.amount && i.unit && i.name 
                    ? formatIngredientWithGrams(i.amount, i.unit, i.name)
                    : `${i.amount ?? '—'} — ${i.name}`}
                </li>
              ))}
            </ul>
          </div>
          
          <div>
            <div className="text-sm font-semibold mb-2 text-zinc-300">Instructions</div>
            <ol className="list-decimal ml-5 text-sm space-y-2">
              {(hydrated?.instructions || meal.instructions || []).map((s: string, idx: number) => (
                <li key={idx} className="text-zinc-200 leading-relaxed">{s}</li>
              ))}
            </ol>
          </div>
          
          <div className="flex gap-2 pt-4 border-t border-zinc-700">
            <Button 
              variant="secondary" 
              onClick={ensureHydrated}
              disabled={isHydrating}
              className="bg-zinc-700 hover:bg-zinc-600"
            >
              {isHydrating ? 'Generating Details...' : 'Ensure Details'}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="border-zinc-600 text-zinc-300 hover:bg-zinc-800"
            >
              Close
            </Button>
          </div>
        </div>
    </InformationModal>
  );
}