// client/src/pages/GuestBuilder.tsx
// Apple App Review Compliant: Guest Experience with Real Talking Copilot

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
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
  Home,
} from "lucide-react";
import { GuestModeBanner } from "@/components/GuestModeBanner";
import { ChefCapIcon } from "@/components/copilot/ChefCapIcon";
import { useCopilot } from "@/components/copilot/CopilotContext";
import { getPageExplanation } from "@/components/copilot/CopilotPageExplanations";
import { CopilotExplanationStore } from "@/components/copilot/CopilotExplanationStore";
import {
  isGuestMode,
  getGuestGenerationsRemaining,
  endGuestSession,
} from "@/lib/guestMode";

interface ActionButton {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  iconColor: string;
  route: string;
}

const ACTION_BUTTONS: ActionButton[] = [
  {
    id: "macros",
    label: "Macro Calculator",
    description: "Calculate your personal targets in under a minute",
    icon: <Calculator className="h-6 w-6" />,
    iconColor: "text-orange-400",
    route: "/macro-counter",
  },
  {
    id: "create",
    label: "Weekly Meal Builder",
    description: "Build meals on a weekly board and see how everything fits",
    icon: <Calendar className="h-6 w-6" />,
    iconColor: "text-orange-400",
    route: "/weekly-meal-board",
  },
  {
    id: "fridge",
    label: "Fridge Rescue",
    description: "Turn what you have into meals — no waste, no stress",
    icon: <Refrigerator className="h-6 w-6" />,
    iconColor: "text-orange-400",
    route: "/fridge-rescue",
  },
  {
    id: "craving",
    label: "Craving Creator",
    description: "I'll make a healthier version that still hits the spot",
    icon: <Heart className="h-6 w-6" />,
    iconColor: "text-orange-400",
    route: "/craving-creator",
  },
];

export default function GuestBuilder() {
  const [, setLocation] = useLocation();
  const { open, isOpen, setLastResponse } = useCopilot();
  const hasAutoOpenedRef = useRef(false);

  useEffect(() => {
    if (!isGuestMode()) {
      setLocation("/welcome");
      return;
    }

    const hasSeenWelcome = sessionStorage.getItem("guest_copilot_welcome_seen");
    if (!hasSeenWelcome && !hasAutoOpenedRef.current) {
      hasAutoOpenedRef.current = true;
      const timer = setTimeout(() => {
        const explanation = getPageExplanation("/guest-builder");
        if (explanation) {
          CopilotExplanationStore.resetPath("/guest-builder");
          open();
          setTimeout(() => {
            setLastResponse({
              title: explanation.title,
              description: explanation.description,
              spokenText: explanation.spokenText,
              autoClose: explanation.autoClose,
            });
          }, 300);
        }
        sessionStorage.setItem("guest_copilot_welcome_seen", "true");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [setLocation, open, setLastResponse]);

  const remaining = getGuestGenerationsRemaining();

  const handleCreateAccount = () => {
    endGuestSession();
    setLocation("/auth");
  };

  const handleActionClick = (route: string) => {
    setLocation(route);
  };

  const handleChefClick = () => {
    const explanation = getPageExplanation("/guest-builder");
    if (explanation) {
      CopilotExplanationStore.resetPath("/guest-builder");
      open();
      setTimeout(() => {
        setLastResponse({
          title: explanation.title,
          description: explanation.description,
          spokenText: explanation.spokenText,
          autoClose: explanation.autoClose,
        });
      }, 300);
    }
  };

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
        </div>
      </div>

      <div
        className="max-w-2xl mx-auto px-4 space-y-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        <GuestModeBanner variant="full" />

        <Card className="bg-zinc-900/60 border border-white/10">
          <CardContent className="p-5">
            <h2 className="text-xl font-bold text-white mb-2">
              Welcome to My Perfect Meals
            </h2>
            <p className="text-white/70 text-sm">
              Explore how our AI-powered meal planning works. Try any feature
              below — no account required to get started.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide px-1">
            Get Started
          </h3>

          {ACTION_BUTTONS.map((action) => (
            <div key={action.id}>
              <Card
                className="border transition-all cursor-pointer bg-zinc-900/40 border-white/10 hover:border-white/20 hover:bg-zinc-800/40"
                onClick={() => handleActionClick(action.route)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-xl flex items-center justify-center bg-white/10 ${action.iconColor}`}
                  >
                    {action.icon}
                  </div>

                  <div className="flex-1">
                    <div className="font-semibold text-white">
                      {action.label}
                    </div>
                    <div className="text-sm text-white/60 mt-0.5">
                      {action.description}
                    </div>
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
            {remaining} AI generation{remaining !== 1 ? "s" : ""} remaining in
            guest mode
          </div>
        )}
      </div>

      {/* Guest Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/70 backdrop-blur-xl border-t border-white/10 shadow-2xl pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="relative h-12 flex items-center justify-between">
            {/* LEFT - Back to Welcome */}
            <div className="flex items-center justify-start flex-1">
              <button
                onClick={() => setLocation("/welcome")}
                className="flex items-center justify-center px-4 h-full text-gray-400 hover:text-white transition-all duration-300"
                style={{ flexDirection: "column" }}
              >
                <Home className="h-4 w-4" />
                <span className="text-[11px] mt-0.5 font-medium">Welcome</span>
              </button>
            </div>

            {/* CENTER - Chef Copilot Button */}
            <div className="absolute left-1/2 -translate-x-1/2 top-2 z-10">
              <motion.button
                onClick={handleChefClick}
                className="flex items-center justify-center w-14 h-14 rounded-full bg-black/70 border-2 border-white/15 backdrop-blur-xl shadow-lg shadow-orange-500/60 hover:shadow-orange-500/100 hover:border-orange-400/100 transition-all duration-300"
                whileTap={{ scale: 0.92 }}
                whileHover={{ y: -2, scale: 1.08 }}
                style={{
                  boxShadow:
                    "0 0 15px rgba(251,146,60,0.3), 0 0 25px rgba(251,146,60,0.2)",
                }}
              >
                <ChefCapIcon size={54} />
              </motion.button>
            </div>

            {/* RIGHT - Sign Up */}
            <div className="flex items-center justify-end flex-1">
              <button
                onClick={handleCreateAccount}
                className="flex items-center justify-center px-4 h-full text-lime-400 hover:text-lime-300 transition-all duration-300"
                style={{ flexDirection: "column" }}
              >
                <UserPlus className="h-4 w-4" />
                <span className="text-[11px] mt-0.5 font-medium">Sign Up</span>
              </button>
            </div>
          </div>
        </div>
      </nav>
    </motion.div>
  );
}
