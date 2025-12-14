import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Search, Plus } from "lucide-react";
import { masterIngredients, searchIngredients } from "@/data/ingredients";

interface FoodSelectorProps {
  selectedFoods: string[];
  onFoodsChange: (foods: string[]) => void;
  placeholder?: string;
  helperText?: string;
  allowCustom?: boolean;
}

export function FoodSelector({
  selectedFoods,
  onFoodsChange,
  placeholder = "Search for foods...",
  helperText,
  allowCustom = true
}: FoodSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [customFood, setCustomFood] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchIngredients(searchQuery, 10);
  }, [searchQuery]);

  const addFood = (food: string) => {
    const trimmed = food.trim().toLowerCase();
    if (trimmed && !selectedFoods.includes(trimmed)) {
      onFoodsChange([...selectedFoods, trimmed]);
    }
    setSearchQuery("");
    setCustomFood("");
    setShowSuggestions(false);
  };

  const removeFood = (food: string) => {
    onFoodsChange(selectedFoods.filter(f => f !== food));
  };

  const addCustomFood = () => {
    if (customFood.trim()) {
      addFood(customFood);
    }
  };

  const handleSearch = () => {
    setShowSuggestions(true);
  };

  return (
    <div className="space-y-4">
      {/* Search input with Search button */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/60 h-4 w-4" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder={placeholder}
              className="pl-10 text-white"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={!searchQuery.trim()}
            variant="outline"
            size="sm"
            className="px-4"
          >
            Search
          </Button>
        </div>
        
        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-black/90 backdrop-blur-md border border-white/20 rounded-md shadow-lg max-h-48 overflow-y-auto">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => addFood(suggestion)}
                disabled={selectedFoods.includes(suggestion)}
                className="w-full text-left px-4 py-2 text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {suggestion}
                {selectedFoods.includes(suggestion) && (
                  <span className="text-green-400 ml-2">✓ Added</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Custom food input */}
      {allowCustom && (
        <div className="flex gap-2">
          <Input
            value={customFood}
            onChange={(e) => setCustomFood(e.target.value)}
            placeholder="Add custom food..."
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomFood();
              }
            }}
            className="text-white"
          />
          <Button
            onClick={addCustomFood}
            disabled={!customFood.trim()}
            variant="outline"
            size="sm"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Selected foods */}
      {selectedFoods.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-white">Selected Foods:</h4>
          <div className="flex flex-wrap gap-2">
            {selectedFoods.map((food) => (
              <Badge key={food} variant="secondary" className="flex items-center gap-2 bg-white/20 text-white">
                {food}
                <button
                  onClick={() => removeFood(food)}
                  className="hover:text-red-400"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Helper text */}
      {helperText && (
        <p className="text-sm text-white/80">{helperText}</p>
      )}

      {/* Click outside to close suggestions */}
      {showSuggestions && (
        <div
          className="fixed inset-0 z-5"
          onClick={() => setShowSuggestions(false)}
        />
      )}
    </div>
  );
}