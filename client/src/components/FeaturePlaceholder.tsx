import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isIosNativeShell } from "@/lib/platform";

export function FeaturePlaceholder({
  title, 
  planLabel, 
  price, 
  bullets, 
  ctaText, 
  ctaHref,
}: {
  title: string; 
  planLabel: string; 
  price: string; 
  bullets: string[];
  ctaText: string; 
  ctaHref: string;
}) {
  const isIos = isIosNativeShell();
  
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-gradient-to-b from-zinc-900 to-black border border-white/10 rounded-2xl p-8 text-white shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-full p-2 bg-white/10">
            <Lock className="w-5 h-5" />
          </div>
          <span className="text-sm bg-white/10 px-3 py-1 rounded-full">
            {isIos ? `🔒 Unlock with ${planLabel}` : `🔒 Unlock with ${planLabel} – ${price}`}
          </span>
        </div>
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        <p className="text-white/70 mb-4">This feature is available on the {planLabel}.</p>
        <ul className="space-y-2 mb-6 text-white/80">
          {bullets.map((b, i) => <li key={i}>• {b}</li>)}
        </ul>
        <Button asChild className="w-full">
          <a href={ctaHref}>{ctaText}</a>
        </Button>
      </div>
    </div>
  );
}