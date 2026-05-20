import { useState, useEffect, useRef } from "react";
import { Plus, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useShoppingListStore } from "@/stores/shoppingListStore";

const QUICK_SUGGESTIONS = [
  "Paper Towels",
  "Toilet Paper",
  "Trash Bags",
  "Dish Soap",
  "Laundry Detergent",
  "Hand Soap",
  "Toothpaste",
  "Shampoo",
  "Dog Food",
  "Cat Litter",
  "Baby Wipes",
  "Diapers"
];

interface Props {
  prefillName?: string;
  onPrefillConsumed?: () => void;
}

export default function AddOtherItems({ prefillName, onPrefillConsumed }: Props) {
  const { toast } = useToast();
  const { addItem } = useShoppingListStore();
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("unit");
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (prefillName) {
      setName(prefillName);
      onPrefillConsumed?.();
      setTimeout(() => {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      }, 300);
    }
  }, [prefillName]);

  function resetForm() {
    setName("");
    setBrand("");
    setQty("1");
    setUnit("unit");
  }

  function handleAdd() {
    if (!name.trim()) {
      toast({ title: "Item name required", variant: "destructive" });
      return;
    }
    const displayName = brand.trim()
      ? `${brand.trim()} ${name.trim()}`
      : name.trim();
    addItem({ name: displayName, quantity: parseFloat(qty) || 1, unit: unit.trim() || "unit", category: "Other" });
    toast({ title: "Added to your list", description: displayName });
    resetForm();
    setShowSuggestions(false);
  }

  function handleSuggestionClick(suggestion: string) {
    setName(suggestion);
    setShowSuggestions(false);
  }

  const filteredSuggestions = name.length >= 2
    ? QUICK_SUGGESTIONS.filter(s => s.toLowerCase().includes(name.toLowerCase()))
    : [];

  return (
    <div id="add-other-items" className="rounded-2xl border border-white/20 bg-black/60 text-white p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-4">
        <Package className="h-5 w-5 text-blue-400" />
        <h3 className="text-lg font-semibold">Add Other Items</h3>
      </div>

      <p className="text-xs text-white/60 mb-4">
        Add household items, scanned products, or anything else. These appear in your list under Other.
      </p>

      <div className="space-y-3 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Label className="text-white/80 text-sm mb-1 block">Item Name</Label>
            <Input
              ref={nameInputRef}
              placeholder="e.g., Paper Towels, Rao's Marinara"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setShowSuggestions(e.target.value.length >= 2);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleAdd(); }
              }}
              onFocus={() => setShowSuggestions(name.length >= 2)}
              className="bg-black/40 border-white/20 text-white placeholder:text-white/40"
              data-testid="input-other-item-name"
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-black/90 border border-white/20 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredSuggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    className="w-full text-left px-3 py-2 text-sm text-white/90 active:bg-white/10"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label className="text-white/80 text-sm mb-1 block">Brand (optional)</Label>
            <Input
              placeholder="e.g., Bounty, Purina, Rao's"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="bg-black/40 border-white/20 text-white placeholder:text-white/40"
              data-testid="input-other-item-brand"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-white/80 text-sm mb-1 block">Qty</Label>
            <Input
              type="number"
              min="1"
              step="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="bg-black/40 border-white/20 text-white"
              data-testid="input-other-item-qty"
            />
          </div>
          <div>
            <Label className="text-white/80 text-sm mb-1 block">Unit</Label>
            <Input
              placeholder="pack, bottle, bag"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="bg-black/40 border-white/20 text-white placeholder:text-white/40"
              data-testid="input-other-item-unit"
            />
          </div>
        </div>

        <Button
          onClick={handleAdd}
          disabled={!name.trim()}
          className="w-full bg-orange-600/20 border border-orange-400/30 text-orange-200 disabled:opacity-40"
          data-testid="button-add-other-item"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add to List
        </Button>
      </div>
    </div>
  );
}
