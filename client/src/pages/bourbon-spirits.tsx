import { useState, useEffect } from "react";
import { apiUrl } from '@/lib/resolveApiBase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocation } from "wouter";
import { ArrowLeft, Sparkles, ChefHat, Wine, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";

const BOURBON_TOUR_STEPS: TourStep[] = [
  { title: "Choose Your Meal", description: "Select meal type, cuisine style, and main ingredient." },
  { title: "Set Occasion & Price", description: "Pick your occasion and preferred price range." },
  { title: "Get Spirit Pairings", description: "See bourbons or spirits that complement your food." },
];

interface BourbonRecommendation {
  spiritName: string;
  spiritType: string;
  ageStatement: string;
  distilleryRegion: string;
  proofABV: string;
  priceRange: string;
  flavorProfile: string;
  pairingReason: string;
  servingSuggestion: string;
  glassType: string;
  alternatives: string[];
}

export default function BourbonSpiritsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const quickTour = useQuickTour("bourbon-spirits");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BourbonRecommendation | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Form state
  const [mealType, setMealType] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [mainIngredient, setMainIngredient] = useState("");
  const [occasion, setOccasion] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [preferences, setPreferences] = useState("");

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = "Bourbon & Spirits | My Perfect Meals";

    const handleScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mealType) return;

    try {
      setLoading(true);

      const response = await fetch(apiUrl("/api/ai/bourbon-spirits-pairing"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: "test-user-1",
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
        setResult(data.recommendation);

        toast({
          title: "Pairing Found!",
          description: `${data.recommendation.spiritName} recommended for your ${mealType}`,
        });
      } else {
        throw new Error("Failed to get bourbon pairing");
      }
    } catch (error) {
      console.error("Bourbon pairing error:", error);
      toast({
        title: "Error",
        description: "Failed to get recommendations. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getSpiritTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "bourbon":
        return "text-amber-200 bg-amber-900/40";
      case "rye whiskey":
      case "rye":
        return "text-orange-200 bg-orange-900/40";
      case "scotch":
        return "text-yellow-200 bg-yellow-900/40";
      case "irish whiskey":
        return "text-green-200 bg-green-900/40";
      default:
        return "text-white/90 bg-white/10";
    }
  };

  // Reusable classes to FIX invisible text in selects
  const triggerCls =
    "bg-black/40 border border-white/20 text-white data-[placeholder]:text-white/60";
  const contentCls =
    "bg-black/90 border border-white/20 text-white shadow-xl z-[60]";
  const itemCls =
    "text-white data-[highlighted]:bg-white/10 data-[highlighted]:text-white data-[state=checked]:bg-white/10";

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
            onClick={() => setLocation("/alcohol-hub")}
            className="flex items-center gap-1 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>

          {/* Title */}
          <h1 className="text-lg font-bold text-white truncate min-w-0">Bourbon & Spirits Pairing</h1>

          <div className="flex-grow" />
          <QuickTourButton onClick={quickTour.openTour} className="flex-shrink-0" />
        </div>
      </div>

      <div
        className="max-w-4xl mx-auto px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >

        {/* Pairing Form */}
        <Card className="mb-8 bg-black/50 backdrop-blur-lg border border-orange-400/70 shadow-[0_0_20px_rgba(249,115,22,0.15)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              
              Find Your Perfect Spirit Pairing
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
                      <SelectItem value="Appetizer" className={itemCls}>
                        Appetizer
                      </SelectItem>
                      <SelectItem value="Main Course" className={itemCls}>
                        Main Course
                      </SelectItem>
                      <SelectItem value="Dessert" className={itemCls}>
                        Dessert
                      </SelectItem>
                      <SelectItem value="Cigar Pairing" className={itemCls}>
                        Cigar Pairing
                      </SelectItem>
                      <SelectItem value="After Dinner" className={itemCls}>
                        After Dinner
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="cuisine">Cuisine Style</Label>
                  <Input
                    id="cuisine"
                    value={cuisine}
                    onChange={(e) => setCuisine(e.target.value)}
                    placeholder="e.g., BBQ, Steakhouse, Southern"
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
                    placeholder="e.g., ribeye steak, dark chocolate, cigar"
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
                      <SelectItem value="Casual Sipping" className={itemCls}>
                        Casual Sipping
                      </SelectItem>
                      <SelectItem value="Business Meeting" className={itemCls}>
                        Business Meeting
                      </SelectItem>
                      <SelectItem value="Celebration" className={itemCls}>
                        Celebration
                      </SelectItem>
                      <SelectItem value="Gentleman's Club" className={itemCls}>
                        Gentleman's Club
                      </SelectItem>
                      <SelectItem value="Cigar Lounge" className={itemCls}>
                        Cigar Lounge
                      </SelectItem>
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
                    <SelectItem value="Under $40" className={itemCls}>
                      Under $40
                    </SelectItem>
                    <SelectItem value="$40-80" className={itemCls}>
                      $40-80
                    </SelectItem>
                    <SelectItem value="$80-150" className={itemCls}>
                      $80-150
                    </SelectItem>
                    <SelectItem value="$150-300" className={itemCls}>
                      $150-300
                    </SelectItem>
                    <SelectItem value="Above $300" className={itemCls}>
                      Above $300 (Premium)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="preferences">Additional Preferences</Label>
                <Textarea
                  id="preferences"
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  placeholder="Any specific preferences for proof, age, flavor profile, or serving style..."
                  rows={3}
                  className="bg-black/40 border border-white/20 text-white placeholder:text-white/60"
                />
              </div>

              <Button
                type="submit"
                disabled={loading || !mealType}
                className="w-full bg-amber-700 hover:bg-amber-800"
              >
                {loading ? (
                  <>
                    <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                    Getting Recommendations...
                  </>
                ) : (
                  <>
                    <Wine className="h-4 w-4 mr-2" />
                    Get Spirit Pairing
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <Card data-testid="bourbonpairing-card" className="overflow-hidden bg-black/50 backdrop-blur-lg border border-orange-400/70 shadow-[0_0_20px_rgba(249,115,22,0.15)]">
            <CardHeader
              className={`${getSpiritTypeColor(result.spiritType)} border-b`}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{result.spiritName}</CardTitle>
                <div className="flex items-center gap-2">
                  <Wine className="h-5 w-5" />
                  <span className="font-medium">{result.spiritType}</span>
                </div>
              </div>
              <p className="text-sm font-medium">
                {result.ageStatement} • {result.distilleryRegion}
              </p>
            </CardHeader>
            <CardContent className="pt-6 text-white/90">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-white mb-2">
                      Pairing Details
                    </h4>
                    <p className="text-sm">{result.pairingReason}</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-white mb-2">
                      Flavor Profile
                    </h4>
                    <p className="text-sm">{result.flavorProfile}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-white">Proof/ABV</p>
                      <p className="text-white/80">{result.proofABV}</p>
                    </div>
                    <div>
                      <p className="font-medium text-white">Price Range</p>
                      <p className="text-white/80">{result.priceRange}</p>
                    </div>
                    <div>
                      <p className="font-medium text-white">Serving</p>
                      <p className="text-white/80">
                        {result.servingSuggestion}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium text-white">Glass Type</p>
                      <p className="text-white/80">{result.glassType}</p>
                    </div>
                  </div>

                  {!!result.alternatives?.length && (
                    <div>
                      <h4 className="font-semibold text-white mb-2">
                        Alternatives
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {result.alternatives.map((alt, i) => (
                          <span
                            key={i}
                            className="px-3 py-1 bg-white/10 border border-white/20 text-white text-sm rounded-full"
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

      <QuickTourModal
        isOpen={quickTour.shouldShow}
        onClose={quickTour.closeTour}
        title="How to Use Bourbon & Spirits Pairing"
        steps={BOURBON_TOUR_STEPS}
        onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
      />
    </div>
  );
}
