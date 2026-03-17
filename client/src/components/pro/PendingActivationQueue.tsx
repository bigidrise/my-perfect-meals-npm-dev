import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, Clock, UserCheck } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

interface PendingClient {
  clientUserId: string;
  clientEmail: string;
  status: string;
  paidAt: string;
  hoursSincePaid: number;
  overdue: boolean;
}

interface Props {
  onActivated: (clientUserId: string) => void;
}

export default function PendingActivationQueue({ onActivated }: Props) {
  const [clients, setClients] = useState<PendingClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/coaching/queue/new-clients"), {
      headers: { ...getAuthHeaders() },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.clients) {
          setClients(data.clients.filter((c: PendingClient) => c.status === "invited"));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleActivate = async (clientUserId: string) => {
    setActivating(clientUserId);
    try {
      const res = await fetch(apiUrl(`/api/coaching/activate-client/${clientUserId}`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      const data = await res.json();
      if (data.ok) {
        setClients((prev) => prev.filter((c) => c.clientUserId !== clientUserId));
        onActivated(clientUserId);
      }
    } catch {
    } finally {
      setActivating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-white/50 text-sm py-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Checking for new clients...</span>
      </div>
    );
  }

  if (clients.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-orange-400" />
        <h2 className="text-base font-semibold text-orange-300">
          New Clients — Pending Activation ({clients.length})
        </h2>
      </div>

      <div className="space-y-3">
        {clients.map((client) => (
          <div
            key={client.clientUserId}
            className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
              client.overdue
                ? "bg-red-500/10 border-red-500/30"
                : "bg-white/5 border-white/15"
            }`}
          >
            <div className="space-y-1">
              <p className="font-semibold text-white text-sm">{client.clientEmail}</p>
              <p className="text-xs text-white/50">
                Paid {client.hoursSincePaid}h ago · {new Date(client.paidAt).toLocaleDateString()}
              </p>
              {client.overdue && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-300 bg-red-500/20 border border-red-500/30 px-2 py-0.5 rounded-full uppercase tracking-wide">
                  <AlertTriangle className="w-3 h-3" />
                  Overdue — 24h+
                </span>
              )}
            </div>

            <button
              onClick={() => handleActivate(client.clientUserId)}
              disabled={activating === client.clientUserId}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-full bg-orange-600 hover:bg-orange-700 active:scale-[0.97] transition-all text-white font-semibold text-sm disabled:opacity-50 shrink-0"
            >
              {activating === client.clientUserId ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <UserCheck className="w-4 h-4" />
                  Activate Client
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
