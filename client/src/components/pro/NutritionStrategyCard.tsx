import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { CheckCircle2, Loader2 } from "lucide-react";

type AckStatus = "not_seen" | "seen" | "acknowledged";

interface NutritionStrategy {
  strategyType: string;
  coachInstructions: string | null;
  watchFor: string | null;
  strategyVersion: number;
  updatedByName: string;
  updatedByRole: string;
  updatedAt: string;
  ackStatus: AckStatus;
  acknowledgedAt: string | null;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function NutritionStrategyCard() {
  const [strategy, setStrategy] = useState<NutritionStrategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [acknowledging, setAcknowledging] = useState(false);
  const [viewFired, setViewFired] = useState(false);

  const fetchStrategy = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/client/nutrition-strategy"), {
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setStrategy(data.strategy ?? null);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStrategy();
  }, [fetchStrategy]);

  useEffect(() => {
    if (!strategy || viewFired) return;
    if (strategy.ackStatus === "acknowledged") return;
    setViewFired(true);
    fetch(apiUrl("/api/client/nutrition-strategy/view"), {
      method: "POST",
      headers: { ...getAuthHeaders() },
      credentials: "include",
    }).catch(() => {});
  }, [strategy, viewFired]);

  const handleGotIt = async () => {
    if (!strategy || acknowledging) return;
    setAcknowledging(true);
    try {
      const res = await fetch(apiUrl("/api/client/nutrition-strategy/acknowledge"), {
        method: "POST",
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (res.ok) {
        setStrategy((prev) =>
          prev
            ? { ...prev, ackStatus: "acknowledged", acknowledgedAt: new Date().toISOString() }
            : prev
        );
      }
    } catch {
    } finally {
      setAcknowledging(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center gap-2 text-white/40 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading strategy...
      </div>
    );
  }

  if (!strategy) return null;

  const isAcknowledged = strategy.ackStatus === "acknowledged";

  return (
    <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold text-orange-400/70 uppercase tracking-wide mb-0.5">
            Current Nutrition Strategy
          </p>
          <p className="text-sm font-bold text-white">{strategy.strategyType}</p>
        </div>
        {isAcknowledged && (
          <span className="flex items-center gap-1 text-[10px] text-green-400 font-medium shrink-0 mt-0.5">
            <CheckCircle2 className="w-3 h-3" />
            Acknowledged
          </span>
        )}
      </div>

      {strategy.coachInstructions && (
        <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2.5">
          <p className="text-[10px] text-white/50 uppercase tracking-wide font-medium mb-1">Coach Instructions</p>
          <p className="text-sm text-white/80 leading-relaxed">{strategy.coachInstructions}</p>
        </div>
      )}

      {strategy.watchFor && (
        <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2.5">
          <p className="text-[10px] text-white/50 uppercase tracking-wide font-medium mb-1">Watch For</p>
          <p className="text-sm text-white/60 leading-relaxed">{strategy.watchFor}</p>
        </div>
      )}

      <p className="text-[10px] text-white/30">
        Set by {strategy.updatedByName} · {formatTimestamp(strategy.updatedAt)}
      </p>

      {!isAcknowledged && (
        <button
          onClick={handleGotIt}
          disabled={acknowledging}
          className="w-full rounded-lg bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/10 text-white text-sm font-semibold py-2.5 transition-colors disabled:opacity-50"
        >
          {acknowledging ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Confirming...
            </span>
          ) : (
            "Got It"
          )}
        </button>
      )}
    </div>
  );
}
