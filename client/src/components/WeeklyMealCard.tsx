// client/src/components/WeeklyMealCard.tsx
// Updated to match Fridge Rescue meal card exactly
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChefHat, Clock, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { useState } from "react";
import HealthBadgesPopover from "./badges/HealthBadgesPopover";
import { formatIngredientWithGrams } from "@/utils/unitConversions";

interface WeeklyMealCardProps {
  dateISO: string;
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  meal: any;
  time?: string;
  onRegenerate?: (slot: string, mealType: string) => Promise<void>;
}

function convertToAmericanUnits(
  quantity: number | string,
  unit: string,
  ingredientName: string,
): { quantity: string; unit: string } {
  const numQuantity =
    typeof quantity === "string" ? parseFloat(quantity) : quantity;
  if (isNaN(numQuantity)) return { quantity: String(quantity), unit };

  const name = ingredientName.toLowerCase();

  if (unit?.toLowerCase() === "g" || unit?.toLowerCase() === "grams") {
    if (
      name.includes("chicken") ||
      name.includes("beef") ||
      name.includes("pork") ||
      name.includes("turkey") ||
      name.includes("fish") ||
      name.includes("salmon") ||
      name.includes("shrimp") ||
      name.includes("meat") ||
      name.includes("steak") ||
      name.includes("bacon") ||
      name.includes("ham") ||
      name.includes("sausage") ||
      name.includes("cheese") ||
      name.includes("butter")
    ) {
      const ounces = numQuantity / 28.35;
      if (ounces >= 16) {
        const pounds = ounces / 16;
        return {
          quantity: pounds >= 1 ? pounds.toFixed(1) : pounds.toFixed(2),
          unit: "lb",
        };
      }
      return {
        quantity: ounces >= 1 ? ounces.toFixed(1) : ounces.toFixed(2),
        unit: "oz",
      };
    }
  }

  if (unit?.toLowerCase() === "ml" || unit?.toLowerCase() === "milliliters") {
    if (
      name.includes("milk") ||
      name.includes("cream") ||
      name.includes("oil") ||
      name.includes("broth") ||
      name.includes("stock") ||
      name.includes("juice") ||
      name.includes("water") ||
      name.includes("sauce") ||
      name.includes("vinegar")
    ) {
      const flOz = numQuantity / 29.57;
      if (flOz >= 32) {
        const cups = flOz / 8;
        return { quantity: cups.toFixed(1), unit: "cups" };
      }
      return {
        quantity: flOz >= 1 ? flOz.toFixed(1) : flOz.toFixed(2),
        unit: "fl oz",
      };
    }
  }

  return { quantity: String(quantity), unit };
}

