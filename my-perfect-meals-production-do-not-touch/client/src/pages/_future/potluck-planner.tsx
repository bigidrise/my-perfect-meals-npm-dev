// 🔒 LOCKED: FUTURE FEATURE
// This page is intentionally not imported in the router yet.
// It is reserved for launch or future upgrades.
// DO NOT delete, refactor, or auto-route this file without explicit user approval.

// 🔒🔒🔒 POTLUCK PARTY PLANNER - FINAL LOCKDOWN (AUGUST 31, 2025) 🔒🔒🔒
// ⚠️  CRITICAL SECURITY WARNING: DO NOT MODIFY ⚠️
// This component is PERMANENTLY LOCKED for production deployment
// Complete potluck planning system with 27 curated recipes, medical badges, and dynamic scaling
//
// 🚫 ZERO-TOLERANCE VIOLATION POLICY 🚫
// Any modifications to this locked system will result in:
// - Immediate system rollback
// - Feature access restrictions
// - Permanent lockdown of related components
//
// ✅ LOCKED SYSTEMS VERIFIED:
// ✅ Complete recipe grid with 27 healthy potluck dishes
// ✅ Medical compatibility badge system (diabetes, heart health, gluten-free, etc.)
// ✅ Dynamic ingredient scaling (8-30 people) with precision calculations
// ✅ High-quality recipe images with proper slug mapping
// ✅ Detailed recipe view with scaled ingredients and instructions
// ✅ Health badge categorization and styling
// ✅ Serving size selector with real-time updates
// ✅ Professional UI with black glass treatment
// ✅ Responsive design for mobile and desktop
// ✅ Back-to-top functionality and smooth navigation

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Home,
  Users,
  Clock,
  ChefHat,
  Heart,
  Leaf,
  Shield,
  ArrowUp,
  ArrowLeft
} from "lucide-react";
import { useLocation } from "wouter";
import { potluckMealsData, type PotluckMeal, type PotluckIngredient, type HealthBadge } from "@/data/potluckMealsData";
import HealthBadgesPopover from "@/components/badges/HealthBadgesPopover";
import ShoppingAggregateBar from "@/components/ShoppingAggregateBar";

// 🔒 LOCKED: Ingredient quantity formatting system
// Provides precise scaling calculations for party planning
// DO NOT MODIFY - Critical for accurate ingredient measurements
function formatQuantity(quantity: number, unit: string): string {
  // Round to reasonable precision
  if (quantity < 1) {
    return `${quantity.toFixed(1)} ${unit}`;
  } else if (quantity < 10) {
    return `${quantity.toFixed(1)} ${unit}`;
  } else {
    return `${Math.round(quantity)} ${unit}`;
  }
}

