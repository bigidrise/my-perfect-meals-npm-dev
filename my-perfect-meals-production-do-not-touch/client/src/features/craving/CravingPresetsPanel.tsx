// 🔒 CRAVING PRESETS PANEL - Plug-in component for Craving Creator
// Reuses Holiday/Potluck scaling pattern with serving selector + Accept flow
// POST /api/craving/accept with { source: "preset" }

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiUrl } from '@/lib/resolveApiBase';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Users, Plus, ChefHat, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { CRAVING_PRESETS, type CravingPreset } from "@/data/cravingsPresetsData";

// Alias for compatibility
const craveMeals = CRAVING_PRESETS;
type CraveMeal = CravingPreset;

const DEV_USER_ID = "00000000-0000-0000-0000-000000000001";

// Scale ingredients based on serving ratio
function scaleIngredients(ingredients: CraveMeal["ingredients"], originalServings: number, newServings: number) {
  const ratio = newServings / originalServings;
  return ingredients.map(ing => ({
    ...ing,
    quantity: parseFloat((ing.quantity * ratio).toFixed(1))
  }));
}

export default function CravingPresetsPanel() {
  const [selectedPreset, setSelectedPreset] = useState<CraveMeal | null>(null);
  const [servings, setServings] = useState(2);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const addToMacrosMutation = useMutation({
    mutationFn: async (data: { preset: CraveMeal; servings: number }) => {
      // Calculate scaled nutrition based on servings
      const baseCalories = 300; // Default base calories per serving
      const baseProtein = 15;   // Default base protein per serving
      const baseCarbs = 20;     // Default base carbs per serving
      const baseFat = 12;       // Default base fat per serving
      
      const totalCalories = Math.round(baseCalories * data.servings);
      const totalProtein = Math.round(baseProtein * data.servings);
      const totalCarbs = Math.round(baseCarbs * data.servings);
      const totalFat = Math.round(baseFat * data.servings);

      const payload = {
        userId: DEV_USER_ID,
        mealId: data.preset.id,
        mealType: "snack",
        source: "craving_creator",
        nutrition: {
          calories: totalCalories,
          protein_g: totalProtein,
          carbs_g: totalCarbs,
          fat_g: totalFat,
        },
        meta: {
          mealName: data.preset.name,
          servings: data.servings,
          source: "craving_presets",
        },
      };

      const response = await fetch(apiUrl("/api/macros/log"), {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID()
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to log to macros: ${response.status} - ${errorText}`);
      }

      return response.json();
    },
    onSuccess: (data, variables) => {
      // Trigger macro refresh in Biometrics dashboard
      window.dispatchEvent(new Event("macros:updated"));

      toast({
        title: "Added to Macros! ✅",
        description: `${variables.preset.name} (${variables.servings} serving${variables.servings !== 1 ? 's' : ''}) logged to your daily macros.`,
      });
      setSelectedPreset(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to Log",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePresetClick = (preset: CraveMeal) => {
    setSelectedPreset(preset);
    setServings(preset.baseServings); // Reset to base servings
  };

  const handleAddToMacros = () => {
    if (selectedPreset) {
      addToMacrosMutation.mutate({ preset: selectedPreset, servings });
    }
  };

  const toggleCardExpansion = (presetId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(presetId)) {
      newExpanded.delete(presetId);
    } else {
      newExpanded.add(presetId);
    }
    setExpandedCards(newExpanded);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-purple-100 mb-2 flex items-center justify-center gap-2">
          <ChefHat className="w-6 h-6" />
          Popular Presets
        </h2>
        <p className="text-purple-200">Quick favorites ready to scale and save</p>
      </div>

      {/* Preset Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {craveMeals.map((preset) => (
          <Card
            key={preset.id}
            className={`cursor-pointer transition-all border-2 ${
              selectedPreset?.id === preset.id
                ? "border-purple-400 bg-purple-900/50 ring-2 ring-purple-400/50"
                : "border-purple-500/30 bg-black/30 hover:bg-purple-900/30 hover:border-purple-400/50"
            }`}
            onClick={() => handlePresetClick(preset)}
          >
            <CardContent className="p-4">
              {/* Preset Image */}
              {preset.image && (
                <div className="mb-3">
                  <img 
                    src={preset.image}
                    alt={preset.name}
                    className="w-full h-32 object-cover rounded-lg"
                    onLoad={() => console.log('✅ Image loaded:', preset.id, preset.image)}
                    onError={(e) => {
                      console.log('❌ Image failed:', preset.id, preset.image);
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
              <h3 className="font-semibold text-white mb-2">{preset.name}</h3>
              <p className="text-purple-200 text-sm mb-3">{preset.summary || ''}</p>
              
              <div className="flex items-center justify-between text-xs text-purple-300 mb-3">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {preset.baseServings} servings
                </span>
                <div className="flex gap-1">
                  {(preset.badges || []).slice(0, 2).map((badge: string, idx: number) => (
                    <span
                      key={idx}
                      className="bg-purple-600/30 px-2 py-1 rounded text-xs"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>

              {/* Cooking Instructions Button */}
              <Button
                onClick={(e) => toggleCardExpansion(preset.id, e)}
                variant="outline"
                size="sm"
                className="w-full bg-purple-600/30 border-purple-500/30 text-purple-100 focus-visible:ring-2 focus-visible:ring-purple-400/50 active:scale-[.99] mb-3"
                aria-expanded={expandedCards.has(preset.id)}
              >
                <BookOpen className="w-3 h-3 mr-1" />
                Cooking Instructions
                {expandedCards.has(preset.id) ? (
                  <ChevronUp className="w-3 h-3 ml-1" />
                ) : (
                  <ChevronDown className="w-3 h-3 ml-1" />
                )}
              </Button>

              {/* Expanded Instructions Dropdown */}
              {expandedCards.has(preset.id) && (
                <div className="space-y-3 border-t border-purple-500/20 pt-3">
                  {/* Ingredients */}
                  <div>
                    <h4 className="font-semibold text-purple-100 text-sm mb-2">Ingredients</h4>
                    <div className="space-y-1">
                      {preset.ingredients.map((ing, idx) => (
                        <div key={idx} className="text-xs text-purple-200 bg-purple-900/20 p-2 rounded">
                          {ing.quantity} {ing.unit || ''} {ing.name}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Instructions */}
                  <div>
                    <h4 className="font-semibold text-purple-100 text-sm mb-2">Instructions</h4>
                    <div className="space-y-2">
                      {preset.instructions.map((instruction, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-purple-200">
                          <span className="bg-purple-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="bg-purple-900/20 p-2 rounded flex-1">{instruction}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Selected Preset Details */}
      {selectedPreset && (
        <Card className="bg-black/40 border-purple-500/30 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-purple-100 flex items-center justify-between">
              <span>{selectedPreset.name}</span>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-300" />
                <Select value={servings.toString()} onValueChange={(value) => setServings(parseInt(value))}>
                  <SelectTrigger className="w-20 bg-purple-900/30 border-purple-500/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 8, 10].map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-purple-200">{selectedPreset.summary || ''}</p>
            
            {/* Health Badges */}
            <div className="flex flex-wrap gap-2">
              {(selectedPreset.badges || []).map((badge: string, idx: number) => (
                <span
                  key={idx}
                  className="bg-purple-600/40 text-purple-100 px-3 py-1 rounded-full text-sm"
                >
                  {badge}
                </span>
              ))}
            </div>

            {/* Scaled Ingredients */}
            <div>
              <h4 className="font-semibold text-purple-100 mb-2">
                Ingredients ({servings} serving{servings > 1 ? 's' : ''})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {scaleIngredients(selectedPreset.ingredients, selectedPreset.baseServings, servings).map((ing, idx) => (
                  <div
                    key={idx}
                    className="bg-purple-900/20 p-2 rounded border border-purple-500/20 text-sm"
                  >
                    <span className="text-purple-100">
                      {ing.quantity} {ing.unit || ''} {ing.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Instructions */}
            <div>
              <h4 className="font-semibold text-purple-100 mb-2">Instructions</h4>
              <div className="space-y-2">
                {selectedPreset.instructions.map((instruction, idx) => (
                  <div
                    key={idx}
                    className="bg-purple-900/20 p-3 rounded border border-purple-500/20"
                  >
                    <div className="flex items-start gap-3">
                      <span className="bg-purple-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="text-purple-100 text-sm">{instruction}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Add to Macros Button */}
            <div className="flex justify-center pt-4">
              <Button
                onClick={handleAddToMacros}
                disabled={addToMacrosMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3"
              >
                {addToMacrosMutation.isPending ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-5 h-5 mr-2" />
                )}
                Add to Macros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}