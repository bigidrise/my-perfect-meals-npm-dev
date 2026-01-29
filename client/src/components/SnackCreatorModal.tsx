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
import { Cookie, Loader2 } from "lucide-react";
import { useSnackCreatorRequest, DietType, BeachBodyPhase } from "@/hooks/useSnackCreatorRequest";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { isGuestMode, getGuestSession, canGuestGenerate, trackGuestGenerationUsage } from "@/lib/guestMode";
import { SafetyGuardBanner, EMPTY_SAFETY_ALERT } from "@/components/SafetyGuardBanner";
import { useSafetyGuardPrecheck } from "@/hooks/useSafetyGuardPrecheck";
import { SafetyGuardToggle } from "@/components/SafetyGuardToggle";
import { isAllergyRelatedError } from "@/utils/allergyAlert";

interface SnackCreatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSnackGenerated: (snack: any) => void;
  dietType?: DietType;
  dietPhase?: BeachBodyPhase;
}

export function SnackCreatorModal({
  open,
  onOpenChange,
  onSnackGenerated,
  dietType,
  dietPhase,
}: SnackCreatorModalProps) {
  const [description, setDescription] = useState("");
  const [safetyEnabled, setSafetyEnabled] = useState(true);
  const [pendingGeneration, setPendingGeneration] = useState(false);
  
  const { user } = useAuth();
  
  const isGuest = isGuestMode();
  const guestSession = isGuest ? getGuestSession() : null;
  const userId = user?.id?.toString() || guestSession?.sessionId || "";
  
  const { generating, progress, error, generateSnack, cancel } = useSnackCreatorRequest(userId);
  const { toast } = useToast();
  
  const {
    checking,
    alert,
    checkSafety,
    clearAlert,
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
  
  const handleOverrideSuccess = (token: string) => {
    setOverrideToken(token);
    setPendingGeneration(true);
  };
  
  useEffect(() => {
    if (pendingGeneration && overrideToken && !generating && !checking) {
      setPendingGeneration(false);
      executeGeneration();
    }
  }, [pendingGeneration, overrideToken, generating, checking]);

  useEffect(() => {
    if (!open) {
      setDescription("");
      setSafetyEnabled(true);
      clearAlert();
      cancel();
    }
  }, [open, cancel, clearAlert]);

  const executeGeneration = async () => {
    const snack = await generateSnack(description.trim(), dietType, dietPhase, overrideToken || undefined);

    if (snack) {
      if (isGuest) {
        trackGuestGenerationUsage();
      }
      
      toast({
        title: "Snack Created!",
        description: `${snack.name} is ready for you`,
      });
      onSnackGenerated(snack);
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
        description: "You need to be signed in to create snacks",
        variant: "destructive",
      });
      return;
    }
    
    if (isGuest && !canGuestGenerate()) {
      toast({
        title: "Guest limit reached",
        description: "Create a free account to continue generating snacks",
        variant: "destructive",
      });
      return;
    }
    
    if (!description.trim()) {
      toast({
        title: "Please describe your snack craving",
        description: "Tell us what you're craving: crunchy, sweet, salty...",
        variant: "destructive",
      });
      return;
    }

    if (hasActiveOverride || !safetyEnabled) {
      await executeGeneration();
      return;
    }

    const isSafe = await checkSafety(description.trim(), "snack-creator");
    
    if (isSafe) {
      await executeGeneration();
    }
  };

  const isProcessing = generating || checking;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-white">
            <Cookie className="h-6 w-6 text-lime-400" />
            Snack Creator
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Describe your craving and get a healthy snack
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <Input
              placeholder="e.g., 'something crunchy and salty,' 'sweet but healthy'"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isProcessing}
              className="bg-black/40 border-white/20 text-white placeholder:text-white/40 focus:border-lime-400/50"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isProcessing) {
                  handleGenerate();
                }
              }}
            />
            <p className="text-xs text-white/40 mt-2">
              Tell us what you're craving and we'll create a healthy snack for you
            </p>
          </div>

          {alert.show && (
            <SafetyGuardBanner
              alert={alert}
              mealRequest={description}
              onDismiss={clearAlert}
              onOverrideSuccess={handleOverrideSuccess}
            />
          )}

          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Loader2 className="h-4 w-4 animate-spin" />
                {checking ? "Checking safety profile..." : "Creating your snack..."}
              </div>
              <Progress value={checking ? 30 : progress} className="h-2" />
            </div>
          )}

          {error && !alert.show && <p className="text-sm text-amber-400">{error}</p>}

          {/* Safety Guard Toggle */}
          <div className="flex items-center justify-between py-2 px-3 bg-black/30 rounded-lg border border-white/10">
            <span className="text-xs text-white/60">Safety Profile for This Snack</span>
            <SafetyGuardToggle
              safetyEnabled={safetyEnabled}
              onSafetyChange={handleSafetyOverride}
              disabled={isProcessing}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1 bg-lime-600 hover:bg-lime-500 text-white"
              onClick={handleGenerate}
              disabled={isProcessing || !description.trim()}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {checking ? "Checking..." : "Creating..."}
                </>
              ) : (
                <>Create Healthy Snack</>
              )}
            </Button>
            <Button
              variant="outline"
              className="bg-black/60 backdrop-blur border-white/30 text-white"
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
