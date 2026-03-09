import { Lock } from "lucide-react";
import { useLocation } from "wouter";

interface LockedBuilderCardProps {
  title: string;
  description: string;
  icon: string;
}

export function LockedBuilderCard({ title, description, icon }: LockedBuilderCardProps) {
  const [, setLocation] = useLocation();

  return (
    <button
      onClick={() => setLocation("/pricing")}
      className="relative bg-black/40 border border-white/10 rounded-xl p-4 text-left group hover:border-orange-500/40 transition-all overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-orange-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-white font-semibold text-sm truncate">{title}</h4>
            <Lock className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
          </div>
          <p className="text-white/50 text-xs leading-relaxed">{description}</p>
        </div>
      </div>
      <div className="relative mt-3 text-orange-400 text-xs font-medium group-hover:text-orange-300 transition-colors">
        Unlock with upgrade →
      </div>
    </button>
  );
}
