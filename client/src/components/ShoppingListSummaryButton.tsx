import { useState } from "react";
import { ShoppingCart, X } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useShoppingListStore } from "@/stores/shoppingListStore";

type Ingredient = {
  name: string;
  qty?: number | string;
  unit?: string;
};

type Props = {
  ingredients: Ingredient[];
  mealName?: string;
  className?: string;
};

export default function ShoppingListSummaryButton({ ingredients, mealName, className }: Props) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const addItems = useShoppingListStore((state) => state.addItems);

  function onAddToList() {
    if (ingredients.length === 0) return;
    
    const items = ingredients.map(i => ({
      name: i.name,
      quantity: typeof i.qty === 'number' ? i.qty : (i.qty ? parseFloat(String(i.qty)) : 1),
      unit: i.unit || '',
      notes: mealName
    }));
    
    addItems(items);
    setOpen(false);
    toast({ 
      title: "Added to Shopping List", 
      description: `${ingredients.length} items from ${mealName || 'this meal'} added to your master list` 
    });
    setLocation("/shopping-list-v2");
  }

  if (ingredients.length === 0) return null;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className={className || "bg-green-500/20 hover:bg-green-500/30 text-green-200 border border-green-400/30"}
        data-testid="button-show-shopping-list"
      >
        <ShoppingCart className="h-4 w-4 mr-2" />
        Shopping
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg bg-white/5 backdrop-blur-2xl border border-white/30 text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Shopping List
              {mealName && <span className="text-sm font-normal text-white/70">— {mealName}</span>}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-xl p-4 bg-black/20 border border-white/15 max-h-[400px] overflow-auto">
              <div className="space-y-2">
                {ingredients.map((ing, idx) => (
                  <div key={idx} className="flex justify-between gap-4 text-sm">
                    <span className="flex-1">{ing.name}</span>
                    <span className="text-white/70 shrink-0">
                      {ing.qty} {ing.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-white/60">
              {ingredients.length} ingredient{ingredients.length !== 1 ? 's' : ''} • Click "Add to Master List" to save for shopping
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              className="border-white/30 text-white/80" 
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={onAddToList} 
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Add to Master List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
