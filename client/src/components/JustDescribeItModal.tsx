import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Minus, Plus, CheckCircle2 } from "lucide-react";
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

const LS_KEY = "mpm.justDescribeIt.v1";

type PersistedResult = {
  description: string;
  estimate: MacroEstimate;
  portion: PortionSize;
  logged: boolean;
  generatedAt: string;
};

function saveResult(data: PersistedResult) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {}
}

function loadResult(): PersistedResult | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedResult;
    if (!parsed?.estimate || typeof parsed.estimate.protein !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearResult() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {}
}

export function JustDescribeItModal({ open, onClose, onAdd }: Props) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<MacroEstimate | null>(null);
  const [portion, setPortion] = useState<PortionSize>("typical");
  const [logged, setLogged] = useState(false);
  const { toast } = useToast();

  // Restore last result on mount
  useEffect(() => {
    const saved = loadResult();
    if (saved) {
      setDescription(saved.description);
      setEstimate(saved.estimate);
      setPortion(saved.portion);
      setLogged(saved.logged ?? false);
    }
  }, []);

  // Persist whenever estimate or logged status changes
  useEffect(() => {
    if (estimate) {
      saveResult({
        description,
        estimate,
        portion,
        logged,
        generatedAt: new Date().toISOString(),
      });
    }
  }, [estimate, portion, logged, description]);

  if (!open) return null;

  const handleEstimate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    try {
      const { getAuthHeaders } = await import("@/lib/auth");
      const res = await fetch(apiUrl("/api/biometrics/estimate-macros"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ description: description.trim() }),
      });
      if (!res.ok) throw new Error("Failed to estimate macros");
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
      setLogged(false);
    } catch {
      toast({
        title: "Estimation failed",
        description: "Couldn't estimate macros. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getAdjustedMacros = (): MacroEstimate | null => {
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
    if (!adjusted) return;
    onAdd(adjusted);
    setLogged(true);
    onClose();
  };

  const handleDescribeAnother = () => {
    clearResult();
    setDescription("");
    setEstimate(null);
    setPortion("typical");
    setLogged(false);
  };

  const adjusted = getAdjustedMacros();

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-gray-900 to-black border border-white/20 rounded-2xl w-full max-w-md overflow-hidden">
        <div className="p-5">

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Just Describe It</h2>
              {!estimate && (
                <p className="text-sm text-white/60">Tell us what you ate. We'll estimate the macros.</p>
              )}
            </div>
            {logged && estimate && (
              <div className="flex items-center gap-1.5 bg-lime-600/20 border border-lime-500/30 rounded-full px-3 py-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-lime-400" />
                <span className="text-xs text-lime-300 font-medium">Logged</span>
              </div>
            )}
          </div>

          {/* Input screen */}
          {!estimate && (
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
                  onClick={onClose}
                  className="flex-1 bg-white/10 text-white border border-white/20 hover:bg-white/15"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleEstimate}
                  disabled={!description.trim() || loading}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Estimate"}
                </Button>
              </div>
            </>
          )}

          {/* Result screen */}
          {estimate && (
            <>
              <div className="rounded-xl border border-white/20 p-4 mb-4 bg-black/30">
                <div className="text-xs text-white/50 mb-2 truncate">"{estimate.description}"</div>
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

              {/* Portion selector — hidden when logged */}
              {!logged && (
                <div className="mb-4">
                  <div className="text-xs text-white/60 mb-2 text-center">Adjust portion</div>
                  <div className="flex gap-2 justify-center">
                    {(["smaller", "typical", "larger"] as PortionSize[]).map((size) => (
                      <button
                        key={size}
                        onClick={() => setPortion(size)}
                        className={`px-4 py-2 rounded-lg text-sm capitalize transition-colors ${
                          portion === size
                            ? "bg-amber-600 text-white"
                            : "bg-white/10 text-white/70"
                        }`}
                      >
                        {size === "smaller" && <Minus className="h-3 w-3 inline mr-1" />}
                        {size}
                        {size === "larger" && <Plus className="h-3 w-3 inline ml-1" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {!logged && (
                <p className="text-xs text-white/50 text-center mb-4">
                  This is a best estimate. Good enough to stay on track.
                </p>
              )}

              {/* Logged state */}
              {logged ? (
                <div className="flex gap-3">
                  <Button
                    onClick={onClose}
                    className="flex-1 bg-white/10 text-white border border-white/20 hover:bg-white/15"
                  >
                    Done
                  </Button>
                  <Button
                    onClick={handleDescribeAnother}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    Describe Another
                  </Button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button
                    onClick={handleDescribeAnother}
                    className="flex-1 bg-white/10 text-white border border-white/20 hover:bg-white/15"
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
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
