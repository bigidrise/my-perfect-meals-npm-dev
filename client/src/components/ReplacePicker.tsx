import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ChefHat, Refrigerator } from "lucide-react";
import type { MealTemplateBase } from "@/data/models";
import { TEMPLATES_SEED } from "@/data/templates.seed";

interface ReplacePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (meal: MealTemplateBase) => void;
  servings: number;
  currentArchetype?: string;
  currentMealType?: string;
}

export default function ReplacePicker({
  isOpen,
  onClose,
  onSelect,
  servings,
  currentArchetype,
  currentMealType
}: ReplacePickerProps) {
  const [selectedTab, setSelectedTab] = useState("templates");

  // Filter templates by current context
  const filteredTemplates = TEMPLATES_SEED.filter(template => {
    const matchesArchetype = !currentArchetype || template.archetype === currentArchetype;
    const matchesMealType = !currentMealType || template.mealType === currentMealType;
    return matchesArchetype && matchesMealType;
  });

  const handleSelect = (meal: MealTemplateBase) => {
    onSelect(meal);
    onClose();
  };

  const renderMealCard = (meal: MealTemplateBase, source: string) => {
    const scaledNutrition = meal.nutritionPerServing ? {
      calories: Math.round(meal.nutritionPerServing.calories * servings),
      protein: Math.round(meal.nutritionPerServing.protein * servings),
      carbs: Math.round(meal.nutritionPerServing.carbs * servings),
      fat: Math.round(meal.nutritionPerServing.fat * servings)
    } : {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0
    };

    return (
      <div
        key={`${source}-${meal.id}`}
        onClick={() => handleSelect(meal)}
        className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl p-4 cursor-pointer hover:bg-black/30 transition-all duration-200 space-y-3"
      >
        <div className="flex justify-between items-start">
          <h3 className="text-white font-semibold text-lg">{meal.name}</h3>
          <span className="text-xs text-white/60 bg-white/10 px-2 py-1 rounded-full">
            {meal.archetype}
          </span>
        </div>

        <p className="text-white/80 text-sm line-clamp-2">{meal.summary}</p>

        {/* Nutrition (scaled to current servings) */}
        {meal.nutritionPerServing ? (
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-white/10 rounded-lg p-2">
              <div className="text-white font-semibold text-sm">{scaledNutrition.calories}</div>
              <div className="text-white/60 text-xs">cal</div>
            </div>
            <div className="bg-white/10 rounded-lg p-2">
              <div className="text-white font-semibold text-sm">{scaledNutrition.protein}g</div>
              <div className="text-white/60 text-xs">protein</div>
            </div>
            <div className="bg-white/10 rounded-lg p-2">
              <div className="text-white font-semibold text-sm">{scaledNutrition.carbs}g</div>
              <div className="text-white/60 text-xs">carbs</div>
            </div>
            <div className="bg-white/10 rounded-lg p-2">
              <div className="text-white font-semibold text-sm">{scaledNutrition.fat}g</div>
              <div className="text-white/60 text-xs">fat</div>
            </div>
          </div>
        ) : (
          <div className="bg-white/10 rounded-lg p-2 text-center">
            <div className="text-white/60 text-sm">Nutrition info pending</div>
          </div>
        )}

        {/* Badges */}
        {meal.badges && meal.badges.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {meal.badges.slice(0, 3).map((badge, i) => (
              <Badge key={i} variant="secondary" className="text-xs bg-white/20 text-white border-white/30">
                {badge}
              </Badge>
            ))}
          </div>
        )}

        <Button 
          size="sm" 
          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
        >
          Select This Meal
        </Button>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] bg-gradient-to-br from-purple-900/95 to-blue-900/95 backdrop-blur border-white/20 text-white overflow-hidden">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle className="text-2xl font-bold text-white">
              Replace with Different Meal
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-white/80">
            Choose a replacement meal (for {servings} serving{servings !== 1 ? 's' : ''})
          </p>
        </DialogHeader>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="h-full">
          <TabsList className="grid w-full grid-cols-2 bg-white/10 border border-white/20">
            <TabsTrigger 
              value="templates" 
              className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/70"
            >
              <ChefHat className="h-4 w-4 mr-2" />
              Templates ({filteredTemplates.length})
            </TabsTrigger>
            <TabsTrigger 
              value="fridge" 
              disabled 
              className="data-[state=active]:bg-white/20 data-[state=active]:text-white text-white/40"
            >
              <Refrigerator className="h-4 w-4 mr-2" />
              Fridge Rescue (Soon)
            </TabsTrigger>
          </TabsList>

          <div className="overflow-y-auto h-[50vh] mt-4">
            <TabsContent value="templates" className="mt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map(template => renderMealCard(template, "template"))}
              </div>
            </TabsContent>

            <TabsContent value="fridge" className="mt-0">
              <div className="text-center py-12 text-white/60">
                <Refrigerator className="h-16 w-16 mx-auto mb-4 opacity-40" />
                <p>Fridge Rescue integration coming soon!</p>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}