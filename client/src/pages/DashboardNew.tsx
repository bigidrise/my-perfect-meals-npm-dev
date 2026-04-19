import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Calculator,
  ShoppingCart,
  Lightbulb,
  Activity,
  User,
  TrendingUp,
  Flame,
  Camera,
  Heart,
  ChefHat,
  Refrigerator,
  MessageSquare,
  Send,
  Loader2,
  Globe,
  ChevronDown,
  ChevronUp,
  Trash2,
  Lock,
} from "lucide-react";
import { ProfileSheet } from "@/components/ProfileSheet";
import { MedicalSourcesInfo } from "@/components/MedicalSourcesInfo";
import { HubControlIcon } from "@/components/icons/HubControlIcon";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useCopilot } from "@/components/copilot/CopilotContext";
import { TrialBanner } from "@/components/TrialBanner";
import { TrialExpiredModal } from "@/components/TrialExpiredModal";
import {
  hasActivePaidSubscription,
  hasPaidPlan,
} from "@/lib/subscriptionCheck";
import { getResolvedTargets } from "@/lib/macroResolver";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { ComplianceCard } from "@/components/dashboard/ComplianceCard";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

interface FeatureCard {
  title: string;
  description: string;
  icon: any;
  route: string;
  size: "large" | "small";
  testId: string;
}

const todayMacros = { protein: 50, carbs: 150, fat: 70 };

