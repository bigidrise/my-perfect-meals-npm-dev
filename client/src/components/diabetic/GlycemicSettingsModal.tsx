import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PillButton } from "@/components/ui/pill-button";
import { useGlycemicSettings } from "@/hooks/useGlycemicSettings";
import { LOW_RANGE_OPTIONS, MID_RANGE_OPTIONS, HIGH_RANGE_OPTIONS } from "@/types/glycemic";
import { useToast } from "@/hooks/use-toast";

interface GlycemicSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function GlycemicSettingsModal({ open, onClose }: GlycemicSettingsModalProps) {
  const { data: glycemicData, save, isSaving } = useGlycemicSettings();
  const { toast } = useToast();

  const [lowRangeCarbs, setLowRangeCarbs] = useState<string[]>([]);
  const [midRangeCarbs, setMidRangeCarbs] = useState<string[]>([]);
  const [highRangeCarbs, setHighRangeCarbs] = useState<string[]>([]);

  useEffect(() => {
    if (open && glycemicData) {
      setLowRangeCarbs(glycemicData.lowRangeCarbs ?? []);
      setMidRangeCarbs(glycemicData.midRangeCarbs ?? []);
      setHighRangeCarbs(glycemicData.highRangeCarbs ?? []);
    }
  }, [open, glycemicData]);

  if (!open) return null;

  const handleSave = async () => {
    try {
      // Build the legacy preferredCarbs from all three (union for backward compat)
      const combined = [...new Set([...lowRangeCarbs, ...midRangeCarbs, ...highRangeCarbs])];
      await save({
        bloodGlucose: glycemicData?.bloodGlucose ?? null,
        preferredCarbs: combined,
        lowRangeCarbs,
        midRangeCarbs,
        highRangeCarbs,
      });
      toast({ title: "Glucose carb preferences saved" });
      onClose();
    } catch {
      toast({ title: "Failed to save preferences", variant: "destructive" });
    }
  };

  const toggle = (
    item: string,
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setList(prev => prev.includes(item) ? prev.filter(f => f !== item) : [...prev, item]);
  };

  const selectAll = (
    options: string[],
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    const allSelected = options.every(f => list.includes(f));
    setList(prev =>
      allSelected ? prev.filter(f => !options.includes(f)) : [...new Set([...prev, ...options])]
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto rounded-2xl bg-zinc-900 border border-white/20 shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 bg-zinc-900/95 backdrop-blur-sm border-b border-white/10">
          <h2 className="text-lg font-bold text-white">Glucose-Based Carb Choices</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-5">

          {/* Explainer */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-white text-sm font-semibold mb-1">Choose the carbs or fruits you prefer for different glucose ranges.</p>
            <p className="text-white/60 text-sm">
              MPM uses these choices to coach meal generation based on your current blood sugar state, so your meals respond differently when your glucose is low, in range, or elevated.
            </p>
          </div>

          {/* LOW GLUCOSE RANGE */}
          <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-blue-300 text-sm font-semibold flex items-center gap-2">
                  <span className="text-lg">🔵</span> Low Glucose Range
                </p>
                <p className="text-blue-200/50 text-xs mt-0.5">When your blood sugar is low — what helps you recover</p>
              </div>
              <PillButton
                active={LOW_RANGE_OPTIONS.every(f => lowRangeCarbs.includes(f))}
                onClick={() => selectAll(LOW_RANGE_OPTIONS, lowRangeCarbs, setLowRangeCarbs)}
              >
                {LOW_RANGE_OPTIONS.every(f => lowRangeCarbs.includes(f)) ? "Clear All" : "Select All"}
              </PillButton>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {LOW_RANGE_OPTIONS.map(food => (
                <PillButton
                  key={food}
                  active={lowRangeCarbs.includes(food)}
                  onClick={() => toggle(food, lowRangeCarbs, setLowRangeCarbs)}
                >
                  {food}
                </PillButton>
              ))}
            </div>
          </div>

          {/* IN-RANGE GLUCOSE */}
          <div className="rounded-xl border border-green-500/30 bg-green-950/20 p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-green-300 text-sm font-semibold flex items-center gap-2">
                  <span className="text-lg">🟢</span> In-Range Glucose
                </p>
                <p className="text-green-200/50 text-xs mt-0.5">When your blood sugar is stable — balanced carbs for steady energy</p>
              </div>
              <PillButton
                active={MID_RANGE_OPTIONS.every(f => midRangeCarbs.includes(f))}
                onClick={() => selectAll(MID_RANGE_OPTIONS, midRangeCarbs, setMidRangeCarbs)}
              >
                {MID_RANGE_OPTIONS.every(f => midRangeCarbs.includes(f)) ? "Clear All" : "Select All"}
              </PillButton>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {MID_RANGE_OPTIONS.map(food => (
                <PillButton
                  key={food}
                  active={midRangeCarbs.includes(food)}
                  onClick={() => toggle(food, midRangeCarbs, setMidRangeCarbs)}
                >
                  {food}
                </PillButton>
              ))}
            </div>
          </div>

          {/* HIGH GLUCOSE RANGE */}
          <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-red-300 text-sm font-semibold flex items-center gap-2">
                  <span className="text-lg">🔴</span> High Glucose Range
                </p>
                <p className="text-red-200/50 text-xs mt-0.5">When your blood sugar is elevated — low-glycemic options to bring it down</p>
              </div>
              <PillButton
                active={HIGH_RANGE_OPTIONS.every(f => highRangeCarbs.includes(f))}
                onClick={() => selectAll(HIGH_RANGE_OPTIONS, highRangeCarbs, setHighRangeCarbs)}
              >
                {HIGH_RANGE_OPTIONS.every(f => highRangeCarbs.includes(f)) ? "Clear All" : "Select All"}
              </PillButton>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {HIGH_RANGE_OPTIONS.map(food => (
                <PillButton
                  key={food}
                  active={highRangeCarbs.includes(food)}
                  onClick={() => toggle(food, highRangeCarbs, setHighRangeCarbs)}
                >
                  {food}
                </PillButton>
              ))}
            </div>
          </div>

        </div>

        {/* Save */}
        <div className="sticky bottom-0 p-4 bg-zinc-900/95 backdrop-blur-sm border-t border-white/10">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-semibold py-3 rounded-xl"
          >
            {isSaving ? "Saving..." : "Save Glucose Carb Preferences"}
          </Button>
        </div>
      </div>
    </div>
  );
}
