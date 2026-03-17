import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, Clock, CheckCircle, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

interface QueueClient {
  clientUserId: string;
  clientEmail: string;
  status: "invited" | "active" | string;
  paidAt: string;
  activatedAt: string | null;
  hoursSincePaid: number;
  overdue: boolean;
}

export default function CoachQueue() {
  const [clients, setClients] = useState<QueueClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/coaching/queue/new-clients"), {
        headers: { ...getAuthHeaders() },
      });
      if (res.status === 403) {
        setError("Access denied. Coach accounts only.");
        return;
      }
      if (!res.ok) throw new Error("Failed to load queue");
      const data = await res.json();
      setClients(data.clients ?? []);
    } catch (err) {
      setError("Could not load client queue. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
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
        setClients((prev) =>
          prev.map((c) =>
            c.clientUserId === clientUserId
              ? { ...c, status: "active", activatedAt: new Date().toISOString() }
              : c
          )
        );
      }
    } catch (err) {
      console.error("[CoachQueue] Activation failed:", err);
    } finally {
      setActivating(null);
    }
  };

  const pending = clients.filter((c) => c.status === "invited");
  const active = clients.filter((c) => c.status === "active");

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 text-white">
      <div className="container max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">New Client Queue</h1>
          <p className="text-white/70 mt-1">Clients pending contact or activation</p>
        </div>

        {loading && (
          <div className="flex items-center gap-3 text-white/60 py-12 justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading queue...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {pending.length === 0 && active.length === 0 && (
              <div className="text-center py-16 text-white/50">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg">No clients yet. Queue is empty.</p>
              </div>
            )}

            {pending.length > 0 && (
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-orange-300 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Pending Contact ({pending.length})
                </h2>
                <div className="space-y-3">
                  {pending.map((client) => (
                    <div
                      key={client.clientUserId}
                      className={`rounded-xl border p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                        client.overdue
                          ? "bg-red-500/10 border-red-500/40"
                          : "bg-black/30 border-white/15"
                      }`}
                    >
                      <div className="space-y-1">
                        <p className="font-medium text-white">
                          {client.clientEmail}
                        </p>
                        <p className="text-sm text-white/60">
                          Paid {client.hoursSincePaid}h ago ·{" "}
                          {new Date(client.paidAt).toLocaleDateString()}
                        </p>
                        {client.overdue && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-300 bg-red-500/20 px-2 py-0.5 rounded-full">
                            <AlertTriangle className="w-3 h-3" />
                            OVERDUE — over 24h
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleActivate(client.clientUserId)}
                        disabled={activating === client.clientUserId}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-semibold shrink-0"
                      >
                        {activating === client.clientUserId ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <UserCheck className="w-4 h-4 mr-1" />
                            Activate Client
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {active.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-green-300 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Active Clients ({active.length})
                </h2>
                <div className="space-y-3">
                  {active.map((client) => (
                    <div
                      key={client.clientUserId}
                      className="rounded-xl border border-white/10 bg-black/20 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <p className="font-medium text-white">{client.clientEmail}</p>
                        <p className="text-sm text-white/50">
                          Activated{" "}
                          {client.activatedAt
                            ? new Date(client.activatedAt).toLocaleDateString()
                            : "—"}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1 rounded-full">
                        Active
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 text-center">
              <Button
                variant="ghost"
                onClick={fetchQueue}
                className="text-white/60 hover:text-white"
              >
                Refresh Queue
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
