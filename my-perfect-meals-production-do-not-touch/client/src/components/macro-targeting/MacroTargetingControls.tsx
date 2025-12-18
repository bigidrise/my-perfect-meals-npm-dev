import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { MacroTargetingState, MacroTargets } from "@/hooks/useMacroTargeting";
import { PRESETS } from "@/hooks/useMacroTargeting";

interface MacroTargetingControlsProps {
  state: MacroTargetingState;
}

export function MacroTargetingControls({ state }: MacroTargetingControlsProps) {
  const { enabled, targets, toggleEnabled, updateTarget, applyPreset } = state;

  return (
    <div className="mb-3 p-3 bg-black/30 border border-emerald-500/30 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <label className="text-white text-sm font-semibold flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={enabled}
            onCheckedChange={toggleEnabled}
            className="h-4 w-4 border-emerald-400/50 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-500"
          />
          🎯 Set Macro Targets
        </label>
      </div>

      {enabled && (
        <div className="space-y-2 mt-3 animate-in fade-in duration-200">
          <p className="text-white/60 text-xs mb-2">
            AI will generate a meal hitting these macros (±5g tolerance). All fields are optional.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-white/80 text-xs font-medium block mb-1">
                Protein (g)
              </label>
              <Input
                type="number"
                min="0"
                max="200"
                value={targets.protein}
                onChange={(e) => {
                  const newValue = e.target.value === '' ? '' : Number(e.target.value);
                  updateTarget('protein', newValue);
                }}
                placeholder="50"
                className="bg-black/40 border-emerald-500/30 text-white placeholder:text-white/30 text-sm h-9 text-center font-semibold"
              />
            </div>

            <div>
              <label className="text-white/80 text-xs font-medium block mb-1">
                Fibrous Carbs (g)
              </label>
              <Input
                type="number"
                min="0"
                max="200"
                value={targets.fibrousCarbs}
                onChange={(e) => {
                  const newValue = e.target.value === '' ? '' : Number(e.target.value);
                  updateTarget('fibrousCarbs', newValue);
                }}
                placeholder="15"
                className="bg-black/40 border-emerald-500/30 text-white placeholder:text-white/30 text-sm h-9 text-center font-semibold"
              />
            </div>

            <div>
              <label className="text-white/80 text-xs font-medium block mb-1">
                Starchy Carbs (g)
              </label>
              <Input
                type="number"
                min="0"
                max="200"
                value={targets.starchyCarbs}
                onChange={(e) => {
                  const newValue = e.target.value === '' ? '' : Number(e.target.value);
                  updateTarget('starchyCarbs', newValue);
                }}
                placeholder="30"
                className="bg-black/40 border-emerald-500/30 text-white placeholder:text-white/30 text-sm h-9 text-center font-semibold"
              />
            </div>

            <div>
              <label className="text-white/80 text-xs font-medium block mb-1">
                Fat (g)
              </label>
              <Input
                type="number"
                min="0"
                max="200"
                value={targets.fat}
                onChange={(e) => {
                  const newValue = e.target.value === '' ? '' : Number(e.target.value);
                  updateTarget('fat', newValue);
                }}
                placeholder="20"
                className="bg-black/40 border-emerald-500/30 text-white placeholder:text-white/30 text-sm h-9 text-center font-semibold"
              />
            </div>
          </div>

          <div className="flex gap-2 mt-2">
            <button
              onClick={() => applyPreset(PRESETS.PRESET_1)}
              className="flex-1 px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded text-white/80 text-xs transition-all"
            >
              50p / 15fc / 30sc / 20f
            </button>
            <button
              onClick={() => applyPreset(PRESETS.PRESET_2)}
              className="flex-1 px-2 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded text-white/80 text-xs transition-all"
            >
              40p / 20fc / 40sc / 15f
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
