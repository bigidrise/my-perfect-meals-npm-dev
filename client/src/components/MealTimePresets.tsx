import { Button } from "@/components/ui/button";

const BUILT_IN_PRESETS = [
  {
    id: "standard",
    name: "Standard 3+1",
    times: { b: "08:00", l: "12:00", s: ["15:30"], d: "18:30" },
    notify: { b: true, l: true, d: true, s: true }
  },
  {
    id: "early",
    name: "Early Bird",
    times: { b: "06:30", l: "11:00", s: ["14:30"], d: "17:30" },
    notify: { b: true, l: true, d: true, s: true }
  },
  {
    id: "late",
    name: "Late Schedule",
    times: { b: "10:00", l: "14:00", s: ["17:00"], d: "20:00" },
    notify: { b: true, l: true, d: true, s: true }
  },
  {
    id: "night",
    name: "Night Shift",
    times: { b: "14:00", l: "19:00", s: ["22:00"], d: "01:00" },
    notify: { b: true, l: true, d: true, s: true }
  },
  {
    id: "16-8",
    name: "16:8 Fasting",
    times: { b: null, l: "12:00", s: ["15:30"], d: "19:30" },
    notify: { b: false, l: true, d: true, s: true }
  },
  {
    id: "18-6",
    name: "18:6 Fasting",
    times: { b: null, l: "13:00", s: ["16:00"], d: "18:30" },
    notify: { b: false, l: true, d: true, s: true }
  },
];

interface MealTimePresetsProps {
  apply: (preset: any) => void;
}

export function MealTimePresets({ apply }: MealTimePresetsProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">Quick Presets</h3>
      <div className="flex flex-wrap gap-2">
        {BUILT_IN_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            variant="outline"
            size="sm"
            onClick={() => apply(preset)}
            className="text-xs"
          >
            {preset.name}
          </Button>
        ))}
      </div>
    </div>
  );
}