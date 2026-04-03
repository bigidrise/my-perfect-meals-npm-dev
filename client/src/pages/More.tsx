import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { GlassCard, GlassCardContent } from "@/components/glass/GlassCard";
import { Crown, Lock, Stethoscope, Dumbbell, LogOut, KeyRound, ClipboardEdit, CheckCircle2, Heart, Briefcase, UserPlus, X, Link2Off, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { getAuthHeaders } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";
import { WorkspaceChooser } from "@/components/WorkspaceChooser";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import ClientLegalModal from "@/components/pro/ClientLegalModal";

interface ProCareFeature {
  title: string;
  description: string;
  icon: any;
  route: string;
  testId: string;
  roleKey: "physician" | "trainer" | null;
}

type ConnectedResult = {
  member: any;
  studio: { studioId: string; studioName: string; membershipId: string } | null;
};

type ConnectionStatus = {
  connected: boolean;
  provider?: {
    userId: string;
    name: string;
    role: string;
    studioName: string | null;
    studioId: string | null;
  };
};

export default function MorePage() {
  const [, setLocation] = useLocation();
  const { user, refreshUser } = useAuth();
  const isDesktop = useIsDesktop();
  const isAdmin = user?.role === "admin";
  const userRole = user?.professionalRole || null;

  const [accessCode, setAccessCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedResult, setConnectedResult] = useState<ConnectedResult | null>(null);
  const [showWorkspaceChooser, setShowWorkspaceChooser] = useState(false);
  const [showProviderModal, setShowProviderModal] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const isProCareClient = !!user?.isProCare;
  const [showClientLegalModal, setShowClientLegalModal] = useState(false);
  const [pendingLegalFlow, setPendingLegalFlow] = useState<"client" | "patient_physician">("client");

  useEffect(() => {
    document.title = "More | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // Fetch real-time connection status from server
  useEffect(() => {
    async function fetchConnectionStatus() {
      try {
        const data = await apiRequest("/api/pro/connection-status");
        setConnectionStatus(data);
      } catch {
        // Non-fatal — fall back to isProCare flag from user object
        setConnectionStatus({ connected: isProCareClient });
      }
    }
    fetchConnectionStatus();
  }, [isProCareClient]);

  async function disconnectFromProvider() {
    try {
      setDisconnecting(true);
      await apiRequest("/api/pro/disconnect-self", { method: "POST" });
      setShowDisconnectConfirm(false);
      setConnectionStatus({ connected: false });
      await refreshUser();
    } catch (e: any) {
      alert("Failed to disconnect. Please try again.");
    } finally {
      setDisconnecting(false);
    }
  }

  const proCareFeatures: ProCareFeature[] = [
    {
      title: "Physicians Clinic",
      description: "Medical oversight, guardrails, and clinical nutrition tools",
      icon: Stethoscope,
      route: "/care-team/physician",
      testId: "card-procare-physician",
      roleKey: "physician",
    },
    {
      title: "Trainers Studio",
      description: "Coaching, personalization, and performance meal planning",
      icon: Dumbbell,
      route: "/care-team/trainer",
      testId: "card-procare-trainer",
      roleKey: "trainer",
    },
    // {
    //   title: "Supplement Hub",
    //   description: "Evidence-based supplement guidance and trusted partners",
    //   icon: Crown,
    //   route: "/supplement-hub",
    //   testId: "card-supplement-hub",
    //   roleKey: null,
    // },
  ];

  const isFeatureLocked = (feature: ProCareFeature) => {
    if (isAdmin) return false;
    if (feature.roleKey === null) return false;
    return feature.roleKey !== userRole;
  };

  const handleCardClick = (feature: ProCareFeature) => {
    if (isFeatureLocked(feature)) return;
    setLocation(feature.route);
  };

  async function connectWithCode() {
    setError(null);
    setConnectedResult(null);
    if (!accessCode.trim()) {
      setError("Enter your provider code.");
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(apiUrl("/api/care-team/connect"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ code: accessCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.code === "LEGAL_REACCEPT_REQUIRED") {
          setPendingLegalFlow(data.flow === "patient_physician" ? "patient_physician" : "client");
          setShowClientLegalModal(true);
        } else {
          setError(data?.error || "Invalid or expired provider code.");
        }
        return;
      }
      setAccessCode("");
      setConnectedResult(data);
      await refreshUser();
    } catch (e: any) {
      setError(e?.message || "Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleClientLegalAccepted() {
    setShowClientLegalModal(false);
    await connectWithCode();
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2b2b2b] pb-20 flex flex-col"
    >
      {!isDesktop && (
        <div
          className="fixed top-0 left-0 right-0 z-40 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
            <div className="px-6 py-3 flex items-center gap-3">
            <Crown className="h-6 w-6 text-orange-500" />
            <h1 className="text-lg font-bold text-white flex-1">More</h1>
            
          </div>
        </div>
      )}

      <div
        className="flex-1 px-4 py-8"
        style={{ paddingTop: isDesktop ? "0" : "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        <div className="max-w-2xl mx-auto space-y-4">
          {/* Hero Image Section */}
          <div className="relative h-48 rounded-xl overflow-hidden">
            <img 
              src="/images/procare-hero.png" 
              alt="Professional coaching"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src =
                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%238b5cf6;stop-opacity:0.3' /%3E%3Cstop offset='100%25' style='stop-color:%23ec4899;stop-opacity:0.3' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='400' height='200' fill='url(%23g)'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='white' font-size='24' font-family='sans-serif' dy='.3em'%3EProCare%3C/text%3E%3C/svg%3E";
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <h2 className="text-2xl font-bold text-white mb-1"></h2>
              <p className="text-white/90 text-sm">
                Empower your coaching practice with precision macro planning.
              </p>
            </div>
          </div>

          

          {/* Switch to Workspace — only for professionals */}
          {(userRole === "trainer" || userRole === "physician") && (
            <Card
              className="cursor-pointer active:scale-[0.98] bg-black/30 backdrop-blur-lg border border-orange-500/30 transition-all duration-300 rounded-xl shadow-md relative overflow-hidden"
              onClick={() => {
                setShowWorkspaceChooser(true);
              }}
              data-testid="card-switch-workspace"
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/20">
                    <Briefcase className="h-5 w-5 text-orange-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white">
                      Switch Workspace
                    </h3>
                    <p className="text-xs text-white/70">Go to Workspace Chooser</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Workspace Chooser Overlay */}
          {showWorkspaceChooser && (
            <WorkspaceChooser
              onChoose={(choice: "personal" | "workspace") => {
                setShowWorkspaceChooser(false);
                if (choice === "workspace") {
                  localStorage.setItem("mpm_active_space", "workspace");
                  const workspaceRoute = userRole === "physician" ? "/care-team/physician" : "/care-team/trainer";
                  setLocation(workspaceRoute);
                } else {
                  localStorage.setItem("mpm_active_space", "personal");
                  sessionStorage.removeItem("mpm.welcomeGateDone");
                  if (!user?.onboardingCompletedAt) {
                    setLocation("/consumer-welcome");
                  } else {
                    setLocation("/");
                  }
                }
              }}
            />
          )}

          {/* Become a Provider — only for users who are NOT already providers */}
          {!userRole && (
            <Card
              className="cursor-pointer active:scale-[0.98] bg-black/30 backdrop-blur-lg border border-blue-500/30 transition-all duration-300 rounded-xl shadow-md relative overflow-hidden"
              onClick={() => setShowProviderModal(true)}
              data-testid="card-become-provider"
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <UserPlus className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white">Become a Provider</h3>
                    <p className="text-xs text-white/70">Apply to work with clients inside My Perfect Meals</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Saved Meals / Favorites */}
          <Card
            className="cursor-pointer active:scale-[0.98] bg-black/30 backdrop-blur-lg border border-red-500/20 transition-all duration-300 rounded-xl shadow-md relative overflow-hidden"
            onClick={() => setLocation("/saved-meals")}
            data-testid="card-saved-meals"
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <Heart className="h-5 w-5 text-red-400" fill="currentColor" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white">Favorites</h3>
                  <p className="text-xs text-white/70">Your saved meals — tap to view and reuse</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ProCare Features - Vertical Stack */}
          <div className="flex flex-col gap-3">
            {/* 1. Professional Studios — HIDDEN: professionals must use workspace chooser to enter clinics */}
            {false && proCareFeatures.filter(f => f.roleKey !== null).map((feature) => {
              const Icon = feature.icon;
              const isLocked = isFeatureLocked(feature);
              const lockedLabel = feature.roleKey === "physician"
                ? "Physician ProCare is available to licensed physicians."
                : "Trainer ProCare is available to certified trainers and coaches.";

              return (
                <Card
                  key={feature.testId}
                  className={`transition-all duration-300 rounded-xl shadow-md relative overflow-hidden ${
                    isLocked
                      ? "bg-black/20 backdrop-blur-lg border border-white/5 opacity-60 cursor-default"
                      : "cursor-pointer active:scale-[0.98] bg-black/30 backdrop-blur-lg border border-white/10"
                  }`}
                  onClick={() => handleCardClick(feature)}
                  data-testid={feature.testId}
                >
                  <CardContent className="p-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 flex-shrink-0 ${isLocked ? "text-white/30" : "text-orange-500"}`} />
                        <h3 className={`text-sm font-semibold flex-1 ${isLocked ? "text-white/40" : "text-white"}`}>
                          {feature.title}
                        </h3>
                        {isLocked && (
                          <Lock className="h-4 w-4 text-white/40 shrink-0" />
                        )}
                      </div>
                      <p className={`text-xs ml-6 ${isLocked ? "text-white/30" : "text-white/80"}`}>
                        {isLocked ? lockedLabel : feature.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* 2. Provider Connection Card — context-aware */}
            {connectionStatus?.connected && connectionStatus.provider ? (
              /* ── CONNECTED STATE ── */
              <GlassCard className="border-2 border-green-500/40">
                <GlassCardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-green-400" />
                    <h2 className="text-xl font-bold text-white">ProCare Connected</h2>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-1">
                    <p className="text-sm font-semibold text-white">{connectionStatus.provider.name}</p>
                    <p className="text-xs text-white/60 capitalize">
                      {connectionStatus.provider.role}
                      {connectionStatus.provider.studioName ? ` · ${connectionStatus.provider.studioName}` : ""}
                    </p>
                  </div>
                  <p className="text-xs text-white/50">
                    Your provider can view and manage your nutrition plan based on the permissions you've set.
                    You can disconnect at any time — reconnecting requires a new access code from your provider.
                  </p>
                  <Button
                    variant="destructive"
                    className="w-full bg-red-700/80 hover:bg-red-700 text-white"
                    onClick={() => setShowDisconnectConfirm(true)}
                    data-testid="button-disconnect-provider"
                  >
                    <Link2Off className="h-4 w-4 mr-2" />
                    Disconnect from {connectionStatus.provider.name}
                  </Button>
                </GlassCardContent>
              </GlassCard>
            ) : (
              /* ── NOT CONNECTED STATE ── */
              <GlassCard className="border-2 border-orange-500/40">
                <GlassCardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-orange-500" />
                    <h2 className="text-xl font-bold text-white">
                      Connect With Your Provider
                    </h2>
                  </div>
                  <p className="text-sm text-white/70">
                    Use your provider's access code to link your account with your
                    coach, trainer, or physician through the ProCare system.
                  </p>
                  <div>
                    <Label className="text-white/80">Provider Access Code</Label>
                    <Input
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      placeholder="Provider code (given by your coach or physician)"
                      className="bg-black/40 text-white border-white/20 placeholder:text-white/40"
                      data-testid="input-careteam-code"
                    />
                  </div>
                  {error && (
                    <div className="rounded-xl border border-red-500/50 bg-red-900/30 text-red-100 p-3">
                      {error}
                    </div>
                  )}
                  <Button
                    disabled={loading}
                    onClick={connectWithCode}
                    className="w-full bg-lime-600 hover:bg-lime-600 text-white"
                    data-testid="button-submit-code"
                  >
                    <ClipboardEdit className="h-4 w-4 mr-2" />
                    Connect to Provider
                  </Button>
                  <p className="text-xs text-white/40 text-center">
                    Access codes connect users with professionals. Subscriptions are purchased through the App Store.
                  </p>
                </GlassCardContent>
              </GlassCard>
            )}

            {/* Just-connected success banner */}
            {connectedResult && !connectionStatus?.connected && (
              <GlassCard className="border-2 border-green-500/40">
                <GlassCardContent className="p-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                    <h2 className="text-lg font-bold text-white">Connected!</h2>
                  </div>
                  {connectedResult.studio && (
                    <p className="text-sm text-white/80">
                      You are now linked to <span className="text-green-300 font-semibold">{connectedResult.studio.studioName}</span>. Your trainer can now manage your meal plan.
                    </p>
                  )}
                  {!connectedResult.studio && (
                    <p className="text-sm text-white/80">
                      You are now linked to your professional. They can manage your meal plan.
                    </p>
                  )}
                  <p className="text-xs text-white/60">
                    Your trainer will assign your meal builder. Check back on your dashboard to see updates.
                  </p>
                </GlassCardContent>
              </GlassCard>
            )}

            {/* 3. Other features (Supplement Hub, etc.) */}
            {proCareFeatures.filter(f => f.roleKey === null).map((feature) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={feature.testId}
                  className="cursor-pointer active:scale-[0.98] bg-black/30 backdrop-blur-lg border border-white/10 transition-all duration-300 rounded-xl shadow-md relative overflow-hidden"
                  onClick={() => handleCardClick(feature)}
                  data-testid={feature.testId}
                >
                  <CardContent className="p-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 flex-shrink-0 text-orange-500" />
                        <h3 className="text-sm font-semibold flex-1 text-white">
                          {feature.title}
                        </h3>
                      </div>
                      <p className="text-xs ml-6 text-white/80">
                        {feature.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
      {/* Become a Provider — Role Picker Modal */}
      {showProviderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={() => setShowProviderModal(false)}>
          <div
            className="w-full max-w-lg bg-zinc-950 border border-white/10 rounded-3xl p-6 pb-8 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Choose your role</h2>
                <p className="text-xs text-white/50 mt-0.5">Select the path that fits your professional background</p>
              </div>
              <button onClick={() => setShowProviderModal(false)} className="p-2 rounded-full bg-white/10 active:scale-[0.95]">
                <X className="h-4 w-4 text-white/70" />
              </button>
            </div>
            <button
              onClick={() => {
                localStorage.setItem("procare_role", "trainer");
                setShowProviderModal(false);
                setLocation("/procare-welcome");
              }}
              className="w-full text-left p-4 rounded-2xl border border-white/15 bg-white/5 active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-500/20">
                  <Dumbbell className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Trainer / Coach</p>
                  <p className="text-xs text-white/50">Personal trainers, coaches, and fitness professionals</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => {
                localStorage.setItem("procare_role", "physician");
                setShowProviderModal(false);
                setLocation("/procare-welcome");
              }}
              className="w-full text-left p-4 rounded-2xl border border-blue-400/25 bg-blue-900/10 active:scale-[0.98] transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/20">
                  <Stethoscope className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Physician / Medical Provider</p>
                  <p className="text-xs text-white/50">Licensed physicians, nurse practitioners, and healthcare providers</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      {showDisconnectConfirm && connectionStatus?.provider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-zinc-950 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-900/40">
                <Link2Off className="h-5 w-5 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-white">Disconnect?</h3>
            </div>
            <p className="text-sm text-white/70">
              This will remove your ProCare connection with{" "}
              <span className="text-white font-semibold">{connectionStatus.provider.name}</span>.
              Your history is preserved — to reconnect, you'll need a new access code from your provider.
            </p>
            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                className="flex-1 border-white/20 text-white hover:bg-white/10"
                onClick={() => setShowDisconnectConfirm(false)}
                disabled={disconnecting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1 bg-red-700 hover:bg-red-800"
                onClick={disconnectFromProvider}
                disabled={disconnecting}
                data-testid="button-confirm-disconnect"
              >
                {disconnecting ? "Disconnecting…" : "Yes, Disconnect"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <ClientLegalModal
        open={showClientLegalModal}
        flow={pendingLegalFlow}
        onAccepted={handleClientLegalAccepted}
        onCancel={() => setShowClientLegalModal(false)}
      />
    </motion.div>
  );
}
