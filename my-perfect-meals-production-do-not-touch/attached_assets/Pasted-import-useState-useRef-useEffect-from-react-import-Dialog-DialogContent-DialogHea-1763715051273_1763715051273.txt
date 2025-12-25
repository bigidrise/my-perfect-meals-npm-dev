import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { Progress } from "@/components/ui/progress";
import { Sparkles, RefreshCw } from "lucide-react";
import TrashButton from "@/components/ui/TrashButton";
import { SNACK_CATEGORIES } from "@/data/snackIngredients";
import { DIABETIC_SNACK_CATEGORIES } from "@/data/diabeticPremadeSnacks";
import { mealIngredients } from "@/data/mealIngredients";
import { Checkbox } from "@/components/ui/checkbox";

interface AIMealCreatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMealGenerated: (meal: any) => void;
  mealSlot: "breakfast" | "lunch" | "dinner" | "snacks";
  showMacroTargeting?: boolean; // Controls visibility of macro targeting section
  dietType?: "weekly" | "diabetic"; // Which snack data to use
}

export default function AIMealCreatorModal({
  open,
  onOpenChange,
  onMealGenerated,
  mealSlot,
  showMacroTargeting = false, // Default to hidden unless explicitly enabled
  dietType = "weekly", // Default to weekly snacks
}: AIMealCreatorModalProps) {
  // Use diabetic snacks for Diabetic Hub, weekly snacks for everything else
  const ACTIVE_SNACK_CATEGORIES = (dietType === "diabetic" && mealSlot === "snacks") 
    ? DIABETIC_SNACK_CATEGORIES 
    : SNACK_CATEGORIES;
  const [ingredients, setIngredients] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("Proteins");
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const tickerRef = useRef<number | null>(null);

  // Macro targeting state (added to match the original code's implicit usage)
  const [macroTargetingEnabled, setMacroTargetingEnabled] = useState(false);
  const [targetProtein, setTargetProtein] = useState<number | ''>('');
  const [targetCarbs, setTargetCarbs] = useState<number | ''>('');
  const [targetFat, setTargetFat] = useState<number | ''>('');

  // Placeholder function for saving macro targets to cache
  const saveMacroTargetsCache = (enabled: boolean, protein: number | '', carbs: number | '', fat: number | '') => {
    console.log("Saving macro targets cache:", { enabled, protein, carbs, fat });
    // In a real app, this would save to local storage or a state management solution
  };

  const startProgressTicker = () => {
    if (tickerRef.current) return;
    setProgress(0);
    tickerRef.current = window.setInterval(() => {
      setProgress((p) => {
        if (p < 90) {
          const next = p + Math.max(1, Math.floor((90 - p) * 0.07));
          return Math.min(next, 90);
        }
        return p;
      });
    }, 150);
  };

  const stopProgressTicker = () => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    setProgress(100);
  };

  const toggleIngredient = (ingredientName: string) => {
    setSelectedIngredients((prev) => {
      const isSelected = prev.some((i) => i.toLowerCase() === ingredientName.toLowerCase());
      if (isSelected) {
        return prev.filter((i) => i.toLowerCase() !== ingredientName.toLowerCase());
      } else {
        return [...prev, ingredientName];
      }
    });
  };

  const handleGenerateMeal = async () => {
    const allIngredients = [...selectedIngredients, ...ingredients.split(",").map(i => i.trim()).filter(i => i)];
    if (allIngredients.length === 0) {
      alert("Please select or enter some ingredients first!");
      return;
    }

    setIsLoading(true);
    startProgressTicker();
    try {
      const response = await fetch("/api/meals/fridge-rescue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fridgeItems: [...selectedIngredients, ...ingredients.split(",").map(i => i.trim()).filter(i => i)],
          userId: 1, // Assuming a default userId for now
          // Macro targets, if enabled, should also be sent here
          macroTargets: macroTargetingEnabled ? { protein: targetProtein, carbs: targetCarbs, fat: targetFat } : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate meal");
      }

      const data = await response.json();
      console.log("🍳 AI Meal Creator received data:", data);

      // Handle both response formats: {meals: [...]} or {meal: {...}}
      let meal;
      if (data.meals && Array.isArray(data.meals) && data.meals.length > 0) {
        meal = data.meals[0]; // Take first meal
      } else if (data.meal) {
        meal = data.meal;
      } else {
        console.error("❌ Invalid data structure:", data);
        throw new Error("No meal found in response");
      }

      // Ensure meal has required fields
      if (!meal.imageUrl) {
        // Provide a default image based on mealSlot if available, or a generic one
        meal.imageUrl = `/assets/meals/default-${mealSlot}.jpg` || "/assets/meals/default-meal.jpg";
      }
      if (!meal.id) {
        meal.id = `ai-meal-${Date.now()}`;
      }

      console.log("✅ Generated meal:", meal.name);
      stopProgressTicker();

      // Pass meal to parent and close modal
      onMealGenerated(meal);
      setIngredients("");
      setSelectedIngredients([]); // Clear selected ingredients
      setSearchQuery(""); // Clear search query
      onOpenChange(false);
    } catch (error) {
      console.error("Error generating meal:", error);
      stopProgressTicker();
      alert("Failed to generate meal. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Cleanup ticker on unmount
  useEffect(() => {
    return () => {
      if (tickerRef.current) {
        clearInterval(tickerRef.current);
      }
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-gradient-to-br from-purple-900/95 via-pink-800/95 to-purple-900/95 backdrop-blur-xl border border-white/20 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-pink-400" />
            Create Meal with AI
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="text-center">
            <p className="text-white/90 mb-4">
              Tell us what ingredients you have, and we'll create a delicious{" "}
              <span className="font-semibold text-pink-300">{mealSlot}</span> recipe
              for you!
            </p>
          </div>

          <div className="space-y-3">
            <label
              htmlFor="ai-ingredients"
              className="block text-sm font-medium text-white/90"
            >
              Select Ingredients:
            </label>

            {/* Category Tabs */}
            {!isLoading && mealSlot !== "snacks" && (
              <div className="flex flex-nowrap gap-2 mb-3 overflow-x-auto w-full min-w-0 pb-2">
                {Object.keys(mealIngredients).map((category) => (
                  <button
                    key={category}
                    onClick={() => setActiveCategory(category)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-2xl text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                      activeCategory === category
                        ? 'bg-purple-600/40 border-2 border-purple-400 text-white shadow-md'
                        : 'bg-black/40 border border-white/20 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}

            {/* Snack Category Suggestions */}
            {mealSlot === "snacks" && !isLoading && (
              <div className="flex flex-wrap gap-2 mb-2">
                {ACTIVE_SNACK_CATEGORIES.map((category) => (
                  <button
                    key={category.name}
                    type="button"
                    onClick={() => {
                      const categoryItems = category.items.slice(0, 5).join(", ");
                      setIngredients((prev) =>
                        prev ? `${prev}, ${categoryItems}` : categoryItems
                      );
                    }}
                    className="px-3 py-1 bg-pink-600/20 hover:bg-pink-600/30 border border-pink-400/30 rounded-lg text-xs text-white/90 transition-colors"
                  >
                    {category.emoji} {category.name}
                  </button>
                ))}
              </div>
            )}

            {/* Macro Targeting Section - Only for Beach Body & Athlete Boards */}
            {showMacroTargeting && (
              <div className="mb-3 p-3 bg-black/30 border border-pink-500/30 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-white text-sm font-semibold flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={macroTargetingEnabled}
                      onCheckedChange={(checked) => {
                        const newEnabled = checked as boolean;
                        setMacroTargetingEnabled(newEnabled);
                        saveMacroTargetsCache(newEnabled, targetProtein, targetCarbs, targetFat);
                      }}
                      className="h-4 w-4 border-pink-400/50 data-[state=checked]:bg-pink-600 data-[state=checked]:border-pink-500"
                    />
                    🎯 Set Macro Targets
                  </label>
                </div>

                {macroTargetingEnabled && (
                  <div className="space-y-2 mt-3 animate-in fade-in duration-200">
                    <p className="text-white/60 text-xs mb-2">
                      AI will generate a meal hitting these exact macros (±5g tolerance)
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-white/80 text-xs font-medium block mb-1">
                          Protein grams
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max="200"
                          value={targetProtein}
                          onChange={(e) => {
                            const newValue = e.target.value === '' ? '' : Number(e.target.value);
                            setTargetProtein(newValue);
                            saveMacroTargetsCache(macroTargetingEnabled, newValue, targetCarbs, targetFat);
                          }}
                          placeholder="50"
                          className="bg-black/40 border-pink-500/30 text-white placeholder:text-white/30 text-sm h-9 text-center font-semibold"
                        />
                      </div>

                      <div>
                        <label className="text-white/80 text-xs font-medium block mb-1">
                          Carb grams
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max="200"
                          value={targetCarbs}
                          onChange={(e) => {
                            const newValue = e.target.value === '' ? '' : Number(e.target.value);
                            setTargetCarbs(newValue);
                            saveMacroTargetsCache(macroTargetingEnabled, targetProtein, newValue, targetFat);
                          }}
                          placeholder="30"
                          className="bg-black/40 border-pink-500/30 text-white placeholder:text-white/30 text-sm h-9 text-center font-semibold"
                        />
                      </div>

                      <div>
                        <label className="text-white/80 text-xs font-medium block mb-1">
                          Fat grams
                        </label>
                        <Input
                          type="number"
                          min="0"
                          max="200"
                          value={targetFat}
                          onChange={(e) => {
                            const newValue = e.target.value === '' ? '' : Number(e.target.value);
                            setTargetFat(newValue);
                            saveMacroTargetsCache(macroTargetingEnabled, targetProtein, targetCarbs, newValue);
                          }}
                          placeholder="20"
                          className="bg-black/40 border-pink-500/30 text-white placeholder:text-white/30 text-sm h-9 text-center font-semibold"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => {
                          setTargetProtein(50);
                          setTargetCarbs(30);
                          setTargetFat(20);
                          saveMacroTargetsCache(macroTargetingEnabled, 50, 30, 20);
                        }}
                        className="flex-1 px-2 py-1 bg-pink-600/20 hover:bg-pink-600/30 border border-pink-500/30 rounded text-white/80 text-xs transition-all"
                      >
                        50p / 30c / 20f
                      </button>
                      <button
                        onClick={() => {
                          setTargetProtein(40);
                          setTargetCarbs(40);
                          setTargetFat(15);
                          saveMacroTargetsCache(macroTargetingEnabled, 40, 40, 15);
                        }}
                        className="flex-1 px-2 py-1 bg-pink-600/20 hover:bg-pink-600/30 border border-pink-500/30 rounded text-white/80 text-xs transition-all"
                      >
                        40p / 40c / 15f
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Search Input - Always visible */}
            <Input
              placeholder="Search ingredients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full p-4 mb-3 border border-white/30 bg-black/30 backdrop-blur-sm rounded-xl focus:ring-2 focus:ring-pink-400/50 focus:border-pink-400/50 text-white placeholder:text-white/50"
            />

            {/* Ingredient Checkboxes */}
            {!isLoading && mealSlot !== "snacks" && (
              <div className="overflow-y-auto max-h-[200px] mb-3 border border-white/20 rounded-xl p-3 bg-black/20">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-1">
                  {(() => {
                    const categoryIngredients = mealIngredients[activeCategory as keyof typeof mealIngredients] || [];
                    const filteredIngredients = searchQuery.trim()
                      ? categoryIngredients.filter((item: any) => {
                          const itemName = typeof item === 'string' ? item : item.name;
                          return itemName.toLowerCase().includes(searchQuery.toLowerCase());
                        })
                      : categoryIngredients;

                    return filteredIngredients.map((item: any) => {
                      const itemName = typeof item === 'string' ? item : item.name;
                      return (
                        <div
                          key={itemName}
                          onClick={() => toggleIngredient(itemName)}
                          className="flex items-center gap-1.5 text-white/90 hover:text-white cursor-pointer p-1"
                        >
                          <Checkbox
                            checked={selectedIngredients.includes(itemName)}
                            className="h-3.5 w-3.5 border-white/30 data-[state=checked]:bg-emerald-600"
                          />
                          <span className="text-xs">{itemName}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            <label
              htmlFor="ai-custom-ingredients"
              className="block text-sm font-medium text-white/90 mb-2"
            >
              Add Custom Ingredients (optional):
            </label>

            <div className="relative">
              <textarea
                id="ai-custom-ingredients"
                value={ingredients}
                onChange={(e) => setIngredients(e.target.value)}
                placeholder="Add any custom ingredients not listed above (separated by commas)"
                className="w-full p-4 pr-10 border border-white/30 bg-black/30 backdrop-blur-sm rounded-xl focus:ring-2 focus:ring-pink-400/50 focus:border-pink-400/50 text-white placeholder:text-white/50"
                rows={3}
                disabled={isLoading}
              />
              {ingredients.trim() && !isLoading && (
                <TrashButton
                  onClick={() => setIngredients("")}
                  size="sm"
                  ariaLabel="Clear custom ingredients"
                  title="Clear custom ingredients"
                  className="absolute top-2 right-2"
                />
              )}
            </div>
          </div>

          {/* Loading State with Progress Bar */}
          {isLoading && (
            <div className="text-center py-4">
              <div className="flex items-center justify-center gap-2 text-pink-300 mb-4">
                <Sparkles className="h-6 w-6 animate-spin" />
                <span className="text-lg font-medium">
                  Creating your AI meal...
                </span>
              </div>

              <div className="max-w-md mx-auto mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white/80">AI Analysis Progress</span>
                  <span className="text-sm text-white/80">{Math.round(progress)}%</span>
                </div>
                <Progress
                  value={progress}
                  className="h-3 bg-black/40 border border-white/30"
                />
              </div>

              <p className="text-white/70 text-sm">

              </p>
            </div>
          )}

          {/* Generate Button */}
          <Button
            onClick={handleGenerateMeal}
            disabled={isLoading || (selectedIngredients.length === 0 && !ingredients.trim())}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-6 px-6 rounded-xl transition-all text-lg flex items-center justify-center gap-3"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin" />
                Creating... (~30 seconds)
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Generate AI Meal
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}