// client/src/pages/GuestBuilder.tsx
// Apple App Review Compliant: One-Day Builder Experience for Guests

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowLeft, 
  Sparkles, 
  Sun, 
  Utensils, 
  Moon, 
  Cookie,
  UserPlus,
  ChefHat,
  Calculator,
  Flame
} from "lucide-react";
import { GuestModeBanner } from "@/components/GuestModeBanner";
import { 
  isGuestMode, 
  getGuestGenerationsRemaining, 
  endGuestSession,
  getGuestSession 
} from "@/lib/guestMode";

type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

interface GuestMeal {
  slot: MealSlot;
  name: string;
  generated: boolean;
}

const MEAL_SLOTS: { slot: MealSlot; label: string; icon: React.ReactNode; time: string }[] = [
  { slot: "breakfast", label: "Breakfast", icon: <Sun className="h-5 w-5" />, time: "Morning" },
  { slot: "lunch", label: "Lunch", icon: <Utensils className="h-5 w-5" />, time: "Midday" },
  { slot: "dinner", label: "Dinner", icon: <Moon className="h-5 w-5" />, time: "Evening" },
  { slot: "snack", label: "Snack", icon: <Cookie className="h-5 w-5" />, time: "Anytime" },
];

export default function GuestBuilder() {
  const [, setLocation] = useLocation();
  const [meals, setMeals] = useState<GuestMeal[]>([
    { slot: "breakfast", name: "", generated: false },
    { slot: "lunch", name: "", generated: false },
    { slot: "dinner", name: "", generated: false },
    { slot: "snack", name: "", generated: false },
  ]);

  useEffect(() => {
    // Redirect to welcome if not in guest mode
    if (!isGuestMode()) {
      setLocation("/welcome");
    }
  }, [setLocation]);

  const session = getGuestSession();
  const remaining = getGuestGenerationsRemaining();

  const handleCreateAccount = () => {
    endGuestSession();
    setLocation("/auth");
  };

  const handleGoToCreator = (slot: MealSlot) => {
    // Store the slot they're building for, then go to craving creator
    sessionStorage.setItem("guest_building_slot", slot);
    setLocation("/craving-creator");
  };

  const handleGoToMacros = () => {
    setLocation("/macro-counter");
  };

  const handleGoToFridgeRescue = () => {
    setLocation("/fridge-rescue");
  };

  const completedMeals = meals.filter(m => m.generated).length;
  const hasBuiltDay = completedMeals >= 3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black text-white pb-32"
    >
      {/* Header */}
      <div
        className="fixed left-0 right-0 z-50 bg-black/50 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            onClick={() => setLocation("/welcome")}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-lime-400" />
              Try My Perfect Meals
            </h1>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div
        className="max-w-2xl mx-auto px-4 space-y-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        {/* Guest Mode Banner */}
        <GuestModeBanner variant="full" />

        {/* Intro Card */}
        <Card className="bg-zinc-900/60 border border-white/10">
          <CardContent className="p-5">
            <h2 className="text-xl font-bold text-white mb-2">Build a Full Day of Meals</h2>
            <p className="text-white/70 text-sm">
              Experience how My Perfect Meals works. Generate up to 4 meals — 
              breakfast, lunch, dinner, and a snack. No account required.
            </p>
          </CardContent>
        </Card>

        {/* Meal Slots */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide px-1">
            Your Day
          </h3>
          
          {MEAL_SLOTS.map((slot) => {
            const meal = meals.find(m => m.slot === slot.slot);
            const isGenerated = meal?.generated;
            
            return (
              <Card 
                key={slot.slot}
                className={`border transition-all ${
                  isGenerated 
                    ? "bg-lime-900/20 border-lime-500/30" 
                    : "bg-zinc-900/40 border-white/10 hover:border-white/20"
                }`}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    isGenerated ? "bg-lime-500/20 text-lime-400" : "bg-white/10 text-white/60"
                  }`}>
                    {slot.icon}
                  </div>
                  
                  <div className="flex-1">
                    <div className="font-semibold text-white">{slot.label}</div>
                    <div className="text-xs text-white/50">{slot.time}</div>
                    {isGenerated && meal?.name && (
                      <div className="text-sm text-lime-300 mt-1">{meal.name}</div>
                    )}
                  </div>

                  {!isGenerated && remaining > 0 && (
                    <Button
                      onClick={() => handleGoToCreator(slot.slot)}
                      size="sm"
                      className="bg-white/10 hover:bg-white/20 text-white"
                    >
                      <ChefHat className="h-4 w-4 mr-1" />
                      Generate
                    </Button>
                  )}

                  {isGenerated && (
                    <div className="text-lime-400 text-sm font-medium">
                      Done
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 pt-4">
          <Button
            onClick={handleGoToMacros}
            variant="outline"
            className="h-16 flex-col gap-1 bg-zinc-900/40 border-white/10 hover:bg-zinc-800/60 text-white"
          >
            <Calculator className="h-5 w-5 text-orange-400" />
            <span className="text-xs">Macro Calculator</span>
          </Button>
          
          <Button
            onClick={handleGoToFridgeRescue}
            variant="outline"
            className="h-16 flex-col gap-1 bg-zinc-900/40 border-white/10 hover:bg-zinc-800/60 text-white"
          >
            <Flame className="h-5 w-5 text-blue-400" />
            <span className="text-xs">Fridge Rescue</span>
          </Button>
        </div>

        {/* Upgrade CTA */}
        {hasBuiltDay && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="pt-4"
          >
            <Card className="bg-gradient-to-r from-lime-900/40 to-emerald-900/40 border border-lime-500/30">
              <CardContent className="p-5 text-center space-y-4">
                <div className="text-2xl">🎉</div>
                <h3 className="text-lg font-bold text-white">Great job building your day!</h3>
                <p className="text-white/70 text-sm">
                  Ready to save your meals, track progress, and unlock personalized nutrition? 
                  Create a free account to continue.
                </p>
                <Button
                  onClick={handleCreateAccount}
                  className="w-full bg-gradient-to-r from-lime-600 to-emerald-600 hover:from-lime-500 hover:to-emerald-500 text-white"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Free Account
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Remaining generations indicator */}
        {remaining > 0 && (
          <div className="text-center text-white/40 text-xs py-4">
            {remaining} meal generation{remaining !== 1 ? 's' : ''} remaining in guest mode
          </div>
        )}
      </div>
    </motion.div>
  );
}
