import React from "react";
import type { Preset } from "@/types/macro";
import { kcal } from "@/utils/macros";

export default function PresetButton({ preset, onClick }: { preset: Preset; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-zinc-700/70 bg-zinc-900/60 px-3 py-2 hover:bg-zinc-800/60 text-left"
    >
      <div className="text-sm font-medium">{preset.name}</div>
      <div className="text-xs opacity-70">
        {preset.protein}P / {preset.carbs}C / {preset.fat}F • {kcal(preset.protein, preset.carbs, preset.fat)} kcal
      </div>
    </button>
  );
}
