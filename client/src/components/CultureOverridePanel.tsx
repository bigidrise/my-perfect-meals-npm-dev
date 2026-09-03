import { useState } from "react";
import { Globe, ChevronDown, ChevronUp, X } from "lucide-react";

interface CultureOverridePanelProps {
  savedCuisine?: string | null;
  onOverrideChange: (override: string | null) => void;
  suggestionChips?: string[];
  className?: string;
}

function capitalizeCuisine(cuisine: string): string {
  if (!cuisine) return "";
  const specialCases: Record<string, string> = {
    "middle eastern": "Middle Eastern",
    "american": "American",
    "american_southern": "Southern",
    "neutral_american": "No preference",
  };
  if (specialCases[cuisine.toLowerCase()]) return specialCases[cuisine.toLowerCase()];
  return cuisine.charAt(0).toUpperCase() + cuisine.slice(1);
}

export default function CultureOverridePanel({
  savedCuisine,
  onOverrideChange,
  suggestionChips = [],
  className = "",
}: CultureOverridePanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [activeOverride, setActiveOverride] = useState<string | null>(null);

  const displayCuisine = savedCuisine && savedCuisine !== "neutral_american" ? savedCuisine : null;

  const handleChip = (chip: string) => {
    setInputValue(chip);
    setActiveOverride(chip);
    onOverrideChange(chip);
  };

  const handleInput = (val: string) => {
    setInputValue(val);
    const trimmed = val.trim();
    setActiveOverride(trimmed || null);
    onOverrideChange(trimmed || null);
  };

  const clearOverride = () => {
    setInputValue("");
    setActiveOverride(null);
    onOverrideChange(null);
    setIsExpanded(false);
  };

  if (!displayCuisine && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors ${className}`}
      >
        <Globe className="h-3.5 w-3.5" />
        <span>Explore a food culture</span>
        <ChevronDown className="h-3 w-3" />
      </button>
    );
  }

  if (!isExpanded && !activeOverride) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`flex items-center gap-1.5 text-xs text-orange-300/70 hover:text-orange-300 transition-colors ${className}`}
      >
        <Globe className="h-3.5 w-3.5" />
        <span>🌍 {capitalizeCuisine(displayCuisine!)} influence active</span>
        <span className="text-white/30">·</span>
        <span className="text-white/40 hover:text-white/70">Explore Another →</span>
      </button>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-orange-300/80">
          <Globe className="h-3.5 w-3.5" />
          <span>Food Culture</span>
          {activeOverride && (
            <span className="text-white/50">· using: <span className="text-orange-300">{capitalizeCuisine(activeOverride)}</span></span>
          )}
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-white/30 hover:text-white/60 transition-colors"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => handleInput(e.target.value)}
          placeholder={displayCuisine
            ? `e.g. Mexican, Jamaican, Japanese… (leave blank to use ${capitalizeCuisine(displayCuisine)})`
            : "e.g. Mexican, Jamaican, Japanese, Armenian…"}
          className="w-full bg-black/40 text-white border border-white/20 px-3 py-2 rounded-lg text-xs placeholder:text-white/30 pr-8"
        />
        {activeOverride && (
          <button
            onClick={clearOverride}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {suggestionChips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestionChips.map((chip) => (
            <button
              key={chip}
              onClick={() => handleChip(chip)}
              className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                activeOverride === chip
                  ? "bg-orange-600/40 border-orange-400/60 text-orange-200"
                  : "bg-white/5 border-white/15 text-white/50 hover:bg-white/10 hover:text-white/70"
              }`}
            >
              {chip}
            </button>
          ))}
          {displayCuisine && activeOverride && (
            <button
              onClick={clearOverride}
              className="px-2.5 py-1 rounded-full text-xs border border-white/15 bg-white/5 text-white/40 hover:text-white/70 transition-all"
            >
              ← Use {capitalizeCuisine(displayCuisine)}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
