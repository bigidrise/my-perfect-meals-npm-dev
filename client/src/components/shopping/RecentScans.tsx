import { useState, useEffect } from "react";
import { getSavedProducts, type SavedProductScan } from "@/lib/shoppingScanStorage";
import { ChevronDown, ChevronUp } from "lucide-react";

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
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface Props {
  refreshKey?: number;
}

export default function RecentScans({ refreshKey }: Props) {
  const [scans, setScans] = useState<SavedProductScan[]>([]);
  const [open, setOpen] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const all = getSavedProducts().filter((s) => s.scanSource === "shopping");
    setScans(all.slice(0, 5));
    if (all.length > 0) setOpen(true);
  }, [refreshKey]);

  if (scans.length === 0) return null;

  return (
    <div className="mt-3 rounded-2xl border border-white/10 bg-white/4 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white/80">Recent Scans</span>
          <span className="text-[10px] font-bold bg-orange-600/70 text-white rounded-full px-1.5 py-0.5 leading-none">
            {scans.length}
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-white/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/40" />
        )}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {scans.map((scan) => {
            const gradeStyle = GRADE_COLORS[scan.score] ?? GRADE_COLORS.B;
            const decision = DECISION_LABELS[scan.userDecision] ?? DECISION_LABELS.skipped;
            const isExpanded = expandedId === scan.id;

            return (
              <button
                key={scan.id}
                onClick={() => setExpandedId(isExpanded ? null : scan.id)}
                className="w-full text-left rounded-xl bg-black/30 border border-white/8 p-3 flex items-start gap-3 active:opacity-80 transition-opacity"
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
                  {isExpanded && scan.overallSummary && (
                    <p className="text-xs text-white/60 leading-relaxed mt-2 border-t border-white/10 pt-2">
                      {scan.overallSummary}
                    </p>
                  )}
                  {isExpanded && scan.considerations && scan.considerations.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {scan.considerations.slice(0, 3).map((c, i) => (
                        <li key={i} className="text-[11px] text-white/50 flex items-start gap-1.5">
                          <span className="text-white/20 mt-0.5 shrink-0">•</span>
                          {c}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
