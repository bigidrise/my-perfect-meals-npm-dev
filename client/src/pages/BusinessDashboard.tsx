import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/apiRequest";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  UserPlus,
  Mail,
  Trash2,
  RefreshCw,
  ChevronLeft,
  Building2,
  Pencil,
  Check,
  X,
  Loader2,
} from "lucide-react";

const ROLE_OPTIONS = [
  { value: "coach", label: "Coach" },
  { value: "trainer", label: "Trainer" },
  { value: "physician", label: "Physician" },
  { value: "staff", label: "Staff" },
];

interface BusinessData {
  business: {
    id: string;
    name: string;
    seatLimit: number;
    status: string;
    plan: string;
  };
  members: {
    id: string;
    userId: string;
    role: string;
    status: string;
    joinedAt: string;
    name?: string;
    email?: string;
  }[];
  invitations: {
    id: string;
    email: string;
    role: string;
    token: string;
    expiresAt: string;
  }[];
  usedSeats: number;
  availableSeats: number;
}

export default function BusinessDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [data, setData] = useState<BusinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("staff");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [cancellingToken, setCancellingToken] = useState<string | null>(null);
  const [resendingToken, setResendingToken] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/business/mine", {
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (res.status === 404) {
        setData(null);
        setLoading(false);
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      toast({ title: "Error", description: "Could not load business data.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInvite = async () => {
    if (!inviteEmail.includes("@")) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    setInviteLoading(true);
    try {
      const res = await fetch("/api/business/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast({ title: "Invite failed", description: json.error, variant: "destructive" });
        return;
      }
      toast({ title: "Invitation sent!", description: `${inviteEmail} will receive an email with a link to join.` });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("staff");
      fetchData();
    } catch {
      toast({ title: "Error", description: "Could not send invitation.", variant: "destructive" });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setRemovingId(memberId);
    try {
      const res = await fetch(`/api/business/members/${memberId}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: "Member removed", description: "They've been removed from your team." });
        fetchData();
      } else {
        const json = await res.json();
        toast({ title: "Error", description: json.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Could not remove member.", variant: "destructive" });
    } finally {
      setRemovingId(null);
    }
  };

  const handleCancelInvite = async (token: string) => {
    setCancellingToken(token);
    try {
      const res = await fetch(`/api/business/invitations/${token}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: "Invite cancelled" });
        fetchData();
      }
    } catch {
      toast({ title: "Error", description: "Could not cancel invite.", variant: "destructive" });
    } finally {
      setCancellingToken(null);
    }
  };

  const handleResendInvite = async (token: string) => {
    setResendingToken(token);
    try {
      const res = await fetch(`/api/business/invitations/${token}/resend`, {
        method: "POST",
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (res.ok) {
        toast({ title: "Invite resent!", description: "A fresh email has been sent." });
      }
    } catch {
      toast({ title: "Error", description: "Could not resend invite.", variant: "destructive" });
    } finally {
      setResendingToken(null);
    }
  };

  const handleSaveName = async () => {
    if (nameInput.trim().length < 2) return;
    setSavingName(true);
    try {
      const res = await fetch("/api/business/name", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ name: nameInput.trim() }),
      });
      if (res.ok) {
        toast({ title: "Business name updated" });
        setEditingName(false);
        fetchData();
      }
    } catch {
      toast({ title: "Error", description: "Could not update name.", variant: "destructive" });
    } finally {
      setSavingName(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-blue-900/40 to-black/80 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-blue-900/40 to-black/80 flex flex-col items-center justify-center px-4 text-center">
        <Building2 className="w-14 h-14 text-blue-400 mb-4" />
        <h2 className="text-white text-xl font-bold mb-2">No Business Account Found</h2>
        <p className="text-white/60 text-sm mb-6 max-w-xs">
          A business account is created automatically when you purchase a Clinical Business plan.
        </p>
        <button
          className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
          onClick={() => setLocation("/pricing")}
        >
          View Plans
        </button>
      </div>
    );
  }

  const { business, members, invitations, usedSeats, availableSeats } = data;
  const seatsFull = availableSeats <= 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-blue-900/40 to-black/80 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-black/60 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <button onClick={() => setLocation("/dashboard")} className="text-white/60 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-white font-bold text-base leading-tight">Business Dashboard</h1>
          <p className="text-white/50 text-xs">Clinical Business Plan</p>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4 max-w-2xl mx-auto">

        {/* Business Name Card */}
        <Card className="bg-white/5 border border-blue-500/30 text-white p-4">
          <div className="flex items-center justify-between">
            {editingName ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm flex-1 outline-none focus:border-blue-400"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                />
                <button
                  className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
                  onClick={handleSaveName}
                  disabled={savingName}
                >
                  {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
                  onClick={() => setEditingName(false)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-blue-400 flex-shrink-0" />
                  <span className="font-semibold text-sm">{business.name}</span>
                </div>
                <button
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 hover:text-white transition-colors"
                  onClick={() => { setNameInput(business.name); setEditingName(true); }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </Card>

        {/* Seat Counter */}
        <Card className="bg-white/5 border border-blue-500/30 text-white p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              <span className="font-semibold text-sm">Team Seats</span>
            </div>
            <span className={`text-lg font-bold ${seatsFull ? "text-red-400" : "text-blue-300"}`}>
              {usedSeats} / {business.seatLimit}
            </span>
          </div>
          <div className="w-full bg-white/10 rounded-full h-2 mb-3">
            <div
              className={`h-2 rounded-full transition-all ${seatsFull ? "bg-red-500" : "bg-blue-500"}`}
              style={{ width: `${Math.min((usedSeats / business.seatLimit) * 100, 100)}%` }}
            />
          </div>
          {seatsFull ? (
            <p className="text-red-400 text-xs">All seats are in use. Remove a member to invite someone new.</p>
          ) : (
            <p className="text-white/50 text-xs">{availableSeats} seat{availableSeats !== 1 ? "s" : ""} available</p>
          )}
        </Card>

        {/* Invite Button */}
        <button
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={() => setInviteOpen(true)}
          disabled={seatsFull}
        >
          <UserPlus className="w-4 h-4" />
          {seatsFull ? "No Seats Available" : "Invite a Team Member"}
        </button>

        {/* Active Members */}
        <div>
          <h2 className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-2 px-1">
            Active Members ({members.length})
          </h2>
          <div className="space-y-2">
            {members.map((m) => (
              <Card key={m.id} className="bg-white/5 border border-white/10 text-white p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.name || m.email || "Unknown"}</p>
                  <p className="text-white/50 text-xs truncate">{m.email || ""}</p>
                </div>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  <Badge className={`text-xs border-0 ${m.role === "owner" ? "bg-blue-600/80 text-white" : "bg-white/10 text-white/70"}`}>
                    {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                  </Badge>
                  {m.role !== "owner" && (
                    <button
                      className="p-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 transition-colors disabled:opacity-40"
                      onClick={() => handleRemoveMember(m.id)}
                      disabled={removingId === m.id}
                      title="Remove member"
                    >
                      {removingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </Card>
            ))}
            {members.length === 0 && (
              <p className="text-white/40 text-sm text-center py-4">No members yet. Invite someone to get started.</p>
            )}
          </div>
        </div>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <div>
            <h2 className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-2 px-1">
              Pending Invitations ({invitations.length})
            </h2>
            <div className="space-y-2">
              {invitations.map((inv) => (
                <Card key={inv.id} className="bg-white/5 border border-white/10 text-white p-3 flex items-center justify-between">
                  <div className="min-w-0 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-white/40 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm truncate">{inv.email}</p>
                      <p className="text-white/40 text-xs">
                        {inv.role.charAt(0).toUpperCase() + inv.role.slice(1)} · Expires{" "}
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                    <button
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/60 hover:text-white transition-colors disabled:opacity-40"
                      onClick={() => handleResendInvite(inv.token)}
                      disabled={resendingToken === inv.token}
                      title="Resend invite"
                    >
                      {resendingToken === inv.token ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      className="p-1.5 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 transition-colors disabled:opacity-40"
                      onClick={() => handleCancelInvite(inv.token)}
                      disabled={cancellingToken === inv.token}
                      title="Cancel invite"
                    >
                      {cancellingToken === inv.token ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Invite Modal */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="bg-gray-900 border border-blue-500/30 text-white max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Invite Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-white/70 text-xs font-semibold uppercase tracking-wide block mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-blue-400 placeholder-white/30"
                placeholder="coach@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInvite()}
              />
            </div>
            <div>
              <label className="text-white/70 text-xs font-semibold uppercase tracking-wide block mb-1.5">
                Role
              </label>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((r) => (
                  <button
                    key={r.value}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      inviteRole === r.value
                        ? "bg-blue-600 text-white"
                        : "bg-white/10 text-white/70 hover:bg-white/15"
                    }`}
                    onClick={() => setInviteRole(r.value)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              onClick={handleInvite}
              disabled={inviteLoading}
            >
              {inviteLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : <><Mail className="w-4 h-4" /> Send Invitation</>}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
