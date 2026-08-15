import { useState, useEffect } from "react";
import { apiUrl } from '@/lib/resolveApiBase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { ArrowLeft, UtensilsCrossed, Sparkles, Home, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MealPairing {
  mealName: string;
  mealType: string;
  cookingTime: string;
  servings: number;
  ingredients: string[];
  instructions: string[];
  nutritionHighlights: string;
  pairingReason: string;
  servingSuggestion: string;
  alternatives: string[];
}

export default function MealPairingAIPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MealPairing | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Form state
  const [drinkType, setDrinkType] = useState("");
  const [specificDrink, setSpecificDrink] = useState("");
  const [mealPreference, setMealPreference] = useState("");
  const [cookingTime, setCookingTime] = useState("");
  const [servings, setServings] = useState("");

  // Reusable classes to FIX invisible text in selects
  const triggerCls =
    "bg-black/40 border border-white/20 text-white data-[placeholder]:text-white/60";
  const contentCls =
    "bg-black/90 border border-white/20 text-white shadow-xl z-[60]";
  const itemCls =
    "text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white data-[state=checked]:bg-white/10";

  // Auto-mark info as seen since Copilot provides guidance now
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Meal Pairing AI | My Perfect Meals";

    if (!localStorage.getItem("hasSeenMealPairingInfo")) {
      localStorage.setItem("hasSeenMealPairingInfo", "true");
    }

    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drinkType || !specificDrink) return;

    try {
      setLoading(true);

      const response = await fetch(apiUrl("/api/ai/meal-pairing"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "test-user-1",
          drinkType,
          specificDrink,
          mealPreference: mealPreference || undefined,
          cookingTime: cookingTime || undefined,
          servings: servings || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data.recommendation);

        toast({
          title: "Perfect Pairing Found!",
          description: `${data.recommendation.mealName} pairs beautifully with ${specificDrink}`,
        });
      } else {
        throw new Error("Failed to get meal pairing");
      }
    } catch (error) {
      console.error("Meal pairing error:", error);
      toast({
        title: "Error",
        description: "Failed to get meal pairing. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav">
      {/* Universal Safe-Area Header */}
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-8 py-3 flex items-center gap-3">
          {/* Back Button */}
          <button
            onClick={() => setLocation("/lifestyle")}
            className="flex items-center gap-1 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>

          {/* Title */}
          <h1 className="text-lg font-bold text-white">Meal Pairing AI</h1>

          
        </div>
      </div>

      <div
        className="max-w-4xl mx-auto px-4 pb-12"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >

        {/* Pairing Form */}
        <Card className="mb-8 bg-black/50 backdrop-blur-lg border border-orange-600 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-semi-bold text-white">
              
              Design Your Perfect Meal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4 text-md text-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="drinkType">Drink Category *</Label>
                  <Select value={drinkType} onValueChange={setDrinkType}>
                    <SelectTrigger className={triggerCls}>
                      <SelectValue placeholder="Select drink type" />
                    </SelectTrigger>
                    <SelectContent className={contentCls}>
                      <SelectItem value="Red Wine" className={itemCls}>Red Wine</SelectItem>
                      <SelectItem value="White Wine" className={itemCls}>White Wine</SelectItem>
                      <SelectItem value="Rosé Wine" className={itemCls}>Rosé Wine</SelectItem>
                      <SelectItem value="Champagne/Sparkling" className={itemCls}>Champagne/Sparkling</SelectItem>
                      <SelectItem value="Bourbon" className={itemCls}>Bourbon</SelectItem>
                      <SelectItem value="Whiskey" className={itemCls}>Whiskey</SelectItem>
                      <SelectItem value="Gin" className={itemCls}>Gin</SelectItem>
                      <SelectItem value="Vodka" className={itemCls}>Vodka</SelectItem>
                      <SelectItem value="Rum" className={itemCls}>Rum</SelectItem>
                      <SelectItem value="Beer" className={itemCls}>Beer</SelectItem>
                      <SelectItem value="Cocktail" className={itemCls}>Cocktail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="specificDrink">Specific Drink *</Label>
                  <Input
                    id="specificDrink"
                    value={specificDrink}
                    onChange={(e) => setSpecificDrink(e.target.value)}
                    placeholder="e.g., Cabernet Sauvignon, Old Fashioned"
                    autoComplete="off"
                    className="bg-black/40 border border-white/20 text-white placeholder:text-white/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="mealPreference">Meal Style</Label>
                  <Select value={mealPreference} onValueChange={setMealPreference}>
                    <SelectTrigger className={triggerCls}>
                      <SelectValue placeholder="Any style" />
                    </SelectTrigger>
                    <SelectContent className={contentCls}>
                      <SelectItem value="Fine Dining" className={itemCls}>Fine Dining</SelectItem>
                      <SelectItem value="Comfort Food" className={itemCls}>Comfort Food</SelectItem>
                      <SelectItem value="Light & Fresh" className={itemCls}>Light & Fresh</SelectItem>
                      <SelectItem value="Hearty & Rustic" className={itemCls}>Hearty & Rustic</SelectItem>
                      <SelectItem value="Seafood" className={itemCls}>Seafood</SelectItem>
                      <SelectItem value="Vegetarian" className={itemCls}>Vegetarian</SelectItem>
                      <SelectItem value="International" className={itemCls}>International</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="cookingTime">Cooking Time</Label>
                  <Select value={cookingTime} onValueChange={setCookingTime}>
                    <SelectTrigger className={triggerCls}>
                      <SelectValue placeholder="Any time" />
                    </SelectTrigger>
                    <SelectContent className={contentCls}>
                      <SelectItem value="15 minutes" className={itemCls}>Quick (15 min)</SelectItem>
                      <SelectItem value="30 minutes" className={itemCls}>Medium (30 min)</SelectItem>
                      <SelectItem value="60 minutes" className={itemCls}>Elaborate (60 min)</SelectItem>
                      <SelectItem value="90+ minutes" className={itemCls}>Gourmet (90+ min)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="servings">Servings</Label>
                  <Input
                    id="servings"
                    type="number"
                    min="1"
                    max="12"
                    value={servings}
                    onChange={(e) => setServings(e.target.value)}
                    placeholder="e.g., 2"
                    className="bg-black/40 border border-white/20 text-white placeholder:text-white/60"
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={loading || !drinkType || !specificDrink} 
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                {loading ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                    Creating Perfect Pairing...
                  </>
                ) : (
                  <>
                    <UtensilsCrossed className="h-4 w-4 mr-2" />
                    Design My Meal
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <Card className="overflow-hidden bg-black/50 backdrop-blur-lg border border-blue-400/70 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
            <CardHeader className="bg-black/40 backdrop-blur-lg border-b border-white/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl text-white">{result.mealName}</CardTitle>
                <div className="flex items-center gap-2 text-white/90">
                  <UtensilsCrossed className="h-5 w-5" />
                  <span className="font-medium">{result.mealType}</span>
                </div>
              </div>
              <p className="text-white/80">
                {result.cookingTime} • Serves {result.servings}
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold text-white mb-3">Why This Pairing Works</h4>
                    <p className="text-white/90 text-sm leading-relaxed">{result.pairingReason}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-white mb-3">Ingredients</h4>
                    <ul className="grid grid-cols-1 gap-1 text-sm text-white/90">
                      {result.ingredients.map((ingredient, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-white mr-2">•</span>
                          {ingredient}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="font-semibold text-white mb-3">Cooking Instructions</h4>
                    <ol className="space-y-2 text-sm text-white/90">
                      {result.instructions.map((instruction, index) => (
                        <li key={index} className="flex items-start">
                          <span className="flex-shrink-0 w-6 h-6 bg-white/20 text-white rounded-full text-xs flex items-center justify-center mr-3 mt-0.5">
                            {index + 1}
                          </span>
                          {instruction}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-white/20 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-white mb-2">Nutrition Highlights</h4>
                  <p className="text-white/90 text-sm">{result.nutritionHighlights}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-2">Serving Suggestion</h4>
                  <p className="text-white/90 text-sm">{result.servingSuggestion}</p>
                </div>
              </div>

              {result.alternatives && result.alternatives.length > 0 && (
                <div className="mt-6 pt-6 border-t border-white/20">
                  <h4 className="font-semibold text-white mb-3">Alternative Pairings</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.alternatives.map((alt, altIndex) => (
                      <span
                        key={altIndex}
                        className="px-3 py-1 bg-white/20 text-white text-sm rounded-full"
                      >
                        {alt}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Back to Top Button */}
      {showBackToTop && (
        <div className="flex justify-center mt-12">
          <Button
            onClick={scrollToTop}
            className="!rounded-full bg-black/30 backdrop-blur-lg border border-black/50 hover:bg-black/40 text-white px-6 py-3"
          >
            <ChevronUp className="h-4 w-4 mr-2" />
            Back to Top
          </Button>
        </div>
      )}
    </div>
  );
}