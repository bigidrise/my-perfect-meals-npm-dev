import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, Sparkles } from "lucide-react";

interface SmartAddProps {
  onAdd: (ingredient: string) => void;
  isLoading?: boolean;
}

const SMART_SUGGESTIONS = {
  proteins: ['Organic Chicken Breast', 'Wild Salmon', 'Grass-Fed Beef', 'Free-Range Eggs', 'Tofu'],
  vegetables: ['Organic Spinach', 'Bell Peppers', 'Avocado', 'Broccoli', 'Sweet Potatoes'],
  grains: ['Brown Rice', 'Quinoa', 'Whole Wheat Bread', 'Oats', 'Wild Rice'],
  pantry: ['Extra Virgin Olive Oil', 'Sea Salt', 'Black Pepper', 'Garlic', 'Onions']
};

const CONTEXTUAL_TIPS = [
  "🥗 Add leafy greens for essential vitamins",
  "🍗 Include lean proteins for muscle health", 
  "🌾 Choose whole grains for sustained energy",
  "🥑 Don't forget healthy fats like avocados",
  "🧄 Fresh herbs and spices boost nutrition"
];

export default function SmartAddComponent({ onAdd, isLoading = false }: SmartAddProps) {
  const [ingredient, setIngredient] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [currentTip, setCurrentTip] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    // Rotate contextual tips
    const interval = setInterval(() => {
      setCurrentTip(prev => (prev + 1) % CONTEXTUAL_TIPS.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (ingredient.length > 2) {
      // Generate smart suggestions based on input
      const allSuggestions = Object.values(SMART_SUGGESTIONS).flat();
      const filtered = allSuggestions.filter(item =>
        item.toLowerCase().includes(ingredient.toLowerCase())
      );
      setSuggestions(filtered.slice(0, 5));
    } else {
      setSuggestions([]);
    }
  }, [ingredient]);

  const handleAddIngredient = (itemToAdd?: string) => {
    const finalItem = itemToAdd || ingredient;
    
    if (!finalItem.trim()) {
      toast({ 
        title: "Missing Ingredient", 
        description: "Please enter an ingredient to add.",
        variant: "destructive"
      });
      return;
    }

    onAdd(finalItem);
    setIngredient("");
    setSuggestions([]);
    
    toast({ 
      title: "Added Successfully! 🛒", 
      description: `${finalItem} has been added to your smart shopping list.`,
      duration: 2000
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddIngredient();
    }
  };

  const QuickAddSection = ({ title, items, icon }: { title: string; items: string[]; icon: string }) => (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-white/80 flex items-center gap-1">
        <span>{icon}</span> {title}
      </h4>
      <div className="flex flex-wrap gap-1">
        {items.slice(0, 3).map((item) => (
          <Badge 
            key={item}
            variant="outline" 
            className="cursor-pointer bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white transition-colors"
            onClick={() => handleAddIngredient(item)}
          >
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );

  return (
    <Card className="w-full bg-black/30 backdrop-blur-lg border-white/20 rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-white">
          <Sparkles className="h-5 w-5 text-blue-400" />
          Smart Add Ingredient
        </CardTitle>
        <div className="flex items-center gap-2 text-sm text-white/80">
          <Lightbulb className="h-4 w-4 text-yellow-400" />
          <span className="transition-all duration-300">
            {CONTEXTUAL_TIPS[currentTip]}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="relative">
          <Input
            value={ingredient}
            onChange={(e) => setIngredient(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type an ingredient (e.g., 'organic chicken')"
            className="pr-20 bg-white/10 border-white/20 text-white placeholder:text-white/60"
            disabled={isLoading}
            list="ingredient-suggestions"
          />
          <datalist id="ingredient-suggestions">
            {suggestions.map((suggestion, index) => (
              <option key={index} value={suggestion} />
            ))}
          </datalist>
          
          <Button 
            onClick={() => handleAddIngredient()}
            disabled={isLoading || !ingredient.trim()}
            size="sm"
            className="absolute right-1 top-1 h-8"
          >
            {isLoading ? "Adding..." : "Add"}
          </Button>
        </div>

        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">💡 Smart suggestions:</p>
            <div className="flex flex-wrap gap-1">
              {suggestions.map((suggestion) => (
                <Badge 
                  key={suggestion}
                  variant="secondary"
                  className="cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                  onClick={() => handleAddIngredient(suggestion)}
                >
                  {suggestion}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <QuickAddSection title="Proteins" items={SMART_SUGGESTIONS.proteins} icon="🍗" />
          <QuickAddSection title="Vegetables" items={SMART_SUGGESTIONS.vegetables} icon="🥬" />
          <QuickAddSection title="Grains" items={SMART_SUGGESTIONS.grains} icon="🌾" />
          <QuickAddSection title="Pantry" items={SMART_SUGGESTIONS.pantry} icon="🧄" />
        </div>
      </CardContent>
    </Card>
  );
}