// client/src/pages/GuestBuilder.tsx
// Apple App Review Compliant: Simplified Guest Experience with Guided Copilot Tour

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowLeft, 
  Sparkles, 
  UserPlus,
  Calculator,
  Calendar,
  Refrigerator,
  Heart,
  X,
  ChefHat
} from "lucide-react";
import { GuestModeBanner } from "@/components/GuestModeBanner";
import { 
  isGuestMode, 
  getGuestGenerationsRemaining, 
  endGuestSession 
} from "@/lib/guestMode";

interface ActionButton {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  iconColor: string;
  route: string;
  copilotMessage: string;
}

const ACTION_BUTTONS: ActionButton[] = [
  {
    id: "macros",
    label: "Find Your Macros",
    description: "Calculate your personal targets in under a minute",
    icon: <Calculator className="h-6 w-6" />,
    iconColor: "text-orange-400",
    route: "/macro-counter",
    copilotMessage: "Not sure how much to eat? Start here — I'll calculate your personal macros in under a minute.",
  },
  {
    id: "create",
    label: "Create Your Meals",
    description: "Build meals on a weekly board and see how everything fits",
    icon: <Calendar className="h-6 w-6" />,
    iconColor: "text-lime-400",
    route: "/weekly-meal-board",
    copilotMessage: "This is the fun part. Build meals on a weekly board so you can experiment, adjust, and learn how everything fits together.",
  },
  {
    id: "fridge",
    label: "What's in Your Fridge?",
    description: "Turn what you have into meals — no waste, no stress",
    icon: <Refrigerator className="h-6 w-6" />,
    iconColor: "text-blue-400",
    route: "/fridge-rescue",
    copilotMessage: "Got food already? Tell me what you have and I'll turn it into meals — no waste, no stress.",
  },
  {
    id: "craving",
    label: "What Are You Craving?",
    description: "I'll make a healthier version that still hits the spot",
    icon: <Heart className="h-6 w-6" />,
    iconColor: "text-pink-400",
    route: "/craving-creator",
    copilotMessage: "Craving something specific? I'll make a healthier version that still hits the spot.",
  },
];

