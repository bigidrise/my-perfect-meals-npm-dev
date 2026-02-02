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
  Shield,
  Eye,
  EyeOff,
  Utensils,
  Dumbbell,
} from "lucide-react";
import { Input } from "@/components/ui/input";

type OnboardingStep = "goals" | "builder" | "safety-pin";

interface BuilderOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  bestFor: string[];
  goalCategories: string[];
  planBadge: string;
}

const BUILDER_OPTIONS: BuilderOption[] = [
  {
    id: "weekly",
    title: "Weekly Meal Builder",
    description: "For everyday healthy eating. Build balanced weekly meal plans with variety.",
    icon: <Calendar className="w-6 h-6" />,
    bestFor: ["General wellness", "Family meals", "Variety seekers"],
    goalCategories: ["general", "weight_loss"],
    planBadge: "Basic Plan",
  },
  {
    id: "diabetic",
    title: "Diabetic Meal Builder",
    description: "Blood sugar-friendly meals. Low glycemic options with carb guidance.",
    icon: <Heart className="w-6 h-6" />,
    bestFor: ["Type 1 or Type 2 diabetes", "Blood sugar management", "Pre-diabetes"],
    goalCategories: ["diabetes"],
    planBadge: "Basic Plan",
  },
  {
    id: "glp1",
    title: "GLP-1 Meal Builder",
    description: "Optimized for Ozempic, Wegovy, Mounjaro users. Protein-focused, smaller portions.",
    icon: <Pill className="w-6 h-6" />,
    bestFor: ["GLP-1 medication users", "Appetite management", "High protein needs"],
    goalCategories: ["glp1"],
    planBadge: "Basic Plan",
  },
  {
    id: "anti_inflammatory",
    title: "Anti-Inflammatory Builder",
    description: "Fight inflammation with healing foods. Omega-3 rich, antioxidant focused.",
    icon: <Flame className="w-6 h-6" />,
    bestFor: ["Autoimmune conditions", "Joint pain", "Chronic inflammation"],
    goalCategories: ["anti_inflammatory"],
    planBadge: "Basic Plan",
  },
  {
    id: "beach_body",
    title: "Beach Body Meal Builder",
    description: "Contest prep and leaning out. Designed for rapid, visible change.",
    icon: <Trophy className="w-6 h-6" />,
    bestFor: ["Competition prep", "Rapid fat loss", "Physique goals"],
    goalCategories: ["performance"],
    planBadge: "Ultimate Plan",
  },
  {
    id: "general_nutrition",
    title: "General Nutrition Builder",
    description: "Professional-grade nutrition with coach support and custom protocols.",
    icon: <Utensils className="w-6 h-6" />,
    bestFor: ["Coach-guided nutrition", "Custom meal plans", "Professional support"],
    goalCategories: ["pro_coaching"],
    planBadge: "Pro Plan (Trainer Unlock)",
  },
  {
    id: "performance_competition",
    title: "Performance & Competition Builder",
    description: "Elite athlete meal planning for competition prep and peak performance.",
    icon: <Dumbbell className="w-6 h-6" />,
    bestFor: ["Elite athletes", "Competition prep", "Peak performance"],
    goalCategories: ["pro_performance"],
    planBadge: "Pro Plan (Trainer Unlock)",
  },
];

const GOAL_OPTIONS = [
  { id: "general", label: "General Lifestyle", description: "Eat healthier without specific restrictions" },
  { id: "diabetes", label: "Diabetes / Blood Sugar", description: "Manage blood sugar with carb-conscious meals" },
  { id: "glp1", label: "GLP-1 / Appetite Support", description: "Optimize meals for medication users" },
  { id: "anti_inflammatory", label: "Anti-Inflammatory", description: "Reduce inflammation through food choices" },
  { id: "performance", label: "Beach Body", description: "Contest prep and leaning out for visible change" },
  { id: "weight_loss", label: "Weight Loss", description: "Simple, effective fat loss approach" },
];

