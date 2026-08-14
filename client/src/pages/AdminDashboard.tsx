import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Search, User, ShieldAlert, LogOut, RefreshCw, Ban, CheckCircle, RotateCcw, KeyRound, ChefHat, ArrowRight, Award, Users, Download, Mail, Bug, Gift } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ENV = import.meta.env.MODE === "production" ? "PRODUCTION" : "DEVELOPMENT";
const ENV_COLOR = ENV === "PRODUCTION" ? "bg-red-600" : "bg-amber-500";

type AdminUser = {
  id: string;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  plan: string;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  subscriptionExpiresAt: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  role: string | null;
  isAdmin: boolean | null;
  isTester: boolean | null;
  isFounder: boolean | null;
  isProCare: boolean | null;
  procareTrainingCompleted: boolean | null;
  onboardingCompletedAt: string | null;
  safetyPinHash: string | null;
  safetyPinSetAt: string | null;
  createdAt: string | null;
  authTokenCreatedAt: string | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  medicalConditions: string[] | null;
  healthConditions: string[] | null;
  specialtyCondition: string | null;
  oncologySupportIntent: string | null;
  needsProfessionalFollowup: boolean | null;
  professionalRole: string | null;
  activeBoard: string | null;
  macrosDefined: boolean | null;
  entitlements: string[] | null;
  planLookupKey: string | null;
  signupSource: string | null;
};

