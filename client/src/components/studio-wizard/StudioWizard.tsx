import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Sparkles,
  ChefHat,
  Loader2,
  Users,
  Brain,
  LucideIcon,
} from "lucide-react";

import { KitchenStepCard } from "@/components/chefs-kitchen/KitchenStepCard";
import { useChefVoice } from "@/components/chefs-kitchen/useChefVoice";
import { apiUrl } from "@/lib/resolveApiBase";
import TalkToChefButton from "@/components/voice/TalkToChefButton";
import { useVoiceStudio } from "@/hooks/useVoiceStudio";

import GeneratedMealCard from "@/components/meal/GeneratedMealCard";

type StudioStep = 1 | 2 | 3 | 4 | 5;

export interface GeneratedMeal {
  id: string;
  name: string;
  description?: string;
  mealType?: string;
  ingredients: Array<{
    name: string;
    quantity?: string;
    amount?: number;
    unit?: string;
    notes?: string;
  }>;
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
  flags?: string[];
  servingSize?: string;
  servings?: number;
  reasoning?: string;
}

export interface StudioStepConfig {
  title: string;
  question: string;
  placeholder?: string;
  voiceScript: string;
  inputType: "textarea" | "buttons";
  buttonOptions?: string[];
  summaryPrefix: string;
  defaultValue?: string;
  required?: boolean;
}

export interface StudioScripts {
  ready: string;
  generatingStart: string;
  generatingProgress1: string;
  generatingProgress2: string;
  complete: string;
}

export interface StudioBranding {
  title: string;
  emoji: string;
  introTitle: string;
  introDescription: string;
  accentColor: string;
  gradientFrom: string;
  gradientVia: string;
  gradientTo: string;
  icon: LucideIcon;
}

export interface StudioConfig {
  branding: StudioBranding;
  steps: StudioStepConfig[];
  scripts: StudioScripts;
  apiEndpoint: string;
  backRoute: string;
  source: string;
  defaultMealType: string;
  servingsStepIndex: number;
  buildPrompt: (values: string[], servings: number) => Record<string, any>;
  afterStepScripts?: Record<number, string>;
  disableVoiceSteps?: number[];
}

function normalizeInstructions(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    const filtered = raw.filter(Boolean);
    if (filtered.length > 1) return filtered;
    if (filtered.length === 1) return normalizeInstructions(filtered[0]);
    return filtered;
  }

  const numberedInlinePattern = /\b(\d+[\.\):])\s+/g;
  const hasNumberedSteps = numberedInlinePattern.test(raw);

  if (hasNumberedSteps) {
    return raw
      .split(/\b\d+[\.\):]\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => (s.endsWith(".") ? s : s + "."));
  }

  const sentences = raw
    .split(/\.\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.endsWith(".") ? s : s + "."));

  return sentences.length ? sentences : [raw];
}

interface StudioWizardProps {
  config: StudioConfig;
}

