import { useState } from "react";
import { ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import {
  getActiveProtocols,
  getActiveDiets,
  type ProtocolEntry,
} from "@/lib/nutritionPersonalization";

interface ProtocolVisibilityPanelProps {
  user: any;
  whyThisComplies?: string | null;
  reasoning?: string | null;
  context?: "meal" | "beverage" | "restaurant";
}

function getMacroSummary(user: any): string | null {
  const cal = user?.dailyCalorieTarget;
  const prot = user?.dailyProteinTarget;
  if (!cal && !prot) return null;
  const parts: string[] = [];
  if (cal) parts.push(`${cal} cal/day`);
  if (prot) parts.push(`${prot}g protein`);
  return parts.join(" · ");
}

export default function ProtocolVisibilityPanel({
  user,
  whyThisComplies,
  reasoning,
  context = "meal",
}: ProtocolVisibilityPanelProps) {
  const [open, setOpen] = useState(false);

  const protocols = getActiveProtocols(user);
  const diets = getActiveDiets(user);
  const macroSummary = getMacroSummary(user);
  const explanation = reasoning || whyThisComplies || null;

  const hasProtocols = protocols.length > 0;
  const hasDiets = diets.length > 0;
  const hasMacros = !!macroSummary;

  if (!hasProtocols && !hasDiets && !hasMacros) return null;

  const highProtocols = protocols.filter((p) => p.level === "high");
  const moderateProtocols = protocols.filter((p) => p.level === "moderate");

  const outcomeLabels = [
    ...protocols.map((p) => p.outcomeLabel),
    ...diets,
  ];

  const PILL_CAP = 4;
  const visibleLabels = outcomeLabels.slice(0, PILL_CAP);
  const hiddenCount = outcomeLabels.length - visibleLabels.length;

  const contextLabel =
    context === "beverage"
      ? "this drink"
      : context === "restaurant"
      ? "this recommendation"
      : "this meal";

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
      {/* ── Level 1: Always-visible "Built Using" strip ── */}
      {outcomeLabels.length > 0 && (
        <div className="px-3.5 pt-2.5 pb-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-white/40 font-semibold uppercase tracking-widest shrink-0">
            Built using
          </span>
          {visibleLabels.map((label) => (
            <span
              key={label}
              className="text-[10px] bg-orange-500/15 border border-orange-500/25 text-orange-300 rounded-full px-2 py-0.5 font-medium"
            >
              {label}
            </span>
          ))}
          {hiddenCount > 0 && (
            <span className="text-[10px] bg-white/8 border border-white/10 text-white/45 rounded-full px-2 py-0.5 font-medium">
              +{hiddenCount} more
            </span>
          )}
          {hasMacros && (
            <span className="text-[10px] bg-white/8 border border-white/10 text-white/50 rounded-full px-2 py-0.5 font-medium">
              {macroSummary}
            </span>
          )}
        </div>
      )}

      {/* ── Expandable header ── */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3.5 py-2 text-left active:bg-white/5 transition-colors select-none border-t border-white/8"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
          <span className="text-[11px] font-semibold text-white/65">
            How This Was Built For You
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-3 w-3 text-white/35 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-3 w-3 text-white/35 flex-shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 space-y-3 border-t border-white/8">

          {/* ── Level 3 first: Clinical reasoning (most important) ── */}
          {explanation && (
            <div className="pt-3 bg-white/5 border border-white/8 rounded-lg p-3 mt-3">
              <p className="text-[10px] text-orange-400/70 uppercase tracking-widest font-semibold mb-1.5">
                Why {contextLabel} fits your profile
              </p>
              <p className="text-xs text-white/70 leading-relaxed">{explanation}</p>
            </div>
          )}

          {/* ── Level 2: Protocol breakdown ── */}
          {hasProtocols && (
            <div className={explanation ? "" : "pt-3"}>
              <p className="text-[10px] text-white/35 uppercase tracking-widest font-semibold mb-2">
                Protocols Applied
              </p>
              <div className="space-y-1.5">
                {highProtocols.map((p) => (
                  <div key={p.displayLabel} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                      <span className="text-xs text-white/75">{p.displayLabel}</span>
                    </div>
                    <span className="text-[10px] text-orange-400/60 font-medium">High</span>
                  </div>
                ))}
                {moderateProtocols.map((p) => (
                  <div key={p.displayLabel} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400/60 flex-shrink-0" />
                      <span className="text-xs text-white/60">{p.displayLabel}</span>
                    </div>
                    <span className="text-[10px] text-amber-400/50 font-medium">Moderate</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Dietary identity ── */}
          {hasDiets && (
            <div>
              <p className="text-[10px] text-white/35 uppercase tracking-widest font-semibold mb-2">
                Dietary Identity
              </p>
              <div className="flex flex-wrap gap-1.5">
                {diets.map((d) => (
                  <span
                    key={d}
                    className="text-[11px] bg-white/8 border border-white/10 text-white/60 rounded-full px-2.5 py-0.5"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Fallback if no explanation ── */}
          {!explanation && (
            <p className="text-[11px] text-white/30 leading-relaxed pt-1">
              All active protocols and dietary rules from your profile were applied when generating {contextLabel}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
