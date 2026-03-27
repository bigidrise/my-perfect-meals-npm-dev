import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { Loader2, RefreshCw } from "lucide-react";

type ProtocolType = "off" | "carbCycle" | "fatCycle";
type DayType = "low" | "moderate" | "high";

interface CycleProtocol {
  protocolType: ProtocolType;
  dayType: DayType | null;
  updatedByRole: string;
  updatedByName: string;
  updatedAt: string;
}

interface CycleProtocolControlProps {
  studioId: string;
  clientUserId: string;
}

const PROTOCOL_LABELS: Record<ProtocolType, string> = {
  off: "Off",
  carbCycle: "Carb Cycling",
  fatCycle: "Fat Cycling",
};

const DAY_LABELS: Record<DayType, string> = {
  low: "Low Day",
  moderate: "Moderate Day",
  high: "High Day",
};

function formatProtocol(p: CycleProtocol | null): string {
  if (!p || p.protocolType === "off") return "Off";
  const day = p.dayType ? ` — ${DAY_LABELS[p.dayType]}` : "";
  return `${PROTOCOL_LABELS[p.protocolType]}${day}`;
}

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
    " at " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function CycleProtocolControl({ studioId, clientUserId }: CycleProtocolControlProps) {
  const [protocol, setProtocol] = useState<CycleProtocol | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolType>("off");
  const [selectedDay, setSelectedDay] = useState<DayType>("low");

  const fetchProtocol = useCallback(async () => {
    if (!studioId || !clientUserId) return;
    setLoading(true);
    try {
      const res = await fetch(
        apiUrl(`/api/studios/${studioId}/clients/${clientUserId}/cycle-protocol`),
        { headers: { ...getAuthHeaders() }, credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        setProtocol(data.protocol);
        if (data.protocol) {
          setSelectedProtocol(data.protocol.protocolType as ProtocolType);
          setSelectedDay((data.protocol.dayType as DayType) || "low");
        }
      }
    } catch {
      setError("Failed to load protocol");
    } finally {
      setLoading(false);
    }
  }, [studioId, clientUserId]);

  useEffect(() => {
    fetchProtocol();
  }, [fetchProtocol]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const body: { protocolType: ProtocolType; dayType?: DayType | null } = {
        protocolType: selectedProtocol,
        dayType: selectedProtocol === "off" ? null : selectedDay,
      };
      const res = await fetch(
        apiUrl(`/api/studios/${studioId}/clients/${clientUserId}/cycle-protocol`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          credentials: "include",
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }
      setSuccess(true);
      fetchProtocol();
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message || "Failed to save protocol");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/5 rounded-lg p-3 border border-white/10">
        <div className="flex items-center gap-2 text-white/40 text-xs">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading cycle protocol...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 rounded-lg p-3 border border-white/10 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">Cycle Protocol</p>
        <button onClick={fetchProtocol} className="text-white/30 hover:text-white/60">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {protocol && protocol.protocolType !== "off" && (
        <div className="rounded-md bg-orange-500/10 border border-orange-500/20 px-2.5 py-2 space-y-1">
          <p className="text-xs font-semibold text-orange-300">{formatProtocol(protocol)}</p>
          <p className="text-[10px] text-white/40">
            Last updated by {protocol.updatedByName} ({protocol.updatedByRole}) &middot; {formatUpdatedAt(protocol.updatedAt)}
          </p>
        </div>
      )}

      {(!protocol || protocol.protocolType === "off") && (
        <p className="text-xs text-white/30">No cycle protocol active</p>
      )}

      <div className="space-y-2">
        <p className="text-[10px] text-white/50 uppercase tracking-wide font-medium">Protocol Type</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(["off", "carbCycle", "fatCycle"] as ProtocolType[]).map((p) => (
            <button
              key={p}
              onClick={() => setSelectedProtocol(p)}
              className={`rounded-md px-2 py-1.5 text-[10px] font-medium border transition-all ${
                selectedProtocol === p
                  ? "bg-orange-500/30 border-orange-500/50 text-orange-300"
                  : "bg-white/5 border-white/10 text-white/50 hover:text-white/80"
              }`}
            >
              {PROTOCOL_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {selectedProtocol !== "off" && (
        <div className="space-y-2">
          <p className="text-[10px] text-white/50 uppercase tracking-wide font-medium">Active Day</p>
          <div className="grid grid-cols-3 gap-1.5">
            {(["low", "moderate", "high"] as DayType[]).map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDay(d)}
                className={`rounded-md px-2 py-1.5 text-[10px] font-medium border transition-all ${
                  selectedDay === d
                    ? "bg-blue-500/30 border-blue-500/50 text-blue-300"
                    : "bg-white/5 border-white/10 text-white/50 hover:text-white/80"
                }`}
              >
                {DAY_LABELS[d]}
              </button>
            ))}
          </div>
          {selectedProtocol === "carbCycle" && selectedDay === "low" && (
            <p className="text-[10px] text-green-400/70">Starchy carbs → 0g on Low Day</p>
          )}
          {selectedProtocol === "carbCycle" && selectedDay === "high" && (
            <p className="text-[10px] text-white/50">Starchy carbs ×1.4 on High Day</p>
          )}
          {selectedProtocol === "fatCycle" && selectedDay === "low" && (
            <p className="text-[10px] text-white/50">Fat ×0.7 on Low Day</p>
          )}
          {selectedProtocol === "fatCycle" && selectedDay === "high" && (
            <p className="text-[10px] text-white/50">Fat ×1.3 on High Day</p>
          )}
        </div>
      )}

      {error && <p className="text-[10px] text-red-400">{error}</p>}
      {success && <p className="text-[10px] text-green-400">Protocol updated — client notified.</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-md bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:opacity-50 text-white text-xs font-semibold py-2 transition-colors"
      >
        {saving ? (
          <span className="flex items-center justify-center gap-1.5">
            <Loader2 className="w-3 h-3 animate-spin" />
            Updating...
          </span>
        ) : (
          "Apply Protocol"
        )}
      </button>
    </div>
  );
}
