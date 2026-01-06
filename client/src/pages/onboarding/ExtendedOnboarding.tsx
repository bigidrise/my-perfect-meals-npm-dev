import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { 
  Calendar, 
  Heart, 
  Pill, 
  Flame, 
  Trophy,
  Check,
  ArrowRight,
  ArrowLeft,
  Utensils
} from "lucide-react";
import { setMacroTargets, getMacroTargets, type StarchStrategy } from "@/lib/dailyLimits";

type OnboardingStep = "goals" | "builder" | "macros" | "starch" | "finish";

interface BuilderOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  bestFor: string[];
  goalCategories: string[];
}

const BUILDER_OPTIONS: BuilderOption[] = [
  {
    id: "weekly",
    title: "Weekly Meal Builder",
    description: "For everyday healthy eating. Build balanced weekly meal plans with variety.",
    icon: <Calendar className="w-6 h-6" />,
    bestFor: ["General wellness", "Family meals", "Variety seekers"],
    goalCategories: ["general", "weight_loss"],
  },
  {
    id: "diabetic",
    title: "Diabetic Meal Builder",
    description: "Blood sugar-friendly meals. Low glycemic options with carb guidance.",
    icon: <Heart className="w-6 h-6" />,
    bestFor: ["Type 1 or Type 2 diabetes", "Blood sugar management", "Pre-diabetes"],
    goalCategories: ["diabetes"],
  },
  {
    id: "glp1",
    title: "GLP-1 Meal Builder",
    description: "Optimized for Ozempic, Wegovy, Mounjaro users. Protein-focused, smaller portions.",
    icon: <Pill className="w-6 h-6" />,
    bestFor: ["GLP-1 medication users", "Appetite management", "High protein needs"],
    goalCategories: ["glp1"],
  },
  {
    id: "anti_inflammatory",
    title: "Anti-Inflammatory Builder",
    description: "Fight inflammation with healing foods. Omega-3 rich, antioxidant focused.",
    icon: <Flame className="w-6 h-6" />,
    bestFor: ["Autoimmune conditions", "Joint pain", "Chronic inflammation"],
    goalCategories: ["anti_inflammatory"],
  },
  {
    id: "beach_body",
    title: "Beach Body Meal Builder",
    description: "Contest prep and leaning out. Designed for rapid, visible change.",
    icon: <Trophy className="w-6 h-6" />,
    bestFor: ["Competition prep", "Rapid fat loss", "Physique goals"],
    goalCategories: ["performance"],
  },
];

const GOAL_OPTIONS = [
  { id: "general", label: "General Lifestyle", description: "Eat healthier without specific restrictions" },
  { id: "diabetes", label: "Diabetes / Blood Sugar", description: "Manage blood sugar with carb-conscious meals" },
  { id: "glp1", label: "GLP-1 / Appetite Support", description: "Optimize meals for medication users" },
  { id: "anti_inflammatory", label: "Anti-Inflammatory", description: "Reduce inflammation through food choices" },
  { id: "performance", label: "Performance / Athlete", description: "Fuel training and competition" },
  { id: "weight_loss", label: "Weight Loss", description: "Simple, effective fat loss approach" },
];