export default function ExtendedOnboarding() {
  const [, setLocation] = useLocation();
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  
  // ProCare mode: coach assigns builder, user only sets macros/starch
  const isProCareUser = user?.isProCare === true;
  const hasCoachAssignedBuilder = isProCareUser && user?.activeBoard;
  const isAwaitingCoachAssignment = isProCareUser && !user?.activeBoard;
  
  const [currentStep, setCurrentStep] = useState<OnboardingStep>("goals");
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [selectedBuilder, setSelectedBuilder] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Safety PIN state
  const [safetyPin, setSafetyPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Choose Your Builder | My Perfect Meals";
    
    if (user?.selectedMealBuilder || user?.activeBoard) {
      // For ProCare clients, activeBoard takes priority; for regular users, selectedMealBuilder
      const currentBuilder = user.isProCare 
        ? (user.activeBoard || user.selectedMealBuilder)
        : (user.selectedMealBuilder || user.activeBoard);
      setSelectedBuilder(currentBuilder || null);
    }
    
    // ProCare with assignment: redirect to macro calculator directly
    if (hasCoachAssignedBuilder) {
      setLocation("/macro-counter");
    }
  }, [user, hasCoachAssignedBuilder, setLocation]);

  // 3-step flow: Goals → Builder → Safety PIN
  const steps: OnboardingStep[] = ["goals", "builder", "safety-pin"];
  const currentStepIndex = steps.indexOf(currentStep);

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

  const handleBuilderContinue = async () => {
    if (!selectedBuilder) return;

    setSaving(true);

    try {
      const authToken = getAuthToken();
      
      // Guest mode: skip server save, just navigate
      if (!authToken) {
        // Store builder selection in localStorage for guest users
        localStorage.setItem("guestSelectedBuilder", selectedBuilder);
        setLocation("/macro-counter");
        return;
      }

      // Save builder selection (independent users only)
      if (!hasCoachAssignedBuilder) {
        const response = await fetch(apiUrl("/api/user/select-meal-builder"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-auth-token": authToken,
          },
          body: JSON.stringify({
            selectedMealBuilder: selectedBuilder,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to save builder selection");
        }
      }

      await refreshUser();

      // Move to Safety PIN step
      handleNext();

    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Could not continue. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSafetyPinContinue = async () => {
    setPinError(null);
    
    // Validate PIN format (exactly 4 digits)
    if (!/^\d{4}$/.test(safetyPin)) {
      setPinError("PIN must be exactly 4 digits");
      return;
    }
    
    if (safetyPin !== confirmPin) {
      setPinError("PINs do not match");
      return;
    }
    
    setSaving(true);
    
    try {
      const authToken = getAuthToken();
      
      if (!authToken) {
        // Guest mode: skip PIN setup
        setLocation("/macro-counter");
        return;
      }
      
      const response = await fetch(apiUrl("/api/safety-pin/set"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": authToken,
        },
        body: JSON.stringify({ pin: safetyPin }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to set Safety PIN");
      }
      
      toast({
        title: "Safety PIN Set",
        description: "Your Safety PIN has been created successfully.",
      });
      
      // Continue to Macro Calculator
      setLocation("/macro-counter");
      
    } catch (error: any) {
      console.error(error);
      setPinError(error.message || "Could not set Safety PIN");
    } finally {
      setSaving(false);
    }
  };

  const handleSkipSafetyPin = () => {
    // Allow users to skip PIN setup (they can set it later in settings)
    setLocation("/macro-counter");
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
          <p className="text-emerald-400/80 text-xs mt-2">You can always change your builder later in Settings.</p>
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
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-medium">{builder.title}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          builder.planBadge === "Ultimate Plan" 
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        }`}>
                          {builder.planBadge}
                        </span>
                      </div>
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
                      <div className="flex items-center gap-2">
                        <h3 className="text-white/80 font-medium text-sm">{builder.title}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          builder.planBadge === "Ultimate Plan" 
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        }`}>
                          {builder.planBadge}
                        </span>
                      </div>
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
          <Button onClick={handleBack} variant="outline" className="flex-1 bg-black border-black text-white">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button
            disabled={!selectedBuilder || saving}
            className="flex-1 bg-orange-500 text-white"
            onClick={handleBuilderContinue}
          >
            {saving ? "Saving..." : "Macro Calculator"} <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  };

  const renderSafetyPinStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
          <Shield className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">MPM SafetyGuard</h2>
        <p className="text-white/70 text-sm">
          Two-layer allergy protection system
        </p>
      </div>

      <Card className="border-white/10 bg-black/30">
        <CardContent className="p-4 space-y-4">
          <p className="text-white/70 text-sm leading-relaxed">
            My Perfect Meals includes <span className="text-green-400 font-medium">MPM SafetyGuard</span>, 
            a two-layer allergy protection system designed to help prevent meals that conflict with your food allergies.
          </p>
          
          <p className="text-white/60 text-sm leading-relaxed">
            SafetyGuard checks ingredients <strong className="text-white">before meals are created</strong> and{" "}
            <strong className="text-white">after meals are generated</strong> to help reduce allergy risks.
          </p>
          
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mt-2">
            <p className="text-amber-200 text-xs leading-relaxed">
              Because allergies can be serious, SafetyGuard is <strong>always on by default</strong>. 
              Create a 4-digit Safety PIN to protect against accidental or unauthorized changes.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-white mb-1">
                Enter Safety PIN
              </label>
              <div className="relative">
                <Input
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  placeholder="4 digits"
                  value={safetyPin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setSafetyPin(val);
                    setPinError(null);
                  }}
                  className="bg-black/40 border-white/20 text-white pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-1">
                Confirm Safety PIN
              </label>
              <Input
                type={showPin ? "text" : "password"}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                placeholder="Confirm 4-digit PIN"
                value={confirmPin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  setConfirmPin(val);
                  setPinError(null);
                }}
                className="bg-black/40 border-white/20 text-white"
              />
            </div>

            {pinError && (
              <p className="text-red-400 text-sm">{pinError}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="text-white/40 text-xs text-center">
        You can change or remove this later in Profile Settings.
      </p>

      <div className="pt-4 space-y-3">
        <Button
          onClick={handleSafetyPinContinue}
          disabled={saving || safetyPin.length < 4}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white"
        >
          {saving ? "Setting PIN..." : "Create Safety PIN"}
          {!saving && <ArrowRight className="w-4 h-4 ml-2" />}
        </Button>

        <Button
          variant="ghost"
          onClick={handleSkipSafetyPin}
          className="w-full text-white/60 hover:text-white"
        >
          Skip for now
        </Button>
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case "goals":
        return renderGoalsStep();
      case "builder":
        return renderBuilderStep();
      case "safety-pin":
        return renderSafetyPinStep();
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
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3">
          <h1 className="text-lg font-bold text-white text-center">
            Select Your Meal Builder
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
