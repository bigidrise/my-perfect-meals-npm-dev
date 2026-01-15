import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowLeft, 
  ChefHat, 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  Check, 
  Clock,
  ChevronLeft,
  ChevronRight,
  Timer,
  X
} from "lucide-react";
import { useChefVoice } from "@/components/chefs-kitchen/useChefVoice";
import { extractTimerSeconds, formatTimeRemaining } from "@/components/chefs-kitchen/timerUtils";
import HealthBadgesPopover from "@/components/badges/HealthBadgesPopover";

interface PrepareIngredient {
  name: string;
  amount?: number;
  quantity?: string;
  unit?: string;
  notes?: string;
}

interface PrepareMeal {
  id?: string;
  name: string;
  description?: string;
  mealType?: string;
  ingredients: PrepareIngredient[];
  instructions: string[] | string;
  imageUrl?: string | null;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  nutrition?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  medicalBadges?: string[];
  servingSize?: string;
  servings?: number;
}

interface PrepareLocationState {
  meal: PrepareMeal;
  source?: string;
}

const CHEF_INTRO = "Alright, let's cook. I'll walk you through this step by step. Take your time — I've got you.";
const CHEF_STEP_COMPLETE = "Nice work. Ready for the next step?";
const CHEF_FINAL = "And that's it! Your meal is ready. Great job — you cooked something amazing today.";

