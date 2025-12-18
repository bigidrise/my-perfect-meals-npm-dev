
import { useMemo } from "react";
import { Button } from "@/components/ui/button";

export type MacroKind = "protein" | "fibrous" | "starchy";

export default function MacroFixCoach({
  totals,
  targets,
  onFix,
  onHelp,
}: {
  totals: { protein:number; carbs:number; fat:number; calories:number; fibrous?:number; starchy?:number };
  targets: { protein:number; fibrous:number; starchy:number };
  onFix: (kind: MacroKind) => void;
  onHelp: () => void;
}) {
  const deficit = useMemo(() => ({
    protein: Math.max((targets?.protein ?? 0) - (totals?.protein ?? 0), 0),
    starchy: Math.max((targets?.starchy ?? 0) - (totals?.starchy ?? 0), 0),
    fibrous: Math.max((targets?.fibrous ?? 0) - (totals?.fibrous ?? 0), 0),
  }), [totals, targets]);

  const show = deficit.protein > 0 || deficit.starchy > 0 || deficit.fibrous > 0;
  if (!show) return null;

  return (
    <div className="border border-lime-500/30 bg-black/40 backdrop-blur p-5 rounded-2xl">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-white text-lg font-semibold">Macro Fix Coach</h3>
        <button
          aria-label="Help"
          className="w-7 h-7 rounded-lg border border-white/20 text-white/90 hover:bg-white/10"
          onClick={onHelp}
        >?</button>
      </div>

      {deficit.protein > 0 && (
        <p className="text-lime-300 text-sm mb-1">You're short <b>{deficit.protein} g</b> of protein.</p>
      )}
      {deficit.starchy > 0 && (
        <p className="text-lime-300 text-sm mb-1">You're short <b>{deficit.starchy} g</b> of starchy carbs.</p>
      )}
      {deficit.fibrous > 0 && (
        <p className="text-lime-300 text-sm mb-1">You're short <b>{deficit.fibrous} g</b> of fibrous carbs.</p>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        {deficit.protein > 0 && (
          <Button 
            variant="ghost" 
            onClick={() => onFix("protein")} 
            className="bg-black/40 backdrop-blur border border-white/20 text-white hover:bg-black/60"
          >
            Add Protein
          </Button>
        )}
        {deficit.fibrous > 0 && (
          <Button 
            variant="ghost" 
            onClick={() => onFix("fibrous")} 
            className="bg-black/40 backdrop-blur border border-white/20 text-white hover:bg-black/60"
          >
            Add Fibrous Carb
          </Button>
        )}
        {deficit.starchy > 0 && (
          <Button 
            variant="ghost" 
            onClick={() => onFix("starchy")} 
            className="bg-black/40 backdrop-blur border border-white/20 text-white hover:bg-black/60"
          >
            Add Starchy Carb
          </Button>
        )}
      </div>
    </div>
  );
}
