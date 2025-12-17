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
} from "@/hooks/useCreateWithChefRequest";
import { useToast } from "@/hooks/use-toast";

interface CreateWithChefModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealType: "breakfast" | "lunch" | "dinner";
  onMealGenerated: (meal: any) => void;
  dietType?: DietType; // Optional diet type for guardrails
  dietPhase?: BeachBodyPhase; // Optional phase for BeachBody
}

export function CreateWithChefModal({
  open,
  onOpenChange,
  mealType,
  onMealGenerated,
  dietType,
  dietPhase,
}: CreateWithChefModalProps) {
  const [description, setDescription] = useState("");
  const { generating, progress, error, generateMeal, cancel } =
    useCreateWithChefRequest();
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setDescription("");
      cancel();
    }
  }, [open, cancel]);

  const handleGenerate = async () => {
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
    );

    if (meal) {
      toast({
        title: "Meal Created!",
        description: `${meal.name} is ready for you`,
      });
      onMealGenerated(meal);
      onOpenChange(false);
    } else if (error) {
      toast({
        title: "Generation Failed",
        description: error,
        variant: "destructive",
      });
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
          <DialogTitle className="flex items-center gap-2 text-xl text-white">
            <ChefHat className="h-6 w-6 text-lime-400" />
            Create With Chef
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

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1 bg-black/60 backdrop-blur border-white/30 text-white active:border-white active:bg-black/80"
              onClick={() => onOpenChange(false)}
              disabled={generating}
            >
              Cancel
            </Button>
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
                  <ChefHat className="h-4 w-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