function useAdminAction() {
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const act = useCallback(async (label: string, userId: string, path: string, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return;
    setLoading(`${userId}:${path}`);
    try {
      const res = await fetch(apiUrl(`/api/admin/${path}`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: `${label} — done`, description: data.note || undefined });
    } catch (e: any) {
      toast({ title: `${label} failed`, description: e.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  }, [toast]);

  return { act, loading };
}

function StatusPill({ value, truthy = true }: { value: unknown; truthy?: boolean }) {
  const ok = truthy ? !!value : !value;
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${ok ? "bg-green-600/30 text-green-300" : "bg-red-600/30 text-red-300"}`}>
      {String(value ?? "—")}
    </span>
  );
}

function UserDetail({ user, onAction }: { user: AdminUser; onAction: (label: string, path: string, confirm?: string) => void }) {
  const { act, loading } = useAdminAction();
  const run = (label: string, path: string, confirm?: string) => act(label, user.id, `users/${user.id}/${path}`, confirm);

  const actions = [
    {
      label: "Complete Onboarding",
      path: "complete-onboarding",
      icon: <CheckCircle className="h-4 w-4" />,
      confirm: `Mark onboarding complete for ${user.email}?`,
      color: "bg-green-700 hover:bg-green-600",
    },
    {
      label: "Reset Onboarding",
      path: "reset-onboarding",
      icon: <RotateCcw className="h-4 w-4" />,
      confirm: `Reset onboarding for ${user.email}? They will be sent back through onboarding.`,
      color: "bg-amber-700 hover:bg-amber-600",
    },
    {
      label: "Reset PIN",
      path: "reset-pin",
      icon: <KeyRound className="h-4 w-4" />,
      confirm: `Clear safety PIN for ${user.email}?`,
      color: "bg-amber-700 hover:bg-amber-600",
    },
    {
      label: "Force Logout",
      path: "force-logout",
      icon: <LogOut className="h-4 w-4" />,
      confirm: `Force logout all sessions for ${user.email}?`,
      color: "bg-orange-700 hover:bg-orange-600",
    },
    {
      label: "Refresh Subscription",
      path: "refresh-subscription",
      icon: <RefreshCw className="h-4 w-4" />,
      confirm: undefined,
      color: "bg-blue-700 hover:bg-blue-600",
    },
    {
      label: "Grant Founder",
      path: "grant-founder",
      icon: <CheckCircle className="h-4 w-4" />,
      confirm: `Grant permanent founder access to ${user.email}? Keep this list very small.`,
      color: "bg-purple-800 hover:bg-purple-700",
    },
    {
      label: "Revoke Founder",
      path: "revoke-founder",
      icon: <RotateCcw className="h-4 w-4" />,
      confirm: `Revoke founder access from ${user.email}?`,
      color: "bg-purple-900 hover:bg-purple-800",
    },
    {
      label: "Disable Account",
      path: "disable",
      icon: <Ban className="h-4 w-4" />,
      confirm: `DISABLE account for ${user.email}? They will be logged out immediately.`,
      color: "bg-red-800 hover:bg-red-700",
    },
    {
      label: "Re-enable Account",
      path: "enable",
      icon: <CheckCircle className="h-4 w-4" />,
      confirm: `Re-enable account for ${user.email}?`,
      color: "bg-green-800 hover:bg-green-700",
    },
    {
      label: "Send Setup Email",
      path: "send-password-reset",
      icon: <Mail className="h-4 w-4" />,
      confirm: `Send a password setup/reset email to ${user.email}? Use this when you created an account on their behalf and they need to set their own password.`,
      color: "bg-sky-800 hover:bg-sky-700",
    },
  ];

  const rows: [string, React.ReactNode][] = [
    ["ID", <span className="font-mono text-xs text-white/50">{user.id}</span>],
    ["Email", user.email],
    ["Username", user.username],
    ["Name", [user.firstName, user.lastName].filter(Boolean).join(" ") || "—"],
    ["Plan", user.plan],
    ["Subscription", user.subscriptionStatus ?? "—"],
    ["Sub Plan", user.subscriptionPlan ?? "—"],
    ["Expires", user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt).toLocaleDateString() : "—"],
    ["Stripe Customer", user.stripeCustomerId ?? "—"],
    ["Stripe Sub", user.stripeSubscriptionId ?? "—"],
    ["Role", user.role ?? "—"],
    ["Admin", <StatusPill value={user.isAdmin} />],
    ["Tester", <StatusPill value={user.isTester} />],
    ["Founder", <StatusPill value={user.isFounder} />],
    ["ProCare", <StatusPill value={user.isProCare} />],
    ["ProCare Training", <StatusPill value={user.procareTrainingCompleted} />],
    ["Onboarding", <StatusPill value={user.onboardingCompletedAt} />],
    ["Macros Defined", <StatusPill value={user.macrosDefined} />],
    ["Safety PIN Set", <StatusPill value={user.safetyPinHash} />],
    ["Active Board", user.activeBoard ?? "—"],
    ["Professional Role", user.professionalRole ?? "—"],
    ["Medical Conditions", (user.medicalConditions?.length ?? 0) > 0 ? user.medicalConditions!.join(", ") : "—"],
    ["Specialty Condition", user.specialtyCondition ?? "—"],
    ["Oncology Intent", user.oncologySupportIntent ?? "—"],
    ["Needs Followup", <StatusPill value={user.needsProfessionalFollowup} />],
    ["Entitlements", (user.entitlements?.length ?? 0) > 0 ? user.entitlements!.join(", ") : "none"],
    ["Plan Lookup Key", user.planLookupKey ?? "—"],
    ["Signup Source", user.signupSource ?? "—"],
    ["Trial Start", user.trialStartedAt ? new Date(user.trialStartedAt).toLocaleDateString() : "—"],
    ["Trial End", user.trialEndsAt ? new Date(user.trialEndsAt).toLocaleDateString() : "—"],
    ["Created", user.createdAt ? new Date(user.createdAt).toLocaleString() : "—"],
    ["Last Token", user.authTokenCreatedAt ? new Date(user.authTokenCreatedAt).toLocaleString() : "—"],
  ];

  return (
    <Card className="bg-black/40 border border-white/10 rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-lg flex items-center gap-2">
          <User className="h-5 w-5 text-orange-400" />
          {user.email}
        </CardTitle>
        <p className="text-xs text-white/40">@{user.username}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
          {rows.map(([label, val]) => (
            <div key={label} className="contents">
              <span className="text-xs text-white/40">{label}</span>
              <span className="text-xs text-white/80">{val}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-white/10 pt-4">
          <p className="text-xs text-white/30 mb-3 uppercase tracking-wide">Support Actions</p>
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => {
              const key = `users/${user.id}/${a.path}`;
              const busy = loading === `${user.id}:${key}`;
              return (
                <button
                  key={a.path}
                  onClick={() => run(a.label, a.path, a.confirm)}
                  disabled={!!loading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition disabled:opacity-50 ${a.color}`}
                >
                  {busy ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : a.icon}
                  {a.label}
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type GrandfatheredPro = {
  id: string;
  email: string;
  username: string;
  professionalRole: string | null;
  procareTrainingCompleted: boolean;
  certificationType: string;
  certCompletedAt: string | null;
};

function GrandfatherStatusPanel() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ count: number; professionals: GrandfatheredPro[] } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [runningMigration, setRunningMigration] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/admin/grandfather-migration-status"), {
        headers: getAuthHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setData({ count: json.count, professionals: json.professionals });
    } catch (e: any) {
      toast({ title: "Failed to load grandfather status", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const downloadCSV = () => {
    if (!data || data.professionals.length === 0) return;
    const headers = ["email", "username", "role", "cert_type", "cert_completed_at"];
    const rows = data.professionals.map((p) => [
      p.email,
      p.username,
      p.professionalRole ?? "",
      p.certificationType,
      p.certCompletedAt ? new Date(p.certCompletedAt).toISOString() : "",
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `grandfathered-professionals-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const runMigration = async () => {
    if (!window.confirm("Re-run the grandfather migration? This is safe to run multiple times — it only updates professionals who don't yet have procare_training_completed=true.")) return;
    setRunningMigration(true);
    try {
      const res = await fetch(apiUrl("/api/admin/run-grandfather-migration"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      toast({ title: "Migration complete", description: json.message });
      await load();
    } catch (e: any) {
      toast({ title: "Migration failed", description: e.message, variant: "destructive" });
    } finally {
      setRunningMigration(false);
    }
  };

  return (
    <Card className="bg-black/40 border border-white/10 rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-orange-400" />
          Phase 2 Grandfather Migration Status
        </CardTitle>
        <p className="text-xs text-white/40 mt-0.5">
          Professionals with <code className="text-orange-300/80">procare_training_completed=true</code> via the pre-July 2026 grandfather path
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <p className="text-xs text-white/40">Loading…</p>}

        {!loading && data && (
          <>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-orange-400">{data.count}</span>
              <span className="text-sm text-white/60">grandfathered professional{data.count !== 1 ? "s" : ""}</span>
              <div className="ml-auto flex items-center gap-2">
                {data.count > 0 && (
                  <button
                    onClick={downloadCSV}
                    className="text-xs text-white/50 bg-white/10 hover:bg-white/20 transition flex items-center gap-1 px-2 py-1 rounded-md"
                  >
                    <Download className="h-3 w-3" /> Download CSV
                  </button>
                )}
                <button
                  onClick={load}
                  className="text-xs text-white/30 hover:text-white/60 transition flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" /> Refresh
                </button>
              </div>
            </div>

            {data.count > 0 && (
              <>
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="text-xs text-orange-400 underline"
                >
                  {expanded ? "Hide list" : `Show ${data.count} professional${data.count !== 1 ? "s" : ""}`}
                </button>

                {expanded && (
                  <div className="mt-2 rounded-lg border border-white/10 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-white/5 text-white/40 text-left">
                          <th className="px-3 py-2 font-medium">Email</th>
                          <th className="px-3 py-2 font-medium">Role</th>
                          <th className="px-3 py-2 font-medium">Cert Type</th>
                          <th className="px-3 py-2 font-medium">Cert Completed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.professionals.map((p) => (
                          <tr key={p.id} className="border-t border-white/5 hover:bg-white/5 transition">
                            <td className="px-3 py-2 text-white/80">{p.email}</td>
                            <td className="px-3 py-2 text-white/60">{p.professionalRole ?? "—"}</td>
                            <td className="px-3 py-2 text-white/60">{p.certificationType}</td>
                            <td className="px-3 py-2 text-white/50">
                              {p.certCompletedAt ? new Date(p.certCompletedAt).toLocaleDateString() : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            <div className="border-t border-white/10 pt-3">
              <button
                onClick={runMigration}
                disabled={runningMigration}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-orange-700 hover:bg-orange-600 disabled:opacity-50 transition"
              >
                {runningMigration ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                Re-run Migration (idempotent)
              </button>
              <p className="text-xs text-white/30 mt-1.5">Safe to re-run. Only affects professionals not yet grandfathered.</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

type TrialGrantResult = {
  success: boolean;
  grantedTo: string;
  isTrialActive: boolean;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  daysRemaining: number;
  trialSource: string | null;
  trialTier: string | null;
};

function GrantTrialPanel() {
  const { toast } = useToast();
  const [emailQuery, setEmailQuery] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [foundUser, setFoundUser] = useState<AdminUser | null>(null);
  const [durationDays, setDurationDays] = useState(30);
  const [trialSource, setTrialSource] = useState<"admin_grant" | "clinic_grant" | "promotion">("admin_grant");
  const [notes, setNotes] = useState("");
  const [granting, setGranting] = useState(false);
  const [grantResult, setGrantResult] = useState<TrialGrantResult | null>(null);

  const lookupUser = async () => {
    const q = emailQuery.trim();
    if (!q || q.length < 2) return;
    setLookingUp(true);
    setFoundUser(null);
    setGrantResult(null);
    try {
      const res = await fetch(apiUrl(`/api/admin/users/search?q=${encodeURIComponent(q)}`), {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      const users: AdminUser[] = data.users || [];
      if (users.length === 0) {
        toast({ title: "No user found", description: `No account matched "${q}"`, variant: "destructive" });
      } else if (users.length === 1) {
        setFoundUser(users[0]);
      } else {
        // Pick the closest exact email match first, then first result
        const exact = users.find((u) => u.email.toLowerCase() === q.toLowerCase());
        setFoundUser(exact ?? users[0]);
        if (!exact) {
          toast({ title: "Multiple matches", description: `Showing closest match. Refine your search if needed.` });
        }
      }
    } catch (e: any) {
      toast({ title: "Lookup failed", description: e.message, variant: "destructive" });
    } finally {
      setLookingUp(false);
    }
  };

  const grantTrial = async () => {
    if (!foundUser) return;
    if (!window.confirm(`Grant a ${durationDays}-day trial to ${foundUser.email}?`)) return;
    setGranting(true);
    setGrantResult(null);
    try {
      const res = await fetch(apiUrl("/api/trial/admin/grant"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          userId: foundUser.id,
          durationDays,
          trialSource,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Grant failed");
      setGrantResult(data as TrialGrantResult);
      toast({ title: "Trial granted", description: `${foundUser.email} now has access until ${data.trialEndsAt ? new Date(data.trialEndsAt).toLocaleDateString() : "—"}` });
    } catch (e: any) {
      toast({ title: "Grant failed", description: e.message, variant: "destructive" });
    } finally {
      setGranting(false);
    }
  };

  const isTrialCurrentlyActive =
    foundUser?.trialEndsAt &&
    !foundUser?.planLookupKey &&
    new Date(foundUser.trialEndsAt) > new Date();

  const trialDaysRemaining = isTrialCurrentlyActive
    ? Math.ceil((new Date(foundUser!.trialEndsAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <Card className="bg-black/40 border border-white/10 rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base flex items-center gap-2">
          <Gift className="h-4 w-4 text-orange-400" />
          Grant Trial Access
        </CardTitle>
        <p className="text-xs text-white/40 mt-0.5">
          Look up a user by email, verify their current trial status, then grant an extended trial.
          All grants are audit-logged.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Email lookup */}
        <div className="space-y-2">
          <label className="text-xs text-white/40 uppercase tracking-wide">User email</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              <input
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50"
                placeholder="user@example.com"
                value={emailQuery}
                onChange={(e) => { setEmailQuery(e.target.value); setFoundUser(null); setGrantResult(null); }}
                onKeyDown={(e) => e.key === "Enter" && lookupUser()}
              />
            </div>
            <button
              onClick={lookupUser}
              disabled={lookingUp || !emailQuery.trim()}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition"
            >
              {lookingUp ? "Looking up…" : "Look up"}
            </button>
          </div>
        </div>

        {/* Found user info + current trial status */}
        {foundUser && !grantResult && (
          <div className="rounded-lg bg-white/5 border border-white/10 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-orange-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-sm text-white font-medium truncate">{foundUser.email}</p>
                <p className="text-xs text-white/40">@{foundUser.username} · {foundUser.plan}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              <span className="text-xs text-white/40">Trial status</span>
              <span className={`text-xs font-medium ${isTrialCurrentlyActive ? "text-green-400" : "text-white/50"}`}>
                {isTrialCurrentlyActive ? `Active — ${trialDaysRemaining}d remaining` : "No active trial"}
              </span>

              {foundUser.trialStartedAt && (
                <>
                  <span className="text-xs text-white/40">Trial started</span>
                  <span className="text-xs text-white/70">{new Date(foundUser.trialStartedAt).toLocaleDateString()}</span>
                </>
              )}

              {foundUser.trialEndsAt && (
                <>
                  <span className="text-xs text-white/40">Trial ends</span>
                  <span className="text-xs text-white/70">{new Date(foundUser.trialEndsAt).toLocaleDateString()}</span>
                </>
              )}

              {foundUser.planLookupKey && (
                <>
                  <span className="text-xs text-white/40">Paid plan</span>
                  <span className="text-xs text-amber-400">{foundUser.planLookupKey} (trial would be superseded)</span>
                </>
              )}
            </div>

            {/* Grant form */}
            <div className="border-t border-white/10 pt-3 space-y-3">
              <p className="text-xs text-white/30 uppercase tracking-wide">Grant options</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-white/40">Duration (days)</label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={durationDays}
                    onChange={(e) => setDurationDays(Math.max(1, Math.min(365, parseInt(e.target.value) || 30)))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-white/40">Source</label>
                  <select
                    value={trialSource}
                    onChange={(e) => setTrialSource(e.target.value as typeof trialSource)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50"
                  >
                    <option value="admin_grant">admin_grant</option>
                    <option value="clinic_grant">clinic_grant</option>
                    <option value="promotion">promotion</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-white/40">Notes (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Amy clinic pilot, Feb 2026"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-white/30">
                  Grants access through {new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </p>
                <button
                  onClick={grantTrial}
                  disabled={granting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition"
                >
                  {granting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Gift className="h-3.5 w-3.5" />}
                  {granting ? "Granting…" : "Grant Trial"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation after successful grant */}
        {grantResult && (
          <div className="rounded-lg bg-green-900/20 border border-green-500/30 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
              <p className="text-sm font-medium text-green-300">Trial granted successfully</p>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mt-2">
              <span className="text-xs text-white/40">Expires</span>
              <span className="text-xs text-white/80">
                {grantResult.trialEndsAt ? new Date(grantResult.trialEndsAt).toLocaleDateString() : "—"}
              </span>
              <span className="text-xs text-white/40">Days remaining</span>
              <span className="text-xs text-white/80">{grantResult.daysRemaining}</span>
              <span className="text-xs text-white/40">Tier</span>
              <span className="text-xs text-white/80">{grantResult.trialTier ?? "—"}</span>
              <span className="text-xs text-white/40">Source</span>
              <span className="text-xs text-white/80">{grantResult.trialSource ?? "—"}</span>
            </div>
            <button
              onClick={() => { setGrantResult(null); setFoundUser(null); setEmailQuery(""); setNotes(""); setDurationDays(30); setTrialSource("admin_grant"); }}
              className="text-xs text-orange-400 underline mt-2 block"
            >
              Grant another trial
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [searching, setSearching] = useState(false);
  const [newBugCount, setNewBugCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchBugCount = () => {
      fetch(apiUrl("/api/bug-reports"), { headers: getAuthHeaders() })
        .then((r) => r.ok ? r.json() : Promise.reject())
        .then((data: { status: string }[]) => {
          setNewBugCount(data.filter((r) => r.status === "new").length);
        })
        .catch(() => { /* silent — badge just won't show */ });
    };

    fetchBugCount();
    const interval = setInterval(fetchBugCount, 60_000);

    // Re-fetch immediately when a report status is changed on the bug reports page
    window.addEventListener("bug-reports-updated", fetchBugCount);

    return () => {
      clearInterval(interval);
      window.removeEventListener("bug-reports-updated", fetchBugCount);
    };
  }, []);

  useEffect(() => {
    const base = "Admin Dashboard";
    document.title = newBugCount && newBugCount > 0 ? `(${newBugCount}) ${base}` : base;
    return () => { document.title = base; };
  }, [newBugCount]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <p>Not authenticated.</p>
      </div>
    );
  }

  if (!user.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center space-y-3">
          <ShieldAlert className="h-12 w-12 text-red-500 mx-auto" />
          <p className="text-lg font-semibold">Access Denied</p>
          <p className="text-white/50 text-sm">This area is restricted to admins.</p>
          <button onClick={() => setLocation("/")} className="text-orange-400 text-sm underline">Go home</button>
        </div>
      </div>
    );
  }

  const search = async () => {
    if (!query.trim() || query.length < 2) return;
    setSearching(true);
    setSelected(null);
    try {
      const res = await fetch(apiUrl(`/api/admin/users/search?q=${encodeURIComponent(query)}`), {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResults(data.users || []);
      if ((data.users || []).length === 0) toast({ title: "No users found", description: `No match for "${query}"` });
    } catch (e: any) {
      toast({ title: "Search failed", description: e.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-950 to-black text-white">
      {/* Environment banner */}
      <div className={`w-full py-1 text-center text-xs font-bold tracking-widest ${ENV_COLOR} text-white`}>
        {ENV} — ADMIN CONSOLE
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="h-6 w-6 text-orange-400" />
              Admin Dashboard
            </h1>
            <p className="text-white/40 text-sm mt-1">Signed in as {user.email}</p>
          </div>
          <button
            onClick={() => setLocation("/")}
            className="text-sm text-white/40 hover:text-white/70 transition"
          >
            ← Back to app
          </button>
        </div>

        {/* Chef Kitchens link */}
        <Card
          className="bg-black/40 border border-orange-500/20 rounded-2xl cursor-pointer hover:border-orange-500/40 transition-colors"
          onClick={() => setLocation("/admin/chef-kitchens")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/20 flex-shrink-0">
              <ChefHat className="h-5 w-5 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Chef Kitchens</p>
              <p className="text-xs text-white/40 mt-0.5">Create and manage branded chef kitchen infrastructure</p>
            </div>
            <ArrowRight className="h-4 w-4 text-orange-400 flex-shrink-0" />
          </CardContent>
        </Card>

        {/* Certifications link */}
        <Card
          className="bg-black/40 border border-orange-500/20 rounded-2xl cursor-pointer hover:border-orange-500/40 transition-colors"
          onClick={() => setLocation("/admin/certifications")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/20 flex-shrink-0">
              <Award className="h-5 w-5 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Certifications</p>
              <p className="text-xs text-white/40 mt-0.5">Manage cert modules, quiz questions, progress, and update announcements</p>
            </div>
            <ArrowRight className="h-4 w-4 text-orange-400 flex-shrink-0" />
          </CardContent>
        </Card>

        {/* Bug Reports link */}
        <Card
          className="bg-black/40 border border-orange-500/20 rounded-2xl cursor-pointer hover:border-orange-500/40 transition-colors"
          onClick={() => setLocation("/admin/bug-reports")}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/20 flex-shrink-0">
              <Bug className="h-5 w-5 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white flex items-center gap-2">
                Bug Reports
                {newBugCount != null && newBugCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold leading-none">
                    {newBugCount}
                  </span>
                )}
              </p>
              <p className="text-xs text-white/40 mt-0.5">Review and triage user-submitted bug reports</p>
            </div>
            <ArrowRight className="h-4 w-4 text-orange-400 flex-shrink-0" />
          </CardContent>
        </Card>

        {/* Grant Trial Access */}
        <GrantTrialPanel />

        {/* Grandfather Migration Status */}
        <GrandfatherStatusPanel />

        {/* Search */}
        <Card className="bg-black/40 border border-white/10 rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-base">User Search</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-orange-500/50"
                  placeholder="Search by email or username…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search()}
                />
              </div>
              <button
                onClick={search}
                disabled={searching}
                className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition"
              >
                {searching ? "Searching…" : "Search"}
              </button>
            </div>

            {results.length > 0 && !selected && (
              <div className="mt-3 space-y-1">
                {results.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelected(u)}
                    className="w-full text-left px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm text-white font-medium">{u.email}</p>
                      <p className="text-xs text-white/40">@{u.username} · {u.plan} · {u.subscriptionStatus ?? "—"}</p>
                    </div>
                    <div className="flex gap-1.5">
                      {u.isAdmin && <span className="px-1.5 py-0.5 bg-orange-600/30 text-orange-300 rounded text-xs">admin</span>}
                      {u.onboardingCompletedAt ? null : <span className="px-1.5 py-0.5 bg-red-600/30 text-red-300 rounded text-xs">no onboarding</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selected user */}
        {selected && (
          <div className="space-y-3">
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-white/40 hover:text-white/70 transition"
            >
              ← Back to results
            </button>
            <UserDetail user={selected} onAction={() => {}} />
          </div>
        )}
      </div>
    </div>
  );
}
