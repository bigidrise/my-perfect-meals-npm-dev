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
import { isAllergyRelatedError, formatAllergyAlertDescription } from "@/utils/allergyAlert";
import { useAuth } from "@/contexts/AuthContext";
import { isGuestMode, getGuestSession, canGuestGenerate, trackGuestGenerationUsage } from "@/lib/guestMode";
import { SafetyGuardToggle } from "@/components/SafetyGuardToggle";

interface SnackCreatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSnackGenerated: (snack: any) => void;
  dietType?: DietType; // Optional diet type for guardrails
  dietPhase?: BeachBodyPhase; // Optional phase for BeachBody
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
  const [overrideToken, setOverrideToken] = useState<string | undefined>();
  const { user } = useAuth();
  
  // Support both authenticated users and guests
  const isGuest = isGuestMode();
  const guestSession = isGuest ? getGuestSession() : null;
  const userId = user?.id?.toString() || guestSession?.sessionId || "";
  
  const { generating, progress, error, generateSnack, cancel } = useSnackCreatorRequest(userId);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setDescription("");
      cancel();
    }
  }, [open, cancel]);

  const handleGenerate = async () => {
    if (!userId) {
      toast({
        title: "Please sign in",
        description: "You need to be signed in to create snacks",
        variant: "destructive",
      });
      return;
    }
    
    // Check guest generation limits
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

    try {
      const snack = await generateSnack(description.trim(), dietType, dietPhase, overrideToken);

      if (snack) {
        // Record guest generation for limit tracking (does not affect unlock progression)
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
    } finally {
      // Auto-reset SafetyGuard after every generation (success or fail)
      setSafetyEnabled(true);
      setOverrideToken(undefined);
    }
  };

  const handleSafetyChange = (enabled: boolean, token?: string) => {
    setSafetyEnabled(enabled);
    setOverrideToken(token);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-white">
            <Cookie className="h-6 w-6 text-lime-400" />
            Snack Creator
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Tell us what you're craving and we'll create a healthy version
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <Input
              placeholder="e.g., 'something crunchy and salty,' 'chocolatey treat,' 'fruity and refreshing'"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={generating}
              className="bg-black/40 border-white/20 text-white placeholder:text-white/40 focus:border-amber-400/50"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !generating) {
                  handleGenerate();
                }
              }}
            />
            <p className="text-xs text-white/40 mt-2">
              Describe your craving and we'll transform it into a healthy snack option
            </p>
          </div>

          {generating && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating your healthy snack...
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {/* SafetyGuard Toggle */}
          <div className="flex justify-end">
            <SafetyGuardToggle
              safetyEnabled={safetyEnabled}
              onSafetyChange={handleSafetyChange}
              disabled={generating}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              className="flex-1 bg-lime-500 hover:bg-lime-700 text-white"
              onClick={handleGenerate}
              disabled={generating || !description.trim()}
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>

                  Generate AI Meal
                </>
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
