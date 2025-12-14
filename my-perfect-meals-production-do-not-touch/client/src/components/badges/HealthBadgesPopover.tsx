import { useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { normalizeBadges } from "./healthBadges";
import { ShieldPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

const CRITICAL_BADGE_KEYS = [
  "cardiac",
  "heart-healthy",
  "heart",
  "renal",
  "kidney",
  "glp1",
  "diabetes",
  "diabetic",
];

export default function HealthBadgesPopover({
  badges,
  label = "Medical badges",
  className = "",
  align = "center",
  side = "top",
}: {
  badges?: string[];
  label?: string;
  className?: string;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
}) {
  const items = useMemo(() => normalizeBadges(badges), [badges]);
  const count = items.length;
  const hasCritical = items.some(item =>
    CRITICAL_BADGE_KEYS.includes(item.key)
  );

  return (
    <div className={className}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2 h-auto p-2 hover:bg-white/10"
            data-testid="button-medical-info"
            aria-label={label}
          >
            <ShieldPlus 
              className={`text-blue-500 ${
                hasCritical 
                  ? 'drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]' 
                  : ''
              }`}
              size={54}
              strokeWidth={2}
              data-testid="icon-medical-badge"
            />
          </Button>
        </PopoverTrigger>
        
        <PopoverContent
          align={align}
          side={side}
          sideOffset={8}
          className="rounded-2xl bg-black/90 text-white border border-white/10 shadow-lg max-w-xs p-4 space-y-2 text-sm z-50"
        >
          <div className="font-semibold mb-2 text-white/90">
            {count === 0 ? "Medical Badges" : `Medical Badges (${count})`}
          </div>
          {count === 0 ? (
            <div className="text-white/60 text-xs" data-testid="text-no-badges">
              No health badges for this meal.
            </div>
          ) : (
            items.map(item => (
              <div key={item.key} className="flex items-start gap-2" data-testid={`badge-row-${item.key}`}>
                <span className={`inline-flex h-2 w-2 rounded-full mt-1.5 flex-shrink-0 ${
                  CRITICAL_BADGE_KEYS.includes(item.key) ? "bg-red-500" : "bg-white/70"
                }`} />
                <div>
                  <div className="font-medium" data-testid={`text-badge-label-${item.key}`}>{item.label}</div>
                  {item.desc && <div className="text-white/80 text-xs" data-testid={`text-badge-desc-${item.key}`}>{item.desc}</div>}
                </div>
              </div>
            ))
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}