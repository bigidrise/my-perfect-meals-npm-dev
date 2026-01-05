import { useState } from "react";
import { useLocation } from "wouter";
import { apiUrl } from '@/lib/resolveApiBase';
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Utensils, Heart, Pill, Flame, ArrowLeft, MessageCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { MealBuilderType, getAuthToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import DisclaimerModal from "@/components/DisclaimerModal";

interface BuilderOption {
  id: MealBuilderType;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const BUILDER_OPTIONS: BuilderOption[] = [
  {
    id: "weekly",
    title: "Weekly Meal Builder",
    description: "For everyday healthy eating. Build balanced weekly meal plans with variety.",
    icon: <Utensils className="w-8 h-8" />,
    color: "from-black via-zinc-950 to-black",
  },
  {
    id: "diabetic",
    title: "Diabetic Meal Builder",
    description: "Blood sugar-friendly meals. Low glycemic options with carb counting.",
    icon: <Heart className="w-8 h-8" />,
    color: "from-black via-zinc-950 to-black",
  },
  {
    id: "glp1",
    title: "GLP-1 Meal Builder",
    description: "Optimized for Ozempic, Wegovy, Mounjaro users. Protein-focused, smaller portions.",
    icon: <Pill className="w-8 h-8" />,
    color: "from-black via-zinc-950 to-black",
  },
  {
    id: "anti_inflammatory",
    title: "Anti-Inflammatory Builder",
    description: "Fight inflammation with healing foods. Omega-3 rich, antioxidant focused.",
    icon: <Flame className="w-8 h-8" />,
    color: "from-black via-zinc-950 to-black",
  },
];

export default function MealBuilderSelection() {
  const [, setLocation] = useLocation();
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [selected, setSelected] = useState<MealBuilderType | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const isProCareClient = user?.isProCare && user?.role !== "admin";
  const availableBuilders = isProCareClient && user?.activeBoard
    ? BUILDER_OPTIONS.filter(opt => opt.id === user.activeBoard)
    : BUILDER_OPTIONS;

  const handleContinue = async () => {
    if (!selected) {
      toast({
        title: "Please select a meal builder",
        description: "Choose the builder that best fits your needs going forward.",
        variant: "destructive",
      });
      return;
    }

    const authToken = getAuthToken();
    if (!authToken) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to continue.",
        variant: "destructive",
      });
      setLocation("/auth");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(apiUrl("/api/user/select-meal-builder"), {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-auth-token": authToken,
        },
        body: JSON.stringify({
          selectedMealBuilder: selected,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save selection");
      }

      await refreshUser();

      toast({
        title: "Builder Updated",
        description: "Your meal builder has been changed. You're all set to continue.",
      });

      const disclaimerAccepted = localStorage.getItem("acceptedDisclaimer") === "true";
      if (disclaimerAccepted) {
        setLocation("/dashboard");
      } else {
        setShowDisclaimer(true);
      }
    } catch (error) {
      console.error("Failed to save meal builder selection:", error);
      toast({
        title: "Error",
        description: "Failed to save your selection. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 text-white p-4"
    >
      {/* Fixed Black Glass Navigation Banner */}
      <div
        className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            onClick={() => setLocation("/dashboard")}
            className="bg-black/10 hover:bg-black/50 text-white rounded-xl border border-white/10 backdrop-blur-none flex items-center gap-1.5 px-2.5 h-9 flex-shrink-0"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-medium">Back</span>
          </Button>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            Choose How You'll Continue
          </h1>
        </div>
      </div>

      {/* Content area with padding for fixed header and bottom nav */}
      <div 
        className="pt-16 pb-24"
        style={{ 
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 64px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 100px)"
        }}
      >
        {/* Member acknowledgment */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
          <p className="text-sm text-white/90 text-center leading-relaxed">
            You're already a My Perfect Meals member. This page helps you switch meal boards as your needs change — whether you're continuing on your own, following a medical plan, or simplifying long-term.
          </p>
        </div>

        {/* ProCare transition note */}
        {user?.isProCare && (
          <div className="bg-indigo-900/30 border border-indigo-500/50 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <MessageCircle className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-indigo-200 text-sm font-medium mb-1">Coming from ProCare?</p>
                <p className="text-indigo-300/80 text-xs leading-relaxed">
                  Your coach or clinician may have recommended a next step. Choose the meal board that fits how you'll continue moving forward.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pricing clarity */}
        <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-3 mb-6">
          <p className="text-emerald-300 text-sm text-center font-medium">
            All options below continue at $19.99/month
          </p>
          <p className="text-emerald-400/70 text-xs text-center mt-1">
            You keep your history, meals, macros, and preferences.
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {/* Locked state: Pro Care client with no assigned board */}
          {isProCareClient && !user?.activeBoard && (
            <div className="bg-zinc-900/80 border border-zinc-700 rounded-2xl p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
                <Utensils className="w-8 h-8 text-zinc-500" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Awaiting Assignment</h3>
              <p className="text-zinc-400 text-sm">
                Your meal builder will be assigned by your coach. Check back soon!
              </p>
            </div>
          )}

          {/* Available builders - only show if NOT in locked state */}
          {!(isProCareClient && !user?.activeBoard) && availableBuilders.map((option) => (
            <motion.button
              key={option.id}
              onClick={() => setSelected(option.id)}
              whileTap={{ scale: 0.98 }}
              className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${
                selected === option.id
                  ? "border-white bg-white/10"
                  : "border-white/20 bg-black/30 hover:border-white/40"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`p-3 rounded-xl bg-gradient-to-br ${option.color} text-white`}
                >
                  {option.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">{option.title}</h3>
                    {selected === option.id && (
                      <Check className="w-5 h-5 text-emerald-400" />
                    )}
                  </div>
                  <p className="text-white/70 text-sm mt-1">{option.description}</p>
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Copilot guidance hint */}
        <div className="bg-black/20 border border-white/5 rounded-xl p-3 mb-6">
          <p className="text-white/60 text-xs text-center italic">
            Not sure which to pick? If you've finished working with a coach, most people transition to the Weekly Meal Builder for long-term balance. If your health needs have changed, select the board that supports that condition.
          </p>
        </div>

        {/* Continue button - hide for Pro Care clients with no assigned board */}
        {!(isProCareClient && !user?.activeBoard) && (
          <Button
            onClick={handleContinue}
            disabled={!selected || saving}
            className="w-full h-14 text-lg bg-lime-600 text-white font-semibold rounded-xl shadow-lg disabled:opacity-50"
          >
            {saving ? "Saving..." : "Continue with This Builder"}
          </Button>
        )}
      </div>

      {showDisclaimer && (
        <DisclaimerModal
          onAccept={() => {
            setShowDisclaimer(false);
            setLocation("/dashboard");
          }}
        />
      )}
    </motion.div>
  );
}
