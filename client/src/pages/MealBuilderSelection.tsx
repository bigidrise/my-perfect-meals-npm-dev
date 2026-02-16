import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { apiUrl } from "@/lib/resolveApiBase";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Utensils,
  Heart,
  Pill,
  Flame,
  ArrowLeft,
  MessageCircle,
  AlertTriangle,
  RefreshCw,
  Trophy,
  Dumbbell,
  Lock,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { PillButton } from "@/components/ui/pill-button";
import { MealBuilderType, getAuthToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import DisclaimerModal from "@/components/DisclaimerModal";

interface BuilderSwitchStatus {
  switchesUsed: number;
  switchesRemaining: number;
  canSwitch: boolean;
  nextSwitchAvailable: string | null;
}

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
    description:
      "For everyday healthy eating. Build balanced weekly meal plans with variety.",
    icon: <Utensils className="w-8 h-8" />,
    color: "from-black via-zinc-950 to-black",
  },
  {
    id: "diabetic",
    title: "Diabetic Meal Builder",
    description:
      "Blood sugar-friendly meals. Low glycemic options with carb counting.",
    icon: <Heart className="w-8 h-8" />,
    color: "from-black via-zinc-950 to-black",
  },
  {
    id: "glp1",
    title: "GLP-1 Meal Builder",
    description:
      "Optimized for Ozempic, Wegovy, Mounjaro users. Protein-focused, smaller portions.",
    icon: <Pill className="w-8 h-8" />,
    color: "from-black via-zinc-950 to-black",
  },
  {
    id: "anti_inflammatory",
    title: "Anti-Inflam. Builder",
    description:
      "Fight inflammation with healing foods. Omega-3 rich, antioxidant focused.",
    icon: <Flame className="w-8 h-8" />,
    color: "from-black via-zinc-950 to-black",
  },
  {
    id: "beach_body",
    title: "Beach Body Builder",
    description:
      "Contest prep and leaning out. Designed for rapid, visible change.",
    icon: <Trophy className="w-8 h-8" />,
    color: "from-black via-zinc-950 to-black",
  },
  {
    id: "general_nutrition",
    title: "General Nutrition Builder",
    description:
      "Professional-grade nutrition with coach support. Requires trainer unlock.",
    icon: <Utensils className="w-8 h-8" />,
    color: "from-black via-zinc-950 to-black",
  },
  {
    id: "performance_competition",
    title: "Performance Builder",
    description:
      "Elite athlete meal planning for competition prep. Requires trainer unlock.",
    icon: <Dumbbell className="w-8 h-8" />,
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
  const [switchStatus, setSwitchStatus] = useState<BuilderSwitchStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const isProCareClient = user?.isProCare && !["admin", "coach", "physician", "trainer"].includes(user?.professionalRole || user?.role || "");
  const isAdmin = user?.role === "admin" || user?.isTester || user?.entitlements?.includes("FULL_ACCESS");
  
  // Pro builders require trainer unlock
  const PRO_BUILDERS = ["general_nutrition", "performance_competition"];
  
  const isProBuilderUnlocked = (builderId: string): boolean => {
    if (!PRO_BUILDERS.includes(builderId)) return true; // Not a pro builder
    if (isAdmin) return true; // Admins have full access
    // User has access if trainer assigned this as their activeBoard
    return user?.activeBoard === builderId;
  };
  
  const availableBuilders =
    isProCareClient && user?.activeBoard
      ? BUILDER_OPTIONS.filter((opt) => opt.id === user.activeBoard)
      : BUILDER_OPTIONS;

  // Refresh user data when component mounts to ensure we have latest state
  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Initialize selected state from user's current builder
  // For ProCare clients (actual clients, not professionals), activeBoard takes priority
  useEffect(() => {
    const currentBuilder = isProCareClient
      ? (user?.activeBoard || user?.selectedMealBuilder)
      : (user?.selectedMealBuilder || user?.activeBoard);
    if (currentBuilder) {
      setSelected(currentBuilder as MealBuilderType);
    }
  }, [user?.activeBoard, user?.selectedMealBuilder, isProCareClient]);

  useEffect(() => {
    const fetchSwitchStatus = async () => {
      const authToken = getAuthToken();
      if (!authToken) {
        setLoadingStatus(false);
        return;
      }

      try {
        const response = await fetch(apiUrl("/api/user/builder-switch-status"), {
          headers: { "x-auth-token": authToken },
        });
        if (response.ok) {
          const status = await response.json();
          setSwitchStatus(status);
        }
      } catch (error) {
        console.error("Failed to fetch switch status:", error);
      } finally {
        setLoadingStatus(false);
      }
    };

    fetchSwitchStatus();
  }, []);

  const handleContinue = async () => {
    if (!selected) {
      toast({
        title: "Please select a meal builder",
        description:
          "Choose the builder that best fits your needs going forward.",
        variant: "destructive",
      });
      return;
    }

    if (selected === user?.selectedMealBuilder) {
      toast({
        title: "Already using this builder",
        description: "You're already using this meal builder.",
      });
      setLocation("/dashboard");
      return;
    }

    // Switch limit check - currently disabled (ENFORCE_SWITCH_LIMITS = false on backend)
    // if (switchStatus && !switchStatus.canSwitch) {
    //   toast({
    //     title: "Switch limit reached",
    //     description: `You've used all 3 builder switches this year. Next switch available ${switchStatus.nextSwitchAvailable ? new Date(switchStatus.nextSwitchAvailable).toLocaleDateString() : "later this year"}.`,
    //     variant: "destructive",
    //   });
    //   return;
    // }

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
      const response = await fetch(apiUrl("/api/user/meal-builder"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": authToken,
        },
        body: JSON.stringify({
          selectedMealBuilder: selected,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.switchStatus) {
          setSwitchStatus(data.switchStatus);
        }
        throw new Error(data.error || "Failed to save selection");
      }

      if (data.switchStatus) {
        setSwitchStatus(data.switchStatus);
      }

      await refreshUser();

      toast({
        title: "Builder Updated",
        description:
          "Your meal builder has been changed. You're all set to continue.",
      });

      const disclaimerAccepted =
        localStorage.getItem("acceptedDisclaimer") === "true";
      if (disclaimerAccepted) {
        setLocation("/dashboard");
      } else {
        setShowDisclaimer(true);
      }
    } catch (error: any) {
      console.error("Failed to save meal builder selection:", error);
      toast({
        title: "Unable to Switch",
        description: error.message || "Failed to save your selection. Please try again.",
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
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 pb-3 flex items-center gap-3">
          <Button
            onClick={() => setLocation("/dashboard")}
            className="bg-black/10 hover:bg-black/50 text-white rounded-xl border border-white/10 backdrop-blur-none flex items-center gap-1.5 px-2.5 h-9 flex-shrink-0"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-medium">Back</span>
          </Button>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            Meal Builder Exchange
          </h1>
        </div>
      </div>

      {/* Content area with padding for fixed header and bottom nav */}
      <div
        className="pt-16 pb-24"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 64px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 100px)",
        }}
      >
        {/* Member acknowledgment */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
          <p className="text-sm text-white/90 text-center leading-relaxed">
            You're already a My Perfect Meals member. This page helps you switch
            meal boards as your needs change — whether you're continuing on your
            own, following a medical plan, or simplifying long-term.
          </p>
        </div>

        {/* ProCare transition note */}
        {user?.isProCare && (
          <div className="bg-indigo-900/30 border border-indigo-500/50 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <MessageCircle className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-indigo-200 text-sm font-medium mb-1">
                  Coming from ProCare?
                </p>
                <p className="text-indigo-300/80 text-xs leading-relaxed">
                  Your coach or clinician may have recommended a next step.
                  Choose the meal board that fits how you'll continue moving
                  forward.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pricing clarity */}
        <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-3 mb-6">
          <p className="text-emerald-300 text-sm text-center font-medium">
            Update the Meal Builder used to create your meals.
          </p>
          <p className="text-emerald-400/70 text-xs text-center mt-1">
            Your plan adjusts based on the builder or program selected.
          </p>
        </div>

        {/* Builder Switch Status - Currently disabled, uncomment when ENFORCE_SWITCH_LIMITS is true */}
        {/* {!loadingStatus && switchStatus && (
          <div className={`rounded-xl p-4 mb-6 ${switchStatus.canSwitch ? "bg-zinc-900/60 border border-zinc-700" : "bg-amber-900/30 border border-amber-500/50"}`}>
            <div className="flex items-center gap-3">
              {switchStatus.canSwitch ? (
                <RefreshCw className="w-5 h-5 text-zinc-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              )}
              <div className="flex-1">
                {switchStatus.canSwitch ? (
                  <>
                    <p className="text-white text-sm font-medium">
                      {switchStatus.switchesRemaining} switch{switchStatus.switchesRemaining !== 1 ? "es" : ""} remaining this year
                    </p>
                    <p className="text-zinc-400 text-xs mt-0.5">
                      You can change your meal builder {switchStatus.switchesRemaining} more time{switchStatus.switchesRemaining !== 1 ? "s" : ""} in the next 12 months.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-amber-200 text-sm font-medium">
                      Switch limit reached
                    </p>
                    <p className="text-amber-300/70 text-xs mt-0.5">
                      You've used all 3 builder switches this year.
                      {switchStatus.nextSwitchAvailable && (
                        <> Your next switch will be available on {new Date(switchStatus.nextSwitchAvailable).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.</>
                      )}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )} */}

        <div className="space-y-4 mb-8">
          {/* Locked state: Pro Care client with no assigned board */}
          {isProCareClient && !user?.activeBoard && (
            <div className="bg-zinc-900/80 border border-zinc-700 rounded-2xl p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
                <Utensils className="w-8 h-8 text-zinc-500" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Awaiting Assignment
              </h3>
              <p className="text-zinc-400 text-sm">
                Your meal builder will be assigned by your coach. Check back
                soon!
              </p>
            </div>
          )}

          {/* Available builders - only show if NOT in locked state */}
          {!(isProCareClient && !user?.activeBoard) &&
            availableBuilders.map((option) => {
              const isUnlocked = isProBuilderUnlocked(option.id);
              const isProBuilder = PRO_BUILDERS.includes(option.id);
              
              return (
              <div
                key={option.id}
                className={`w-full p-4 rounded-2xl border-2 transition-all ${
                  !isUnlocked
                    ? "border-zinc-700 bg-black/20 opacity-60"
                    : selected === option.id
                    ? "border-emerald-500/50 bg-white/10"
                    : "border-white/20 bg-black/30"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`p-3 rounded-xl bg-gradient-to-br ${option.color} ${isUnlocked ? "text-white" : "text-zinc-500"} flex-shrink-0`}
                  >
                    {option.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={`text-base font-semibold truncate ${!isUnlocked ? "text-zinc-400" : ""}`}>{option.title}</h3>
                        {!isUnlocked && isProBuilder && (
                          <Lock className="w-4 h-4 text-zinc-500" />
                        )}
                        {option.id === "beach_body" && (
                          <span className="text-xs px-2 py-0.5 bg-amber-600/30 text-amber-300 rounded-full border border-amber-500/30">
                            Ultimate
                          </span>
                        )}
                        {((user?.isProCare ? user?.activeBoard : user?.selectedMealBuilder) || user?.selectedMealBuilder) === option.id && (
                          <span className="text-xs px-2 py-0.5 bg-emerald-600/30 text-emerald-300 rounded-full border border-emerald-500/30">
                            Current
                          </span>
                        )}
                      </div>
                      {isUnlocked ? (
                        <PillButton
                          active={selected === option.id}
                          onClick={() => setSelected(option.id)}
                          className="flex-shrink-0"
                        >
                          {selected === option.id ? "On" : "Off"}
                        </PillButton>
                      ) : (
                        <span className="text-xs text-zinc-500 italic">Trainer unlock required</span>
                      )}
                    </div>
                    <p className={`text-sm mt-1 ${!isUnlocked ? "text-zinc-500" : "text-white/70"}`}>
                      {!isUnlocked ? "Requires trainer/coach to unlock access" : option.description}
                    </p>
                  </div>
                </div>
              </div>
            );
            })}
        </div>

        {/* Copilot guidance hint */}
        <div className="bg-black/20 border border-white/5 rounded-xl p-3 mb-6">
          <p className="text-white/60 text-xs text-center italic">
            Not sure which to pick? If you've finished working with a coach,
            most people transition to the Weekly Meal Builder for long-term
            balance. If your health needs have changed, select the board that
            supports that condition.
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
