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
import { ChefHat, Loader2 } from "lucide-react";
import {
  useCreateWithChefRequest,
  DietType,
  BeachBodyPhase,
  StarchContext,
} from "@/hooks/useCreateWithChefRequest";
import { useToast } from "@/hooks/use-toast";
import { isAllergyRelatedError, formatAllergyAlertDescription } from "@/utils/allergyAlert";
import { useAuth } from "@/contexts/AuthContext";
import { isGuestMode, getGuestSession, canGuestGenerate, trackGuestGenerationUsage } from "@/lib/guestMode";
import { SafetyGuardToggle } from "@/components/SafetyGuardToggle";

interface CreateWithChefModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealType: "breakfast" | "lunch" | "dinner";
  onMealGenerated: (
    meal: any,
    slot: "breakfast" | "lunch" | "dinner" | "snacks",
  ) => void;
  dietType?: DietType; // Optional diet type for guardrails
  dietPhase?: BeachBodyPhase; // Optional phase for BeachBody
  starchContext?: StarchContext; // Optional starch context for intelligent carb distribution
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
  const [overrideToken, setOverrideToken] = useState<string | null>(null);
  
  // 🔐 Pending request for SafetyGuard continuation bridge
  const [pendingGeneration, setPendingGeneration] = useState(false);
  
  const { user } = useAuth();
  
  // Support both authenticated users and guests
  const isGuest = isGuestMode();
  const guestSession = isGuest ? getGuestSession() : null;
  const userId = user?.id?.toString() || guestSession?.sessionId || "";
  
  const { generating, progress, error, generateMeal, cancel } =
    useCreateWithChefRequest(userId);
  const { toast } = useToast();
  
  // Handle safety override continuation
  const handleSafetyChange = (enabled: boolean, token?: string) => {
    setSafetyEnabled(enabled);
    if (token) {
      setOverrideToken(token);
      setPendingGeneration(true);
    }
  };
  
  // Effect: Auto-generate when override token is set
  useEffect(() => {
    if (pendingGeneration && overrideToken && !generating) {
      setPendingGeneration(false);
      handleGenerate();
    }
  }, [pendingGeneration, overrideToken, generating]);

  useEffect(() => {
    if (!open) {
      setDescription("");
      setSafetyEnabled(true);
      setOverrideToken(null);
      cancel();
    }
  }, [open, cancel]);

  const handleGenerate = async () => {
    if (!userId) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to create meals",
        variant: "destructive",
      });
      return;
    }
    
    // Check guest generation limits
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
      // Record guest generation for limit tracking (does not affect unlock progression)
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
          title: "⚠️ ALLERGY ALERT",
          description: formatAllergyAlertDescription(error),
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
              disabled={generating}
              className="bg-black/40 border-white/20 text-white placeholder:text-white/40 focus:border-orange-400/50"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !generating) {
                  handleGenerate();
                }
              }}
            />
            <p className="text-xs text-white/40 mt-2">
              Describe what you're craving and the Chef will create a
              personalized meal for you
            </p>
          </div>

          {generating && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Loader2 className="h-4 w-4 animate-spin" />
                Chef is preparing your meal...
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          {/* Safety Guard Toggle - ONLY override location */}
          <div className="flex items-center justify-between py-2 px-3 bg-black/30 rounded-lg border border-white/10">
            <span className="text-xs text-white/60">Safety Profile for This Meal</span>
            <SafetyGuardToggle
              safetyEnabled={safetyEnabled}
              onSafetyChange={handleSafetyChange}
              disabled={generating}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1 bg-lime-600 hover:bg-lime-600 text-white"
              onClick={handleGenerate}
              disabled={generating || !description.trim()}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>Generate AI Meal</>
              )}
            </Button>
            <Button
              variant="outline"
              className="flex-3 bg-black/60 backdrop-blur border-white/30 text-white active:border-white active:bg-black/80"
              onClick={() => onOpenChange(false)}
              disabled={generating}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
