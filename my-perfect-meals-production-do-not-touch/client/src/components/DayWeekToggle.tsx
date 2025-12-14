import { Button } from "@/components/ui/button";

interface DayWeekToggleProps {
  mode: 'day' | 'week';
  onModeChange: (mode: 'day' | 'week') => void;
}

export function DayWeekToggle({ mode, onModeChange }: DayWeekToggleProps) {
  return (
    <div className="inline-flex bg-black/40 rounded-lg p-1 border border-white/10">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onModeChange('day')}
        className={`px-4 py-1 rounded-md transition-all text-xs ${
          mode === 'day'
            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
            : 'text-white/70 hover:text-white hover:bg-white/5'
        }`}
      >
        Day
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onModeChange('week')}
        className={`hidden px-4 py-1 rounded-md transition-all text-xs ${
          mode === 'week'
            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
            : 'text-white/70 hover:text-white hover:bg-white/5'
        }`}
      >
        Week
      </Button>
    </div>
  );
}