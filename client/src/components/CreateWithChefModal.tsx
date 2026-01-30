import { useState, useEffect } from "react";
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
import { SafetyGuardBanner } from "@/components/SafetyGuardBanner";
import { useSafetyGuardPrecheck } from "@/hooks/useSafetyGuardPrecheck";
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
      executeGeneration();
    }
  }, [pendingGeneration, overrideToken, generating, safetyChecking]);

  useEffect(() => {
    if (!open) {
      setDescription("");
      setSafetyEnabled(true);
      clearSafetyAlert();
      cancel();
    }
  }, [open, cancel, clearSafetyAlert]);

  const executeGeneration = async () => {
    const meal = await generateMeal(
      description.trim(),
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

    if (hasActiveOverride || !safetyEnabled) {
      await executeGeneration();
      return;
    }

    const isSafe = await checkSafety(description.trim(), `create-with-chef-${mealType}`);
    
    if (isSafe) {
      await executeGeneration();
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

          {/* SafetyGuard Preflight Banner - Black/Yellow Alert */}
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

          {/* Safety Guard Toggle */}
          <div className="flex justify-end">
            <SafetyGuardToggle
              safetyEnabled={safetyEnabled}
              onSafetyChange={handleSafetyOverride}
              disabled={isProcessing}
            />
          </div>

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
        </div>
      </DialogContent>
    </Dialog>
  );
}
