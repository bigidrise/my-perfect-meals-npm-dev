import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { isHouseholdPlan } from "@shared/planFeatures";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { GlassCard, GlassCardContent } from "@/components/glass/GlassCard";
import { Crown, Lock, Stethoscope, Dumbbell, LogOut, KeyRound, ClipboardEdit, CheckCircle2, Heart, Briefcase, UserPlus, X, Link2Off, ShieldCheck, Users, TrendingUp, Lightbulb, Building2, Gift } from "lucide-react";
import { MfaSetupSection } from "@/components/MfaSetupSection";
import { useAuth } from "@/contexts/AuthContext";
import { hasActivePaidSubscription, isClinicalOrAbove } from "@/lib/subscriptionCheck";
import { useUpgradeModal } from "@/contexts/UpgradeModalContext";
import { apiRequest } from "@/lib/queryClient";
import { getAuthHeaders } from "@/lib/auth";
import { apiUrl } from "@/lib/resolveApiBase";
import { proStore } from "@/lib/proData";
import { clearResolvedTargetsCache } from "@/lib/macroResolver";
import { WorkspaceChooser } from "@/components/WorkspaceChooser";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import ClientLegalModal from "@/components/pro/ClientLegalModal";
import { SponsorEndedBanner } from "@/components/SponsorEndedBanner";
import { useTranslation } from "react-i18next";

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
  const { requestUpgrade } = useUpgradeModal();
  const isDesktop = useIsDesktop();
  const { t } = useTranslation("more");
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

  const [businessCard, setBusinessCard] = useState<{
    mode: "owner" | "member";
    name: string;
    usedSeats?: number;
    seatLimit?: number;
    role?: string;
  } | null>(null);

  useEffect(() => {
    async function fetchBusiness() {
      try {
        const ownerRes = await fetch("/api/business/mine", {
          headers: getAuthHeaders() as HeadersInit,
          credentials: "include",
        });
        if (ownerRes.ok) {
          const data = await ownerRes.json();
          setBusinessCard({
            mode: "owner",
            name: data.business.name,
            usedSeats: data.usedSeats,
            seatLimit: data.business.seatLimit,
          });
          return;
        }
        const memberRes = await fetch("/api/business/membership", {
          headers: getAuthHeaders() as HeadersInit,
          credentials: "include",
        });
        if (memberRes.ok) {
          const data = await memberRes.json();
          setBusinessCard({
            mode: "member",
            name: data.membership.businessName,
            role: data.membership.role,
          });
        }
      } catch {
        // Non-fatal
      }
    }
    if (user) fetchBusiness();
  }, [user]);

  useEffect(() => {
    document.title = "More | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    async function fetchConnectionStatus() {
      try {
        const data = await apiRequest("/api/pro/connection-status");
        setConnectionStatus(data);
      } catch {
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

      if (user?.id) {
        try {
          const clientMap: Record<string, string> = JSON.parse(
            localStorage.getItem("mpm_user_client_map") || "{}"
          );
          const clientId = clientMap[user.id];
          if (clientId) {
            const stripped = proStore.stripMedicalFlags(clientId);
            if (stripped) {
              clearResolvedTargetsCache();
              window.dispatchEvent(new CustomEvent("mpm:targetsUpdated"));
              console.log("[Disconnect] Cleared physician medical flags from local store.");
            }
          }
        } catch {
          // Non-fatal
        }
      }

      await refreshUser();
    } catch (e: any) {
      alert(t("errorDisconnect"));
    } finally {
      setDisconnecting(false);
    }
  }

  const proCareFeatures: ProCareFeature[] = [
    {
      title: t("physiciansClinicTitle"),
      description: t("physiciansClinicDesc"),
      icon: Stethoscope,
      route: "/care-team/physician",
      testId: "card-procare-physician",
      roleKey: "physician",
    },
    {
      title: t("trainersStudioTitle"),
      description: t("trainersStudioDesc"),
      icon: Dumbbell,
      route: "/care-team/trainer",
      testId: "card-procare-trainer",
      roleKey: "trainer",
    },
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
    if (!isClinicalOrAbove(user)) {
      requestUpgrade({ requiredTier: "clinical", featureName: "ProCare Connection" });
      return;
    }
    setError(null);
    setConnectedResult(null);
    if (!accessCode.trim()) {
      setError(t("errorCodeRequired"));
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
        } else if (data?.error === "CLINICAL_REQUIRED") {
          requestUpgrade({ requiredTier: "clinical", featureName: "ProCare Connection" });
        } else {
          setError(data?.error || t("errorCodeInvalid"));
        }
        return;
      }
      setAccessCode("");
      setConnectedResult(data);
      await refreshUser();
    } catch (e: any) {
      setError(e?.message || t("errorConnect"));
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
            <h1 className="text-lg font-bold text-white flex-1">{t("pageTitle")}</h1>
          </div>
        </div>
      )}

      <div
        className="flex-1 px-4 py-8"
        style={{ paddingTop: isDesktop ? "0" : "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        <div className="max-w-2xl mx-auto space-y-4">
          <SponsorEndedBanner />
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
              <div className="bg-black/55 backdrop-blur-sm rounded-xl px-3 py-2.5">
                <h2 className="text-2xl font-bold text-white mb-1"></h2>
                <p className="text-white/90 text-sm">
                  {t("proHeroDesc")}
                </p>
              </div>
            </div>
          </div>

          {/* Tips & Strategies */}
          <div className="relative">
            <div className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-70" style={{ background: "radial-gradient(120% 120% at 50% 0%, rgba(249,115,22,0.5), rgba(249,115,22,0.25), rgba(0,0,0,0))" }} />
          <Card
            className="relative cursor-pointer active:scale-[0.98] bg-gradient-to-r from-black via-orange-950/30 to-black backdrop-blur-lg border border-orange-500/30 hover:border-orange-500/60 hover:shadow-[0_0_30px_rgba(249,115,22,0.45)] transition-all duration-300 rounded-xl shadow-md overflow-hidden"
            style={{ backgroundColor: "transparent" }}
            onClick={() => setLocation("/tips")}
            data-testid="card-tips-strategies"
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/20">
                  <Lightbulb className="h-5 w-5 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white">{t("tipsTitle")}</h3>
                  <p className="text-xs text-white/70">{t("tipsDesc")}</p>
                </div>
                <div className="flex-shrink-0 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30">
                  <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wide">{t("guideLabel")}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          </div>

          {/* Household Profiles */}
          {isHouseholdPlan(user?.planLookupKey) && (
            <div className="relative">
              <div className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-70" style={{ background: "radial-gradient(120% 120% at 50% 0%, rgba(245,158,11,0.5), rgba(245,158,11,0.25), rgba(0,0,0,0))" }} />
              <Card
                className="relative cursor-pointer active:scale-[0.98] bg-gradient-to-r from-black via-amber-950/30 to-black backdrop-blur-lg border border-amber-500/30 hover:border-amber-500/60 hover:shadow-[0_0_30px_rgba(245,158,11,0.45)] transition-all duration-300 rounded-xl shadow-md overflow-hidden"
                style={{ backgroundColor: "transparent" }}
                onClick={() => setLocation("/household-profiles")}
                data-testid="card-household-profiles"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/20">
                      <Users className="h-5 w-5 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-white">{t("householdTitle")}</h3>
                      <p className="text-xs text-white/70">{t("householdDesc")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Switch to Workspace */}
          {(userRole === "trainer" || userRole === "physician") && (
            <div className="relative">
              <div className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-70" style={{ background: "radial-gradient(120% 120% at 50% 0%, rgba(6,182,212,0.5), rgba(6,182,212,0.25), rgba(0,0,0,0))" }} />
              <Card
                className="relative cursor-pointer active:scale-[0.98] bg-gradient-to-r from-black via-cyan-950/30 to-black backdrop-blur-lg border border-cyan-500/30 hover:border-cyan-500/60 hover:shadow-[0_0_30px_rgba(6,182,212,0.45)] transition-all duration-300 rounded-xl shadow-md overflow-hidden"
                style={{ backgroundColor: "transparent" }}
                onClick={() => setShowWorkspaceChooser(true)}
                data-testid="card-switch-workspace"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-500/20">
                      <Briefcase className="h-5 w-5 text-cyan-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-white">{t("workspaceTitle")}</h3>
                      <p className="text-xs text-white/70">{t("workspaceDesc")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

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

          {/* Become a Provider */}
          {!userRole && (
            <div className="relative">
              <div className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-70" style={{ background: "radial-gradient(120% 120% at 50% 0%, rgba(59,130,246,0.5), rgba(59,130,246,0.25), rgba(0,0,0,0))" }} />
              <Card
                className="relative cursor-pointer active:scale-[0.98] bg-gradient-to-r from-black via-blue-950/30 to-black backdrop-blur-lg border border-blue-500/30 hover:border-blue-500/60 hover:shadow-[0_0_30px_rgba(59,130,246,0.45)] transition-all duration-300 rounded-xl shadow-md overflow-hidden"
                style={{ backgroundColor: "transparent" }}
                onClick={() => setShowProviderModal(true)}
                data-testid="card-become-provider"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <UserPlus className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-white">{t("becomeProviderTitle")}</h3>
                      <p className="text-xs text-white/70">{t("becomeProviderDesc")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Saved Meals / Favorites */}
          {(() => {
            const favLocked = !hasActivePaidSubscription(user);
            return (
              <div className="relative">
                <div className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-70" style={{ background: "radial-gradient(120% 120% at 50% 0%, rgba(244,63,94,0.5), rgba(244,63,94,0.25), rgba(0,0,0,0))" }} />
                <Card
                  className="relative cursor-pointer active:scale-[0.98] bg-gradient-to-r from-black via-rose-950/30 to-black backdrop-blur-lg border border-rose-500/30 hover:border-rose-500/60 hover:shadow-[0_0_30px_rgba(244,63,94,0.45)] transition-all duration-300 rounded-xl shadow-md overflow-hidden"
                  style={{ backgroundColor: "transparent" }}
                  onClick={() => {
                    if (favLocked) { requestUpgrade({ requiredTier: "essential", featureName: "Saved Meals" }); return; }
                    setLocation("/saved-meals");
                  }}
                  data-testid="card-saved-meals"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${favLocked ? "bg-red-500/10" : "bg-red-500/20"}`}>
                        <Heart className={`h-5 w-5 ${favLocked ? "text-red-400/50" : "text-red-400"}`} fill="currentColor" />
                      </div>
                      <div className="flex-1">
                        <h3 className={`text-sm font-semibold ${favLocked ? "text-white/50" : "text-white"}`}>{t("favoritesTitle")}</h3>
                        <p className={`text-xs ${favLocked ? "text-white/40" : "text-white/70"}`}>{t("favoritesDesc")}</p>
                      </div>
                      {favLocked && <Lock className="h-4 w-4 text-orange-400/70 flex-shrink-0" />}
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          {/* Business Center */}
          <div className="relative">
            <div className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-70" style={{ background: "radial-gradient(120% 120% at 50% 0%, rgba(245,158,11,0.5), rgba(245,158,11,0.25), rgba(0,0,0,0))" }} />
            <Card
              className="relative cursor-pointer active:scale-[0.98] bg-gradient-to-r from-black via-amber-950/30 to-black backdrop-blur-lg border border-amber-500/30 hover:border-amber-500/60 hover:shadow-[0_0_30px_rgba(245,158,11,0.45)] transition-all duration-300 rounded-xl shadow-md overflow-hidden"
              style={{ backgroundColor: "transparent" }}
              onClick={() => setLocation("/business-center")}
              data-testid="card-business-center"
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <TrendingUp className="h-5 w-5 text-amber-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white">{t("businessTitle")}</h3>
                    <p className="text-xs text-white/70">{t("businessDesc")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Client Access Card — shown when this user accepted a client invitation */}
          {user?.activeClientAccess && (
            <Card
              className="bg-gradient-to-r from-black via-emerald-950/40 to-black backdrop-blur-lg border border-emerald-500/40 rounded-xl shadow-md overflow-hidden"
              style={{ backgroundColor: "transparent" }}
              data-testid="card-client-access"
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-emerald-600/20 mt-0.5">
                    <Gift className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <h3 className="text-sm font-semibold text-white">
                      Access granted by {user.activeClientAccess.businessName}
                    </h3>
                    {user.activeClientAccess.programName && (
                      <p className="text-xs text-white/70 truncate">
                        Program: {user.activeClientAccess.programName}
                      </p>
                    )}
                    <p className="text-xs text-white/50">
                      {user.activeClientAccess.trialDays
                        ? `${user.activeClientAccess.trialDays}-day trial`
                        : "Trial access"}
                      {user.activeClientAccess.inviterName
                        ? ` · Invited by ${user.activeClientAccess.inviterName}`
                        : ""}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Organization Card */}
          {businessCard && (
            <Card
              className="cursor-pointer active:scale-[0.98] bg-gradient-to-r from-black via-blue-950/40 to-black backdrop-blur-lg border border-blue-500/40 transition-all duration-300 rounded-xl shadow-md overflow-hidden"
              style={{ backgroundColor: "transparent" }}
              onClick={() => setLocation("/business-dashboard")}
              data-testid="card-clinical-business"
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-600/20">
                    <Building2 className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {businessCard.mode === "owner" ? (
                      <>
                        <h3 className="text-sm font-semibold text-white">{t("orgDashTitle")}</h3>
                        <p className="text-xs text-white/60 truncate">
                          {businessCard.name} · {businessCard.usedSeats} of {businessCard.seatLimit} seats used
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="text-sm font-semibold text-white">{t("myTeamTitle")}</h3>
                        <p className="text-xs text-white/60 truncate">
                          {businessCard.name} · {businessCard.role ? businessCard.role.charAt(0).toUpperCase() + businessCard.role.slice(1) : "Member"}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-3">
            {/* Professional Studios — HIDDEN */}
            {false && proCareFeatures.filter(f => f.roleKey !== null).map((feature) => {
              const Icon = feature.icon;
              const isLocked = isFeatureLocked(feature);
              const lockedLabel = feature.roleKey === "physician"
                ? t("physicianLock")
                : t("trainerLock");

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

            {/* Provider Connection Card */}
            {connectionStatus?.connected && connectionStatus.provider ? (
              <GlassCard className="border-2 border-green-500/40">
                <GlassCardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-green-400" />
                    <h2 className="text-xl font-bold text-white">{t("connectedHeading")}</h2>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-1">
                    <p className="text-sm font-semibold text-white">{connectionStatus.provider.name}</p>
                    <p className="text-xs text-white/60 capitalize">
                      {connectionStatus.provider.role}
                      {connectionStatus.provider.studioName ? ` · ${connectionStatus.provider.studioName}` : ""}
                    </p>
                  </div>
                  <p className="text-xs text-white/50">
                    {t("connectedDesc")}
                  </p>
                  <Button
                    variant="destructive"
                    className="w-full bg-red-700/80 hover:bg-red-700 text-white"
                    onClick={() => setShowDisconnectConfirm(true)}
                    data-testid="button-disconnect-provider"
                  >
                    <Link2Off className="h-4 w-4 mr-2" />
                    {t("disconnectBtn", { name: connectionStatus.provider.name })}
                  </Button>
                </GlassCardContent>
              </GlassCard>
            ) : (
              <GlassCard className="border-2 border-orange-500/40">
                <GlassCardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-orange-500" />
                    <h2 className="text-xl font-bold text-white">
                      {t("connectHeading")}
                    </h2>
                  </div>
                  <p className="text-sm text-white/70">
                    {t("connectDesc")}
                  </p>
                  <div>
                    <Label className="text-white/80">{t("codeLabel")}</Label>
                    <Input
                      value={accessCode}
                      onChange={(e) => setAccessCode(e.target.value)}
                      placeholder={t("codePlaceholder")}
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
                    {t("connectBtn")}
                  </Button>
                  <p className="text-xs text-white/40 text-center">
                    {t("connectDisclaimer")}
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
                    <h2 className="text-lg font-bold text-white">{t("connectedBanner")}</h2>
                  </div>
                  {connectedResult.studio && (
                    <p className="text-sm text-white/80">
                      {t("connectedStudio", { studio: connectedResult.studio.studioName })}
                    </p>
                  )}
                  {!connectedResult.studio && (
                    <p className="text-sm text-white/80">
                      {t("connectedNoStudio")}
                    </p>
                  )}
                  <p className="text-xs text-white/60">
                    {t("connectedInstructions")}
                  </p>
                </GlassCardContent>
              </GlassCard>
            )}

            {/* Account Security — Two-Factor Authentication */}
            <div className="relative">
              <div className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-70" style={{ background: "radial-gradient(120% 120% at 50% 0%, rgba(139,92,246,0.5), rgba(139,92,246,0.25), rgba(0,0,0,0))" }} />
              <GlassCard className="relative border border-violet-500/30">
                <GlassCardContent className="p-5">
                  <MfaSetupSection />
                </GlassCardContent>
              </GlassCard>
            </div>

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

      {/* Role Picker Modal */}
      {showProviderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4" onClick={() => setShowProviderModal(false)}>
          <div
            className="w-full max-w-lg bg-zinc-950 border border-white/10 rounded-3xl p-6 pb-8 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">{t("chooseRole")}</h2>
                <p className="text-xs text-white/50 mt-0.5">{t("chooseRoleSub")}</p>
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
                  <p className="text-sm font-semibold text-white">{t("trainerRole")}</p>
                  <p className="text-xs text-white/50">{t("trainerRoleDesc")}</p>
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
                  <p className="text-sm font-semibold text-white">{t("physicianRole")}</p>
                  <p className="text-xs text-white/50">{t("physicianRoleDesc")}</p>
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
              <h3 className="text-lg font-bold text-white">{t("disconnectConfirm")}</h3>
            </div>
            <p className="text-sm text-white/70">
              {t("disconnectDesc", { name: connectionStatus.provider.name })}
            </p>
            <div className="flex gap-3 pt-1">
              <Button
                className="flex-1 bg-white/10 border border-white/20 text-white hover:bg-white/20"
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
                {disconnecting ? t("disconnecting") : t("disconnectYes")}
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
