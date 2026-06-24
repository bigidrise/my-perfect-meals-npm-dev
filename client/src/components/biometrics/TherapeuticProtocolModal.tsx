import { X, ShieldCheck } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";

interface TherapeuticModalContent {
  headline: string;
  selectedItems: string[];
  activeProtocols: string[];
  priorities: string[];
  body: string;
  conflictPolicy: string;
}

interface TherapeuticProtocolModalProps {
  content: TherapeuticModalContent;
  onClose: () => void;
}

export default function TherapeuticProtocolModal({ content, onClose }: TherapeuticProtocolModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-gradient-to-b from-black/95 to-black/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-900/20 via-transparent to-transparent pointer-events-none rounded-2xl" />

        <div className="relative p-5 border-b border-white/10 flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-teal-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-white font-bold text-lg leading-tight">{content.headline}</h2>
            <p className="text-white/50 text-xs mt-0.5">Therapeutic Nutrition Intelligence</p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1.5 rounded-lg bg-white/5 text-white/50 active:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative p-5 space-y-4">
          {content.selectedItems.length > 0 && (
            <div>
              <p className="text-white/50 text-[11px] uppercase tracking-wide font-semibold mb-2">You Selected</p>
              <div className="flex flex-wrap gap-1.5">
                {content.selectedItems.map(item => (
                  <span key={item} className="px-2.5 py-1 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-300 text-xs font-medium">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {content.activeProtocols.length > 0 && (
            <div>
              <p className="text-white/50 text-[11px] uppercase tracking-wide font-semibold mb-2">Also Active</p>
              <div className="flex flex-wrap gap-1.5">
                {content.activeProtocols.map(p => (
                  <span key={p} className="px-2.5 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-300 text-xs font-medium">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-white/90 text-sm leading-relaxed">{content.body}</p>
          </div>

          {content.priorities.length > 0 && (
            <div>
              <p className="text-white/50 text-[11px] uppercase tracking-wide font-semibold mb-2">Nutrition Priorities</p>
              <ul className="space-y-1.5">
                {content.priorities.map((p, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="flex-shrink-0 w-4 h-4 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                    </span>
                    <span className="text-white/70 text-sm capitalize">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-amber-200/80 text-xs leading-relaxed">{content.conflictPolicy}</p>
          </div>
        </div>

        <div className="relative p-5 pt-0">
          <PillButton
            onClick={onClose}
            className="w-full bg-teal-600 hover:bg-teal-500 text-white font-semibold py-3 rounded-xl"
          >
            Got It — Protocol Active
          </PillButton>
        </div>
      </div>
    </div>
  );
}
