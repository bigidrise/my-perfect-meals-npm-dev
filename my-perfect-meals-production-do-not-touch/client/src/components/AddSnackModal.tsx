import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { X, Camera } from "lucide-react";

type SnackPayload = {
  title: string;
  brand?: string;
  servingDesc?: string;
  servings: number;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  includeInShoppingList: boolean;
};

export function AddSnackModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (payload: SnackPayload) => void;
}) {
  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [servingDesc, setServingDesc] = useState("");
  const [servings, setServings] = useState<number>(1);
  const [calories, setCalories] = useState<number>(0);
  const [protein, setProtein] = useState<number | undefined>(undefined);
  const [carbs, setCarbs] = useState<number | undefined>(undefined);
  const [fat, setFat] = useState<number | undefined>(undefined);
  const [include, setInclude] = useState<boolean>(false);
  const { toast } = useToast();

  const handlePhotoLog = async () => {
    toast({
      title: "Coming Soon",
      description: "Photo analysis will be available in a future update. Please enter values manually.",
    });
  };

  const calcFromMacros =
    (protein ?? 0) * 4 + (carbs ?? 0) * 4 + (fat ?? 0) * 9;

  const canSave = title.trim().length > 0 && calories >= 0 && servings > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      title: title.trim(),
      brand: brand.trim() || undefined,
      servingDesc: servingDesc.trim() || undefined,
      servings,
      calories,
      protein,
      carbs,
      fat,
      includeInShoppingList: include,
    });
    onClose();
    // reset for next time
    setTitle(""); setBrand(""); setServingDesc("");
    setServings(1); setCalories(0);
    setProtein(undefined); setCarbs(undefined); setFat(undefined);
    setInclude(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-black/90 text-white border-white/20 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Add Custom Snack</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">

          {/* Photo Log Button */}
          <Button
            onClick={handlePhotoLog}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white"
          >
            <Camera className="h-4 w-4 mr-2" />
            📸 Log from Photo
          </Button>
          {/* Name field */}
          <div className="space-y-2">
            <label className="text-sm text-white/90 font-medium">Name</label>
            <input 
              className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-md px-3 py-2 text-sm text-white/95 placeholder-white/50 focus:border-white/50 focus:outline-none focus:ring-1 focus:ring-white/20"
              placeholder="Granola bar, Apple, Chips"
              value={title} 
              onChange={e => setTitle(e.target.value)} 
            />
          </div>

          {/* Brand and Serving Description */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm text-white/90 font-medium">Brand (optional)</label>
              <input 
                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-md px-3 py-2 text-sm text-white/95 placeholder-white/50 focus:border-white/50 focus:outline-none focus:ring-1 focus:ring-white/20"
                placeholder="Quest" 
                value={brand} 
                onChange={e => setBrand(e.target.value)} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/90 font-medium">Serving description</label>
              <input 
                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-md px-3 py-2 text-sm text-white/95 placeholder-white/50 focus:border-white/50 focus:outline-none focus:ring-1 focus:ring-white/20"
                placeholder="1 bar (40g)"
                value={servingDesc} 
                onChange={e => setServingDesc(e.target.value)} 
              />
            </div>
          </div>

          {/* Nutrition Grid */}
          <div className="grid grid-cols-4 gap-3">
            <div className="space-y-2">
              <label className="text-sm text-white/90 font-medium">Servings</label>
              <input 
                type="number" 
                min={0.25} 
                step={0.25}
                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-md px-3 py-2 text-sm text-white/95 placeholder-white/50 focus:border-white/50 focus:outline-none focus:ring-1 focus:ring-white/20"
                value={servings} 
                onChange={e => setServings(parseFloat(e.target.value) || 0)} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/90 font-medium">Calories</label>
              <input 
                type="number" 
                min={0} 
                step={1}
                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-md px-3 py-2 text-sm text-white/95 placeholder-white/50 focus:border-white/50 focus:outline-none focus:ring-1 focus:ring-white/20"
                value={calories} 
                onChange={e => setCalories(parseFloat(e.target.value) || 0)} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/90 font-medium">Protein grams</label>
              <input 
                type="number" 
                min={0} 
                step={1}
                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-md px-3 py-2 text-sm text-white/95 placeholder-white/50 focus:border-white/50 focus:outline-none focus:ring-1 focus:ring-white/20"
                value={protein ?? ''} 
                onChange={e => setProtein(e.target.value === '' ? undefined : parseFloat(e.target.value) || 0)} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/90 font-medium">Carb grams</label>
              <input 
                type="number" 
                min={0} 
                step={1}
                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-md px-3 py-2 text-sm text-white/95 placeholder-white/50 focus:border-white/50 focus:outline-none focus:ring-1 focus:ring-white/20"
                value={carbs ?? ''} 
                onChange={e => setCarbs(e.target.value === '' ? undefined : parseFloat(e.target.value) || 0)} 
              />
            </div>
          </div>

          {/* Fat and Macro Calculator */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm text-white/90 font-medium">Fat grams</label>
              <input 
                type="number" 
                min={0} 
                step={1}
                className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-md px-3 py-2 text-sm text-white/95 placeholder-white/50 focus:border-white/50 focus:outline-none focus:ring-1 focus:ring-white/20"
                value={fat ?? ''} 
                onChange={e => setFat(e.target.value === '' ? undefined : parseFloat(e.target.value) || 0)} 
              />
            </div>
            <div className="text-xs text-white/60 self-end pb-2">
              {protein != null || carbs != null || fat != null
                ? `Macro kcal ≈ ${Math.round(calcFromMacros)}`
                : 'Enter any macros (optional)'}
            </div>
          </div>

          {/* Shopping List Checkbox */}
          <div className="flex items-center gap-2 py-2">
            <input 
              id="inc-list" 
              type="checkbox" 
              className="h-4 w-4 text-purple-400 bg-zinc-800/50 border-zinc-700/50 rounded focus:ring-purple-400/20"
              checked={include} 
              onChange={e => setInclude(e.target.checked)} 
            />
            <label htmlFor="inc-list" className="text-sm text-white/90">
              Add to shopping list (off by default)
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <button 
              className="rounded-md px-4 py-2 border border-white/20 text-white/80 hover:bg-white/10 transition-colors text-sm" 
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              className="rounded-md px-4 py-2 border border-purple-400/50 bg-purple-600/20 text-purple-100 hover:bg-purple-600/30 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-purple-600/20"
              disabled={!canSave} 
              onClick={handleSave}
            >
              Save Snack
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}