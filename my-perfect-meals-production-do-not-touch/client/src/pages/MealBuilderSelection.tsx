import { useState } from "react";
import { useLocation } from "wouter";
import { apiUrl } from '@/lib/resolveApiBase';
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Utensils, Heart, Pill, Flame } from "lucide-react";
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
    color: "from-emerald-600 to-emerald-500",
  },
  {
    id: "diabetic",
    title: "Diabetic Meal Builder",
    description: "Blood sugar-friendly meals. Low glycemic options with carb counting.",
    icon: <Heart className="w-8 h-8" />,
    color: "from-blue-600 to-blue-500",
  },
  {
    id: "glp1",
    title: "GLP-1 Meal Builder",
    description: "Optimized for Ozempic, Wegovy, Mounjaro users. Protein-focused, smaller portions.",
    icon: <Pill className="w-8 h-8" />,
    color: "from-purple-600 to-purple-500",
  },
  {
    id: "anti_inflammatory",
    title: "Anti-Inflammatory Builder",
    description: "Fight inflammation with healing foods. Omega-3 rich, antioxidant focused.",
    icon: <Flame className="w-8 h-8" />,
    color: "from-orange-600 to-orange-500",
  },
];

export default function MealBuilderSelection() {
  const [, setLocation] = useLocation();
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [selected, setSelected] = useState<MealBuilderType | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const handleContinue = async () => {
    if (!selected) {
      toast({
        title: "Please select a meal builder",
        description: "Choose the builder that best fits your dietary needs.",
        variant: "destructive",
      });
      return;
    }

    const authToken = getAuthToken();
    if (!authToken) {
      toast({
        title: "Please sign in",
        description: "You need to create an account to start your free trial.",
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
        title: "Great choice!",
        description: "Your 7-day free trial has started. Enjoy full access to all features!",
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
      className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-black text-white p-4"
    >
      <div className="max-w-2xl mx-auto pt-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-3">Choose Your Meal Builder</h1>
          <p className="text-white/70">
            Select the builder that fits your dietary needs. You can change this anytime.
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {BUILDER_OPTIONS.map((option) => (
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

        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
          <p className="text-sm text-white/80 text-center">
            Your 7-day free trial includes full access to all Premium features.
            After the trial, you'll keep your chosen builder with the Basic plan.
          </p>
        </div>

        <Button
          onClick={handleContinue}
          disabled={!selected || saving}
          className="w-full h-14 text-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Start My Free Trial"}
        </Button>
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
