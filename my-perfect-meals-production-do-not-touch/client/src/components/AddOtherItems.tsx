import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  readOtherItems,
  addOtherItem,
  updateOtherItem,
  deleteOtherItem,
  type OtherItem
} from "@/stores/otherItemsStore";

const CATEGORIES = ["Household", "Personal Care", "Pets", "Baby", "Pharmacy", "Misc"] as const;
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

export default function AddOtherItems() {
  const { toast } = useToast();
  const [items, setItems] = useState<OtherItem[]>(() => readOtherItems().items);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("unit");
  const [category, setCategory] = useState<typeof CATEGORIES[number]>("Household");
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const onUpdate = () => setItems(readOtherItems().items);
    window.addEventListener("other:items:updated", onUpdate);
    return () => window.removeEventListener("other:items:updated", onUpdate);
  }, []);

  function resetForm() {
    setName("");
    setBrand("");
    setQty("1");
    setUnit("unit");
    setCategory("Household");
    setEditingId(null);
  }

  function handleAdd() {
    if (!name.trim()) {
      toast({ title: "Item name required", variant: "destructive" });
      return;
    }

    if (editingId) {
      // Update existing
      updateOtherItem(editingId, {
        name: name.trim(),
        brand: brand.trim() || undefined,
        qty: parseFloat(qty) || 1,
        unit: unit.trim(),
        category
      });
      toast({ title: "Item updated" });
    } else {
      // Add new
      addOtherItem({
        name: name.trim(),
        brand: brand.trim() || undefined,
        qty: parseFloat(qty) || 1,
        unit: unit.trim(),
        category
      });
      toast({ title: "Item added", description: brand ? `${brand} ${name}` : name });
    }
    
    resetForm();
    setShowSuggestions(false);
  }

  function handleEdit(item: OtherItem) {
    setEditingId(item.id);
    setName(item.name);
    setBrand(item.brand || "");
    setQty(item.qty.toString());
    setUnit(item.unit);
    setCategory(item.category);
  }

  function handleDelete(id: string) {
    if (confirm("Remove this item?")) {
      deleteOtherItem(id);
      toast({ title: "Item removed" });
    }
  }

  function handleSuggestionClick(suggestion: string) {
    setName(suggestion);
    setShowSuggestions(false);
  }

  const filteredSuggestions = name.length >= 2
    ? QUICK_SUGGESTIONS.filter(s => s.toLowerCase().includes(name.toLowerCase()))
    : [];

  return (
    <div className="rounded-2xl border border-white/20 bg-black/60 text-white p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Package className="h-5 w-5 text-blue-400" />
        <h3 className="text-lg font-semibold">Add Other Items</h3>
      </div>
      
      <p className="text-xs text-white/60 mb-4">
        Add household items (paper towels, pet food, etc.) to your shopping list. These won't affect your macros.
      </p>

      {/* Add Form */}
      <div className="space-y-3 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Item Name */}
          <div className="relative">
            <Label className="text-white/80 text-sm mb-1">Item Name</Label>
            <Input
              placeholder="e.g., Paper Towels, Milk, Dog Food"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setShowSuggestions(e.target.value.length >= 2);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
              onFocus={() => setShowSuggestions(name.length >= 2)}
              className="bg-black/40 border-white/20 text-white placeholder:text-white/40"
              data-testid="input-other-item-name"
            />
            
            {/* Quick Suggestions */}
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-black/90 border border-white/20 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredSuggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    className="w-full text-left px-3 py-2 hover:bg-white/10 text-sm text-white/90"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Brand */}
          <div>
            <Label className="text-white/80 text-sm mb-1">Brand (optional)</Label>
            <Input
              placeholder="e.g., Bounty, Purina, Huggies"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="bg-black/40 border-white/20 text-white placeholder:text-white/40"
              data-testid="input-other-item-brand"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Qty */}
          <div>
            <Label className="text-white/80 text-sm mb-1">Qty</Label>
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

          {/* Unit */}
          <div>
            <Label className="text-white/80 text-sm mb-1">Unit</Label>
            <Input
              placeholder="pack, bottle"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="bg-black/40 border-white/20 text-white placeholder:text-white/40"
              data-testid="input-other-item-unit"
            />
          </div>

          {/* Category */}
          <div className="sm:col-span-2">
            <Label className="text-white/80 text-sm mb-1">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as typeof CATEGORIES[number])}>
              <SelectTrigger className="bg-black/40 border-white/20 text-white" data-testid="select-other-item-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Add Button */}
        <Button
          onClick={handleAdd}
          disabled={!name.trim()}
          className="w-full bg-blue-600/20 border border-blue-400/30 text-blue-200 hover:bg-blue-600/30"
          data-testid="button-add-other-item"
        >
          <Plus className="h-4 w-4 mr-2" />
          {editingId ? "Update Item" : "Add Item"}
        </Button>
        
        {editingId && (
          <Button
            onClick={resetForm}
            variant="ghost"
            className="w-full text-white/70 hover:text-white"
          >
            Cancel Edit
          </Button>
        )}
      </div>

      {/* Items List */}
      {items.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-white/80 mb-2">
            Your Other Items ({items.length})
          </div>
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
              data-testid={`other-item-${item.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white">
                  {item.brand && <span className="text-blue-300">{item.brand} </span>}
                  {item.name}
                </div>
                <div className="text-xs text-white/60 flex items-center gap-3 mt-1">
                  <span>{item.qty} {item.unit}</span>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20">
                    {item.category}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEdit(item)}
                  className="h-8 w-8 p-0 hover:bg-white/20"
                  data-testid={`button-edit-other-${item.id}`}
                >
                  <Edit2 className="h-4 w-4 text-yellow-400" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDelete(item.id)}
                  className="h-8 w-8 p-0 hover:bg-white/20"
                  data-testid={`button-delete-other-${item.id}`}
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
