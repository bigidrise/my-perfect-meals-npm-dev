import { Button } from "@/components/ui/button";
import { Hammer, Clock } from "lucide-react";
import { useLocation } from "wouter";

type Props = {
  title: string;
  blurb: string;
  hint?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export default function ComingSoonCard({
  title,
  blurb,
  hint,
  ctaLabel = "Go to Weekly Meal Board",
  ctaHref = "/weekly-meal-board",
}: Props) {
  const [, setLocation] = useLocation();

  return (
    <div className="bg-black/30 backdrop-blur-lg border border-white/20 shadow-xl rounded-2xl p-6 text-white/90">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
          <Hammer className="h-6 w-6 text-amber-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">{title}</h3>
          <p className="text-sm text-amber-400">Coming Soon</p>
        </div>
      </div>
      
      <p className="text-white/70 mb-4 leading-relaxed">{blurb}</p>
      
      {hint ? (
        <div className="flex items-center gap-2 text-xs text-white/70 mb-4">
          <Clock className="h-4 w-4" />
          <span>{hint}</span>
        </div>
      ) : null}
      
      <Button
        onClick={() => setLocation(ctaHref)}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        {ctaLabel}
      </Button>
    </div>
  );
}