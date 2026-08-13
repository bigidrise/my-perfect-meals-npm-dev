import { useLocation } from "wouter";
import { useOrgFlag } from "@/contexts/OrgContext";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef, useCallback } from "react";
import { WorkspaceChooser } from "@/components/WorkspaceChooser";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InformationModal } from "@/components/ui/universal-modal";
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
  Play,
  Pause,
  Mic,
  Square,
} from "lucide-react";
import { ProfileSheet } from "@/components/ProfileSheet";
import { MedicalSourcesInfo } from "@/components/MedicalSourcesInfo";
import { HubControlIcon } from "@/components/icons/HubControlIcon";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useCopilot } from "@/components/copilot/CopilotContext";

import {
  hasActivePaidSubscription,
  hasPaidPlan,
} from "@/lib/subscriptionCheck";
import { getTierForLookupKey } from "@shared/planFeatures";
import { useUpgradeModal } from "@/contexts/UpgradeModalContext";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { BugReportButton } from "@/components/BugReportButton";
import { ComplianceCard } from "@/components/dashboard/ComplianceCard";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useProUnreadCount } from "@/hooks/useProUnreadCount";
import { PatternAlertBanner } from "@/components/PatternAlertBanner";
import { TipsBanner } from "@/components/TipsBanner";
import { useTranslation } from "react-i18next";
import InspirationCaptureModal from "@/components/InspirationCaptureModal";
import MacroScanModal from "@/components/MacroScanModal";
import { NutritionPersonalizationSummaryCard } from "@/components/protocol/NutritionPersonalizationSummaryCard";
import { TodaysPrescriptionCard } from "@/components/dashboard/TodaysPrescriptionCard";
import { WhatsNewCard } from "@/components/WhatsNewCard";
import CoachCornerCard from "@/components/ace/CoachCornerCard";
import { COACHES_CORNER_ENABLED } from "@/features/coachCornerFlag";

type DashBadgeVariant = "free" | "paid" | "professional";

function getMobilePlanBadge(user: any): { textKey: string; variant: DashBadgeVariant } | null {
  if (!user) return null;
  const key = (user.planLookupKey ?? "").toLowerCase();
  if (key.includes("procare") || key.includes("trainer") || key.includes("physician")) {
    return { textKey: "professionalBadge", variant: "professional" };
  }
  const tier = getTierForLookupKey(user.planLookupKey);
  switch (tier) {
    case "basic":    return { textKey: "essentialBadge", variant: "paid" };
    case "premium":  return { textKey: "proBadge",       variant: "paid" };
    case "ultimate": return { textKey: "clinicalBadge",  variant: "paid" };
    default:         return { textKey: "freeBadge",      variant: "free" };
  }
}

