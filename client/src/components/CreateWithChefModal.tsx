import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import {
  useCreateWithChefRequest,
  DietType,
  BeachBodyPhase,
  StarchContext,
} from "@/hooks/useCreateWithChefRequest";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isGuestMode, getGuestSession, canGuestGenerate, trackGuestGenerationUsage } from "@/lib/guestMode";
import { SafetyGuardToggle } from "@/components/SafetyGuardToggle";
import { GlucoseGuardToggle } from "@/components/GlucoseGuardToggle";
import { SafetyGuardBanner } from "@/components/SafetyGuardBanner";
import { useSafetyGuardPrecheck } from "@/hooks/useSafetyGuardPrecheck";
import { detectStarchyIngredients } from "@/utils/ingredientClassifier";
import { isAllergyRelatedError } from "@/utils/allergyAlert";

interface CreateWithChefModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealType: "breakfast" | "lunch" | "dinner";
  onMealGenerated: (
    meal: any,
    slot: "breakfast" | "lunch" | "dinner" | "snacks",
  ) => void;
  dietType?: DietType;
  dietPhase?: BeachBodyPhase;
  starchContext?: StarchContext;
}

export function CreateWithChefModal({
  open,
  onOpenChange,
  mealType,
  onMealGenerated,
  dietType,
  dietPhase,
  starchContext,
}: CreateWithChefModalProps) {
  const [description, setDescription] = useState("");
  const [safetyEnabled, setSafetyEnabled] = useState(true);
  const [pendingGeneration, setPendingGeneration] = useState(false);
  
  // Starch Guard state
  const [starchBlocked, setStarchBlocked] = useState(false);
  const [starchMatchedTerms, setStarchMatchedTerms] = useState<string[]>([]);
  const [alternativeInput, setAlternativeInput] = useState("");
  
  const { user } = useAuth();
  
  const isGuest = isGuestMode();
  const guestSession = isGuest ? getGuestSession() : null;
  const userId = user?.id?.toString() || guestSession?.sessionId || "";
  
  const { generating, progress, error, generateMeal, cancel } =
    useCreateWithChefRequest(userId);
  const { toast } = useToast();
  
  const {
    checking: safetyChecking,
    alert: safetyAlert,
    checkSafety,
    clearAlert: clearSafetyAlert,
    setOverrideToken,
    overrideToken,
    hasActiveOverride
  } = useSafetyGuardPrecheck();
  
  // Calculate starch slot availability from context
  const starchStatus = useMemo(() => {
    if (!starchContext || !starchContext.existingMeals) {
      return { slotsUsed: 0, maxSlots: 1, isExhausted: false };
    }
    
    const maxSlots = starchContext.strategy === 'flex' ? 2 : 1;
    const slotsUsed = starchContext.existingMeals.filter(m => m.hasStarch).length;
    const isExhausted = slotsUsed >= maxSlots;
    
    return { slotsUsed, maxSlots, isExhausted };
  }, [starchContext]);
  
  const handleSafetyOverride = (enabled: boolean, token?: string) => {
    setSafetyEnabled(enabled);
    if (token) {
      setOverrideToken(token);
      setPendingGeneration(true);
    }
  };
  
  useEffect(() => {
    if (pendingGeneration && overrideToken && !generating && !safetyChecking) {
      setPendingGeneration(false);
      executeGeneration(description.trim());
    }
  }, [pendingGeneration, overrideToken, generating, safetyChecking]);

  useEffect(() => {
    if (!open) {
      setDescription("");
      setSafetyEnabled(true);
      clearSafetyAlert();
      setStarchBlocked(false);
      setStarchMatchedTerms([]);
      setAlternativeInput("");
      cancel();
    }
  }, [open, cancel, clearSafetyAlert]);

  const executeGeneration = async (mealDescription: string) => {
    const meal = await generateMeal(
      mealDescription,
      mealType,
      dietType,
      dietPhase,
      starchContext,
      {
        safetyMode: !safetyEnabled && overrideToken ? "CUSTOM_AUTHENTICATED" : "STRICT",
        overrideToken: !safetyEnabled ? overrideToken || undefined : undefined,
      }
    );

    if (meal) {
      if (isGuest) {
        trackGuestGenerationUsage();
      }
      
      toast({
        title: "Meal Created!",
        description: `${meal.name} is ready for you`,
      });
      onMealGenerated(meal, mealType);
      onOpenChange(false);
    } else if (error) {
      if (isAllergyRelatedError(error)) {
        toast({
          title: "⚠️ Allergy Alert",
          description: error,
          variant: "warning",
        });
      } else {
        toast({
          title: "Generation Failed",
          description: error,
          variant: "destructive",
        });
      }
    }
  };

  const handleGenerate = async () => {
    if (!userId) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to create meals",
        variant: "destructive",
      });
      return;
    }
    
    if (isGuest && !canGuestGenerate()) {
      toast({
        title: "Guest limit reached",
        description: "Create a free account to continue generating meals",
        variant: "destructive",
      });
      return;
    }
    
    if (!description.trim()) {
      toast({
        title: "Please describe your meal",
        description: "Tell the Chef what you're in the mood for",
        variant: "destructive",
      });
      return;
    }

    // STARCH GUARD CHECK - if starch slots exhausted AND requesting starchy food
    if (starchStatus.isExhausted) {
      const detection = detectStarchyIngredients(description.trim());
      if (detection.hasStarchy) {
        console.log('🥔 [StarchGuard] BLOCKED - Starch slots exhausted, starchy request detected');
        setStarchBlocked(true);
        setStarchMatchedTerms(detection.matchedTerms);
        return;
      }
    }

    if (hasActiveOverride || !safetyEnabled) {
      await executeGeneration(description.trim());
      return;
    }

    const isSafe = await checkSafety(description.trim(), `create-with-chef-${mealType}`);
    
    if (isSafe) {
      await executeGeneration(description.trim());
    }
  };
  
  // Handle "Let Chef Pick" - proceed with original request, server will substitute
  const handleLetChefPick = async () => {
    setStarchBlocked(false);
    
    if (hasActiveOverride || !safetyEnabled) {
      await executeGeneration(description.trim());
      return;
    }

    const isSafe = await checkSafety(description.trim(), `create-with-chef-${mealType}`);
    if (isSafe) {
      await executeGeneration(description.trim());
    }
  };
  
  // Handle "Use My Alternative" - use user's fibrous carb choice
  const handleUseAlternative = async () => {
    if (!alternativeInput.trim()) {
      toast({
        title: "Please enter an alternative",
        description: "Tell us what you'd like instead",
        variant: "destructive",
      });
      return;
    }
    
    // Replace the starchy term with user's choice in the description
    let newDescription = description;
    for (const term of starchMatchedTerms) {
      const regex = new RegExp(term, 'gi');
      newDescription = newDescription.replace(regex, alternativeInput.trim());
    }
    
    setDescription(newDescription);
    setStarchBlocked(false);
    setStarchMatchedTerms([]);
    setAlternativeInput("");
    
    if (hasActiveOverride || !safetyEnabled) {
      await executeGeneration(newDescription);
      return;
    }

    const isSafe = await checkSafety(newDescription, `create-with-chef-${mealType}`);
    if (isSafe) {
      await executeGeneration(newDescription);
    }
  };

  const getPlaceholder = () => {
    switch (mealType) {
      case "breakfast":
        return "e.g., 'protein pancakes,' 'sweet eggs with fruit,' 'low-carb omelette'";
      case "lunch":
        return "e.g., 'grilled chicken salad,' 'high-protein wrap,' 'Mediterranean bowl'";
      case "dinner":
        return "e.g., 'low-carb tacos,' 'steak with vegetables,' 'salmon with rice'";
      default:
        return "e.g., 'something light and healthy,' 'high-protein meal'";
    }
  };

  const isProcessing = generating || safetyChecking;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-xl font-semibold">
            Create with AI Chef
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Tell the Chef what you want for {mealType}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* STARCH GUARD INTERCEPT */}
          {starchBlocked ? (
            <div className="rounded-lg border p-4 bg-orange-950/60 border-orange-500/50">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-orange-500/20 text-2xl">
                  🥔
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-orange-400 mb-2">
                    Starchy Carbs Limit Reached
                  </h4>
                  
                  <p className="text-orange-200/90 text-sm mb-3">
                    You've already used your starch meal{starchStatus.maxSlots > 1 ? 's' : ''} for today ({starchStatus.slotsUsed} of {starchStatus.maxSlots}).
                  </p>
                  
                  {starchMatchedTerms.length > 0 && (
                    <div className="mb-3">
                      <p className="text-white/60 text-xs mb-1.5">You requested:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {starchMatchedTerms.map((term, i) => (
                          <span 
                            key={i}
                            className="px-2 py-0.5 bg-orange-500/20 text-orange-300 text-xs rounded-full border border-orange-500/30"
                          >
                            {term}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <p className="text-white/80 text-sm mb-4">
                    Would you like to pick a <span className="text-green-400 font-medium">fibrous carb</span> instead, or let the Chef choose for you?
                  </p>
                  
                  {/* Option 1: User picks their own fibrous carb */}
                  <div className="mb-3">
                    <Input
                      placeholder="e.g., broccoli, asparagus, cauliflower..."
                      value={alternativeInput}
                      onChange={(e) => setAlternativeInput(e.target.value)}
                      disabled={isProcessing}
                      className="bg-black/40 border-white/20 text-white placeholder:text-white/40 focus:border-green-400/50 mb-2"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && alternativeInput.trim()) {
                          handleUseAlternative();
                        }
                      }}
                    />
                    <Button
                      onClick={handleUseAlternative}
                      disabled={isProcessing || !alternativeInput.trim()}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      {isProcessing ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                      ) : (
                        <>Use My Choice</>
                      )}
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2 my-3">
                    <div className="flex-1 h-px bg-white/20"></div>
                    <span className="text-white/40 text-xs">or</span>
                    <div className="flex-1 h-px bg-white/20"></div>
                  </div>
                  
                  {/* Option 2: Let Chef pick */}
                  <Button
                    onClick={handleLetChefPick}
                    disabled={isProcessing}
                    variant="outline"
                    className="w-full bg-black/40 border-orange-500/30 text-orange-200 hover:bg-orange-500/20"
                  >
                    {isProcessing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
                    ) : (
                      <>Chef's Choice - Pick For Me</>
                    )}
                  </Button>
                  
                  <p className="text-white/50 text-xs mt-2 text-center">
                    Chef will substitute with a delicious fibrous carb option
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Normal input mode */}
              <div>
                <Input
                  placeholder={getPlaceholder()}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isProcessing}
                  className="bg-black/40 border-white/20 text-white placeholder:text-white/40 focus:border-orange-400/50"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isProcessing) {
                      handleGenerate();
                    }
                  }}
                />
                <p className="text-xs text-white/40 mt-2">
                  Describe what you're craving and the Chef will create a
                  personalized meal for you
                </p>
              </div>

              {/* SafetyGuard Preflight Banner */}
              <SafetyGuardBanner
                alert={safetyAlert}
                mealRequest={description}
                onDismiss={clearSafetyAlert}
                onOverrideSuccess={(token) => handleSafetyOverride(false, token)}
              />

              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-white/70">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {safetyChecking ? "Checking safety profile..." : "Chef is preparing your meal..."}
                  </div>
                  <Progress value={safetyChecking ? 30 : progress} className="h-2" />
                </div>
              )}

              {error && !safetyAlert.show && <p className="text-sm text-amber-400">{error}</p>}

              {/* Meal Safety Section */}
              <div className="py-2 px-3 bg-black/30 rounded-lg border border-white/10 space-y-2">
                <span className="text-xs text-white/60 block mb-2">Meal Safety</span>
                <SafetyGuardToggle
                  safetyEnabled={safetyEnabled}
                  onSafetyChange={handleSafetyOverride}
                  disabled={isProcessing}
                />
                <GlucoseGuardToggle disabled={isProcessing} />
              </div>

              {/* Starch Budget Info - show when starch context available */}
              {starchContext && (
                <div className="py-2 px-3 bg-black/30 rounded-lg border border-white/10">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60">Today's Starch Meals:</span>
                    <span className={`font-medium ${starchStatus.isExhausted ? 'text-orange-400' : 'text-green-400'}`}>
                      {starchStatus.slotsUsed} / {starchStatus.maxSlots} used
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  className="flex-1 bg-lime-600 hover:bg-lime-600 text-white"
                  onClick={handleGenerate}
                  disabled={isProcessing || !description.trim()}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {safetyChecking ? "Checking..." : "Generating..."}
                    </>
                  ) : (
                    <>Generate AI Meal</>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="flex-3 bg-black/60 backdrop-blur border-white/30 text-white active:border-white active:bg-black/80"
                  onClick={() => onOpenChange(false)}
                  disabled={isProcessing}
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