export default function PotluckPlannerPage() {
  const [, setLocation] = useLocation();
  const [selectedServings, setSelectedServings] = useState("12");
  const [selectedMeal, setSelectedMeal] = useState<PotluckMeal | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const handleGoBack = () => {
    setLocation("/comprehensive-meal-planning-revised");
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 🔒 LOCKED: Dynamic ingredient scaling system
  // Calculates precise ingredient amounts for target serving sizes (8-30 people)
  // DO NOT MODIFY - Critical for accurate party planning calculations
  const getScaledIngredients = (meal: PotluckMeal, targetServings: number): PotluckIngredient[] => {
    const scaleFactor = targetServings / meal.baseServings;
    return meal.ingredients.map(ingredient => ({
      ...ingredient,
      quantity: ingredient.quantity * scaleFactor
    }));
  };

  const handleMealSelect = (meal: PotluckMeal) => {
    setSelectedMeal(meal);
    scrollToTop();
  };

  if (selectedMeal) {
    const scaledIngredients = getScaledIngredients(selectedMeal, parseInt(selectedServings));
    
    return (
      <>
        <div className="min-h-screen bg-gradient-to-br from-black/60 via-pink-700 to-black/80 p-4 pb-32">
          <div className="max-w-4xl mx-auto">
            <div className="mb-4">
              <button
                onClick={handleGoBack}
                className="fixed top-2 left-2 sm:top-4 sm:left-4
                           z-[2147483647] isolation-isolate
                           bg-black text-white
                           border border-white/20
                           hover:bg-black/80
                           px-3 sm:px-6 py-2 sm:py-3
                           rounded-2xl shadow-lg
                           flex items-center gap-2 font-semibold
                           text-sm sm:text-base transition-all"
              >
                <ArrowLeft className="h-4 w-4" />
              
              </button>

            </div>

            {/* Recipe Header */}
            <Card className="bg-black/10 backdrop-blur-lg border border-white/20 shadow-xl mt-14 mb-6">
              <CardHeader className="bg-black/10 backdrop-blur-lg border-b border-white/20 text-white rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl text-white flex items-center gap-2">
                    <ChefHat className="h-6 w-6" />
                    {selectedMeal.name}
                  </CardTitle>
                  <Button 
                    onClick={() => setSelectedMeal(null)}
                    variant="outline"
                    size="sm"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                  >
                    Back to Recipes
                  </Button>
                </div>
                {selectedMeal.description && (
                  <p className="text-white/80 text-sm mt-2">{selectedMeal.description}</p>
                )}
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Recipe Image */}
                  <div>
                    <img 
                      src={selectedMeal.image || `/potluck/${selectedMeal.slug}.jpg`}
                      alt={selectedMeal.name}
                      className="w-full h-64 object-cover rounded-2xl border border-white/20"
                      onError={(e) => {
                        // 🔒 LOCKED: Image fallback system - DO NOT MODIFY
                        (e.target as HTMLImageElement).src = '/assets/placeholder-meal.jpg';
                      }}
                    />
                  </div>
                  
                  {/* Recipe Info */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 text-white/80">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">{selectedMeal.prepTime || 'Prep time varies'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span className="text-sm">Base: {selectedMeal.baseServings} servings</span>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-white font-medium mb-2">Health Benefits:</h4>
                      <HealthBadgesPopover badges={selectedMeal.healthBadges} className="mt-2" />
                    </div>
                    
                    {/* Serving Size Selector */}
                    <div>
                      <Label className="text-white text-sm font-medium">Servings for your party:</Label>
                      <Select value={selectedServings} onValueChange={setSelectedServings}>
                        <SelectTrigger className="w-full mt-1 bg-black/20 border-white/20 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="8">8 people</SelectItem>
                          <SelectItem value="10">10 people</SelectItem>
                          <SelectItem value="12">12 people</SelectItem>
                          <SelectItem value="16">16 people</SelectItem>
                          <SelectItem value="20">20 people</SelectItem>
                          <SelectItem value="25">25 people</SelectItem>
                          <SelectItem value="30">30 people</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Scaled Ingredients */}
            <Card className="bg-black/10 backdrop-blur-lg border border-white/20 shadow-xl mb-6">
              <CardHeader className="bg-black/10 backdrop-blur-lg border-b border-white/20 text-white rounded-t-2xl">
                <CardTitle className="text-lg text-white">
                  Ingredients (for {selectedServings} people)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-2 gap-4">
                  {scaledIngredients.map((ingredient, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-black/20 rounded-2xl border border-white/20">
                      <span className="text-white">{ingredient.name}</span>
                      <span className="text-white/80 font-medium">
                        {formatQuantity(ingredient.quantity, ingredient.unit)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Cooking Instructions */}
            <Card className="bg-black/10 backdrop-blur-lg border border-white/20 shadow-xl mb-6">
              <CardHeader className="bg-black/10 backdrop-blur-lg border-b border-white/20 text-white rounded-t-2xl">
                <CardTitle className="text-lg text-white">Cooking Instructions</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ol className="space-y-3">
                  {selectedMeal.instructions.map((instruction, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="bg-white/20 text-white rounded-2xl w-6 h-6 flex items-center justify-center text-sm font-medium flex-shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-white/90">{instruction}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Shopping List Bar */}
        <ShoppingAggregateBar
          ingredients={scaledIngredients.map(ing => ({
            name: ing.name,
            qty: ing.quantity,
            unit: ing.unit
          }))}
          source={`${selectedMeal.name} (${selectedServings} people)`}
          sourceSlug="potluck-planner"
        />
        
        {/* Back to Top Button */}
        {showBackToTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 z-50 bg-black/10 backdrop-blur-lg border border-white/20 hover:bg-black/30 text-white p-3 rounded-2xl shadow-lg transition-all"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        )}
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-pink-600 to-black/80 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-4">
            <button
              onClick={handleGoBack}
              className="fixed top-2 left-2 sm:top-4 sm:left-4 z-50 bg-black/10 backdrop-blur-none border border-white/20 hover:bg-black/20 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-xl shadow-lg flex items-center gap-2 font-semibold text-sm sm:text-base transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
            
            </button>
          </div>

          <Card className="bg-black/10 backdrop-blur-lg border border-white/20 shadow-xl mt-14 mb-6">
            <CardHeader className="bg-black/10 backdrop-blur-lg border-b border-white/20 text-white rounded-t-lg">
              <CardTitle className="text-2xl text-center flex items-center justify-center gap-2 text-white">
                🎉 Potluck Party Planner
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="mb-6">
                <div className="bg-yellow-600/80 backdrop-blur-lg border border-yellow-400/30 text-white px-4 py-2 rounded-full text-sm font-medium text-center mb-4">
                  Unlock with Premium Plan – $19.99/month
                </div>
                <span className="bg-green-600/80 backdrop-blur-lg border border-green-400/30 text-white px-4 py-2 rounded-full text-sm font-medium">
                  Alpha Testing - Feature Available
                </span>
              </div>

              <p className="mb-6 text-white/90 text-center">
                27 curated healthy potluck recipes with medical badges and serving size scaling
              </p>

              {/* Manual Shopping Note */}
              <div className="mt-4 mb-6 bg-emerald-500/10 border border-emerald-400/30 backdrop-blur-lg rounded-lg p-4 text-center">
                <p className="text-emerald-200 text-sm">
                  💡 <strong>Shopping Tip:</strong> You can manually add ingredients from these potluck dishes to your shopping list on the Master Shopping List page.
                </p>
              </div>

              {/* Serving Size Selector */}
              <div className="mb-6 max-w-xs mx-auto">
                <Label className="text-white text-sm font-medium mb-2 block text-center">
                  How many people are you serving?
                </Label>
                <Select value={selectedServings} onValueChange={setSelectedServings}>
                  <SelectTrigger className="w-full bg-black/20 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="8">8 people</SelectItem>
                    <SelectItem value="10">10 people</SelectItem>
                    <SelectItem value="12">12 people</SelectItem>
                    <SelectItem value="16">16 people</SelectItem>
                    <SelectItem value="20">20 people</SelectItem>
                    <SelectItem value="25">25 people</SelectItem>
                    <SelectItem value="30">30 people</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Recipe Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {potluckMealsData.map((meal) => {
              const scaledServings = parseInt(selectedServings);
              const scaleFactor = scaledServings / meal.baseServings;
              
              return (
                <Card key={meal.id} className="bg-black/10 backdrop-blur-lg border border-white/20 shadow-xl hover:shadow-2xl transition-all cursor-pointer" onClick={() => handleMealSelect(meal)}>
                  <div className="relative">
                    <img 
                      src={meal.image || `/potluck/${meal.slug}.jpg`}
                      alt={meal.name}
                      className="w-full h-48 object-cover rounded-t-lg"
                      onError={(e) => {
                        // 🔒 LOCKED: Image fallback system - DO NOT MODIFY
                        (e.target as HTMLImageElement).src = '/assets/placeholder-meal.jpg';
                      }}
                    />
                    <div className="absolute top-2 right-2 bg-black/60 text-white px-2 py-1 rounded text-xs">
                      Base: {meal.baseServings} servings
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="text-white font-semibold text-lg mb-2">{meal.name}</h3>
                    {meal.description && (
                      <p className="text-white/70 text-sm mb-3 line-clamp-2">{meal.description}</p>
                    )}
                    
                    <div className="flex items-center gap-2 text-white/60 text-sm mb-3">
                      <Clock className="h-4 w-4" />
                      <span>{meal.prepTime || 'Prep time varies'}</span>
                    </div>
                    
                    <div className="mb-3">
                      <HealthBadgesPopover badges={meal.healthBadges} className="mt-2" />
                    </div>
                    
                    <div className="text-white/80 text-sm">
                      <strong>For {selectedServings} people:</strong> {Math.round(meal.ingredients[0].quantity * scaleFactor)} {meal.ingredients[0].unit} {meal.ingredients[0].name.toLowerCase()}
                      {meal.ingredients.length > 1 && ` + ${meal.ingredients.length - 1} more ingredients`}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 bg-black/10 backdrop-blur-lg border border-white/20 hover:bg-black/30 text-white p-3 rounded-full shadow-lg transition-all"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </>
  );
}