const DASH_BADGE_CLASSES: Record<DashBadgeVariant, string> = {
  free:         "bg-orange-500/15 border border-orange-500/25 text-orange-400",
  paid:         "bg-orange-500/15 border border-orange-500/25 text-orange-400",
  professional: "bg-blue-500/15 border border-blue-500/25 text-blue-400",
};

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
  const { t } = useTranslation("dashboard");
  const { requestUpgrade } = useUpgradeModal();
  const showMarketplace = useOrgFlag("partnerMarketplace");
  const [showScanner, setShowScanner] = useState(false);
  const [isGuidedMode, setIsGuidedMode] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showInspirationModal, setShowInspirationModal] = useState(false);
  const [lastRecipeScan, setLastRecipeScan] = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem("mpm.recipe.lastScan") ?? "null"); } catch { return null; }
  });
  const { open: openCopilot } = useCopilot();
  const isDesktop = useIsDesktop();
  const [showMacroModal, setShowMacroModal] = useState(false);
  const handlePhotoLog = () => setShowMacroModal(true);

  const mobilePlanBadge = getMobilePlanBadge(user);
  const isCoach = !!(user?.professionalRole);
  const isProCareClient = !!user?.isProCare && !isCoach;
  const hasProviderConnection = !!user?.isProCare;
  const proUnreadCount = useProUnreadCount();
  const [showWorkspaceChooser, setShowWorkspaceChooser] = useState(false);
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
  const [tabletPlayingId, setTabletPlayingId] = useState<string | null>(null);
  const tabletAudioCache = useRef<Record<string, string>>({});
  const tabletAudioRef = useRef<HTMLAudioElement | null>(null);
  const [tabletRecording, setTabletRecording] = useState(false);
  const [tabletAudioBlob, setTabletAudioBlob] = useState<Blob | null>(null);
  const [tabletVoiceSending, setTabletVoiceSending] = useState(false);
  const [tabletRecordingSec, setTabletRecordingSec] = useState(0);
  const tabletMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const tabletRecordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tabletStreamRef = useRef<MediaStream | null>(null);

  // Provider inbox — completely separate from client tablet
  const [providerOpen, setProviderOpen] = useState(false);
  const [providerMessages, setProviderMessages] = useState<any[]>([]);
  const [providerLoading, setProviderLoading] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [providerInput, setProviderInput] = useState("");
  const [providerSending, setProviderSending] = useState(false);
  const [providerHasUnread, setProviderHasUnread] = useState(false);
  const [providerTranslatingId, setProviderTranslatingId] = useState<string | null>(null);
  const providerScrollRef = useRef<HTMLDivElement>(null);
  const providerTranslationCache = useRef(new Map<string, string>());
  const providerInitialLoad = useRef(true);

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
        if (res.status === 401 || res.status === 403) {
          // Token was invalidated — stop polling and signal auth context to sign out
          console.warn("⚠️ [DashboardNew] Tablet poll got 401 — dispatching auth-rejected");
          window.dispatchEvent(new CustomEvent("mpm:polling-auth-rejected"));
          return;
        }
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
      setLocation("/pricing");
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
      setLocation("/pricing");
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
      setLocation("/pricing");
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

  const handleTabletPlay = async (entry: any) => {
    if (tabletPlayingId === entry.id) {
      tabletAudioRef.current?.pause();
      setTabletPlayingId(null);
      return;
    }
    tabletAudioRef.current?.pause();
    setTabletPlayingId(entry.id);
    try {
      let url = tabletAudioCache.current[entry.id];
      if (!url) {
        const res = await fetch(apiUrl(`/api/client/tablet/audio/${entry.id}`), {
          headers: { ...getAuthHeaders() },
          credentials: "include",
        });
        if (!res.ok) {
          setTabletError("Audio not available yet — try again shortly");
          setTabletPlayingId(null);
          return;
        }
        const data = await res.json();
        if (data.pending) {
          setTabletError("Still transcribing — try again in a moment");
          setTabletPlayingId(null);
          return;
        }
        url = data.url;
        tabletAudioCache.current[entry.id] = url;
      }
      const audio = new Audio(url);
      tabletAudioRef.current = audio;
      audio.onended = () => setTabletPlayingId(null);
      audio.onerror = () => {
        setTabletError("Could not play audio");
        setTabletPlayingId(null);
      };
      audio.play();
    } catch {
      setTabletError("Could not load audio");
      setTabletPlayingId(null);
    }
  };

  const startTabletRecording = async () => {
    setTabletError(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setTabletError("Audio recording not supported in this browser");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      tabletStreamRef.current = stream;

      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "audio/webm";
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "audio/mp4";
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      tabletMediaRecorderRef.current = recorder;
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType || "audio/webm" });
        setTabletAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
        tabletStreamRef.current = null;
        if (tabletRecordingTimerRef.current) {
          clearInterval(tabletRecordingTimerRef.current);
          tabletRecordingTimerRef.current = null;
        }
      };

      recorder.start(500);
      setTabletRecording(true);
      setTabletRecordingSec(0);
      tabletRecordingTimerRef.current = setInterval(() => {
        setTabletRecordingSec((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      if (err?.name === "NotAllowedError") {
        setTabletError("Microphone access denied — please allow it in your browser settings");
      } else {
        setTabletError("Could not start recording");
      }
    }
  };

  const stopTabletRecording = () => {
    tabletMediaRecorderRef.current?.stop();
    setTabletRecording(false);
    if (tabletRecordingTimerRef.current) {
      clearInterval(tabletRecordingTimerRef.current);
      tabletRecordingTimerRef.current = null;
    }
  };

  const discardTabletVoice = () => {
    setTabletAudioBlob(null);
    setTabletRecordingSec(0);
    tabletStreamRef.current?.getTracks().forEach((t) => t.stop());
    tabletStreamRef.current = null;
  };

  const sendTabletVoice = async () => {
    if (!tabletAudioBlob || tabletVoiceSending) return;
    setTabletVoiceSending(true);
    try {
      const formData = new FormData();
      formData.append("audio", tabletAudioBlob, "voice-message.webm");
      const res = await fetch(apiUrl("/api/client/tablet/voice-message"), {
        method: "POST",
        headers: { ...getAuthHeaders() },
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setTabletError(errData.error || "Failed to send voice message");
        return;
      }
      const data = await res.json();
      setTabletMessages((prev) => [...prev, data.entry]);
      setTabletAudioBlob(null);
      setTabletRecordingSec(0);
    } catch {
      setTabletError("Failed to send voice message");
    } finally {
      setTabletVoiceSending(false);
    }
  };

  // ── Provider inbox functions (fully independent) ──────────────────────────
  const fetchProviderTablet = useCallback(async () => {
    if (providerInitialLoad.current) setProviderLoading(true);
    setProviderError(null);
    try {
      const res = await fetch(apiUrl("/api/client/tablet"), {
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          // Token was invalidated — stop polling and signal auth context to sign out
          console.warn("⚠️ [DashboardNew] Provider tablet poll got 401 — dispatching auth-rejected");
          window.dispatchEvent(new CustomEvent("mpm:polling-auth-rejected"));
          return;
        }
        if (res.status === 404) setProviderError("No active provider connection");
        else setProviderError("Failed to load messages");
        return;
      }
      const data = await res.json();
      const msgs = data.messages || [];
      setProviderMessages((prev) => {
        if (JSON.stringify(prev.map((m: any) => m.id)) === JSON.stringify(msgs.map((m: any) => m.id))) return prev;
        return msgs;
      });
      const seenTime = parseInt(localStorage.getItem("mpm.tablet.provider.lastSeen") || "0", 10);
      const proMsgs = msgs.filter((m: any) => m.sender === "pro");
      if (proMsgs.length > 0) {
        setProviderHasUnread(new Date(proMsgs[proMsgs.length - 1].createdAt).getTime() > seenTime);
      } else {
        setProviderHasUnread(false);
      }
    } catch {
      setProviderError("Failed to load messages");
    } finally {
      setProviderLoading(false);
      providerInitialLoad.current = false;
    }
  }, []);

  const handleProviderSend = async () => {
    if (!hasProviderConnection) return;
    if (!providerInput.trim() || providerSending) return;
    setProviderSending(true);
    try {
      const res = await fetch(apiUrl("/api/client/tablet/message"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ body: providerInput.trim() }),
      });
      if (!res.ok) {
        if (res.status === 422) {
          const errData = await res.json().catch(() => ({}));
          setProviderError(errData.error || "Message blocked by content policy");
          return;
        }
        throw new Error("Failed to send");
      }
      const data = await res.json();
      setProviderMessages((prev) => [...prev, data.entry]);
      setProviderInput("");
    } catch {
      setProviderError("Failed to send message");
    } finally {
      setProviderSending(false);
    }
  };

  const handleProviderTranslate = async (entry: any) => {
    if (!hasProviderConnection || providerTranslatingId) return;
    const cacheKey = `${entry.id}_translate`;
    if (providerTranslationCache.current.has(cacheKey)) {
      setProviderMessages((prev) =>
        prev.map((n: any) =>
          n.id === entry.id
            ? { ...n, translatedBody: n.translatedBody ? undefined : providerTranslationCache.current.get(cacheKey) }
            : n
        )
      );
      return;
    }
    setProviderTranslatingId(entry.id);
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
      const translated = data.translated?.description || data.description || entry.body;
      providerTranslationCache.current.set(cacheKey, translated);
      setProviderMessages((prev) =>
        prev.map((n: any) => n.id === entry.id ? { ...n, translatedBody: translated } : n)
      );
    } catch {
      setProviderError("Translation failed");
    } finally {
      setProviderTranslatingId(null);
    }
  };

  const handleProviderDelete = async (entry: any) => {
    if (!hasProviderConnection) return;
    try {
      const res = await fetch(apiUrl(`/api/client/tablet/entry/${entry.id}`), {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setProviderMessages((prev) => prev.filter((m: any) => m.id !== entry.id));
    } catch {
      setProviderError("Failed to delete message");
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
    if (isProCareClient && sessionStorage.getItem("mpm.openClientChat") === "1") {
      sessionStorage.removeItem("mpm.openClientChat");
      setTabletOpen(true);
    }
  }, [isProCareClient]);

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

  // Provider inbox polling effects
  useEffect(() => {
    if (isCoach && hasProviderConnection && !providerOpen) {
      fetchProviderTablet();
      const bg = setInterval(fetchProviderTablet, 30000);
      return () => clearInterval(bg);
    }
  }, [isCoach, hasProviderConnection, providerOpen, fetchProviderTablet]);

  useEffect(() => {
    if (providerOpen && isCoach && hasProviderConnection) {
      providerInitialLoad.current = true;
      fetchProviderTablet();
      const interval = setInterval(fetchProviderTablet, 10000);
      localStorage.setItem("mpm.tablet.provider.lastSeen", Date.now().toString());
      setProviderHasUnread(false);
      return () => clearInterval(interval);
    }
  }, [providerOpen, isCoach, hasProviderConnection, fetchProviderTablet]);

  useEffect(() => {
    if (providerScrollRef.current) {
      providerScrollRef.current.scrollTop = providerScrollRef.current.scrollHeight;
    }
  }, [providerMessages]);

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
    if (user.isTester) return;
    const dismissKey = `mpm.dismiss.subscriptionModal.${user.id}`;
    if (localStorage.getItem(dismissKey) === "true") return;
    setShowSubscriptionModal(true);
  }, [user]);


  // Greeting priority: nickname > firstName > username-derived name > fallback
  const firstName =
    user?.nickname || user?.firstName || user?.name?.split(" ")[0] || "there";

  const features: FeatureCard[] = [
    {
      title: t("macroCalc"),
      description: t("macroCalcDesc"),
      icon: Calculator,
      route: "/macro-counter",
      size: "large",
      testId: "macro-calculator",
    },
    {
      title: t("myBiometrics"),
      description: t("myBiometricsDesc"),
      icon: Activity,
      route: "/my-biometrics",
      size: "large",
      testId: "biometrics",
    },
    {
      title: t("savedMeals"),
      description: t("savedMealsDesc"),
      icon: Heart,
      route: "/saved-meals",
      size: "small",
      testId: "card-saved-meals",
    },
    {
      title: t("dailyJournal"),
      description: t("dailyJournalDesc"),
      icon: Lightbulb,
      route: "/get-inspiration",
      size: "small",
      testId: "card-inspiration",
    },
  ];

  const ESSENTIAL_ONLY_ROUTES: Record<string, string> = {
    "/saved-meals": "Saved Meals",
    "/shopping-list-v2": "Shopping List",
  };

  const handleCardClick = (route: string) => {
    const featureName = ESSENTIAL_ONLY_ROUTES[route];
    if (featureName && !hasActivePaidSubscription(user)) {
      requestUpgrade({ requiredTier: "essential", featureName });
      return;
    }
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

  const dashboardGlowConfigs: Record<string, { glowBg: string; border: string; hoverBorder: string; hoverShadow: string; cardBg: string; iconBg: string; iconColor: string }> = {
    "/macro-counter": {
      glowBg: "radial-gradient(120% 120% at 50% 0%, rgba(249,115,22,0.5), rgba(249,115,22,0.25), rgba(0,0,0,0))",
      border: "border-orange-500/30",
      hoverBorder: "hover:border-orange-500/60",
      hoverShadow: "hover:shadow-[0_0_30px_rgba(249,115,22,0.45)]",
      cardBg: "from-black via-orange-950/30 to-black",
      iconBg: "from-orange-500/20 to-orange-700/20 border border-orange-500/30",
      iconColor: "text-orange-500",
    },
    "/my-biometrics": {
      glowBg: "radial-gradient(120% 120% at 50% 0%, rgba(6,182,212,0.5), rgba(6,182,212,0.25), rgba(0,0,0,0))",
      border: "border-cyan-500/30",
      hoverBorder: "hover:border-cyan-500/60",
      hoverShadow: "hover:shadow-[0_0_30px_rgba(6,182,212,0.45)]",
      cardBg: "from-black via-cyan-950/30 to-black",
      iconBg: "from-cyan-500/20 to-cyan-700/20 border border-cyan-500/30",
      iconColor: "text-cyan-400",
    },
    "/saved-meals": {
      glowBg: "radial-gradient(120% 120% at 50% 0%, rgba(244,63,94,0.5), rgba(244,63,94,0.25), rgba(0,0,0,0))",
      border: "border-rose-500/30",
      hoverBorder: "hover:border-rose-500/60",
      hoverShadow: "hover:shadow-[0_0_30px_rgba(244,63,94,0.45)]",
      cardBg: "from-black via-rose-950/30 to-black",
      iconBg: "from-rose-500/20 to-rose-700/20 border border-rose-500/30",
      iconColor: "text-rose-400",
    },
    "/get-inspiration": {
      glowBg: "radial-gradient(120% 120% at 50% 0%, rgba(245,158,11,0.5), rgba(245,158,11,0.25), rgba(0,0,0,0))",
      border: "border-amber-500/30",
      hoverBorder: "hover:border-amber-500/60",
      hoverShadow: "hover:shadow-[0_0_30px_rgba(245,158,11,0.45)]",
      cardBg: "from-black via-amber-950/30 to-black",
      iconBg: "from-amber-500/20 to-amber-700/20 border border-amber-500/30",
      iconColor: "text-amber-400",
    },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-full flex flex-col bg-black pb-safe-nav"
    >
      {!isDesktop && (
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 h-14">
            {/* LEFT: plan tier badge */}
            <div className="justify-self-start">
              {mobilePlanBadge && (
                <span
                  className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${DASH_BADGE_CLASSES[mobilePlanBadge.variant]}`}
                  style={{ lineHeight: "1.4" }}
                >
                  {t(mobilePlanBadge.textKey)}
                </span>
              )}
            </div>
            {/* CENTER: MPM — always mathematically centered */}
            <h1 className="justify-self-center text-md font-bold text-white">{t("mpmLabel")}</h1>
            {/* RIGHT: Bug report + Hub */}
            <div className="justify-self-end flex items-center gap-2">
              <BugReportButton />
              <ProfileSheet>
                <button
                  className="flex items-center gap-1.5 px-3 py-2 bg-black/50 backdrop-blur-sm border border-white/10 rounded-lg hover:bg-black/70 hover:border-orange-500/30 transition-all"
                  data-testid="button-my-hub"
                >
                  <span className="text-xs font-semibold text-orange-400">{t("hubLabel")}</span>
                  <HubControlIcon size="md" />
                </button>
              </ProfileSheet>
            </div>
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
        <PatternAlertBanner />
        <TipsBanner />

        <WhatsNewCard />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mb-4"
        >
          <div className="relative h-48 rounded-xl overflow-hidden">
            <img
              src="/images/home-hero.png"
              alt={t("heroAlt")}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <div className="w-fit bg-black/60 backdrop-blur-sm rounded-xl px-3 py-2.5 mb-3">
                <h2 className="text-base font-bold text-white mb-1">
                  {t("greeting", { name: firstName })}
                </h2>
                <p className="text-white text-sm mb-2">
                  {t("coachLearning")}
                </p>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/30 border border-orange-400/60 text-orange-200 text-xs font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                  {t("behaviorBadge")}
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        <NutritionPersonalizationSummaryCard />

        <TodaysPrescriptionCard />

        {COACHES_CORNER_ENABLED && <CoachCornerCard />}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.5 }}
          className="mb-4 space-y-3"
        >
          {isCoach ? (
            <>
              {/* Card 1: Client Messages inbox */}
              <div className="relative">
                <div className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-70" style={{ background: "radial-gradient(120% 120% at 50% 0%, rgba(20,184,166,0.5), rgba(20,184,166,0.25), rgba(0,0,0,0))" }} />
              <Card
                className={`relative cursor-pointer active:scale-[0.98] bg-black/30 backdrop-blur-lg transition-all duration-300 rounded-xl shadow-md ${proUnreadCount > 0 ? "border-2 border-orange-400 shadow-[0_0_0_3px_rgba(249,115,22,0.25),0_0_28px_rgba(249,115,22,0.8)]" : "border border-teal-500/30"}`}
                onClick={() => setShowWorkspaceChooser(true)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${proUnreadCount > 0 ? "bg-orange-500/20" : "bg-teal-500/20"}`}>
                      <MessageSquare className={`h-5 w-5 ${proUnreadCount > 0 ? "text-orange-400" : "text-teal-400"}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-white">{t("clientMessages")}</h3>
                      <p className={`text-xs ${proUnreadCount > 0 ? "text-orange-400 font-medium" : "text-white"}`}>
                        {proUnreadCount > 0
                          ? t("newClientMsg", { n: proUnreadCount })
                          : t("noClientMsg")}
                      </p>
                    </div>
                    {proUnreadCount > 0 && (
                      <span className="text-[10px] font-bold text-white bg-orange-500 rounded-full px-2 py-0.5 min-w-[1.4rem] text-center">
                        {proUnreadCount}
                      </span>
                    )}
                    <ChevronDown className={`h-4 w-4 ${proUnreadCount > 0 ? "text-orange-400/60" : "text-white/30"}`} />
                  </div>
                </CardContent>
              </Card>
              </div>

              {/* Card 2: Provider Messages inbox — only for coaches who are also under a provider */}
              {hasProviderConnection && (
                <div className="relative">
                  <div className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-70" style={{ background: "radial-gradient(120% 120% at 50% 0%, rgba(59,130,246,0.5), rgba(59,130,246,0.25), rgba(0,0,0,0))" }} />
                <Card
                  className={`relative cursor-pointer active:scale-[0.98] bg-black/30 backdrop-blur-lg transition-all duration-300 rounded-xl shadow-md ${providerHasUnread ? "border-2 border-orange-400 shadow-[0_0_0_3px_rgba(249,115,22,0.25),0_0_28px_rgba(249,115,22,0.8)]" : "border border-blue-500/30"}`}
                  onClick={() => setProviderOpen(!providerOpen)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${providerHasUnread ? "bg-orange-500/20" : "bg-blue-500/20"}`}>
                        <MessageSquare className={`h-5 w-5 ${providerHasUnread ? "text-orange-400" : "text-blue-400"}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-white">{t("providerMessages")}</h3>
                        <p className={`text-xs ${providerHasUnread ? "text-orange-400 font-medium" : "text-white"}`}>
                          {providerHasUnread ? t("newProviderMsg") : t("providerMsg")}
                        </p>
                      </div>
                      {providerHasUnread && (
                        <span className="text-[10px] font-bold text-white bg-orange-500 rounded-full px-2 py-0.5 uppercase tracking-wide">{t("newBadge")}</span>
                      )}
                      {providerOpen ? (
                        <ChevronUp className="h-4 w-4 text-white/40" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-white/40" />
                      )}
                    </div>
                  </CardContent>
                </Card>
                </div>
              )}
            </>
          ) : isProCareClient ? (
            <div className="relative">
              <div className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-70" style={{ background: "radial-gradient(120% 120% at 50% 0%, rgba(168,85,247,0.5), rgba(168,85,247,0.25), rgba(0,0,0,0))" }} />
            <Card
              className={`relative cursor-pointer active:scale-[0.98] bg-black/30 backdrop-blur-lg transition-all duration-300 rounded-xl shadow-md ${tabletHasUnread ? "border-2 border-orange-400 shadow-[0_0_0_3px_rgba(249,115,22,0.25),0_0_28px_rgba(249,115,22,0.8)]" : "border border-purple-500/30"}`}
              onClick={() => setTabletOpen(!tabletOpen)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${tabletHasUnread ? "bg-orange-500/20" : "bg-purple-500/20"}`}>
                    <MessageSquare className={`h-5 w-5 ${tabletHasUnread ? "text-orange-400" : "text-purple-400"}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white">
                      {t("myMessages")}
                    </h3>
                    <p className={`text-xs ${tabletHasUnread ? "text-orange-400 font-medium" : "text-white/70"}`}>
                      {tabletHasUnread ? t("newCoachMsg") : t("viewCoach")}
                    </p>
                  </div>
                  {tabletHasUnread && (
                    <span className="text-[10px] font-bold text-white bg-orange-500 rounded-full px-2 py-0.5 uppercase tracking-wide">{t("newBadge")}</span>
                  )}
                  {tabletOpen ? (
                    <ChevronUp className="h-4 w-4 text-white/40" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-white/40" />
                  )}
                </div>
              </CardContent>
            </Card>
            </div>
          ) : (
            <div className="relative">
              <div className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-70" style={{ background: "radial-gradient(120% 120% at 50% 0%, rgba(249,115,22,0.3), rgba(249,115,22,0.1), rgba(0,0,0,0))" }} />
            <Card
              className="relative cursor-pointer active:scale-[0.98] bg-black/30 backdrop-blur-lg border border-white/10 transition-all duration-300 rounded-xl shadow-md opacity-70"
              onClick={() => setLocation("/pricing")}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-white/10 relative">
                    <MessageSquare className="h-5 w-5 text-white/40" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white/70 flex items-center gap-1.5">
                      {t("procareMessages")}
                      <Lock className="h-3.5 w-3.5 text-orange-400" />
                    </h3>
                    <p className="text-xs text-white/50">
                      {t("chatDirectDesc")}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-white/20" />
                </div>
              </CardContent>
            </Card>
            </div>
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
                        {t("noMessages")}
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
                            {entry.sender === "client" ? t("you") : t("coach")}{" "}
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
                              title={t("translate")}
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
                              title={t("delete")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {entry.contentType === "voice" ? (
                          <div className="space-y-2">
                            {/* Play button row */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleTabletPlay(entry)}
                                className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${
                                  tabletPlayingId === entry.id
                                    ? "bg-orange-500 text-white"
                                    : "bg-white/10 text-white/70"
                                }`}
                              >
                                {tabletPlayingId === entry.id ? (
                                  <Pause className="w-3.5 h-3.5" />
                                ) : (
                                  <Play className="w-3.5 h-3.5 ml-0.5" />
                                )}
                              </button>
                              <div className="flex items-center gap-1.5">
                                <Mic className="w-3 h-3 text-orange-400" />
                                <span className="text-[11px] text-orange-300 font-medium">
                                  {t("voiceNote")}
                                  {entry.audioDurationSec
                                    ? ` · ${Math.floor(entry.audioDurationSec / 60)}:${String(entry.audioDurationSec % 60).padStart(2, "0")}`
                                    : ""}
                                </span>
                              </div>
                            </div>
                            {/* Transcript */}
                            {entry.transcriptStatus === "completed" && entry.transcript ? (
                              <p className="text-xs text-white/75 leading-relaxed italic border-l-2 border-orange-500/40 pl-2">
                                {entry.translatedBody || entry.transcript}
                              </p>
                            ) : entry.transcriptStatus === "failed" ? (
                              <p className="text-[10px] text-white/35 italic">{t("transcriptUnavailable")}</p>
                            ) : (
                              <p className="text-[10px] text-white/35 italic">{t("transcribing")}</p>
                            )}
                          </div>
                        ) : (
                          <>
                            <p className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap">
                              {entry.translatedBody || entry.body}
                            </p>
                            {entry.translatedBody && (
                              <p className="text-[10px] text-white/30 mt-1 italic">
                                {t("original", { text: entry.body })}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  {tabletRecording ? (
                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
                      <Mic className="w-4 h-4 text-red-400 animate-pulse shrink-0" />
                      <span className="text-sm text-red-300 flex-1">
                        {t("recording")} {Math.floor(tabletRecordingSec / 60)}:{String(tabletRecordingSec % 60).padStart(2, "0")}
                      </span>
                      <button
                        onClick={stopTabletRecording}
                        className="flex items-center justify-center w-8 h-8 rounded-full bg-red-500 text-white shrink-0"
                        title={t("stopRecording")}
                      >
                        <Square className="w-3.5 h-3.5 fill-white" />
                      </button>
                    </div>
                  ) : tabletAudioBlob ? (
                    <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-md px-3 py-2">
                      <Mic className="w-4 h-4 text-orange-400 shrink-0" />
                      <span className="text-sm text-orange-300 flex-1">
                        {t("voiceReady")} · {Math.floor(tabletRecordingSec / 60)}:{String(tabletRecordingSec % 60).padStart(2, "0")}
                      </span>
                      <button
                        onClick={discardTabletVoice}
                        className="text-white/40 px-1 text-xs shrink-0"
                        title={t("discard")}
                      >
                        ✕
                      </button>
                      <Button
                        size="sm"
                        disabled={tabletVoiceSending}
                        onClick={sendTabletVoice}
                        className="bg-orange-600 px-3 shrink-0"
                      >
                        {tabletVoiceSending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <textarea
                        value={tabletInput}
                        onChange={(e) => setTabletInput(e.target.value)}
                        placeholder={t("replyCoach")}
                        className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-orange-500/50"
                        rows={2}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleTabletSend();
                          }
                        }}
                      />
                      <div className="flex flex-col gap-1.5 self-end">
                        <button
                          onClick={startTabletRecording}
                          className="flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white/60"
                          title={t("sendVoice")}
                        >
                          <Mic className="w-4 h-4" />
                        </button>
                        <Button
                          size="sm"
                          disabled={!tabletInput.trim() || tabletSending}
                          onClick={handleTabletSend}
                          className="bg-orange-600 px-3"
                        >
                          {tabletSending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Provider inbox panel — fully independent from client tablet */}
          {providerOpen && isCoach && hasProviderConnection && (
            <div className="bg-black/30 backdrop-blur-lg border border-blue-500/20 rounded-xl p-4 space-y-3">
              {providerLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-white/40" />
                </div>
              )}
              {providerError && (
                <p className="text-sm text-red-400">{providerError}</p>
              )}
              {!providerLoading && !providerError && (
                <>
                  <div ref={providerScrollRef} className="max-h-64 overflow-y-auto space-y-2">
                    {providerMessages.length === 0 && (
                      <p className="text-xs text-white/30 py-2">{t("noMessages")}</p>
                    )}
                    {providerMessages.map((entry: any) => (
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
                            {entry.sender === "client" ? t("you") : t("provider")}{" "}
                            &middot;{" "}
                            {new Date(entry.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
                            {new Date(entry.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleProviderTranslate(entry); }}
                              disabled={providerTranslatingId === entry.id}
                              className="text-blue-400 p-0.5"
                              title={t("translate")}
                            >
                              {providerTranslatingId === entry.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Globe className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleProviderDelete(entry); }}
                              className="text-red-500 p-0.5"
                              title={t("delete")}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap">
                          {entry.translatedBody || entry.body}
                        </p>
                        {entry.translatedBody && (
                          <p className="text-[10px] text-white/30 mt-1 italic">{t("original", { text: entry.body })}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <textarea
                      value={providerInput}
                      onChange={(e) => setProviderInput(e.target.value)}
                      placeholder={t("replyProvider")}
                      className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-blue-500/50"
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleProviderSend();
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      disabled={!providerInput.trim() || providerSending}
                      onClick={handleProviderSend}
                      className="bg-blue-600 hover:bg-blue-700 px-3 self-end"
                    >
                      {providerSending ? (
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
              <div className="relative">
                <div className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-70" style={{ background: "radial-gradient(120% 120% at 50% 0%, rgba(59,130,246,0.5), rgba(59,130,246,0.25), rgba(0,0,0,0))" }} />
                <Card
                  className="relative cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(59,130,246,0.45)] active:scale-95 bg-gradient-to-r from-black via-blue-950/30 to-black backdrop-blur-lg border border-blue-500/30 hover:border-blue-400/60 rounded-xl group"
                  style={{ backgroundColor: "transparent" }}
                  data-testid="card-medical-safety"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-700/20 border border-blue-500/30">
                        <Activity className="h-6 w-6 text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-white text-base">
                          {t("sourcesTitle")}
                        </CardTitle>
                        <CardDescription className="text-white/70 text-xs mt-1">
                          {t("sourcesOrgs")}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </div>
            }
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mb-4"
        >
          <div className="relative">
            <div className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-70" style={{ background: "radial-gradient(120% 120% at 50% 0%, rgba(16,185,129,0.5), rgba(16,185,129,0.25), rgba(0,0,0,0))" }} />
            <Card
              className="relative cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(16,185,129,0.45)] active:scale-95 bg-gradient-to-r from-black via-emerald-950/30 to-black backdrop-blur-lg border border-emerald-500/30 hover:border-emerald-500/60 rounded-xl group"
              style={{ backgroundColor: "transparent" }}
              onClick={() => setLocation("/shopping-list-v2")}
              data-testid="card-shopping-list"
            >
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-700/20 border border-emerald-500/30 group-hover:from-emerald-500/30 group-hover:to-emerald-700/30 transition-all">
                    <ShoppingCart className="h-6 w-6 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-white text-base">
                      {" "}
                      {t("shoppingCard")}
                    </CardTitle>
                    <CardDescription className="text-white/70 text-xs mt-1">
                      {t("shoppingDesc")}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </div>
        </motion.div>

        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="mb-4"
          >
            <div className="relative">
              <div className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-70" style={{ background: "radial-gradient(120% 120% at 50% 0%, rgba(245,158,11,0.5), rgba(245,158,11,0.25), rgba(0,0,0,0))" }} />
              <Card
                className="relative cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(245,158,11,0.45)] active:scale-95 bg-gradient-to-r from-black via-amber-950/30 to-black backdrop-blur-lg border border-amber-500/30 hover:border-amber-500/60 rounded-xl group"
                style={{ backgroundColor: "transparent" }}
                onClick={handlePhotoLog}
                data-testid="card-photo-log"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-700/20 border border-amber-500/30 group-hover:from-amber-500/30 group-hover:to-amber-700/30 transition-all">
                      <Camera className="h-6 w-6 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-white text-lg">
                        {t("macroScanCard")}
                      </CardTitle>
                      <CardDescription className="text-white/70 text-sm mt-1">
                        {t("macroScanDesc")}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </div>
          </motion.div>

        {/* Recipe Maker */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="mb-4"
        >
          <div className="relative">
            <div className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-70" style={{ background: "radial-gradient(120% 120% at 50% 0%, rgba(244,63,94,0.5), rgba(244,63,94,0.25), rgba(0,0,0,0))" }} />
            <Card
              onClick={() => {
                if (!hasActivePaidSubscription(user)) {
                  requestUpgrade({ requiredTier: "essential", featureName: "Recipe Maker" });
                  return;
                }
                setShowInspirationModal(true);
              }}
              className="relative cursor-pointer transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_0_30px_rgba(244,63,94,0.45)] active:scale-95 bg-gradient-to-r from-black via-rose-950/30 to-black backdrop-blur-lg border border-rose-500/30 hover:border-rose-500/60 rounded-xl group"
              style={{ backgroundColor: "transparent" }}
              data-testid="card-recipe-scan"
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-gradient-to-br from-rose-500/20 to-rose-700/20 border border-rose-500/30 group-hover:from-rose-500/30 group-hover:to-rose-700/30 transition-all">
                    <Camera className="h-6 w-6 text-rose-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-white">{t("recipeScanCard")}</h3>
                    <p className="text-xs text-white/60">{t("recipeScanDesc")}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Last Recipe Maker card */}
        {lastRecipeScan && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mb-4"
          >
            <div className="rounded-xl bg-black/30 backdrop-blur-lg border border-orange-500/30 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-2 rounded-lg bg-orange-500/15 border border-orange-500/25 shrink-0">
                    <Camera className="h-4 w-4 text-orange-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-orange-400 font-medium uppercase tracking-wide mb-0.5">{t("lastRecipeScan")}</p>
                    <p className="text-white font-semibold text-sm truncate">
                      {lastRecipeScan.mealData?.title || lastRecipeScan.mealData?.name || t("scannedRecipe")}
                    </p>
                    {(lastRecipeScan.mealData?.nutrition?.calories != null) && (
                      <p className="text-white/50 text-xs mt-0.5">
                        {lastRecipeScan.mealData.nutrition.calories} {t("calUnit")}
                        {lastRecipeScan.mealData.nutrition?.protein != null && ` · ${t("proteinUnit", { g: lastRecipeScan.mealData.nutrition.protein })}`}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => {
                      if (!hasActivePaidSubscription(user)) {
                        requestUpgrade({ requiredTier: "essential", featureName: "Recipe Maker" });
                        return;
                      }
                      setShowInspirationModal(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-orange-600 text-white text-xs font-semibold active:scale-95 transition-all"
                  >
                    {t("view")}
                  </button>
                  <button
                    onClick={() => {
                      try { localStorage.removeItem("mpm.recipe.lastScan"); } catch {}
                      setLastRecipeScan(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white/8 border border-white/10 text-white/60 text-xs font-semibold active:scale-95 transition-all"
                  >
                    {t("clear")}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isMacroCalculator = feature.testId === "macro-calculator";
            const shouldFlash = isGuidedMode && isMacroCalculator;
            const glow = dashboardGlowConfigs[feature.route] ?? dashboardGlowConfigs["/macro-counter"];
            return (
              <motion.div
                key={feature.testId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1, duration: 0.5 }}
                className="md:col-span-1 relative"
              >
                <div
                  className="pointer-events-none absolute -inset-1 rounded-xl blur-md opacity-70"
                  style={{ background: glow.glowBg }}
                />
                <Card
                  onClick={() => handleCardClick(feature.route)}
                  className={`relative cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-95 bg-gradient-to-r ${glow.cardBg} backdrop-blur-lg border ${glow.border} ${glow.hoverBorder} ${glow.hoverShadow} rounded-xl group ${shouldFlash ? "flash-border" : ""}`}
                  style={{ backgroundColor: "transparent" }}
                  data-testid={feature.testId}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg bg-gradient-to-br ${glow.iconBg} transition-all`}>
                        <Icon className={`h-6 w-6 ${glow.iconColor}`} />
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-white">
                          {feature.title}
                        </h3>
                        <p className="text-xs text-white/70">
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
                {t("readyToPlan")}
              </h3>
              <p className="text-white/70 text-sm mb-4">
                {t("readyToPlanDesc")}
              </p>
              <button
                onClick={() => setLocation("/planner")}
                className="px-6 py-2 bg-gradient-to-r from-orange-500 to-orange-700 hover:from-orange-600 hover:to-orange-800 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl"
                data-testid="button-go-to-planner"
              >
                {t("goToBuilders")}
              </button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <MacroScanModal
        open={showMacroModal}
        onOpenChange={setShowMacroModal}
        onSuccess={(result) => {
          setShowMacroModal(false);
          setLocation(
            `/my-biometrics?from=photo&p=${result.protein}&c=${result.carbs}&f=${result.fat}&k=${result.calories}`
          );
        }}
      />

      <InspirationCaptureModal
        open={showInspirationModal}
        onOpenChange={(v) => {
          setShowInspirationModal(v);
          if (!v) {
            try { setLastRecipeScan(JSON.parse(localStorage.getItem("mpm.recipe.lastScan") ?? "null")); } catch {}
          }
        }}
      />

      <InformationModal open={showSubscriptionModal} onOpenChange={setShowSubscriptionModal} className="sm:max-w-md bg-black/90 text-white border-orange-500/40 backdrop-blur-lg" title={<span className="font-bold text-center block">{t("upgradeTitle")}</span>} description={t("upgradeDesc")}>
          <div className="mt-4 space-y-2 text-sm text-white/80">
            <div>• {t("upgradeItem1")}</div>
            <div>• {t("upgradeItem2")}</div>
            <div>• {t("upgradeItem3")}</div>
            <div>• {t("upgradeItem4")}</div>
          </div>
          <div className="mt-6 space-y-3">
            <Button
              className="w-full bg-orange-600 hover:bg-orange-700"
              onClick={() => {
                if (user) localStorage.setItem(`mpm.dismiss.subscriptionModal.${user.id}`, "true");
                setShowSubscriptionModal(false);
                setLocation("/pricing");
              }}
            >
              {t("explorePlans")}
            </Button>
            <Button
              variant="ghost"
              className="w-full text-orange-400 hover:bg-orange-500/10"
              onClick={() => {
                if (user) localStorage.setItem(`mpm.dismiss.subscriptionModal.${user.id}`, "true");
                setShowSubscriptionModal(false);
              }}
            >
              {t("continueCurrentPlan")}
            </Button>
          </div>
      </InformationModal>

      {showWorkspaceChooser && (
        <WorkspaceChooser
          onChoose={(choice) => {
            setShowWorkspaceChooser(false);
            if (choice === "workspace") {
              localStorage.setItem("mpm_active_space", "workspace");
              setLocation(
                user?.professionalRole === "physician"
                  ? "/pro/physician-clients"
                  : "/pro/clients"
              );
            }
          }}
        />
      )}
    </motion.div>
  );
}
