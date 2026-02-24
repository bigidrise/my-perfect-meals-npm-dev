import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PillButton } from "@/components/ui/pill-button";
import { useGlycemicSettings } from "@/hooks/useGlycemicSettings";
import { LOW_GI, MID_GI, HIGH_GI } from "@/types/glycemic";
import { useToast } from "@/hooks/use-toast";

interface GlycemicSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function GlycemicSettingsModal({ open, onClose }: GlycemicSettingsModalProps) {
  const { data: glycemicData, save, isSaving } = useGlycemicSettings();
  const { toast } = useToast();
  const [preferredCarbs, setPreferredCarbs] = useState<string[]>([]);

  useEffect(() => {
    if (open && glycemicData?.preferredCarbs) {
      setPreferredCarbs(glycemicData.preferredCarbs);
    }
  }, [open, glycemicData?.preferredCarbs]);

  if (!open) return null;

  const handleSave = async () => {
    try {
      await save({
        bloodGlucose: glycemicData?.bloodGlucose ?? null,
        preferredCarbs,
      });
      toast({ title: "Glycemic preferences saved" });
      onClose();
    } catch {
      toast({ title: "Failed to save preferences", variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto rounded-2xl bg-zinc-900 border border-white/20 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-zinc-900/95 backdrop-blur-sm border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Glycemic Preferences</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-white/70 text-sm">
            Select which carbs you prefer — this personalizes your meal recommendations.
          </p>

          <div className="rounded-xl border border-green-500/30 bg-green-950/20 p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-green-300 text-sm font-semibold flex items-center gap-2">
                <span className="text-lg">🟢</span> Low Glycemic (Best for stable blood sugar)
              </p>
              <PillButton
                active={LOW_GI.every((f) => preferredCarbs.includes(f))}
                onClick={() => {
                  const allSelected = LOW_GI.every((f) => preferredCarbs.includes(f));
                  setPreferredCarbs((prev) =>
                    allSelected
                      ? prev.filter((f) => !LOW_GI.includes(f))
                      : [...new Set([...prev, ...LOW_GI])]
                  );
                }}
              >
                {LOW_GI.every((f) => preferredCarbs.includes(f)) ? "Clear All" : "Select All"}
              </PillButton>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {LOW_GI.map((food) => (
                <PillButton
                  key={food}
                  active={preferredCarbs.includes(food)}
                  onClick={() =>
                    setPreferredCarbs((prev) =>
                      prev.includes(food) ? prev.filter((f) => f !== food) : [...prev, food]
                    )
                  }
                >
                  {food}
                </PillButton>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-yellow-500/30 bg-yellow-950/20 p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-yellow-300 text-sm font-semibold flex items-center gap-2">
                <span className="text-lg">🟡</span> Mid Glycemic (Moderate energy release)
              </p>
              <PillButton
                active={MID_GI.every((f) => preferredCarbs.includes(f))}
                onClick={() => {
                  const allSelected = MID_GI.every((f) => preferredCarbs.includes(f));
                  setPreferredCarbs((prev) =>
                    allSelected
                      ? prev.filter((f) => !MID_GI.includes(f))
                      : [...new Set([...prev, ...MID_GI])]
                  );
                }}
              >
                {MID_GI.every((f) => preferredCarbs.includes(f)) ? "Clear All" : "Select All"}
              </PillButton>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {MID_GI.map((food) => (
                <PillButton
                  key={food}
                  active={preferredCarbs.includes(food)}
                  onClick={() =>
                    setPreferredCarbs((prev) =>
                      prev.includes(food) ? prev.filter((f) => f !== food) : [...prev, food]
                    )
                  }
                >
                  {food}
                </PillButton>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-red-300 text-sm font-semibold flex items-center gap-2">
                <span className="text-lg">🔴</span> High Glycemic (Quick energy, use sparingly)
              </p>
              <PillButton
                active={HIGH_GI.every((f) => preferredCarbs.includes(f))}
                onClick={() => {
                  const allSelected = HIGH_GI.every((f) => preferredCarbs.includes(f));
                  setPreferredCarbs((prev) =>
                    allSelected
                      ? prev.filter((f) => !HIGH_GI.includes(f))
                      : [...new Set([...prev, ...HIGH_GI])]
                  );
                }}
              >
                {HIGH_GI.every((f) => preferredCarbs.includes(f)) ? "Clear All" : "Select All"}
              </PillButton>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {HIGH_GI.map((food) => (
                <PillButton
                  key={food}
                  active={preferredCarbs.includes(food)}
                  onClick={() =>
                    setPreferredCarbs((prev) =>
                      prev.includes(food) ? prev.filter((f) => f !== food) : [...prev, food]
                    )
                  }
                >
                  {food}
                </PillButton>
              ))}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 p-4 bg-zinc-900/95 backdrop-blur-sm border-t border-white/10">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-semibold py-3 rounded-xl"
          >
            {isSaving ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </div>
    </div>
  );
}