export default function GuestBuilder() {
  const [, setLocation] = useLocation();
  const [showCopilotTour, setShowCopilotTour] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [highlightedButton, setHighlightedButton] = useState<string | null>(null);
  const buttonRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    if (!isGuestMode()) {
      setLocation("/welcome");
      return;
    }

    const hasSeenTour = sessionStorage.getItem("guest_copilot_tour_seen");
    if (!hasSeenTour) {
      const timer = setTimeout(() => {
        setShowCopilotTour(true);
        setTourStep(0);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [setLocation]);

  const remaining = getGuestGenerationsRemaining();

  const handleCreateAccount = () => {
    endGuestSession();
    setLocation("/auth");
  };

  const handleActionClick = (route: string) => {
    setLocation(route);
  };

  const handleNextTourStep = () => {
    if (tourStep < ACTION_BUTTONS.length) {
      setTourStep(tourStep + 1);
      setHighlightedButton(ACTION_BUTTONS[tourStep]?.id || null);
    } else {
      handleCloseTour();
    }
  };

  const handleCloseTour = () => {
    setShowCopilotTour(false);
    setHighlightedButton(null);
    sessionStorage.setItem("guest_copilot_tour_seen", "true");
  };

  const getCurrentCopilotMessage = () => {
    if (tourStep === 0) {
      return "Welcome 👋 This is My Perfect Meals — your coach for planning meals your way. Start anywhere, but here's how most people use it…";
    }
    if (tourStep <= ACTION_BUTTONS.length) {
      return ACTION_BUTTONS[tourStep - 1]?.copilotMessage || "";
    }
    return "You can tap me anytime if you want help. Otherwise — go explore.";
  };

  useEffect(() => {
    if (showCopilotTour && tourStep > 0 && tourStep <= ACTION_BUTTONS.length) {
      setHighlightedButton(ACTION_BUTTONS[tourStep - 1]?.id || null);
    } else {
      setHighlightedButton(null);
    }
  }, [tourStep, showCopilotTour]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black text-white pb-32"
    >
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
          <Button
            onClick={handleCreateAccount}
            size="sm"
            className="bg-lime-600 hover:bg-lime-500 text-white"
          >
            <UserPlus className="h-4 w-4 mr-1" />
            Sign Up
          </Button>
        </div>
      </div>

      <div
        className="max-w-2xl mx-auto px-4 space-y-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        <GuestModeBanner variant="full" />

        <Card className="bg-zinc-900/60 border border-white/10">
          <CardContent className="p-5">
            <h2 className="text-xl font-bold text-white mb-2">Welcome to My Perfect Meals</h2>
            <p className="text-white/70 text-sm">
              Explore how our AI-powered meal planning works. Try any feature below — 
              no account required to get started.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide px-1">
            Get Started
          </h3>
          
          {ACTION_BUTTONS.map((action, index) => (
            <div
              key={action.id}
              ref={(el) => { buttonRefs.current[action.id] = el; }}
            >
              <Card 
                className={`border transition-all cursor-pointer ${
                  highlightedButton === action.id
                    ? "bg-lime-900/30 border-lime-500/50 ring-2 ring-lime-500/30"
                    : "bg-zinc-900/40 border-white/10 hover:border-white/20 hover:bg-zinc-800/40"
                }`}
                onClick={() => handleActionClick(action.route)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center bg-white/10 ${action.iconColor}`}>
                    {action.icon}
                  </div>
                  
                  <div className="flex-1">
                    <div className="font-semibold text-white">{action.label}</div>
                    <div className="text-sm text-white/60 mt-0.5">{action.description}</div>
                  </div>

                  <div className="text-white/30">
                    <ArrowLeft className="h-4 w-4 rotate-180" />
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>

        {remaining > 0 && (
          <div className="text-center text-white/40 text-xs py-4">
            {remaining} AI generation{remaining !== 1 ? 's' : ''} remaining in guest mode
          </div>
        )}

        <Card className="bg-gradient-to-r from-zinc-900/60 to-zinc-800/60 border border-white/10">
          <CardContent className="p-5 text-center space-y-4">
            <h3 className="text-lg font-bold text-white">Ready for the full experience?</h3>
            <p className="text-white/70 text-sm">
              Create an account to save your meals, track your progress, and get personalized nutrition guidance.
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
      </div>

      <AnimatePresence>
        {showCopilotTour && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[100] p-4"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
          >
            <Card className="bg-zinc-900/95 backdrop-blur-xl border border-lime-500/30 shadow-2xl max-w-lg mx-auto">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-lime-500/20 flex items-center justify-center flex-shrink-0">
                    <ChefHat className="h-5 w-5 text-lime-400" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm leading-relaxed">
                      {getCurrentCopilotMessage()}
                    </p>
                    
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        onClick={handleNextTourStep}
                        size="sm"
                        className="bg-lime-600 hover:bg-lime-500 text-white"
                      >
                        {tourStep < ACTION_BUTTONS.length ? "Next" : "Got it!"}
                      </Button>
                      
                      {tourStep < ACTION_BUTTONS.length && (
                        <Button
                          onClick={handleCloseTour}
                          size="sm"
                          variant="ghost"
                          className="text-white/60 hover:text-white hover:bg-white/10"
                        >
                          Skip Tour
                        </Button>
                      )}
                      
                      <div className="flex-1" />
                      
                      <div className="flex gap-1">
                        {[0, ...ACTION_BUTTONS.map((_, i) => i + 1)].map((step) => (
                          <div
                            key={step}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${
                              step === tourStep ? "w-4 bg-lime-400" : step < tourStep ? "bg-lime-400/50" : "bg-white/20"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    onClick={handleCloseTour}
                    size="sm"
                    variant="ghost"
                    className="text-white/40 hover:text-white hover:bg-white/10 p-1 h-auto"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