export default function PrepareMealPage() {
  const [location, setLocation] = useLocation();
  const [meal, setMeal] = useState<PrepareMeal | null>(null);
  const [source, setSource] = useState<string>("unknown");
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [isPlaying, setIsPlaying] = useState(false);
  const { speak, stop: stopChef } = useChefVoice(setIsPlaying);
  
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [activeTimerStep, setActiveTimerStep] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const instructions = meal?.instructions 
    ? (Array.isArray(meal.instructions) ? meal.instructions : [meal.instructions])
    : [];
  
  const totalSteps = instructions.length;

  useEffect(() => {
    document.title = "Prepare with Chef | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    // Primary data source: localStorage (set before navigation)
    const saved = localStorage.getItem("mpm_prepare_meal");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const isNewSession = parsed.timestamp && (Date.now() - parsed.timestamp < 5000);
        
        setMeal(parsed.meal);
        setSource(parsed.source || "unknown");
        
        // If this is a new session (fresh navigation), start from step 0
        if (isNewSession) {
          setCurrentStep(0);
          setCompletedSteps(new Set());
          setTimeout(() => {
            speak(CHEF_INTRO);
          }, 500);
        } else {
          // Resume existing session
          setCurrentStep(parsed.currentStep || 0);
          setCompletedSteps(new Set(parsed.completedSteps || []));
        }
      } catch {
        setLocation("/dashboard");
      }
    } else {
      // No meal data available - redirect
      setLocation("/dashboard");
    }
  }, []);

  useEffect(() => {
    if (meal) {
      try {
        localStorage.setItem("mpm_prepare_meal", JSON.stringify({
          meal,
          source,
          currentStep,
          completedSteps: Array.from(completedSteps),
        }));
      } catch {
      }
    }
  }, [meal, source, currentStep, completedSteps]);

  useEffect(() => {
    if (isTimerRunning && timerSeconds > 0) {
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            setActiveTimerStep(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isTimerRunning, timerSeconds > 0]);

  const handleNextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCompletedSteps(prev => new Set([...prev, currentStep]));
      setCurrentStep(prev => prev + 1);
      speak(CHEF_STEP_COMPLETE);
    } else {
      setCompletedSteps(prev => new Set([...prev, currentStep]));
      speak(CHEF_FINAL);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleStartTimer = (stepIndex: number) => {
    const instruction = instructions[stepIndex];
    const seconds = extractTimerSeconds(instruction);
    if (seconds) {
      setTimerSeconds(seconds);
      setIsTimerRunning(true);
      setActiveTimerStep(stepIndex);
    }
  };

  const handleStopTimer = () => {
    setIsTimerRunning(false);
    setTimerSeconds(0);
    setActiveTimerStep(null);
  };

  const handleReadStep = (stepIndex: number) => {
    stopChef();
    speak(instructions[stepIndex]);
  };

  const handleFinish = () => {
    try {
      localStorage.removeItem("mpm_prepare_meal");
    } catch {
    }
    setLocation("/dashboard");
  };

  const handleExit = () => {
    stopChef();
    setLocation("/dashboard");
  };

  if (!meal) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-lime-500" />
      </div>
    );
  }

  const currentInstruction = instructions[currentStep] || "";
  const currentTimerSeconds = extractTimerSeconds(currentInstruction);
  const allCompleted = completedSteps.size === totalSteps;

  const nutrition = meal.nutrition || {
    calories: meal.calories,
    protein: meal.protein,
    carbs: meal.carbs,
    fat: meal.fat,
  };

  const medicalBadges = meal.medicalBadges || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-black pb-safe-nav"
    >
      <div
        className="fixed left-0 right-0 z-50 bg-black/80 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-2">
          <button
            onClick={handleExit}
            className="flex items-center gap-2 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Exit</span>
          </button>

          <h1 className="text-lg font-bold text-white truncate flex-1">
            Prepare with Chef
          </h1>

          <div className="flex items-center gap-1 text-lime-500">
            <ChefHat className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div
        className="px-4 space-y-4"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 80px)",
        }}
      >
        <Card className="bg-black/40 backdrop-blur-lg border border-white/20 shadow-lg">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              {meal.imageUrl && (
                <img 
                  src={meal.imageUrl} 
                  alt={meal.name}
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white truncate">{meal.name}</h2>
                  {medicalBadges.length > 0 && (
                    <HealthBadgesPopover badges={medicalBadges} />
                  )}
                </div>
                {meal.servings && (
                  <p className="text-sm text-white/60">{meal.servings} servings</p>
                )}
                <div className="flex gap-3 mt-1 text-xs text-white/70">
                  {nutrition.calories && <span>{nutrition.calories} cal</span>}
                  {nutrition.protein && <span>{nutrition.protein}g P</span>}
                  {nutrition.carbs && <span>{nutrition.carbs}g C</span>}
                  {nutrition.fat && <span>{nutrition.fat}g F</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white/10 rounded-full h-2">
                <div 
                  className="bg-lime-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${totalSteps > 0 ? ((completedSteps.size) / totalSteps) * 100 : 0}%` }}
                />
              </div>
              <span className="text-xs text-white/60">
                {completedSteps.size}/{totalSteps}
              </span>
            </div>
          </CardContent>
        </Card>

        {isTimerRunning && activeTimerStep !== null && (
          <Card className="bg-lime-600/20 border border-lime-500/40 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Timer className="h-6 w-6 text-lime-500 animate-pulse" />
                  <div>
                    <p className="text-sm text-white/70">Step {activeTimerStep + 1} Timer</p>
                    <p className="text-2xl font-bold text-lime-500 font-mono">
                      {formatTimeRemaining(timerSeconds)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleStopTimer}
                  className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
                >
                  <X className="h-5 w-5 text-white" />
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-black/40 backdrop-blur-lg border border-lime-500/30 shadow-lg">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-lime-600 flex items-center justify-center text-black font-bold text-sm">
                  {currentStep + 1}
                </div>
                <span className="text-sm text-white/60">of {totalSteps}</span>
              </div>
              
              {currentTimerSeconds && activeTimerStep !== currentStep && (
                <button
                  onClick={() => handleStartTimer(currentStep)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-lime-600/20 border border-lime-500/40 text-lime-500 text-sm hover:bg-lime-600/30 transition"
                >
                  <Clock className="h-4 w-4" />
                  Start Timer
                </button>
              )}
            </div>

            <p className="text-white text-base leading-relaxed">
              {currentInstruction}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => handleReadStep(currentStep)}
                disabled={isPlaying}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition ${
                  isPlaying
                    ? "bg-lime-600/20 border-lime-500/40 text-lime-500"
                    : "bg-black/40 border-white/20 text-white hover:bg-black/50"
                }`}
              >
                <Volume2 className="h-4 w-4" />
                {isPlaying ? "Speaking..." : "Read Aloud"}
              </button>
              
              {completedSteps.has(currentStep) && (
                <div className="flex items-center gap-1 px-3 py-2 rounded-lg bg-lime-600/20 border border-lime-500/40 text-lime-500 text-sm">
                  <Check className="h-4 w-4" />
                  Done
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <button
            onClick={handlePrevStep}
            disabled={currentStep === 0}
            className="flex-1 py-3 rounded-xl bg-black/40 border border-white/20 text-white font-medium disabled:opacity-30 flex items-center justify-center gap-2 transition hover:bg-black/50"
          >
            <ChevronLeft className="h-5 w-5" />
            Previous
          </button>
          
          {currentStep < totalSteps - 1 ? (
            <button
              onClick={handleNextStep}
              className="flex-1 py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-black font-semibold flex items-center justify-center gap-2 transition"
            >
              Next Step
              <ChevronRight className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={allCompleted ? handleFinish : handleNextStep}
              className="flex-1 py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-black font-semibold flex items-center justify-center gap-2 transition"
            >
              {allCompleted ? "Finish Cooking" : "Complete"}
              <Check className="h-5 w-5" />
            </button>
          )}
        </div>

        <Card className="bg-black/30 border border-white/10">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-white mb-3">All Steps</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {instructions.map((instruction, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={`w-full text-left p-2 rounded-lg transition flex items-start gap-2 ${
                    currentStep === index
                      ? "bg-lime-600/20 border border-lime-500/40"
                      : completedSteps.has(index)
                      ? "bg-white/5 border border-white/10"
                      : "bg-black/20 border border-transparent hover:border-white/10"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs ${
                    completedSteps.has(index)
                      ? "bg-lime-600 text-black"
                      : currentStep === index
                      ? "bg-lime-600/50 text-white"
                      : "bg-white/10 text-white/60"
                  }`}>
                    {completedSteps.has(index) ? <Check className="h-3 w-3" /> : index + 1}
                  </div>
                  <span className={`text-xs line-clamp-2 ${
                    currentStep === index ? "text-white" : "text-white/70"
                  }`}>
                    {instruction}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/30 border border-white/10">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Ingredients</h3>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {meal.ingredients.map((ing, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-white/80">{ing.name}</span>
                  <span className="text-white/60">
                    {ing.quantity || (ing.amount ? `${ing.amount} ${ing.unit || ''}` : '')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
