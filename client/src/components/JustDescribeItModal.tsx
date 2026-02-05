import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Minus, Plus } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { useToast } from "@/hooks/use-toast";

interface MacroEstimate {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
  starchyCarbs: number;
  fibrousCarbs: number;
  description: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (macros: MacroEstimate) => void;
}

type PortionSize = "smaller" | "typical" | "larger";

const PORTION_MULTIPLIERS: Record<PortionSize, number> = {
  smaller: 0.75,
  typical: 1.0,
  larger: 1.25,
};

export function JustDescribeItModal({ open, onClose, onAdd }: Props) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<MacroEstimate | null>(null);
  const [portion, setPortion] = useState<PortionSize>("typical");
  const { toast } = useToast();

  if (!open) return null;

  const handleEstimate = async () => {
    if (!description.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/biometrics/estimate-macros"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ description: description.trim() }),
      });

      if (!res.ok) {
        throw new Error("Failed to estimate macros");
      }

      const data = await res.json();
      setEstimate({
        protein: data.protein ?? 0,
        carbs: data.carbs ?? 0,
        fat: data.fat ?? 0,
        calories: data.calories ?? 0,
        starchyCarbs: data.starchyCarbs ?? 0,
        fibrousCarbs: data.fibrousCarbs ?? 0,
        description: description.trim(),
      });
      setPortion("typical");
    } catch (err) {
      toast({
        title: "Estimation failed",
        description: "Couldn't estimate macros. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getAdjustedMacros = () => {
    if (!estimate) return null;
    const mult = PORTION_MULTIPLIERS[portion];
    return {
      protein: Math.round(estimate.protein * mult),
      carbs: Math.round(estimate.carbs * mult),
      fat: Math.round(estimate.fat * mult),
      calories: Math.round(estimate.calories * mult),
      starchyCarbs: Math.round(estimate.starchyCarbs * mult),
      fibrousCarbs: Math.round(estimate.fibrousCarbs * mult),
      description: estimate.description,
    };
  };

  const handleAdd = () => {
    const adjusted = getAdjustedMacros();
    if (adjusted) {
      onAdd(adjusted);
      handleClose();
    }
  };

  const handleClose = () => {
    setDescription("");
    setEstimate(null);
    setPortion("typical");
    onClose();
  };

  const adjusted = getAdjustedMacros();

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-gray-900 to-black border border-white/20 rounded-2xl w-full max-w-md overflow-hidden">
        <div className="p-5">
          <h2 className="text-lg font-semibold text-white mb-1">
            Just Describe It
          </h2>
          <p className="text-sm text-white/60 mb-4">
            Tell us what you ate. We'll estimate the macros.
          </p>

          {!estimate ? (
            <>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Two scoops of vanilla ice cream, a large Cinnabon, grilled chicken sandwich..."
                className="w-full h-28 p-3 rounded-xl bg-black/40 border border-white/20 text-white placeholder:text-white/40 text-sm resize-none focus:outline-none focus:border-amber-500/50"
                autoFocus
              />
              <p className="text-xs text-white/50 mt-2 mb-4">
                Include portion size if you can — "large", "small", "half", etc.
              </p>

              <div className="flex gap-3">
                <Button
                  onClick={handleClose}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/20"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleEstimate}
                  disabled={!description.trim() || loading}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Estimate"
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-white/20 p-4 mb-4 bg-black/30">
                <div className="text-xs text-white/50 mb-2 truncate">
                  "{estimate.description}"
                </div>
                <div className="text-sm text-white/90 space-y-1">
                  <div className="flex justify-between">
                    <span>Protein</span>
                    <span className="font-semibold text-white">{adjusted?.protein}g</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Carbs</span>
                    <span className="font-semibold text-white">{adjusted?.carbs}g</span>
                  </div>
                  <div className="flex justify-between text-white/60 text-xs pl-3">
                    <span>Starchy</span>
                    <span>{adjusted?.starchyCarbs}g</span>
                  </div>
                  <div className="flex justify-between text-white/60 text-xs pl-3">
                    <span>Fibrous</span>
                    <span>{adjusted?.fibrousCarbs}g</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fat</span>
                    <span className="font-semibold text-white">{adjusted?.fat}g</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-white/10">
                    <span>Calories</span>
                    <span className="font-semibold text-white">{adjusted?.calories}</span>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <div className="text-xs text-white/60 mb-2 text-center">
                  Adjust portion
                </div>
                <div className="flex gap-2 justify-center">
                  {(["smaller", "typical", "larger"] as PortionSize[]).map((size) => (
                    <button
                      key={size}
                      onClick={() => setPortion(size)}
                      className={`px-4 py-2 rounded-lg text-sm capitalize transition-colors ${
                        portion === size
                          ? "bg-amber-600 text-white"
                          : "bg-white/10 text-white/70 hover:bg-white/20"
                      }`}
                    >
                      {size === "smaller" && <Minus className="h-3 w-3 inline mr-1" />}
                      {size}
                      {size === "larger" && <Plus className="h-3 w-3 inline ml-1" />}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-xs text-white/50 text-center mb-4">
                This is a best estimate. Good enough to stay on track.
              </p>

              <div className="flex gap-3">
                <Button
                  onClick={() => setEstimate(null)}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white border border-white/20"
                >
                  Try Again
                </Button>
                <Button
                  onClick={handleAdd}
                  className="flex-1 bg-lime-600 hover:bg-lime-700 text-white"
                >
                  Add to Today
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