export default function StudioWizard({ config }: StudioWizardProps) {
  const [, setLocation] = useLocation();
  const { branding, steps, scripts, apiEndpoint, backRoute, source, defaultMealType, buildPrompt } = config;

  const [studioStep, setStudioStep] = useState<StudioStep>(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const { speak, stop: stopChef } = useChefVoice(setIsPlaying);

  const [stepValues, setStepValues] = useState<string[]>(
    steps.map((s) => s.defaultValue || "")
  );
  const stepValuesRef = useRef<string[]>(steps.map((s) => s.defaultValue || ""));
  
  const [stepListened, setStepListened] = useState<boolean[]>(
    steps.map(() => false)
  );
  const [stepLocked, setStepLocked] = useState<boolean[]>(
    steps.map(() => false)
  );

  const servings = config.servingsStepIndex >= 0 ? Number(stepValues[config.servingsStepIndex]) || 2 : 2;

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [generatedMeal, setGeneratedMeal] = useState<GeneratedMeal | null>(null);
  const [displayMeal, setDisplayMeal] = useState<GeneratedMeal | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mealToShow = displayMeal || generatedMeal;

  const updateStepValue = (index: number, value: string) => {
    stepValuesRef.current[index] = value;
    setStepValues((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  const setListened = (index: number, value: boolean) => {
    setStepListened((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  const setLocked = (index: number, value: boolean) => {
    setStepLocked((prev) => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  // Voice studio ref for stopping voice when editing
  const voiceStopRef = useRef<(() => void) | null>(null);
  
  const stopVoiceIfActive = () => {
    voiceStopRef.current?.();
  };

  const editStep = (index: number) => {
    stopVoiceIfActive();
    stopChef();
    for (let i = index; i < steps.length; i++) {
      setLocked(i, false);
      if (i > index) setListened(i, false);
    }
    setStudioStep((index + 1) as StudioStep);
  };

  const restartStudio = () => {
    stopVoiceIfActive();
    setStudioStep(1);
    stepValuesRef.current = steps.map((s) => s.defaultValue || "");
    setStepValues(steps.map((s) => s.defaultValue || ""));
    setStepListened(steps.map(() => false));
    setStepLocked(steps.map(() => false));

    setIsGenerating(false);
    setProgress(0);
    setGeneratedMeal(null);
    setDisplayMeal(null);
    setError(null);

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = null;

    stopChef();
  };

  // Voice Studio configuration for hands-free mode
  const voiceStudio = useVoiceStudio({
    steps: steps.map((step, idx) => ({
      voiceScript: step.voiceScript,
      setValue: (val: string) => updateStepValue(idx, val),
      setLocked: (val: boolean) => setLocked(idx, val),
      setListened: (val: boolean) => setListened(idx, val),
      parseValue: step.inputType === "buttons" 
        ? (transcript: string) => {
            // For button steps (servings), extract numbers
            const words: Record<string, string> = {
              one: "1", two: "2", three: "3", four: "4", five: "5",
              six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
              eleven: "11", twelve: "12",
            };
            const lower = transcript.toLowerCase();
            for (const [word, num] of Object.entries(words)) {
              if (lower.includes(word)) return num;
            }
            const match = transcript.match(/\d+/);
            if (match && step.buttonOptions?.includes(match[0])) {
              return match[0];
            }
            return step.defaultValue || transcript;
          }
        : undefined,
    })),
    onAllStepsComplete: () => {
      // Move to generate step
      setStudioStep((steps.length + 1) as StudioStep);
      generateMeal();
    },
    setStudioStep: (step) => setStudioStep(step as StudioStep),
    disabledSteps: config.disableVoiceSteps,
  });

  // Current step index (0-based) for voice disable check
  const currentStepIndex = studioStep - 1;
  const isVoiceDisabledForCurrentStep = config.disableVoiceSteps?.includes(currentStepIndex) ?? false;

  // Wire voiceStopRef to the voice studio
  useEffect(() => {
    voiceStopRef.current = voiceStudio.stopVoiceMode;
  }, [voiceStudio.stopVoiceMode]);

  useEffect(() => {
    document.title = `${branding.title} ${branding.emoji} | My Perfect Meals`;
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [branding.title, branding.emoji]);

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  const generateMeal = async () => {
    setIsGenerating(true);
    setProgress(10);
    setError(null);

    stopChef();
    speak(scripts.generatingStart);

    progressIntervalRef.current = setInterval(() => {
      setProgress((p) => (p >= 90 ? p : p + Math.floor(Math.random() * 8) + 4));
    }, 700);

    setTimeout(() => speak(scripts.generatingProgress1), 1700);
    setTimeout(() => speak(scripts.generatingProgress2), 3400);

    try {
      const currentValues = stepValuesRef.current;
      const currentServings = config.servingsStepIndex >= 0 ? Number(currentValues[config.servingsStepIndex]) || 2 : 2;
      const payload = buildPrompt(currentValues, currentServings);
      const fullUrl = apiUrl(apiEndpoint);

      const response = await fetch(fullUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...payload,
          mealType: defaultMealType,
          source,
          servings: currentServings,
        }),
      });

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to generate meal: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const meal = data?.meal || data?.recipe || data;

      if (!meal) throw new Error("No meal data returned from API");

      const srcNutrition = meal.nutrition || {};
      const nutritionCalories = srcNutrition.calories ?? meal.calories ?? 0;
      const nutritionProtein = srcNutrition.protein ?? meal.protein ?? 0;
      const nutritionCarbs = srcNutrition.carbs ?? meal.carbs ?? 0;
      const nutritionFat = srcNutrition.fat ?? meal.fat ?? 0;

      const normalized: GeneratedMeal = {
        id: meal.id || crypto.randomUUID(),
        name: meal.name || meal.title || "Generated Meal",
        description: meal.description || meal.reasoning,
        mealType: meal.mealType || defaultMealType,
        ingredients: Array.isArray(meal.ingredients)
          ? meal.ingredients.map((ing: any) => {
              if (typeof ing === "string") return { name: ing };
              return {
                name: ing.name || "",
                quantity: ing.quantity,
                amount: ing.amount ?? ing.grams,
                unit: ing.unit ?? "g",
                notes: ing.notes ?? "",
              };
            })
          : [],
        instructions: normalizeInstructions(meal.cookingInstructions || meal.instructions),
        imageUrl: meal.imageUrl,
        calories: nutritionCalories,
        protein: nutritionProtein,
        carbs: nutritionCarbs,
        fat: nutritionFat,
        nutrition: {
          calories: nutritionCalories,
          protein: nutritionProtein,
          carbs: nutritionCarbs,
          fat: nutritionFat,
        },
        medicalBadges: Array.isArray(meal.medicalBadges) ? meal.medicalBadges : [],
        flags: Array.isArray(meal.flags) ? meal.flags : [],
        servingSize: meal.servingSize || `${currentServings} ${currentServings === 1 ? "serving" : "servings"}`,
        servings: meal.servings || currentServings,
        reasoning: meal.reasoning,
      };

      setProgress(100);
      setIsGenerating(false);
      setGeneratedMeal(normalized);

      setTimeout(() => speak(scripts.complete), 500);
    } catch (e) {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      setIsGenerating(false);
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(`${msg}. Please try again.`);
      console.error(`🚨 ${branding.title} error:`, e);
    }
  };

  const goToChefsKitchenPrepare = () => {
    if (!generatedMeal) return;
    try {
      localStorage.setItem("mpm_chefs_kitchen_external_prepare", "true");
      localStorage.setItem("mpm_chefs_kitchen_meal", JSON.stringify(generatedMeal));
      localStorage.removeItem("mpm_chefs_kitchen_prep");
    } catch {
      // ignore
    }
    setLocation("/lifestyle/chefs-kitchen");
  };

  const IconComponent = branding.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className={`min-h-screen bg-gradient-to-br ${branding.gradientFrom} ${branding.gradientVia} ${branding.gradientTo} pb-safe-nav`}
    >
      <div
        className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-2 flex-nowrap overflow-hidden">
          <button
            onClick={() => setLocation(backRoute)}
            className="flex items-center gap-2 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>

          <h1 className="text-lg font-bold text-white truncate min-w-0">
            {branding.title}{" "}
            <span className="text-xl leading-none">{branding.emoji}</span>
          </h1>

          <div className="flex-grow" />
        </div>
      </div>

      <div
        className="px-4 space-y-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 80px)" }}
      >
        <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <IconComponent className={`h-5 w-5 ${branding.accentColor}`} />
              <h2 className="text-lg font-bold text-white">{branding.introTitle}</h2>
            </div>
            <p className="text-sm text-white/80">{branding.introDescription}</p>
          </CardContent>
        </Card>

        {steps.map((step, index) => {
          const stepNum = (index + 1) as StudioStep;
          if (studioStep < stepNum) return null;

          const value = stepValues[index];
          const hasListened = stepListened[index];
          const isLocked = stepLocked[index];

          const getSummary = () => {
            if (!value) return step.summaryPrefix ? `No ${step.summaryPrefix.toLowerCase()}` : "Not set";
            if (step.inputType === "buttons") {
              return `${step.summaryPrefix}: ${value} ${Number(value) === 1 ? "person" : "people"}`;
            }
            return `${step.summaryPrefix}: ${value}`;
          };

          return (
            <KitchenStepCard
              key={index}
              stepTitle={`Step ${stepNum} · ${step.title}`}
              question={step.question}
              summaryText={getSummary()}
              value={value}
              setValue={(v) => updateStepValue(index, v)}
              hasListened={hasListened}
              isLocked={isLocked}
              isPlaying={isPlaying}
              placeholder={step.placeholder}
              inputType={step.inputType}
              buttonOptions={step.buttonOptions}
              onInputFocus={stopChef}
              onListen={() => {
                if (hasListened || isPlaying) return;
                speak(step.voiceScript, () => setListened(index, true));
              }}
              onSubmit={() => {
                stopChef();
                setLocked(index, true);
                
                const afterScript = config.afterStepScripts?.[index];
                if (afterScript) {
                  speak(afterScript, () => {
                    if (index < steps.length - 1) {
                      setStudioStep((stepNum + 1) as StudioStep);
                    } else {
                      setStudioStep(5);
                    }
                  });
                } else {
                  if (index < steps.length - 1) {
                    setStudioStep((stepNum + 1) as StudioStep);
                  } else {
                    setStudioStep(5);
                  }
                }
              }}
              onEdit={() => editStep(index)}
              canEdit={!generatedMeal && !isGenerating}
            />
          );
        })}

        {studioStep >= 5 && (
          <Card className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <ChefHat className={`h-4 w-4 ${branding.accentColor}`} />
                <h3 className="text-sm font-semibold text-white">Generate</h3>
              </div>

              {!isGenerating && !generatedMeal && !error && (
                <div className="text-center py-6">
                  <Sparkles className={`h-8 w-8 ${branding.accentColor} mx-auto mb-4`} />
                  <h3 className="text-lg font-bold text-white mb-2">
                    Ready to Create Your Meal
                  </h3>
                  <p className="text-sm text-white/70 mb-4">
                    We&apos;ll generate a full meal card with ingredients, macros, and cooking steps.
                  </p>

                  <div className="rounded-xl border border-white/20 bg-black/40 p-4 text-left space-y-2 mb-4">
                    <p className="text-xs text-white/60">Your session:</p>
                    {steps.map((step, index) => (
                      <p key={index} className="text-sm text-white/90">
                        <strong>{step.title}:</strong> {stepValues[index] || "None"}
                      </p>
                    ))}
                  </div>

                  <button
                    className={`w-full py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-black font-semibold text-sm transition`}
                    onClick={generateMeal}
                    data-testid="button-generate-meal"
                  >
                    Generate Meal
                  </button>
                </div>
              )}

              {isGenerating && (
                <div className="text-center py-6">
                  <Loader2 className={`h-8 w-8 ${branding.accentColor} animate-spin mx-auto mb-4`} />
                  <h3 className="text-lg font-bold text-white mb-2">Creating Your Meal...</h3>
                  <div className="w-full bg-black/40 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-lime-500 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="text-sm text-white/60 mt-2">{progress}%</p>
                </div>
              )}

              {error && (
                <div className="text-center py-6">
                  <p className="text-red-400 mb-4">{error}</p>
                  <button
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition"
                    onClick={restartStudio}
                  >
                    Try Again
                  </button>
                </div>
              )}

              {generatedMeal && mealToShow && (
                <div className="space-y-4">
                  <GeneratedMealCard
                    generatedMeal={generatedMeal}
                    mealToShow={mealToShow}
                    servings={servings}
                    onRestart={restartStudio}
                    onContentUpdate={(updated) => {
                      setDisplayMeal({
                        ...generatedMeal,
                        ...updated,
                      });
                    }}
                    source={source}
                  />

                  <button
                    className="w-full py-3 rounded-xl bg-lime-600 hover:bg-lime-500 text-white font-semibold text-sm transition flex items-center justify-center gap-2"
                    onClick={goToChefsKitchenPrepare}
                  >
                    <ChefHat className="h-4 w-4" />
                    Enter Chef&apos;s Kitchen
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>

      {/* Talk to Chef floating button - show during studio steps (before generate), hidden on disabled voice steps */}
      {studioStep <= steps.length && !isGenerating && !isVoiceDisabledForCurrentStep && (
        <TalkToChefButton
          voiceState={voiceStudio.voiceState}
          currentStep={voiceStudio.currentVoiceStep}
          totalSteps={steps.length}
          lastTranscript={voiceStudio.lastTranscript}
          isPlaying={voiceStudio.isPlaying}
          onStart={() => voiceStudio.startVoiceMode(currentStepIndex)}
          onStop={voiceStudio.stopVoiceMode}
        />
      )}
    </motion.div>
  );
}