export default function DashboardNew() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showScanner, setShowScanner] = useState(false);
  const [isGuidedMode, setIsGuidedMode] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const { open: openCopilot } = useCopilot();
  const isDesktop = useIsDesktop();
  const handlePhotoLog = () => {
    setLocation("/my-biometrics?capture=1");
  };

  const isProCareClient = !!user?.isProCare;
  const [tabletOpen, setTabletOpen] = useState(false);
  const [tabletMessages, setTabletMessages] = useState<any[]>([]);
  const [tabletLoading, setTabletLoading] = useState(false);
  const [tabletError, setTabletError] = useState<string | null>(null);
  const [tabletInput, setTabletInput] = useState("");
  const [tabletSending, setTabletSending] = useState(false);
  const [tabletTranslatingId, setTabletTranslatingId] = useState<string | null>(
    null,
  );
  const [tabletHasUnread, setTabletHasUnread] = useState(false);
  const tabletScrollRef = useRef<HTMLDivElement>(null);
  const tabletTranslationCache = useRef(new Map<string, string>());
  const tabletInitialLoad = useRef(true);

  const fetchClientTablet = useCallback(async () => {
    if (tabletInitialLoad.current) {
      setTabletLoading(true);
    }
    setTabletError(null);
    try {
      const res = await fetch(apiUrl("/api/client/tablet"), {
        headers: { ...getAuthHeaders() },
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        if (res.status === 404) setTabletError("No active coach connection");
        else setTabletError("Failed to load messages");
        return;
      }
      const data = await res.json();
      const msgs = data.messages || [];
      setTabletMessages((prev) => {
        const prevMap = new Map(prev.map((m: any) => [m.id, m]));
        return msgs.map((m: any) => ({
          ...m,
          translatedBody: prevMap.get(m.id)?.translatedBody,
        }));
      });

      const lastSeenKey = "mpm.tablet.client.lastSeen";
      const lastSeen = localStorage.getItem(lastSeenKey);
      const coachMsgs = msgs.filter((m: any) => m.sender === "pro");
      if (coachMsgs.length > 0) {
        const latestTime = new Date(
          coachMsgs[coachMsgs.length - 1].createdAt,
        ).getTime();
        const seenTime = lastSeen ? parseInt(lastSeen, 10) : 0;
        setTabletHasUnread(latestTime > seenTime);
      } else {
        setTabletHasUnread(false);
      }
    } catch {
      setTabletError("Failed to load messages");
    } finally {
      setTabletLoading(false);
      tabletInitialLoad.current = false;
    }
  }, []);

  const handleTabletSend = async () => {
    if (!isProCareClient) {
      setLocation("/coaches");
      return;
    }
    if (!tabletInput.trim() || tabletSending) return;
    setTabletSending(true);
    try {
      const res = await fetch(apiUrl("/api/client/tablet/message"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ body: tabletInput.trim() }),
      });
      if (!res.ok) {
        if (res.status === 422) {
          const errData = await res.json().catch(() => ({}));
          setTabletError(errData.error || "Message blocked by content policy");
          return;
        }
        throw new Error("Failed to send");
      }
      const data = await res.json();
      setTabletMessages((prev) => [...prev, data.entry]);
      setTabletInput("");
    } catch {
      setTabletError("Failed to send message");
    } finally {
      setTabletSending(false);
    }
  };

  const handleTabletTranslate = async (entry: any) => {
    if (!isProCareClient) {
      setLocation("/coaches");
      return;
    }
    if (tabletTranslatingId) return;
    const cacheKey = `${entry.id}_translate`;
    if (tabletTranslationCache.current.has(cacheKey)) {
      setTabletMessages((prev) =>
        prev.map((n: any) =>
          n.id === entry.id
            ? {
                ...n,
                translatedBody: n.translatedBody
                  ? undefined
                  : tabletTranslationCache.current.get(cacheKey),
              }
            : n,
        ),
      );
      return;
    }
    setTabletTranslatingId(entry.id);
    try {
      const res = await fetch(apiUrl("/api/translate"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({
          content: { name: "Message", description: entry.body },
          targetLanguage: navigator.language?.split("-")[0] || "es",
        }),
      });
      if (!res.ok) throw new Error("Translation failed");
      const data = await res.json();
      const translated =
        data.translated?.description || data.description || entry.body;
      tabletTranslationCache.current.set(cacheKey, translated);
      setTabletMessages((prev) =>
        prev.map((n: any) =>
          n.id === entry.id ? { ...n, translatedBody: translated } : n,
        ),
      );
    } catch {
      setTabletError("Translation failed");
    } finally {
      setTabletTranslatingId(null);
    }
  };

  const handleTabletDelete = async (entry: any) => {
    if (!isProCareClient) {
      setLocation("/coaches");
      return;
    }
    try {
      const res = await fetch(apiUrl(`/api/client/tablet/entry/${entry.id}`), {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setTabletMessages((prev) => prev.filter((m: any) => m.id !== entry.id));
    } catch {
      setTabletError("Failed to delete message");
    }
  };

  useEffect(() => {
    if (isProCareClient && !tabletOpen) {
      fetchClientTablet();
      const bgInterval = setInterval(fetchClientTablet, 30000);
      return () => clearInterval(bgInterval);
    }
  }, [isProCareClient, tabletOpen, fetchClientTablet]);

  useEffect(() => {
    if (tabletOpen && isProCareClient) {
      tabletInitialLoad.current = true;
      fetchClientTablet();
      const interval = setInterval(fetchClientTablet, 10000);
      localStorage.setItem("mpm.tablet.client.lastSeen", Date.now().toString());
      setTabletHasUnread(false);
      return () => clearInterval(interval);
    }
  }, [tabletOpen, isProCareClient, fetchClientTablet]);

  useEffect(() => {
    if (!isProCareClient) {
      setTabletOpen(false);
      setTabletInput("");
      setTabletError(null);
    }
  }, [isProCareClient]);

  useEffect(() => {
    if (tabletScrollRef.current) {
      tabletScrollRef.current.scrollTop = tabletScrollRef.current.scrollHeight;
    }
  }, [tabletMessages]);

  useEffect(() => {
    document.title = "Home | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });

    const coachMode = localStorage.getItem("coachMode");
    setIsGuidedMode(coachMode === "guided");
  }, []);

  // =========================================
  // AUTO-OPEN COPILOT INTRO - Guided Mode Only
  // =========================================
  useEffect(() => {
    const triggerFlag = localStorage.getItem("trigger-copilot-intro");

    if (triggerFlag === "true") {
      // Open Copilot sheet - use minimal delay to preserve user gesture context
      // CopilotSheet will handle flag removal and intro playback
      setTimeout(() => {
        openCopilot(); // Open the Copilot sheet
      }, 100); // 100ms delay - short enough to preserve user gesture for audio autoplay
    }
  }, [openCopilot]);

  useEffect(() => {
    if (!user) return;
    if (hasPaidPlan(user)) return;
    const hasShown = localStorage.getItem("mpm_subscription_modal_shown");
    if (!hasShown) {
      setShowSubscriptionModal(true);
    }
  }, [user]);

  // Greeting priority: nickname > firstName > username-derived name > fallback
  const firstName =
    user?.nickname || user?.firstName || user?.name?.split(" ")[0] || "there";

  const features: FeatureCard[] = [
    {
      title: "Macro Calculator",
      description: "Precision macro targeting",
      icon: Calculator,
      route: "/macro-counter",
      size: "large",
      testId: "macro-calculator",
    },
    {
      title: "My Biometrics",
      description: "Track your health metrics",
      icon: Activity,
      route: "/my-biometrics",
      size: "large",
      testId: "biometrics", // Updated testId for tour
    },
    {
      title: "Saved Meals",
      description: "Your favorites",
      icon: Heart,
      route: "/saved-meals",
      size: "small",
      testId: "card-saved-meals",
    },
    {
      title: "Daily Journal & Inspiration",
      description: "Daily motivation",
      icon: Lightbulb,
      route: "/get-inspiration",
      size: "small",
      testId: "card-inspiration",
    },
  ];

  const handleCardClick = (route: string) => {
    setLocation(route);
  };

  // Handler for when food is found via barcode scanner
  const handleFoodFound = (foodData: any) => {
    console.log("Food found:", foodData);
    // Here you would typically process foodData:
    // 1. Save to draft (if applicable)
    // 2. Navigate to biometrics with the found food data
    // For now, let's just navigate to biometrics and close the scanner
    setLocation("/my-biometrics"); // Navigate to biometrics
    setShowScanner(false); // Close the scanner modal
  };

  const isPaid = hasActivePaidSubscription(user);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-full flex flex-col bg-black pb-safe-nav"
    >
      <TrialBanner />
      <TrialExpiredModal />
      {!isDesktop && (
        <div
          className="fixed right-4 z-50"
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        >
          <ProfileSheet>
            <button
              className="flex items-center gap-1.5 px-3 py-2 bg-black/50 backdrop-blur-sm border border-white/10 rounded-lg hover:bg-black/70 hover:border-orange-500/30 transition-all"
              data-testid="button-my-hub"
            >
              <span className="text-xs font-semibold text-orange-400">Hub</span>
              <HubControlIcon size="md" />
            </button>
          </ProfileSheet>
        </div>
      )}

      {!isDesktop && (
        <div
          className="fixed top-0 left-0 right-0 z-40 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 pb-3 h-14 flex items-center justify-center">
            <h1 className="text-md font-bold text-white">MPM</h1>
          </div>
        </div>
      )}

      <div
        className="max-w-6xl mx-auto px-4 pb-8 flex flex-col gap-4"
        style={{
          paddingTop: isDesktop
            ? "2rem"
            : "calc(env(safe-area-inset-top, 0px) + 6rem)",
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mb-4"
        >
          <div className="relative h-48 rounded-xl overflow-hidden">
            <img
              src="/images/home-hero.png"
              alt="My Perfect Meals Dashboard"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <h2 className="text-2xl font-bold text-white mb-2">
                Welcome back, {firstName}!
              </h2>
              <p className="text-white/90 text-sm mb-4">
                Ready to hit your macro goals today?
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center p-2 rounded-lg bg-black/30 backdrop-blur-sm border border-white/10">
                  <Flame className="h-4 w-4 text-blue-500 mb-1" />
                  <div className="text-sm font-semibold text-white/80">
                    Protein
                  </div>
                  <div className="text-sm font-bold text-white"></div>
                </div>
                <div className="flex flex-col items-center p-2 rounded-lg bg-black/30 backdrop-blur-sm border border-white/10">
                  <TrendingUp className="h-4 w-4 text-orange-500 mb-1" />
                  <div className="text-sm font-semibold text-white/80">
                    Carbs
                  </div>
                  <div className="text-sm font-bold text-white"></div>
                </div>
                <div className="flex flex-col items-center p-2 rounded-lg bg-black/30 backdrop-blur-sm border border-white/10">
                  <Activity className="h-4 w-4 text-purple-500 mb-1" />
                  <div className="text-sm font-semibold text-white/80">
                    Fats
                  </div>
                  <div className="text-sm font-bold text-white"></div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {user?.goalType && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.11, duration: 0.4 }}
            className="mb-4"
          >
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 flex items-center gap-3">
              <span className="text-xl">
                {user.goalType === "lose"
                  ? "🔥"
                  : user.goalType === "gain"
                    ? "💪"
                    : "⚖️"}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/60 uppercase tracking-wide font-medium">
                  Active Goal
                </p>
                <p className="text-sm font-semibold text-white leading-tight">
                  {user.goalType === "lose"
                    ? "Lose Weight"
                    : user.goalType === "gain"
                      ? "Gain Muscle"
                      : "Maintain Weight"}
                  {user.goalTarget ? ` — ${user.goalTarget}` : ""}
                  {user.goalTimelineWeeks
                    ? ` in ${user.goalTimelineWeeks >= 52 ? "1 year" : user.goalTimelineWeeks >= 26 ? "6 months" : `${user.goalTimelineWeeks} weeks`}`
                    : ""}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.5 }}
          className="mb-4 space-y-3"
        >
          {isProCareClient ? (
            <Card
              className="cursor-pointer active:scale-[0.98] bg-black/30 backdrop-blur-lg border border-purple-500/30 transition-all duration-300 rounded-xl shadow-md relative"
              onClick={() => setTabletOpen(!tabletOpen)}
            >
              {tabletHasUnread && (
                <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse z-10" />
              )}
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <MessageSquare className="h-5 w-5 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white">
                      Messages
                    </h3>
                    <p className="text-xs text-white/70">
                      View and reply to your coach
                    </p>
                  </div>
                  {tabletOpen ? (
                    <ChevronUp className="h-4 w-4 text-white/40" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-white/40" />
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card
              className="cursor-pointer active:scale-[0.98] bg-black/30 backdrop-blur-lg border border-white/10 transition-all duration-300 rounded-xl shadow-md relative opacity-70"
              onClick={() => setLocation("/coaches")}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/10 relative">
                    <MessageSquare className="h-5 w-5 text-white/40" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                      ProCare Messages
                      <Lock className="h-3.5 w-3.5 text-orange-400" />
                    </h3>
                    <p className="text-xs text-white/50">
                      Chat directly with your coach for guidance and
                      accountability
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-white/20" />
                </div>
              </CardContent>
            </Card>
          )}

          {tabletOpen && (
            <div className="bg-black/30 backdrop-blur-lg border border-purple-500/20 rounded-xl p-4 space-y-3">
              {tabletLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-white/40" />
                </div>
              )}
              {tabletError && (
                <p className="text-sm text-red-400">{tabletError}</p>
              )}
              {!tabletLoading && !tabletError && (
                <>
                  <div
                    ref={tabletScrollRef}
                    className="max-h-64 overflow-y-auto space-y-2"
                  >
                    {tabletMessages.length === 0 && (
                      <p className="text-xs text-white/30 py-2">
                        No messages yet
                      </p>
                    )}
                    {tabletMessages.map((entry: any) => (
                      <div
                        key={entry.id}
                        className={`rounded-md p-2.5 border ${
                          entry.sender === "client"
                            ? "bg-blue-500/10 border-blue-500/20 ml-6"
                            : "bg-white/5 border-white/5 mr-6"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-white/40">
                            {entry.sender === "client" ? "You" : "Coach"}{" "}
                            &middot;{" "}
                            {new Date(entry.createdAt).toLocaleDateString(
                              undefined,
                              { month: "short", day: "numeric" },
                            )}{" "}
                            {new Date(entry.createdAt).toLocaleTimeString(
                              undefined,
                              { hour: "numeric", minute: "2-digit" },
                            )}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTabletTranslate(entry);
                              }}
                              disabled={tabletTranslatingId === entry.id}
                              className="text-blue-400 p-0.5"
                              title="Translate"
                            >
                              {tabletTranslatingId === entry.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Globe className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTabletDelete(entry);
                              }}
                              className="text-red-500 p-0.5"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap">
                          {entry.translatedBody || entry.body}
                        </p>
                        {entry.translatedBody && (
                          <p className="text-[10px] text-white/30 mt-1 italic">
                            Original: {entry.body}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <textarea
                      value={tabletInput}
                      onChange={(e) => setTabletInput(e.target.value)}
                      placeholder="Reply to your coach..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-purple-500/50"
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleTabletSend();
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      disabled={!tabletInput.trim() || tabletSending}
                      onClick={handleTabletSend}
                      className="bg-purple-600 hover:bg-purple-700 px-3 self-end"
                    >
                      {tabletSending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="mb-4"
        >
          <ComplianceCard userId={user?.id} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="mb-4"
        >
          <MedicalSourcesInfo
            trigger={
              <Card
                className="cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(59,130,246,0.35)] active:scale-95 bg-black/30 backdrop-blur-lg border border-white/10 hover:border-blue-400/50 rounded-xl group"
                data-testid="card-medical-safety"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-700/20 border border-blue-500/30">
                      <Activity className="h-6 w-6 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-white text-lg">
                        Sources & Medical Information
                      </CardTitle>
                      <CardDescription className="text-white/70 text-sm mt-1">
                        NIH · USDA · WHO · ADA
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            }
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mb-4"
        >
          <Card
            className="cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(249,115,22,0.4)] active:scale-95 bg-black/30 backdrop-blur-lg border border-white/10 hover:border-orange-500/50 rounded-xl group"
            onClick={() => setLocation("/shopping-list-v2")}
            data-testid="card-shopping-list"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-700/20 border border-orange-500/30 group-hover:from-orange-500/30 group-hover:to-orange-700/30 transition-all">
                  <ShoppingCart className="h-6 w-6 text-orange-500" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-white text-lg">
                    {" "}
                    Smart Grocery List
                  </CardTitle>
                  <CardDescription className="text-white/70 text-sm mt-1">
                    Smart grocery list manager
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="mb-4"
        >
          <Card
            className="cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(249,115,22,0.4)] active:scale-95 bg-black/30 backdrop-blur-lg border border-white/10 hover:border-orange-500/50 rounded-xl group"
            onClick={handlePhotoLog}
            data-testid="card-photo-log"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-700/20 border border-orange-500/30 group-hover:from-orange-500/30 group-hover:to-orange-700/30 transition-all">
                  <Camera className="h-6 w-6 text-orange-500" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-white text-lg">
                    MacroScan
                  </CardTitle>
                  <CardDescription className="text-white/70 text-sm mt-1">
                    Scan nutrition. Log macros instantly
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isMacroCalculator = feature.testId === "macro-calculator";
            const shouldFlash = isGuidedMode && isMacroCalculator;
            return (
              <motion.div
                key={feature.testId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1, duration: 0.5 }}
                className="md:col-span-1"
              >
                <Card
                  onClick={() => handleCardClick(feature.route)}
                  className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(249,115,22,0.4)] active:scale-95 bg-black/30 backdrop-blur-lg border border-white/10 hover:border-orange-500/50 rounded-xl group ${shouldFlash ? "flash-border" : ""}`}
                  data-testid={feature.testId}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-700/20 border border-orange-500/30 group-hover:from-orange-500/30 group-hover:to-orange-700/30 transition-all">
                        <Icon className="h-6 w-6 text-orange-500" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {feature.title}
                        </h3>
                        <p className="text-sm text-white/70">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <Card className="bg-black/30 backdrop-blur-lg border border-white/10 hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] transition-all">
            <CardContent className="p-6 text-center">
              <h3 className="text-white font-semibold mb-2">
                Ready to Plan Your Meals?
              </h3>
              <p className="text-white/70 text-sm mb-4">
                Start building your perfect week with AI-powered meal planning
              </p>
              <button
                onClick={() => setLocation("/planner")}
                className="px-6 py-2 bg-gradient-to-r from-orange-500 to-orange-700 hover:from-orange-600 hover:to-orange-800 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl"
                data-testid="button-go-to-planner"
              >
                Go to Builders
              </button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Dialog
        open={showSubscriptionModal}
        onOpenChange={setShowSubscriptionModal}
      >
        <DialogContent className="sm:max-w-md bg-black/90 text-white border border-orange-500/40 backdrop-blur-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">
              Unlock Full Access
            </DialogTitle>
            <DialogDescription className="text-white/80 text-center mt-2">
              AI-powered meal planning, personalized macros, restaurant
              guidance, and advanced coaching tools.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-2 text-sm text-white/80">
            <div>• Unlimited AI meal creation</div>
            <div>• Advanced macro targeting</div>
            <div>• Restaurant & craving tools</div>
            <div>• Premium coaching access</div>
          </div>
          <div className="mt-6 space-y-3">
            <Button
              className="w-full bg-orange-600 hover:bg-orange-700"
              onClick={() => {
                localStorage.setItem("mpm_subscription_modal_shown", "true");
                setShowSubscriptionModal(false);
                setLocation("/pricing");
              }}
            >
              Explore Premium Plans
            </Button>
            <Button
              variant="ghost"
              className="w-full text-orange-400 hover:bg-orange-500/10"
              onClick={() => {
                localStorage.setItem("mpm_subscription_modal_shown", "true");
                setShowSubscriptionModal(false);
              }}
            >
              Continue with Free Features
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