export default function WeeklyMealCard({ dateISO, slot, meal, time, onRegenerate }: WeeklyMealCardProps) {
  const [regenerating, setRegenerating] = useState(false);
  const [instructionsExpanded, setInstructionsExpanded] = useState(false);
  
  const title = meal?.name || "Meal";
  const description = meal?.description || "";
  const imageUrl = meal?.imageUrl;
  const ingredients = meal?.ingredients || [];
  const cookingTime = meal?.cookingTime || "15 min";
  const difficulty = meal?.difficulty || "Easy";
  const medicalBadges = meal?.medicalBadges || [];
  
  // Normalize instructions - handle string, array of strings, and array of {step: string} objects
  const rawInstructions = meal?.instructions || "";
  let instructions = "";
  if (Array.isArray(rawInstructions)) {
    instructions = rawInstructions.map((item, idx) => {
      if (typeof item === "string") {
        return `${idx + 1}. ${item}`;
      } else if (item && typeof item === "object" && item.step) {
        return `${idx + 1}. ${item.step}`;
      }
      return "";
    }).filter(Boolean).join(" ");
  } else {
    instructions = String(rawInstructions || "");
  }
  
  const nutrition = meal?.nutrition || {
    calories: meal?.calories || 0,
    protein: meal?.protein || 0,
    carbs: meal?.carbs || 0,
    fat: meal?.fat || 0
  };

  const handleRegenerate = async () => {
    if (!onRegenerate) return;
    setRegenerating(true);
    try {
      await onRegenerate(slot, meal?.mealType || slot);
    } catch (error) {
      console.error("Failed to regenerate meal:", error);
    }
    setRegenerating(false);
  };

  return (
    <Card className="overflow-hidden bg-black/30 backdrop-blur-lg border border-white/20 shadow-xl flex flex-col h-full">
      {/* Image with badges - exactly like Fridge Rescue */}
      <div className="relative">
        <img
          src={
            imageUrl ||
            `https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=300&fit=crop&auto=format`
          }
          alt={title}
          className="w-full h-48 object-cover"
          onError={(e) => {
            e.currentTarget.src = `https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400&h=300&fit=crop&auto=format`;
          }}
        />
        <div className="absolute top-3 left-3">
          <Badge
            variant={difficulty === "Easy" ? "default" : "secondary"}
            className="bg-white/10 border border-white/20 text-white"
          >
            <ChefHat className="h-3 w-3 mr-1" />
            {difficulty}
          </Badge>
        </div>
        <div className="absolute top-3 right-3">
          <Badge variant="outline" className="bg-white">
            <Clock className="h-3 w-3 mr-1" />
            {cookingTime}
          </Badge>
        </div>
      </div>

      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-white">{title}</CardTitle>
        {description && (
          <CardDescription className="text-sm text-white/80">
            {description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col">
        {/* Medical Badges - exactly like Fridge Rescue */}
        {medicalBadges && medicalBadges.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <HealthBadgesPopover
              badges={medicalBadges.map((b: any) => b.badge || b.label || b.id || b.condition)}
              className="mt-2"
            />
          </div>
        )}

        {/* Nutrition Grid - exactly like Fridge Rescue */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-2 rounded-md">
            <div className="text-sm font-bold text-green-400">
              {nutrition?.calories || 0}
            </div>
            <div className="text-xs text-white/70">Cal</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-2 rounded-md">
            <div className="text-sm font-bold text-blue-400">
              {nutrition?.protein || 0}g
            </div>
            <div className="text-xs text-white/70">Protein</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-2 rounded-md">
            <div className="text-sm font-bold text-orange-400">
              {nutrition?.carbs || 0}g
            </div>
            <div className="text-xs text-white/70">Carbs</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 p-2 rounded-md">
            <div className="text-sm font-bold text-purple-400">
              {nutrition?.fat || 0}g
            </div>
            <div className="text-xs text-white/70">Fat</div>
          </div>
        </div>

        {/* Ingredients - exactly like Fridge Rescue */}
        {ingredients && ingredients.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-white">Ingredients:</h4>
            <ul className="text-xs text-white/80 space-y-1">
              {ingredients.slice(0, 4).map((ingredient: any, i: number) => {
                if (typeof ingredient === "string") {
                  return (
                    <li key={i} className="flex items-start">
                      <span className="text-green-400 mr-1">•</span>
                      <span>{ingredient}</span>
                    </li>
                  );
                }

                const converted = convertToAmericanUnits(
                  ingredient.quantity || ingredient.amount || "",
                  ingredient.unit || "",
                  ingredient.name || ingredient.item || "",
                );

                return (
                  <li key={i} className="flex items-start">
                    <span className="text-green-400 mr-1">•</span>
                    <span>
                      {`${converted.quantity} ${converted.unit} ${ingredient.name || ingredient.item}`.trim()}
                    </span>
                  </li>
                );
              })}
              {ingredients.length > 4 && (
                <li className="text-xs text-white/60">
                  + {ingredients.length - 4} more...
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Cooking Instructions - exactly like Fridge Rescue */}
        {instructions && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-white">Instructions:</h4>
            <div className="text-xs text-white/80">
              {instructions.length > 120 ? (
                <div>
                  <p className="mb-2">
                    {instructionsExpanded
                      ? instructions
                      : `${instructions.substring(0, 120)}...`}
                  </p>
                  <button
                    onClick={() => setInstructionsExpanded(!instructionsExpanded)}
                    className="flex items-center gap-1 text-green-400 hover:text-green-300 text-xs font-medium"
                  >
                    {instructionsExpanded ? (
                      <>
                        <ChevronUp className="h-3 w-3" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" />
                        Show More
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <p>{instructions}</p>
              )}
            </div>
          </div>
        )}

        {/* Regenerate Button */}
        {onRegenerate && (
          <Button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="w-full bg-white/10 backdrop-blur-sm hover:bg-white/20 border border-white/20 text-white text-sm mt-auto"
            size="sm"
          >
            <RefreshCw className={`h-3 w-3 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
            {regenerating ? 'Regenerating...' : 'Regenerate Meal'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
