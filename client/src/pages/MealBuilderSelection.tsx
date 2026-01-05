import { useState } from "react";
import { useLocation } from "wouter";
import { apiUrl } from '@/lib/resolveApiBase';
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Check, Utensils, Heart, Pill, Flame, ArrowLeft} from "lucide-react";
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

  // Role-based access: Pro Care clients only see their assigned board
  const isProCareClient = user?.isProCare && user?.role !== "admin";
  const availableBuilders = isProCareClient && user?.activeBoard
    ? BUILDER_OPTIONS.filter(opt => opt.id === user.activeBoard)
    : BUILDER_OPTIONS; // Admin and non-ProCare users see all

  // Determine if user is an existing subscriber (not a new user needing trial)
  // If they already have a selectedMealBuilder, they're switching - not starting fresh
  const isExistingUser = !!user?.selectedMealBuilder;

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

      // Different messaging for new vs existing users
      if (isExistingUser) {
        toast({
          title: "Builder Updated!",
          description: "Your meal builder has been changed. Your plan continues as normal.",
        });
      } else {
        toast({
          title: "Great choice!",
          description: "Your 7-day free trial has started. Enjoy full access to all features!",
        });
      }

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
              Choose Your Meal Builder
            </h1>
          </div>
        </div>

        {/* Content area with padding for fixed header */}
        <div 
          className="pt-16"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 64px)" }}
        >
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

          {/* Pro Care client with assigned board - show badge */}
          {isProCareClient && user?.activeBoard && (
            <div className="bg-indigo-900/30 border border-indigo-500/50 rounded-xl p-3 text-center mb-4">
              <p className="text-indigo-300 text-sm font-medium">
                Assigned by your Coach
              </p>
            </div>
          )}

          {/* Available builders (filtered for Pro Care clients) - only show if NOT in locked state */}
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

        {/* Show appropriate messaging based on user status */}
        {!isProCareClient && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
            {isExistingUser ? (
              <p className="text-sm text-white/80 text-center">
                Switching your meal builder will update your dietary focus.
                Your current subscription continues at $19.99/month.
              </p>
            ) : (
              <p className="text-sm text-white/80 text-center">
                Your 7-day free trial includes full access to all Premium features.
                After the trial, you'll keep your chosen builder with the Basic plan.
              </p>
            )}
          </div>
        )}

        {/* Hide button for Pro Care clients with no assigned board */}
        {!(isProCareClient && !user?.activeBoard) && (
          <Button
            onClick={handleContinue}
            disabled={!selected || saving}
            className="w-full h-14 text-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving 
              ? "Saving..." 
              : isExistingUser 
                ? "Switch Builder" 
                : "Start My Free Trial"
            }
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