export default function ExtendedOnboarding() {
  const [, setLocation] = useLocation();
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  
  // ProCare mode: coach assigns builder, user only sets macros/starch
  // ProCare users with no activeBoard yet are in "awaiting assignment" state
  const isProCareUser = user?.isProCare === true;
  const hasCoachAssignedBuilder = isProCareUser && user?.activeBoard;
  const isAwaitingCoachAssignment = isProCareUser && !user?.activeBoard;
  
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(
    hasCoachAssignedBuilder ? "macros" : isProCareUser ? "goals" : "goals"
  );
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [selectedBuilder, setSelectedBuilder] = useState<string | null>(null);
  const [starchStrategy, setStarchStrategy] = useState<StarchStrategy>("one");
  const [saving, setSaving] = useState(false);
  
  const [macros, setMacros] = useState({
    calories: "2000",
    protein: "150",
    carbs: "200",
    fat: "70",
  });

  const isRepairMode = window.location.search.includes("repair=1");

  useEffect(() => {
    document.title = hasCoachAssignedBuilder ? "Complete Your Setup | My Perfect Meals" : "Setup | My Perfect Meals";
    
    const existingTargets = getMacroTargets(user?.id);
    if (existingTargets) {
      setMacros({
        calories: String(existingTargets.calories || 2000),
        protein: String(existingTargets.protein_g || 150),
        carbs: String(existingTargets.carbs_g || 200),
        fat: String(existingTargets.fat_g || 70),
      });
      if (existingTargets.starchStrategy) {
        setStarchStrategy(existingTargets.starchStrategy);
      }
    }
    
    if (user?.selectedMealBuilder || user?.activeBoard) {
      setSelectedBuilder(user.activeBoard || user.selectedMealBuilder || null);
    }
    
    // ProCare with assignment: automatically advance to macros step
    // This handles both initial load AND mid-session coach assignment
    if (hasCoachAssignedBuilder && (currentStep === "goals" || currentStep === "builder")) {
      setCurrentStep("macros");
      setSelectedBuilder(user?.activeBoard ?? null);
    }
  }, [user, hasCoachAssignedBuilder, currentStep]);

  // ProCare with assigned builder: skip goals and builder selection
  // ProCare awaiting assignment: show waiting state
  // Independent: full 5-step flow
  const steps: OnboardingStep[] = hasCoachAssignedBuilder 
    ? ["macros", "starch", "finish"]  // ProCare: coach assigns builder
    : ["goals", "builder", "macros", "starch", "finish"];  // Independent or awaiting
  const rawStepIndex = steps.indexOf(currentStep);
  // Guard against -1 during step transitions (e.g., ProCare assignment mid-flow)
  const currentStepIndex = rawStepIndex === -1 ? 0 : rawStepIndex;

  const getRecommendedBuilders = () => {
    if (!selectedGoal) return BUILDER_OPTIONS;
    return BUILDER_OPTIONS.filter(b => b.goalCategories.includes(selectedGoal));
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex]);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex]);
    }
  };

  const handleFinish = async () => {
    // ProCare mode: builder is already assigned by coach
    const builderToUse = hasCoachAssignedBuilder ? user?.activeBoard : selectedBuilder;
    
    if (!builderToUse && !hasCoachAssignedBuilder) {
      toast({
        title: "Please select a meal builder",
        variant: "destructive",
      });
      setCurrentStep("builder");
      return;
    }

    setSaving(true);

    try {
      await setMacroTargets({
        calories: parseInt(macros.calories) || 0,
        protein_g: parseInt(macros.protein) || 0,
        carbs_g: parseInt(macros.carbs) || 0,
        fat_g: parseInt(macros.fat) || 0,
        starchStrategy: starchStrategy,
      }, user?.id);

      const authToken = getAuthToken();
      if (authToken) {
        // Only call select-meal-builder for independent mode (not ProCare)
        if (!hasCoachAssignedBuilder && builderToUse) {
          const response = await fetch(apiUrl("/api/user/select-meal-builder"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-auth-token": authToken,
            },
            body: JSON.stringify({
              selectedMealBuilder: builderToUse,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to save builder selection");
          }
        }

        const completeResponse = await fetch(apiUrl("/api/user/complete-onboarding"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-auth-token": authToken,
          },
          body: JSON.stringify({
            onboardingMode: isProCareUser ? "procare" : "independent",
          }),
        });

        if (!completeResponse.ok) {
          const errorData = await completeResponse.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to complete onboarding");
        }

        await refreshUser();
      }

      toast({
        title: "Setup Complete!",
        description: hasCoachAssignedBuilder 
          ? "Your coach's assigned builder is ready."
          : "Your meal builder is ready to use.",
      });

      setLocation("/planner");
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
      toast({
        title: "Error",
        description: "Failed to save your preferences. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((step, index) => (
        <div
          key={step}
          className={`w-2 h-2 rounded-full transition-all ${
            index === currentStepIndex
              ? "w-6 bg-orange-500"
              : index < currentStepIndex
              ? "bg-orange-500"
              : "bg-white/20"
          }`}
        />
      ))}
    </div>
  );

  const renderGoalsStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white mb-2">What are you focused on right now?</h2>
        <p className="text-white/70 text-sm">This sets your primary meal builder. You can change it later.</p>
      </div>

      <div className="space-y-3">
        {GOAL_OPTIONS.map((goal) => (
          <Card
            key={goal.id}
            className={`cursor-pointer transition-all ${
              selectedGoal === goal.id
                ? "border-orange-500 bg-orange-500/10"
                : "border-white/10 bg-black/30 hover:border-white/30"
            }`}
            onClick={() => setSelectedGoal(goal.id)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                selectedGoal === goal.id ? "border-orange-500 bg-orange-500" : "border-white/30"
              }`}>
                {selectedGoal === goal.id && <Check className="w-3 h-3 text-white" />}
              </div>
              <div>
                <h3 className="text-white font-medium">{goal.label}</h3>
                <p className="text-white/60 text-xs">{goal.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        onClick={() => {
          if (!selectedGoal) {
            toast({
              title: "Please select a goal",
              description: "Choose what you're focused on to continue.",
              variant: "destructive",
            });
            return;
          }
          handleNext();
        }}
        disabled={!selectedGoal}
        className="w-full mt-6 bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
      >
        Continue <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );

  const renderBuilderStep = () => {
    // ProCare users without assignment: show waiting state
    if (isAwaitingCoachAssignment) {
      return (
        <div className="space-y-4">
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Heart className="w-8 h-8 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Awaiting Your Coach</h2>
            <p className="text-white/70 text-sm">
              Your coach will assign your meal builder. You'll be notified when it's ready.
            </p>
          </div>

          <Card className="border-blue-500/30 bg-blue-500/10">
            <CardContent className="p-4 text-center">
              <p className="text-blue-200 text-sm">
                You're enrolled in Pro Care. Your coach will select the best meal builder for your goals and assign it to your account.
              </p>
            </CardContent>
          </Card>

          <Button
            onClick={() => setLocation("/dashboard")}
            variant="outline"
            className="w-full mt-6 border-white/20 text-white hover:bg-white/10"
          >
            Return to Dashboard
          </Button>
        </div>
      );
    }

    const recommended = getRecommendedBuilders();
    const others = BUILDER_OPTIONS.filter(b => !recommended.includes(b));

    return (
      <div className="space-y-4">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-white mb-2">Choose your Primary Builder</h2>
          <p className="text-white/70 text-sm">This is the only builder you'll be able to open in Planner.</p>
        </div>

        {recommended.length > 0 && (
          <div className="space-y-3">
            <p className="text-orange-400 text-xs font-medium uppercase tracking-wide">Recommended for you</p>
            {recommended.map((builder) => (
              <Card
                key={builder.id}
                className={`cursor-pointer transition-all ${
                  selectedBuilder === builder.id
                    ? "border-orange-500 bg-orange-500/10"
                    : "border-white/10 bg-black/30 hover:border-white/30"
                }`}
                onClick={() => setSelectedBuilder(builder.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${selectedBuilder === builder.id ? "bg-orange-500/20 text-orange-400" : "bg-white/5 text-white/60"}`}>
                      {builder.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-medium">{builder.title}</h3>
                      <p className="text-white/60 text-xs mt-1">{builder.description}</p>
                    </div>
                    {selectedBuilder === builder.id && (
                      <Check className="w-5 h-5 text-orange-500" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {others.length > 0 && (
          <div className="space-y-3 mt-4">
            <p className="text-white/40 text-xs font-medium uppercase tracking-wide">Other options</p>
            {others.map((builder) => (
              <Card
                key={builder.id}
                className={`cursor-pointer transition-all ${
                  selectedBuilder === builder.id
                    ? "border-orange-500 bg-orange-500/10"
                    : "border-white/10 bg-black/30 hover:border-white/30"
                }`}
                onClick={() => setSelectedBuilder(builder.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/5 text-white/60">
                      {builder.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white/80 font-medium text-sm">{builder.title}</h3>
                    </div>
                    {selectedBuilder === builder.id && (
                      <Check className="w-5 h-5 text-orange-500" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <Button onClick={handleBack} variant="outline" className="flex-1 border-orange-500/50 text-orange-400 hover:bg-orange-500/10">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!selectedBuilder}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
          >
            Continue <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  };

  const renderMacrosStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white mb-2">Set your daily targets</h2>
        <p className="text-white/70 text-sm">We'll use this to build meals that fit your goals.</p>
      </div>

      <Card className="border-white/10 bg-black/30">
        <CardContent className="p-4 space-y-4">
          <div>
            <label className="text-white/70 text-xs uppercase tracking-wide">Calories</label>
            <input
              type="number"
              value={macros.calories}
              onChange={(e) => setMacros({ ...macros, calories: e.target.value })}
              className="w-full mt-1 p-3 rounded-lg bg-black/50 border border-white/20 text-white text-lg"
              inputMode="numeric"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-white/70 text-xs uppercase tracking-wide">Protein (g)</label>
              <input
                type="number"
                value={macros.protein}
                onChange={(e) => setMacros({ ...macros, protein: e.target.value })}
                className="w-full mt-1 p-3 rounded-lg bg-black/50 border border-white/20 text-white"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="text-white/70 text-xs uppercase tracking-wide">Carbs (g)</label>
              <input
                type="number"
                value={macros.carbs}
                onChange={(e) => setMacros({ ...macros, carbs: e.target.value })}
                className="w-full mt-1 p-3 rounded-lg bg-black/50 border border-white/20 text-white"
                inputMode="numeric"
              />
            </div>
            <div>
              <label className="text-white/70 text-xs uppercase tracking-wide">Fat (g)</label>
              <input
                type="number"
                value={macros.fat}
                onChange={(e) => setMacros({ ...macros, fat: e.target.value })}
                className="w-full mt-1 p-3 rounded-lg bg-black/50 border border-white/20 text-white"
                inputMode="numeric"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-white/50 text-xs text-center">
        You can refine these later in the Macro Calculator.
      </p>

      <div className="flex gap-3 mt-6">
        <Button onClick={handleBack} variant="outline" className="flex-1 border-orange-500/50 text-orange-400 hover:bg-orange-500/10">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button onClick={handleNext} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white">
          Continue <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderStarchStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-white mb-2">Pick your Starch Game Plan</h2>
        <p className="text-white/70 text-sm">This controls how carbs are distributed across your day.</p>
      </div>

      <div className="space-y-3">
        <Card
          className={`cursor-pointer transition-all ${
            starchStrategy === "one"
              ? "border-orange-500 bg-orange-500/10"
              : "border-white/10 bg-black/30 hover:border-white/30"
          }`}
          onClick={() => setStarchStrategy("one")}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                starchStrategy === "one" ? "border-orange-500 bg-orange-500" : "border-white/30"
              }`}>
                {starchStrategy === "one" && <Check className="w-3 h-3 text-white" />}
              </div>
              <div>
                <h3 className="text-white font-medium">One Starch Meal</h3>
                <p className="text-white/60 text-xs mt-1">One main meal includes starch; the rest are lower-starch.</p>
                <p className="text-orange-400/80 text-xs mt-2">Best for: appetite control, blood sugar, cutting</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all ${
            starchStrategy === "flex"
              ? "border-orange-500 bg-orange-500/10"
              : "border-white/10 bg-black/30 hover:border-white/30"
          }`}
          onClick={() => setStarchStrategy("flex")}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                starchStrategy === "flex" ? "border-orange-500 bg-orange-500" : "border-white/30"
              }`}>
                {starchStrategy === "flex" && <Check className="w-3 h-3 text-white" />}
              </div>
              <div>
                <h3 className="text-white font-medium">Flex Split</h3>
                <p className="text-white/60 text-xs mt-1">Starch can be split across meals to support performance and energy.</p>
                <p className="text-orange-400/80 text-xs mt-2">Best for: athletes, high activity, maintenance</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3 mt-6">
        <Button onClick={handleBack} variant="outline" className="flex-1 border-orange-500/50 text-orange-400 hover:bg-orange-500/10">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button onClick={handleNext} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white">
          Continue <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderFinishStep = () => {
    const builderToShow = hasCoachAssignedBuilder ? user?.activeBoard : selectedBuilder;
    const builderInfo = BUILDER_OPTIONS.find(b => b.id === builderToShow);
    
    return (
      <div className="space-y-4">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-500/20 flex items-center justify-center">
            <Utensils className="w-8 h-8 text-orange-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">You're all set!</h2>
          <p className="text-white/70 text-sm">
            {hasCoachAssignedBuilder 
              ? "Your coach has assigned your builder. Review your setup below."
              : "Here's your setup summary."}
          </p>
        </div>

        <Card className="border-white/10 bg-black/30">
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-white/10">
              <span className="text-white/60 text-sm">
                {hasCoachAssignedBuilder ? "Assigned Builder" : "Primary Builder"}
              </span>
              <span className="text-white font-medium">{builderInfo?.title || builderToShow}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/10">
              <span className="text-white/60 text-sm">Daily Calories</span>
              <span className="text-white font-medium">{macros.calories}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-white/10">
              <span className="text-white/60 text-sm">Protein / Carbs / Fat</span>
              <span className="text-white font-medium">{macros.protein}g / {macros.carbs}g / {macros.fat}g</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-white/60 text-sm">Starch Plan</span>
              <span className="text-white font-medium">{starchStrategy === "one" ? "One Starch Meal" : "Flex Split"}</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 mt-6">
          <Button onClick={handleBack} variant="outline" className="flex-1 border-orange-500/50 text-orange-400 hover:bg-orange-500/10">
            <ArrowLeft className="w-4 h-4 mr-2" /> Edit
          </Button>
          <Button
            onClick={handleFinish}
            disabled={saving}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
          >
            {saving ? "Saving..." : "Enter Planner"}
          </Button>
        </div>
      </div>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case "goals":
        return renderGoalsStep();
      case "builder":
        return renderBuilderStep();
      case "macros":
        return renderMacrosStep();
      case "starch":
        return renderStarchStep();
      case "finish":
        return renderFinishStep();
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black text-white"
    >
      <div
        className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold text-white text-center">
            {hasCoachAssignedBuilder 
              ? "Complete Your Setup" 
              : isRepairMode 
                ? "Complete Your Setup" 
                : "Let's Get You Started"}
          </h1>
        </div>
      </div>

      <div
        className="px-4 py-6 max-w-md mx-auto"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 80px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 120px)",
        }}
      >
        {renderStepIndicator()}

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {renderCurrentStep()}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
