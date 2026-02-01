import { useState, useEffect } from "react";
import { apiUrl } from '@/lib/resolveApiBase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { ArrowLeft, Wine, Sparkles, ChefHat, Home, ChevronUp } from "lucide-react";
import { saveScrollPosition, saveNavigationHistory } from "@/utils/scrollUtils";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";

const WINE_TOUR_STEPS: TourStep[] = [
  { title: "Choose Your Meal", description: "Select your meal type, cuisine style, or main ingredient." },
  { title: "Set Preferences", description: "Pick your occasion and price range for the perfect match." },
  { title: "Get Recommendations", description: "See wines that fit your selection and complement your meal." },
];

interface WineRecommendation {
  wineName: string;
  wineType: string;
  varietal: string;
  region: string;
  vintageRange: string;
  priceRange: string;
  flavorProfile: string;
  pairingReason: string;
  servingTemp: string;
  glassType: string;
  alternatives: string[];
}

interface WinePairingResult {
  id: string;
  userId: string;
  mealType: string;
  cuisine?: string;
  mainIngredient?: string;
  occasion?: string;
  priceRange?: string;
  preferences?: string;
  recommendations: WineRecommendation[];
  createdAt: string;
}

export default function WinePairingPage() {
  const [, setLocation] = useLocation();
  const quickTour = useQuickTour("wine-pairing");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WinePairingResult | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Form state
  const [mealType, setMealType] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [mainIngredient, setMainIngredient] = useState("");
  const [occasion, setOccasion] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [preferences, setPreferences] = useState("");

  // Reusable classes to FIX invisible text in selects
  const triggerCls =
    "bg-black/40 border border-white/20 text-white data-[placeholder]:text-white/60";
  const contentCls =
    "bg-black/90 border border-white/20 text-white shadow-xl z-[60]";
  const itemCls =
    "text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white data-[state=checked]:bg-white/10";

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Wine Pairing | My Perfect Meals";
    saveNavigationHistory("/wine-pairing", "/alcohol-hub");

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
    if (!mealType) return;

    try {
      setLoading(true);
      const response = await fetch(apiUrl("/api/ai/wine-pairing"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "test-user-1", // Using test user
          mealType,
          cuisine: cuisine || undefined,
          mainIngredient: mainIngredient || undefined,
          occasion: occasion || undefined,
          priceRange: priceRange || undefined,
          preferences: preferences || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data);
      } else {
        console.error("Failed to get wine pairing recommendations");
      }
    } catch (error) {
      console.error("Wine pairing error:", error);
    } finally {
      setLoading(false);
    }
  };

  const getWineTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'red':
        return 'text-white bg-red-900/60 border-red-500/50';
      case 'white':
        return 'text-white bg-yellow-900/60 border-yellow-500/50';
      case 'rosé':
      case 'rose':
        return 'text-white bg-pink-900/60 border-pink-500/50';
      case 'sparkling':
        return 'text-white bg-blue-900/60 border-blue-500/50';
      default:
        return 'text-white bg-purple-900/60 border-purple-500/50';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav">
      {/* Universal Safe-Area Header */}
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-8 py-3 flex items-center gap-3 flex-nowrap">
          {/* Back Button */}
          <button
            onClick={() => {
              saveScrollPosition("winePairingScroll");
              saveNavigationHistory("/alcohol-hub", "/wine-pairing");
              setLocation("/alcohol-hub");
            }}
            className="flex items-center gap-1 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>

          {/* Title */}
          <h1 className="text-lg font-bold text-white truncate min-w-0">Wine Pairing AI</h1>

          <div className="flex-grow" />
          <QuickTourButton onClick={quickTour.openTour} className="flex-shrink-0" />
        </div>
      </div>

      <div
        className="max-w-4xl mx-auto px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >

        {/* Pairing Form */}
        <Card className="mb-8 bg-black/50 backdrop-blur-lg border border-purple-400/70 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              
              Find Your Perfect Pairing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4 text-md text-white">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="mealType">Meal Type *</Label>
                  <Select value={mealType} onValueChange={setMealType}>
                    <SelectTrigger className={triggerCls}>
                      <SelectValue placeholder="Select meal type" />
                    </SelectTrigger>
                    <SelectContent className={contentCls}>
                      <SelectItem value="Appetizer" className={itemCls}>Appetizer</SelectItem>
                      <SelectItem value="Main Course" className={itemCls}>Main Course</SelectItem>
                      <SelectItem value="Dessert" className={itemCls}>Dessert</SelectItem>
                      <SelectItem value="Light Meal" className={itemCls}>Light Meal</SelectItem>
                      <SelectItem value="Cheese Course" className={itemCls}>Cheese Course</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="cuisine">Cuisine Style</Label>
                  <Input
                    id="cuisine"
                    value={cuisine}
                    onChange={(e) => setCuisine(e.target.value)}
                    placeholder="e.g., Italian, French, Asian"
                    autoComplete="off"
                    className="bg-black/40 border border-white/20 text-white placeholder:text-white/60"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="mainIngredient">Main Ingredient</Label>
                  <Input
                    id="mainIngredient"
                    value={mainIngredient}
                    onChange={(e) => setMainIngredient(e.target.value)}
                    placeholder="e.g., salmon, beef, chicken"
                    autoComplete="off"
                    className="bg-black/40 border border-white/20 text-white placeholder:text-white/60"
                  />
                </div>
                <div>
                  <Label htmlFor="occasion">Occasion</Label>
                  <Select value={occasion} onValueChange={setOccasion}>
                    <SelectTrigger className={triggerCls}>
                      <SelectValue placeholder="Select occasion" />
                    </SelectTrigger>
                    <SelectContent className={contentCls}>
                      <SelectItem value="Casual Dinner" className={itemCls}>Casual Dinner</SelectItem>
                      <SelectItem value="Romantic Date" className={itemCls}>Romantic Date</SelectItem>
                      <SelectItem value="Business Meal" className={itemCls}>Business Meal</SelectItem>
                      <SelectItem value="Celebration" className={itemCls}>Celebration</SelectItem>
                      <SelectItem value="Family Gathering" className={itemCls}>Family Gathering</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="priceRange">Price Range</Label>
                <Select value={priceRange} onValueChange={setPriceRange}>
                  <SelectTrigger className={triggerCls}>
                    <SelectValue placeholder="Select budget" />
                  </SelectTrigger>
                  <SelectContent className={contentCls}>
                    <SelectItem value="Under $20" className={itemCls}>Under $20</SelectItem>
                    <SelectItem value="$20-40" className={itemCls}>$20-40</SelectItem>
                    <SelectItem value="$40-80" className={itemCls}>$40-80</SelectItem>
                    <SelectItem value="$80-150" className={itemCls}>$80-150</SelectItem>
                    <SelectItem value="Above $150" className={itemCls}>Above $150</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="preferences">Additional Preferences</Label>
                <Textarea
                  id="preferences"
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  placeholder="Any specific preferences, allergies, or requirements..."
                  rows={3}
                  className="bg-black/40 border border-white/20 text-white placeholder:text-white/60"
                />
              </div>

              <Button 
                type="submit" 
                disabled={loading || !mealType} 
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                {loading ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                    Getting Recommendations...
                  </>
                ) : (
                  <>
                    <Wine className="h-4 w-4 mr-2" />
                    Get Wine Pairing
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white text-center">
              Your Wine Pairing Recommendations
            </h2>

            {result.recommendations.map((wine, index) => (
              <Card key={index} data-testid="winepairing-card" className="overflow-hidden bg-black/50 backdrop-blur-lg border border-purple-400/70 shadow-[0_0_20px_rgba(168,85,247,0.15)]">
                <CardHeader className={`${getWineTypeColor(wine.wineType)} border-b`}>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{wine.wineName}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Wine className="h-5 w-5" />
                      <span className="font-medium">{wine.wineType}</span>
                    </div>
                  </div>
                  <p className="text-sm font-medium">{wine.varietal} • {wine.region}</p>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-semibold text-white mb-2">Pairing Details</h4>
                        <p className="text-white/90 text-sm">{wine.pairingReason}</p>
                      </div>

                      <div>
                        <h4 className="font-semibold text-white mb-2">Flavor Profile</h4>
                        <p className="text-white/90 text-sm">{wine.flavorProfile}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="font-medium text-white">Vintage</p>
                          <p className="text-white/80">{wine.vintageRange}</p>
                        </div>
                        <div>
                          <p className="font-medium text-white">Price Range</p>
                          <p className="text-white/80">{wine.priceRange}</p>
                        </div>
                        <div>
                          <p className="font-medium text-white">Serving Temp</p>
                          <p className="text-white/80">{wine.servingTemp}</p>
                        </div>
                        <div>
                          <p className="font-medium text-white">Glass Type</p>
                          <p className="text-white/80">{wine.glassType}</p>
                        </div>
                      </div>

                      {wine.alternatives && wine.alternatives.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-white mb-2">Alternatives</h4>
                          <div className="flex flex-wrap gap-2">
                            {wine.alternatives.map((alt, altIndex) => (
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
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Back to Top Button */}
      {showBackToTop && (
        <div className="flex justify-center mt-12">
          
        </div>
      )}

      <QuickTourModal
        isOpen={quickTour.shouldShow}
        onClose={quickTour.closeTour}
        title="How to Use Wine Pairing"
        steps={WINE_TOUR_STEPS}
        onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
      />
    </div>
  );
}