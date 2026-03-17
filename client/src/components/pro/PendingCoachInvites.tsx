import { useState, useEffect, useCallback } from "react";
import { getAuthHeaders } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";
import { useToast } from "@/hooks/use-toast";
import { Mail, Clock, Send, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface PendingInvite {
  id: string;
  email: string;
  status: string;
  invitedAt: string;
  expiresAt: string;
  daysSinceInvited: number;
}

export default function PendingCoachInvites() {
  const { toast } = useToast();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCoach, setIsCoach] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [sending, setSending] = useState(false);

  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/coaching/pending-invites"), {
        headers: getAuthHeaders(),
      });
      if (res.status === 403) {
        setIsCoach(false);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      setIsCoach(true);
      setInvites(data.invites || []);
    } catch {
      setIsCoach(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const sendInvite = async () => {
    if (!inviteEmail.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(apiUrl("/api/coaching/send-invite"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Failed to send invite");
      toast({ title: "Invite Sent", description: `Coaching invite sent to ${inviteEmail}` });
      setInviteEmail("");
      fetchInvites();
    } catch (err: any) {
      toast({ title: "Invite Failed", description: err?.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (loading || !isCoach) return null;

  return (
    <div className="bg-white/5 border border-white/20 rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Mail className="h-5 w-5 text-blue-400" />
          <div>
            <p className="text-white font-semibold text-sm">Invited — Awaiting Payment</p>
            <p className="text-white/50 text-xs">
              {invites.length === 0
                ? "No pending invites"
                : `${invites.length} invite${invites.length !== 1 ? "s" : ""} sent, awaiting signup`}
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-white/40" />
        ) : (
          <ChevronDown className="h-4 w-4 text-white/40" />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendInvite()}
              placeholder="client@email.com"
              className="flex-1 bg-black/30 border border-white/20 text-white placeholder:text-white/30 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-orange-400/60"
            />
            <button
              onClick={sendInvite}
              disabled={sending || !inviteEmail.trim()}
              className="rounded-full bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white px-4 py-2 text-sm font-semibold flex items-center gap-1.5 transition-all active:scale-[0.98]"
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Send Invite
            </button>
          </div>

          {invites.length > 0 ? (
            <div className="space-y-2">
              {invites.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between bg-black/20 border border-white/10 rounded-xl px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center">
                      <Mail className="h-3.5 w-3.5 text-blue-300" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{inv.email}</p>
                      <p className="text-white/40 text-xs flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Invited {inv.daysSinceInvited === 0 ? "today" : `${inv.daysSinceInvited}d ago`}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-400/20">
                    Awaiting signup
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white/30 text-sm text-center py-2">
              No pending invites. Enter an email above to invite a client.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
