import { DietOverrideControl } from "@/components/ui/DietOverrideControl";
import { CuisineOverrideControl } from "@/components/ui/CuisineOverrideControl";

interface DietCuisineControlRowProps {
  savedCuisine?: string | null;
  dietOverrideEnabled: boolean;
  dietOverrideValue: string;
  onDietToggle: (enabled: boolean) => void;
  onDietChange: (diet: string) => void;
  cuisineOverrideEnabled: boolean;
  cuisineOverrideValue: string;
  onCuisineToggle: (enabled: boolean) => void;
  onCuisineChange: (cuisine: string) => void;
  className?: string;
}

/**
 * DietCuisineControlRow
 *
 * Responsive wrapper: stacked on mobile, side-by-side on desktop (md+).
 * Each control takes equal half-width on desktop so they sit in one row.
 * When either dropdown is open the row reflows naturally.
 */
export function DietCuisineControlRow({
  savedCuisine,
  dietOverrideEnabled,
  dietOverrideValue,
  onDietToggle,
  onDietChange,
  cuisineOverrideEnabled,
  cuisineOverrideValue,
  onCuisineToggle,
  onCuisineChange,
  className = "",
}: DietCuisineControlRowProps) {
  return (
    <div className={`flex flex-col md:flex-row md:gap-3 gap-2 ${className}`}>
      <div className="flex-1 min-w-0">
        <DietOverrideControl
          overrideEnabled={dietOverrideEnabled}
          overrideDiet={dietOverrideValue}
          onToggle={onDietToggle}
          onDietChange={onDietChange}
        />
      </div>
      <div className="flex-1 min-w-0">
        <CuisineOverrideControl
          savedCuisine={savedCuisine}
          overrideEnabled={cuisineOverrideEnabled}
          overrideCuisine={cuisineOverrideValue}
          onToggle={onCuisineToggle}
          onCuisineChange={onCuisineChange}
        />
      </div>
    </div>
  );
}
