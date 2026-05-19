import { useState, useEffect } from "react";
import { getTodayShoppingScans, deleteProductScan, type SavedProductScan } from "@/lib/shoppingScanStorage";
import type { IngredientScanResult } from "@/lib/photoIngredientCapture";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";

const GRADE_COLORS: Record<string, string> = {
  A: "bg-emerald-500/20 border-emerald-500/40 text-emerald-400",
  B: "bg-lime-500/20 border-lime-500/40 text-lime-400",
  C: "bg-amber-500/20 border-amber-500/40 text-amber-400",
  D: "bg-rose-500/20 border-rose-500/40 text-rose-400",
};

const DECISION_LABELS: Record<string, { label: string; color: string }> = {
  added: { label: "Added", color: "text-emerald-400" },
  saved: { label: "Saved", color: "text-orange-400" },
  skipped: { label: "Skipped", color: "text-white/40" },
};

function formatRelativeDate(iso: string): string {
  const then = new Date(iso);
  const diffMs = Date.now() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 2) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return "Earlier today";
}

/** Reconstruct a full IngredientScanResult from a saved scan so the sheet can reopen. */
function reconstructResult(scan: SavedProductScan): IngredientScanResult {
  return {
    alignmentGrade: (scan.score as "A" | "B" | "C" | "D") ?? "B",
    overallSummary: scan.overallSummary ?? "",
    ingredientConsiderations: scan.considerations ?? [],
    extractedIngredients: scan.ingredients ?? [],
    householdNotes: scan.householdFlags ?? [],
    ocrConfidenceLow: false,
  };
}

interface Props {
  refreshKey?: number;
  onReopen?: (result: IngredientScanResult) => void;
}

export default function RecentScans({ refreshKey, onReopen }: Props) {
  const [scans, setScans] = useState<SavedProductScan[]>([]);
  const [open, setOpen] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function loadScans() {
    const todayScans = getTodayShoppingScans().slice(0, 20);
    setScans(todayScans);
    if (todayScans.length > 0) setOpen(true);
  }

  useEffect(() => {
    loadScans();
  }, [refreshKey]);

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    deleteProductScan(id);
    setScans((prev) => prev.filter((s) => s.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  if (scans.length === 0) return null;

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/4 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white/80">Today's Scans</span>
          <span className="text-[10px] font-bold bg-cyan-700/60 text-white rounded-full px-1.5 py-0.5 leading-none">
            {scans.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/25">Clears tonight</span>
          {open ? (
            <ChevronUp className="w-4 h-4 text-white/40" />
          ) : (
            <ChevronDown className="w-4 h-4 text-white/40" />
          )}
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {scans.map((scan) => {
            const gradeStyle = GRADE_COLORS[scan.score] ?? GRADE_COLORS.B;
            const decision = DECISION_LABELS[scan.userDecision] ?? DECISION_LABELS.skipped;
            const isExpanded = expandedId === scan.id;
            const canReopen = !!(scan.overallSummary || scan.considerations?.length);

            return (
              <div
                key={scan.id}
                className="rounded-xl bg-black/30 border border-white/8 overflow-hidden"
              >
                <div className="flex items-stretch">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : scan.id)}
                    className="flex-1 text-left p-3 flex items-start gap-3 active:opacity-80 transition-opacity min-w-0"
                  >
                    <div
                      className={`shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center font-black text-base ${gradeStyle}`}
                    >
                      {scan.score}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-white/90 font-medium leading-tight truncate">
                          {scan.productName || "Scanned Product"}
                        </p>
                        <span className={`text-[10px] font-semibold shrink-0 ${decision.color}`}>
                          {decision.label}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/40 mt-0.5">{formatRelativeDate(scan.scanDate)}</p>
                    </div>
                  </button>

                  {/* Remove pill button */}
                  <div className="shrink-0 flex items-center justify-center px-2 border-l border-white/8">
                    <PillButton
                      variant="rose"
                      active
                      onClick={(e) => handleDelete(e, scan.id)}
                      aria-label="Remove this scan"
                      className="text-xs px-3 py-1.5 h-auto"
                    >
                      Remove
                    </PillButton>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-white/8 pt-2 space-y-2">
                    {scan.overallSummary && (
                      <p className="text-xs text-white/60 leading-relaxed">
                        {scan.overallSummary}
                      </p>
                    )}
                    {scan.considerations && scan.considerations.length > 0 && (
                      <ul className="space-y-1">
                        {scan.considerations.slice(0, 3).map((c, i) => (
                          <li key={i} className="text-[11px] text-white/50 flex items-start gap-1.5">
                            <span className="text-white/20 mt-0.5 shrink-0">•</span>
                            {c}
                          </li>
                        ))}
                      </ul>
                    )}
                    {canReopen && onReopen && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onReopen(reconstructResult(scan));
                        }}
                        className="w-full flex items-center justify-center gap-1.5 mt-1 rounded-lg bg-cyan-900/50 border border-cyan-500/20 py-2 text-xs text-cyan-300 font-medium active:opacity-70"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View Full Analysis
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
