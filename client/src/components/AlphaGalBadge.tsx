import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface AlphaGalBadgeData {
  status: "protected" | "verify" | "incompatible";
  label: string;
  reason: string;
}

const CONFIG = {
  protected: {
    bg: "bg-emerald-900/40",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  verify: {
    bg: "bg-amber-900/40",
    border: "border-amber-500/30",
    text: "text-amber-400",
    dot: "bg-amber-400",
  },
  incompatible: {
    bg: "bg-red-900/40",
    border: "border-red-500/30",
    text: "text-red-400",
    dot: "bg-red-500",
  },
};

export default function AlphaGalBadge({ badge }: { badge: AlphaGalBadgeData }) {
  const c = CONFIG[badge.status];
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium cursor-default ${c.bg} ${c.border} ${c.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
            {badge.label}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs text-xs bg-black/90 border border-white/10 text-white"
        >
          {badge.reason}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
