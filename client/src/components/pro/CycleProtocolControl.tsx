import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { Loader2, RefreshCw } from "lucide-react";

const STRATEGY_TYPES = [
  "Lower Carb Phase",
  "Higher Carb Push",
  "Carb Refeed",
  "Lower Fat Phase",
  "Higher Fat Adjustment",
  "Maintenance Hold",
  "Custom Strategy",
] as const;

type StrategyType = typeof STRATEGY_TYPES[number];
type AckStatus = "not_seen" | "seen" | "acknowledged";

interface NutritionStrategy {
  strategyType: StrategyType;
  coachInstructions: string | null;
  watchFor: string | null;
  strategyVersion: number;
  updatedByRole: string;
  updatedByName: string;
  updatedAt: string;
  lastViewedAt: string | null;
  acknowledgedAt: string | null;
  ackStatus: AckStatus;
}

interface CycleProtocolControlProps {
  studioId: string;
  clientUserId: string;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
    " at " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  );
}

function AckChip({ status, acknowledgedAt }: { status: AckStatus; acknowledgedAt: string | null }) {
  if (status === "acknowledged") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 border border-green-500/30 px-2 py-0.5 text-[10px] font-medium text-green-400">
        Acknowledged{acknowledgedAt ? ` · ${formatTimestamp(acknowledgedAt)}` : ""}
      </span>
    );
  }
  if (status === "seen") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[10px] font-medium text-blue-400">
        Seen
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/20 px-2 py-0.5 text-[10px] font-medium text-white/50">
      Not seen
    </span>
  );
}

export default function CycleProtocolControl({ studioId, clientUserId }: CycleProtocolControlProps) {
  const [strategy, setStrategy] = useState<NutritionStrategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [selectedType, setSelectedType] = useState<StrategyType>("Custom Strategy");
  const [instructions, setInstructions] = useState("");
  const [watchFor, setWatchFor] = useState("");

  const fetchStrategy = useCallback(async () => {
    if (!studioId || !clientUserId) return;
    setLoading(true);
    try {
      const res = await fetch(
        apiUrl(`/api/studios/${studioId}/clients/${clientUserId}/cycle-protocol`),
        { headers: { ...getAuthHeaders() }, credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        setStrategy(data.strategy ?? null);
        if (data.strategy) {
          setSelectedType(data.strategy.strategyType as StrategyType);
          setInstructions(data.strategy.coachInstructions ?? "");
          setWatchFor(data.strategy.watchFor ?? "");
        }
      }
    } catch {
      setError("Failed to load strategy");
    } finally {
      setLoading(false);
    }
  }, [studioId, clientUserId]);

  useEffect(() => {
    fetchStrategy();
  }, [fetchStrategy]);

  const handleSave = async () => {
    if (!instructions.trim()) {
      setError("Coach instructions are required.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(
        apiUrl(`/api/studios/${studioId}/clients/${clientUserId}/cycle-protocol`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          credentials: "include",
          body: JSON.stringify({
            strategyType: selectedType,
            coachInstructions: instructions.trim(),
            watchFor: watchFor.trim() || null,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      setSuccess(true);
      fetchStrategy();
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message || "Failed to save strategy");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/5 rounded-lg p-3 border border-white/10">
        <div className="flex items-center gap-2 text-white/40 text-xs">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading strategy...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 rounded-lg p-3 border border-white/10 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">Current Nutrition Strategy</p>
        <button onClick={fetchStrategy} className="text-white/30 hover:text-white/60">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {strategy ? (
        <div className="rounded-md bg-orange-500/10 border border-orange-500/20 px-2.5 py-2 space-y-1.5">
          <p className="text-xs font-semibold text-orange-300">{strategy.strategyType}</p>
          {strategy.coachInstructions && (
            <p className="text-[10px] text-white/60 leading-relaxed">{strategy.coachInstructions}</p>
          )}
          {strategy.watchFor && (
            <p className="text-[10px] text-white/40 italic">{strategy.watchFor}</p>
          )}
          <div className="flex items-center justify-between pt-0.5">
            <p className="text-[10px] text-white/30">
              {strategy.updatedByName} ({strategy.updatedByRole}) · {formatTimestamp(strategy.updatedAt)}
            </p>
            <AckChip status={strategy.ackStatus} acknowledgedAt={strategy.acknowledgedAt} />
          </div>
        </div>
      ) : (
        <p className="text-xs text-white/30">No strategy set yet</p>
      )}

      <div className="space-y-2.5">
        <div className="space-y-1.5">
          <p className="text-[10px] text-white/50 uppercase tracking-wide font-medium">Strategy Type</p>
          <div className="grid grid-cols-2 gap-1">
            {STRATEGY_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`rounded-md px-2 py-1.5 text-[10px] font-medium border text-left transition-all ${
                  selectedType === t
                    ? "bg-orange-500/30 border-orange-500/50 text-orange-300"
                    : "bg-white/5 border-white/10 text-white/50 hover:text-white/80"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] text-white/50 uppercase tracking-wide font-medium">
            Coach Instructions <span className="text-red-400">*</span>
          </p>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. Keep carbs here until weight loss stalls."
            rows={3}
            className="w-full rounded-md bg-white/5 border border-white/10 text-white text-xs px-2.5 py-2 placeholder:text-white/25 resize-none focus:outline-none focus:border-orange-500/50"
          />
        </div>

        <div className="space-y-1">
          <p className="text-[10px] text-white/50 uppercase tracking-wide font-medium">
            Watch For <span className="text-white/30 font-normal">(optional)</span>
          </p>
          <textarea
            value={watchFor}
            onChange={(e) => setWatchFor(e.target.value)}
            placeholder="e.g. Watch energy levels and weekly average weight."
            rows={2}
            className="w-full rounded-md bg-white/5 border border-white/10 text-white text-xs px-2.5 py-2 placeholder:text-white/25 resize-none focus:outline-none focus:border-orange-500/50"
          />
        </div>
      </div>

      {error && <p className="text-[10px] text-red-400">{error}</p>}
      {success && <p className="text-[10px] text-green-400">Strategy saved — client notified.</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-md bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 text-white text-xs font-semibold py-2 transition-colors"
      >
        {saving ? (
          <span className="flex items-center justify-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Saving...
          </span>
        ) : (
          "Save & Notify Client"
        )}
      </button>
    </div>
  );
}
