import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Search, User, ShieldAlert, LogOut, RefreshCw, Ban, CheckCircle, RotateCcw, KeyRound, ChefHat, ArrowRight } from "lucide-react";
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

export default function AdminDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [searching, setSearching] = useState(false);

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
