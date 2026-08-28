// client/src/pages/MyBiometrics.tsx
// Local-first, zero-fragility Biometrics page
// • No server calls. Optional one-line sync hooks are commented.
// • Stores: macros, steps, body stats, blood pressure — all in localStorage
// • Simple, readable components; black-glass aesthetic; consistent text colors
// • Charts use recharts and render from local data

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import {
  createWaterLog,
  getWaterLogs,
  isWaterHistoryResponseCurrent,
} from "@/lib/waterLogsApi";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PillButton } from "@/components/ui/pill-button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InformationModal, ConfirmationModal } from "@/components/ui/universal-modal";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  PlusCircle,
  RotateCcw,
  Home,
  Activity,
  Scale,
  Stethoscope,
  BarChart3,
  Target,
  ArrowLeft,
  Info,
  Ruler,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { readDraft, clearDraft } from "@/lib/macrosDraft";
import { startQueueAutoFlush, queueOrPost } from "@/lib/queue";
import { normalizeMacros } from "@/lib/macroNormalize";
import { getQuickView, clearQuickView, QuickView } from "@/lib/macrosQuickView";
import { parseBiometricsParams, BIOMETRICS_SOURCES, SECTION_IDS } from "@/lib/biometricsNavigation";
import { getMacroTargets, MacroTargets } from "@/lib/dailyLimits";
import { getResolvedTargets } from "@/lib/macroResolver";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { MACRO_SOURCES, getMacroSourceBySlug } from "@/lib/macroSourcesConfig";
import ReadOnlyNote from "@/components/ReadOnlyNote";
import MacroScanModal from "@/components/MacroScanModal";
import { launchIngredientPhotoCapture, type IngredientScanResult } from "@/lib/photoIngredientCapture";
import { IngredientIntelligenceSheet } from "@/components/biometrics/IngredientIntelligenceSheet";
import { useTranslation } from "react-i18next";
import { sendToShoppingList } from "@/lib/shoppingListApi";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { isGuestMode, markStepCompleted } from "@/lib/guestMode";
import { GUEST_SUITE_BRANDING } from "@/lib/guestSuiteBranding";
import { markFirstLoopComplete, hasCompletedFirstLoop } from "@/lib/guestSuiteNavigator";
import { useGuestNavigationGuard } from "@/hooks/useGuestNavigationGuard";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { JustDescribeItModal } from "@/components/JustDescribeItModal";
import { getCurrentUser } from "@/lib/auth";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import ClinicalLabsCard from "@/components/biometrics/ClinicalLabsCard";
import TherapeuticNutritionCard from "@/components/biometrics/TherapeuticNutritionCard";
import MacroConsistencyTimeline from "@/components/biometrics/MacroConsistencyTimeline";
import { hasFeature } from "@/lib/entitlements";
import { canAccessClinicalLabs, canAccessTherapeuticNutrition } from "@/lib/subscriptionCheck";
import { useUpgradeModal } from "@/contexts/UpgradeModalContext";
import { convertWeightLbsDisplay } from "@shared/units";

// ============================== CONFIG ==============================
const SYNC_ENDPOINT = ""; // optional API endpoint; if set, we POST after local save

// keys
const LS_MACROS = "mpm_bio_macros_v1"; // { rows: OfflineDay[] }
const LS_BODY = "mpm_bio_body_v1"; // { weight?: number, waist?: number, heightIn?: number }
const LS_WEIGHT = "mpm_bio_weight_v1"; // WeightRow[]

// types
type OfflineDay = {
  day: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  starchyCarbs?: number;
  fibrousCarbs?: number;
};
interface WeightRow {
  id: string;
  date: string;
  weight: number;
}
interface WaistRow {
  id: string;
  date: string;
  value: number; // always in inches
  unit: string;
}

// utils
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const kcalFrom = (p = 0, c = 0, f = 0) =>
  Math.max(0, 4 * Number(p || 0) + 4 * Number(c || 0) + 9 * Number(f || 0));

// storage helpers
const loadJSON = <T,>(k: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const saveJSON = (k: string, v: any) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

// ============================== PAGE ==============================
export default function MyBiometrics() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation("biometrics");
  const isDesktop = useIsDesktop();
  const { requestUpgrade } = useUpgradeModal();
  
  const [isProSession] = useState(() => localStorage.getItem("pro-session") === "true");

  // === DEFERRED STORAGE READS (Option A: No localStorage during render) ===
  const [storageLoaded, setStorageLoaded] = useState(false);
  
  useGuestNavigationGuard("biometrics");

  const biometricsTourSteps: TourStep[] = [
    {
      title: "Your Macro Targets",
      description:
        "Your daily protein, carbs, and fat targets live at the top of this page. These stay saved until you recalculate them in the Macro Calculator.",
    },
    {
      title: "Persisted by Design",
      description:
        "Once your targets are set, they remain persistent. You don’t need to reset them unless your goals or stats change.",
    },
    {
      title: "Log Food with MacroScan",
      description:
        "Use MacroScan to log packaged foods quickly. Take a photo of a nutrition label, review the AI-analyzed macros, and add them to your day.",
    },
    {
      title: "Review Your Trends",
      description:
        "Track your macro totals over time. View daily, 7-day, and 30-day trends to stay consistent and spot patterns.",
    },
    {
      title: "Track Your Weight",
      description:
        "Log your weight to monitor progress. Charts show trends from one week up to a full year.",
    },
    {
      title: "Track Your Water",
      description:
        "Log your daily water intake at the bottom of the page to support hydration and recovery.",
    },
    {
      icon: "📐",
      title: "Body Composition Tracking",
      description:
        "Track your body fat percentage from scans like DEXA, BodPod, Calipers, or Smart Scale. Your body composition data syncs with the Macro Calculator and can adjust starchy carb allocation for Performance Nutrition and Performance builders.",
    },
  ];

  const quickTour = useQuickTour("my-biometrics");

  // Mark biometrics as viewed for guest users on mount
  // Also mark first loop complete if coming from shopping (this unlocks Fridge Rescue & Craving Creator)
  useEffect(() => {
    if (isGuestMode()) {
      markStepCompleted("biometrics_viewed");
      
      // Only mark first loop complete if user came from shopping list
      // We check for a session marker set by the shopping list page
      const cameFromShopping = sessionStorage.getItem("mpm_guest_from_shopping") === "true";
      if (cameFromShopping && !hasCompletedFirstLoop()) {
        markFirstLoopComplete();
        sessionStorage.removeItem("mpm_guest_from_shopping"); // Clear the marker
      }
    }
  }, []);

  // ------- MACROS (server-first, localStorage fallback) -------
  const [macroRows, setMacroRows] = useState<OfflineDay[]>([]);
  const userId = user?.id || "";

  useEffect(() => {
    if (!userId) {
      const stored = loadJSON<{ rows?: OfflineDay[] }>(LS_MACROS, {});
      if (stored.rows && stored.rows.length > 0) setMacroRows(stored.rows);
      setStorageLoaded(true);
      return;
    }

    const end = new Date();
    end.setHours(23, 59, 59, 999); // end-of-day so noon-UTC logged entries are never past the boundary
    const start = new Date();
    start.setDate(end.getDate() - 365);
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    apiRequest(`/api/users/${userId}/macro-logs/daily-with-source?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}`)
      .then((rows: any[]) => {
        const mapped: OfflineDay[] = rows.map(r => ({
          day: typeof r.date === "string" ? r.date.slice(0, 10) : r.date,
          kcal: Number(r.kcal) || 0,
          protein: Number(r.protein) || 0,
          carbs: Number(r.carbs) || 0,
          fat: Number(r.fat) || 0,
          starchyCarbs: Number(r.starchyCarbs) || 0,
          fibrousCarbs: Number(r.fibrousCarbs) || 0,
        }));
        setMacroRows(mapped);
        saveJSON(LS_MACROS, { rows: mapped });
        setStorageLoaded(true);
      })
      .catch(() => {
        const stored = loadJSON<{ rows?: OfflineDay[] }>(LS_MACROS, {});
        if (stored.rows && stored.rows.length > 0) setMacroRows(stored.rows);
        setStorageLoaded(true);
      });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const refetch = () => {
      const end = new Date();
      end.setHours(23, 59, 59, 999); // end-of-day so noon-UTC logged entries are never past the boundary
      const start = new Date();
      start.setDate(end.getDate() - 365);
      apiRequest(`/api/users/${userId}/macro-logs/daily-with-source?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`)
        .then((rows: any[]) => {
          if (rows) {
            const mapped: OfflineDay[] = rows.map(r => ({
              day: typeof r.date === "string" ? r.date.slice(0, 10) : r.date,
              kcal: Number(r.kcal) || 0,
              protein: Number(r.protein) || 0,
              carbs: Number(r.carbs) || 0,
              fat: Number(r.fat) || 0,
              starchyCarbs: Number(r.starchyCarbs) || 0,
              fibrousCarbs: Number(r.fibrousCarbs) || 0,
            }));
            setMacroRows(mapped);
            saveJSON(LS_MACROS, { rows: mapped });
          }
        })
        .catch(() => {});
    };
    window.addEventListener("macros:updated", refetch);
    return () => window.removeEventListener("macros:updated", refetch);
  }, [userId]);

  // Persist macroRows to localStorage whenever state changes so optimistic updates
  // survive a page reload even before the next server fetch completes.
  // Guard on storageLoaded so the initial empty-state render doesn't wipe the cache.
  useEffect(() => {
    if (!storageLoaded) return;
    saveJSON(LS_MACROS, { rows: macroRows });
  }, [macroRows, storageLoaded]);

  const [today, setToday] = useState(todayKey);

  // Midnight reset: re-arm a timeout each day so "today" updates and macros reset to zero
  useEffect(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 3);
    const ms = midnight.getTime() - now.getTime();
    const timer = setTimeout(() => {
      setToday(todayKey());
      window.dispatchEvent(new Event("macros:updated"));
    }, ms);
    return () => clearTimeout(timer);
  }, [today]);

  const sortedRows = useMemo(
    () => [...macroRows].sort((a, b) => b.day.localeCompare(a.day)),
    [macroRows],
  );
  const todayRow = sortedRows.find((r) => r.day === today) || {
    day: today,
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };
  const history30 = sortedRows.slice(0, 30);
  const history7 = sortedRows.slice(0, 7);
  const historyToday = [todayRow];


  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");
  const [k, setK] = useState("");
  const [sc, setSc] = useState(""); // starchyCarbs
  const [fc, setFc] = useState(""); // fibrousCarbs
  const [ingredientSheetOpen, setIngredientSheetOpen] = useState(false);
  const [ingredientResult, setIngredientResult] = useState<IngredientScanResult | null>(null);

  // Check URL params for pre-filled values from photo log
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const urlP = params.get("p");
    const urlC = params.get("c");
    const urlF = params.get("f");
    const urlK = params.get("k");

    if (urlP) setP(urlP);
    if (urlC) setC(urlC);
    if (urlF) setF(urlF);
    if (urlK) setK(urlK);

    // Clear URL params after reading
    if (urlP || urlC || urlF || urlK) {
      const url = new URL(window.location.href);
      url.searchParams.delete("p");
      url.searchParams.delete("c");
      url.searchParams.delete("f");
      url.searchParams.delete("k");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  // Profile selection for top-off adds
  type Profile =
    | "pure"
    | "chicken"
    | "turkey"
    | "whey"
    | "rice"
    | "oats"
    | "oil"
    | "fish"
    | "veggies"
    | "beef";
  const [selectedProfile, setSelectedProfile] = useState<Profile>("whey");
  const PROFILES_ENABLED = false; // DISABLED: Moved to AdditionalMacrosModal in meal builders

  // Heuristic tails (kept tiny + transparent)
  const applyProfile = (profile: Profile, P: number, C: number, F: number) => {
    switch (profile) {
      case "pure":
        return { P: P, C: C, F: F }; // macro-only
      case "whey":
        return { P: P, C: C, F: F }; // similar to pure (0 F/C)
      case "chicken":
        return { P: P, C: C, F: F + Math.round(P * 0.12) }; // ~12% of P shows up as fat
      case "turkey":
        return { P: P, C: C, F: F + Math.round(P * 0.08) };
      case "fish":
        return { P: P, C: C, F: F + Math.round(P * 0.1) }; // white fish ~10% fat
      case "beef":
        return { P: P, C: C, F: F + Math.round(P * 0.25) }; // lean beef ~25% fat
      case "rice":
        return { P: P + Math.round(C * 0.05), C: C, F: F }; // small protein tail
      case "oats":
        return {
          P: P + Math.round(C * 0.2),
          C: C,
          F: F + Math.round(C * 0.12),
        };
      case "veggies":
        return { P: P + Math.round(C * 0.15), C: C, F: F }; // fibrous carbs have some protein
      case "oil":
        return { P: P, C: C, F: F }; // user enters F directly
      default:
        return { P: P, C: C, F: F };
    }
  };

  // Macro Targets state (persistent, not date-specific) - now with pro override support
  const [targets, setTargets] = useState<MacroTargets | null>(null);
  const [targetsLoading, setTargetsLoading] = useState(true);
  const [targetSource, setTargetSource] = useState<"pro" | "self" | "performance" | "none">(
    "none",
  );
  const [proName, setProName] = useState<string>("");

  // Always keep a ref to the latest refreshTargets so the event listeners
  // (registered once at mount with []) never call a stale closure.
  const refreshTargetsRef = useRef<() => Promise<void>>(async () => {});

  const refreshTargets = async () => {
    if (!user?.id) {
      setTargets(null);
      setTargetSource("none");
      setTargetsLoading(false);
      return;
    }

    // Signal that a fresh resolution is starting so the UI shows the shimmer
    // rather than stale or empty values during the async prescription fetch.
    setTargetsLoading(true);

    // ── 1. ProCare precedence (client-side, always checked first) ─────────────
    // Professional overrides are stored in localStorage / proStore and are NOT
    // surfaced by the server-side prescription resolver (which is scoped to the
    // user's own clinical hierarchy). We must check them before hitting the
    // server, or a client with an active ProCare override would see their
    // self-set targets labeled "self" instead of the coach/clinician's targets.
    const localResolved = getResolvedTargets(user.id);
    if (localResolved.source === "pro") {
      setTargets({
        calories:       localResolved.calories,
        protein_g:      localResolved.protein_g,
        carbs_g:        localResolved.carbs_g,
        fat_g:          localResolved.fat_g,
        starchyCarbs_g: localResolved.starchyCarbs_g,
        fibrousCarbs_g: localResolved.fibrousCarbs_g,
      });
      setTargetSource("pro");
      if (localResolved.setBy) setProName(localResolved.setBy);
      setTargetsLoading(false);
      return;
    }

    // ── 2. Server prescription (hierarchy-resolved: GLP-1 → Performance) ──────
    // Only reached when no ProCare override is active. The server resolver
    // applies: Macro Calculator baseline → GLP-1 clinical overlay → Performance
    // training-day modifier. All surfaces read the same effective prescription.
    const storedDate = typeof window !== "undefined"
      ? localStorage.getItem("mpm.performance.selectedDate") : null;
    const dateISO = storedDate || new Date().toISOString().slice(0, 10);

    try {
      const prescRes = await fetch(apiUrl(`/api/prescription/${dateISO}`), {
        headers: { ...getAuthHeaders() },
        credentials: "include",
        cache: "no-store",
      });
      if (prescRes.ok) {
        const p = await prescRes.json();
        if (p && p.source !== "fallback" && (p.caloriesTarget > 0 || p.proteinTarget > 0)) {
          setTargets({
            calories:       p.caloriesTarget,
            protein_g:      p.proteinTarget,
            carbs_g:        p.carbsTarget,
            fat_g:          p.fatTarget,
            starchyCarbs_g: p.starchyCarbsTarget ?? 0,
            fibrousCarbs_g: p.fibrousCarbsTarget ?? 0,
          });
          const srcLabel =
            p.source === "performance" ? "performance"
            : "self"; // "clinical" (GLP-1) and "user_default" both display as "self"
          setTargetSource(srcLabel);
          setTargetsLoading(false);
          return;
        }
      }
    } catch {
      // Network failure — fall through to local resolver so we never flash null
    }

    // ── 3. Local resolver fallback (offline or no prescription targets) ────────
    if (localResolved.source !== "none") {
      setTargets({
        calories:       localResolved.calories,
        protein_g:      localResolved.protein_g,
        carbs_g:        localResolved.carbs_g,
        fat_g:          localResolved.fat_g,
        starchyCarbs_g: localResolved.starchyCarbs_g,
        fibrousCarbs_g: localResolved.fibrousCarbs_g,
      });
      setTargetSource(localResolved.source);
      // Note: localResolved.source === "pro" is already handled at step 1 above
      // and we returned early. TypeScript correctly narrows "pro" out here.
      setTargetsLoading(false);
      return;
    }

    // No targets configured anywhere — user genuinely has no macro setup.
    setTargets(null);
    setTargetSource("none");
    setTargetsLoading(false);
  };

  // Keep the ref current every render so event listeners always call the latest version.
  refreshTargetsRef.current = refreshTargets;

  useEffect(() => {
    refreshTargets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key?.includes("macro") ||
        e.key?.includes("targets") ||
        e.key?.includes("pro")
      ) {
        refreshTargetsRef.current();
      }
    };

    const handleCustomEvent = () => {
      refreshTargetsRef.current();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("mpm:targetsUpdated", handleCustomEvent);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("mpm:targetsUpdated", handleCustomEvent);
    };
  }, []);

  // Toast hook
  const { toast } = useToast();

  // Summary badges for top display (yellow-only system)
  const summaryBadges = useMemo(() => {
    if (!targets) return [];
    const hasStarchySplit =
      (targets.starchyCarbs_g ?? 0) > 0 ||
      (targets.fibrousCarbs_g ?? 0) > 0 ||
      ((todayRow as any).starchyCarbs ?? 0) > 0 ||
      ((todayRow as any).fibrousCarbs ?? 0) > 0;
    const carbRows = hasStarchySplit
      ? [
          { key: "Starchy Carbs", used: (todayRow as any).starchyCarbs ?? 0, max: targets.starchyCarbs_g ?? 0, unit: "g" },
          { key: "Fibrous Carbs", used: (todayRow as any).fibrousCarbs ?? 0, max: targets.fibrousCarbs_g ?? 0, unit: "g" },
        ]
      : [{ key: "Carbs", used: todayRow.carbs, max: targets.carbs_g, unit: "g" }];
    const items = [
      {
        key: "Protein",
        used: todayRow.protein,
        max: targets.protein_g,
        unit: "g",
      },
      ...carbRows,
      { key: "Fat", used: todayRow.fat, max: targets.fat_g, unit: "g" },
      {
        key: "Calories",
        used: todayRow.kcal,
        max: targets.calories,
        unit: "kcal",
      },
    ];
    return items.map((i) => {
      const pct = i.max > 0 ? (i.used / i.max) * 100 : 0;
      const near = pct >= 90;
      const over = pct >= 100;
      return { ...i, pct, near, over };
    });
  }, [targets, todayRow]);

  // One-time toast right after "Send Day" event
  useEffect(() => {
    function onDaySent(e: any) {
      // prevent spam: only show once per date
      const d = e?.detail?.date ?? today;
      const k = `mpm.toastShown.${d}`;
      if (sessionStorage.getItem(k)) return;

      const anyNear = summaryBadges.some((b) => b.pct >= 90);
      if (anyNear) {
        const highs = summaryBadges
          .filter((b) => b.pct >= 90)
          .map((b) => `${b.key} ${Math.round(b.pct)}%`)
          .join(", ");
        try {
          toast({
            title: "Heads up",
            description: `You're close on: ${highs}.`,
          });
        } catch {}
        sessionStorage.setItem(k, "1");
      }
    }
    window.addEventListener("mpm:daySent", onDaySent as any);
    return () => window.removeEventListener("mpm:daySent", onDaySent as any);
  }, [summaryBadges, today, toast]);

  // Quick View panel state (non-auto-logging preview from meal cards)
  // SAFE: Start with null, load from storage in useEffect
  const [qv, setQv] = useState<QuickView | null>(null);
  const [highlightQv, setHighlightQv] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showNextActionModal, setShowNextActionModal] = useState(false);
  const [showPersistentInfo, setShowPersistentInfo] = useState(false);

  // Return-to-source state (populated from ?from= param on arrival)
  const [returnSource, setReturnSource] = useState<{ label: string; path: string } | null>(null);

  // Parse inbound nav params (section, from, highlight) once on mount
  useEffect(() => {
    const { section, from: fromKey, highlight } = parseBiometricsParams(window.location.search);

    // Persist the return source for the lifetime of this page visit
    if (fromKey && BIOMETRICS_SOURCES[fromKey]) {
      setReturnSource(BIOMETRICS_SOURCES[fromKey]);
    }

    // Activate highlight state
    if (highlight) {
      setHighlightQv(true);
    }

    // Scroll to the correct section (retry until element mounts), or top if no section
    if (section) {
      const sectionId = SECTION_IDS[section];
      const attemptScroll = (attempts = 0) => {
        const el = document.getElementById(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (attempts < 12) {
          requestAnimationFrame(() => attemptScroll(attempts + 1));
        }
      };
      requestAnimationFrame(() => attemptScroll());
    } else {
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "auto" }));
    }

    // Strip consumed params from URL (keep ?draft, ?from won't show in address bar)
    const url = new URL(window.location.href);
    ["section", "highlight"].forEach((k) => url.searchParams.delete(k));
    window.history.replaceState(null, "", url.toString());
  }, []);

  // Auto-clear QuickView highlight after 5 seconds
  useEffect(() => {
    if (!highlightQv) return;
    const t = setTimeout(() => setHighlightQv(false), 5000);
    return () => clearTimeout(t);
  }, [highlightQv]);

  // Check for guide modal signal on mount (from MacroBridgeButton or RemainingMacrosFooter)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hasUrlFlag = params.get("showGuide") === "1";
    const hasSessionFlag = sessionStorage.getItem("biometrics:showGuide") === "1";
    if (hasUrlFlag || hasSessionFlag) {
      setShowGuideModal(true);
      sessionStorage.removeItem("biometrics:showGuide");
      if (hasUrlFlag) {
        const url = new URL(window.location.href);
        url.searchParams.delete("showGuide");
        window.history.replaceState(null, "", url.toString());
      }
    }
  }, []);

  // Load Quick View from storage on mount — pre-fill the manual input fields
  useEffect(() => {
    try {
      const stored = getQuickView();
      if (stored) {
        setP(String(stored.protein));
        setC(String(stored.carbs));
        setF(String(stored.fat));
        setK(String(stored.calories));
        if (stored.starchyCarbs) setSc(String(stored.starchyCarbs));
        if (stored.fibrousCarbs) setFc(String(stored.fibrousCarbs));
        setQv(stored);
        clearQuickView();
      }
    } catch (e) {
      console.error("Failed to load quick view:", e);
    }
  }, []);

  // Clear Quick View at midnight automatically
  useEffect(() => {
    if (!qv) return;
    const ms = Math.max(0, qv.expiresAt - Date.now());
    const t = setTimeout(() => {
      clearQuickView();
      setQv(null);
    }, ms);
    return () => clearTimeout(t);
  }, [qv]);

  const addFromQuickView = () => {
    if (!qv) return;
    setHighlightQv(false);
    const hasReturn = !!sessionStorage.getItem("biometrics:returnTo");
    
    const P = qv.protein;
    const C = qv.carbs;
    const F = qv.fat;
    const K = qv.calories;
    const SC = qv.starchyCarbs ?? 0;
    const FC = qv.fibrousCarbs ?? 0;

    setMacroRows((prev) => {
      const idx = prev.findIndex((r) => r.day === today);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          kcal: next[idx].kcal + K,
          protein: next[idx].protein + P,
          carbs: next[idx].carbs + C,
          fat: next[idx].fat + F,
          starchyCarbs: (next[idx].starchyCarbs ?? 0) + SC,
          fibrousCarbs: (next[idx].fibrousCarbs ?? 0) + FC,
        };
        return next;
      }
      return [{ day: today, kcal: K, protein: P, carbs: C, fat: F, starchyCarbs: SC, fibrousCarbs: FC }, ...prev];
    });

    toast({
      title: "Added to Today",
      description: `${P}g protein, ${C}g carbs, ${F}g fat logged.`,
    });

    clearQuickView();
    setQv(null);
    if (hasReturn) setShowNextActionModal(true);
  };

  const dismissQuickView = () => {
    const hasReturn = !!sessionStorage.getItem("biometrics:returnTo");
    clearQuickView();
    setQv(null);
    setHighlightQv(false);
    if (hasReturn) setShowNextActionModal(true);
  };

  const addMacros = () => {
    let P = Number(p || 0),
      F = Number(f || 0);
    const SC = Number(sc || 0); // starchyCarbs
    const FC = Number(fc || 0); // fibrousCarbs
    // Total carbs always derived from starchy + fibrous split
    let C = SC + FC;

    // If nothing entered, do nothing (silent)
    if (![P, C, F, Number(k || 0)].some(Boolean)) return;

    // Apply optional profile tails
    const adj = PROFILES_ENABLED
      ? applyProfile(selectedProfile, P, C, F)
      : { P, C, F };
    P = adj.P;
    C = adj.C;
    F = adj.F;

    // Derive calories if blank
    const K = k.trim() ? Number(k) : Math.round(kcalFrom(P, C, F));

    setMacroRows((prev) => {
      const idx = prev.findIndex((r) => r.day === today);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          kcal: next[idx].kcal + K,
          protein: next[idx].protein + P,
          carbs: next[idx].carbs + C,
          fat: next[idx].fat + F,
          starchyCarbs: (next[idx].starchyCarbs ?? 0) + SC,
          fibrousCarbs: (next[idx].fibrousCarbs ?? 0) + FC,
        };
        return next;
      }
      return [{ day: today, kcal: K, protein: P, carbs: C, fat: F, starchyCarbs: SC, fibrousCarbs: FC }, ...prev];
    });

    // Clear inputs (keep profile sticky)
    setP("");
    setC("");
    setF("");
    setK("");
    setSc("");
    setFc("");

    // Dispatch "done" event after successfully adding macros (500ms debounce)
    setTimeout(() => {
      const event = new CustomEvent("walkthrough:event", {
        detail: { testId: "biometrics-macros-added", event: "done" },
      });
      window.dispatchEvent(event);
    }, 500);

    if (userId) {
      fetch(apiUrl("/api/macros/log"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({
          loggedAt: new Date().toISOString(),
          mealType: "manual",
          protein: P,
          carbs: C,
          fat: F,
          kcal: K,
          starchyCarbs: SC,
          fibrousCarbs: FC,
          source: "manual",
        }),
      })
        .then(async (r) => {
          if (r.ok) {
            // Do NOT dispatch "macros:updated" here. The optimistic setMacroRows
            // update is already applied and correct. Dispatching the event triggers
            // an immediate server refetch that races with the just-committed write
            // and can overwrite the graph display with pre-write stale data.
          } else {
            const body = await r.json().catch(() => ({}));
            console.error("[MACROS/LOG] write failed", r.status, body);
            toast({
              title: "Macros not saved",
              description: "Your entry was added locally but couldn't be saved to your account. Check your connection and try again.",
              variant: "destructive",
            });
          }
        })
        .catch((err) => {
          console.error("[MACROS/LOG] network error", err);
          toast({
            title: "Macros not saved",
            description: "Network error — your entry wasn't persisted. Please try again.",
            variant: "destructive",
          });
        });
    }
  };

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const confirmReset = async () => {
    setShowResetConfirm(false);

    // Clear local state and input fields immediately (optimistic)
    setMacroRows((prev) => prev.filter((r) => r.day !== today));
    setP("");
    setC("");
    setF("");
    setK("");
    setSc("");
    setFc("");

    // Clear localStorage cache so it doesn't restore on next load
    try {
      const stored = loadJSON<{ rows?: OfflineDay[] }>(LS_MACROS, {});
      if (stored.rows) {
        const filtered = stored.rows.filter((r: OfflineDay) => r.day !== today);
        saveJSON(LS_MACROS, { rows: filtered });
      }
    } catch {
      // ignore cache errors
    }

    // Delete from server so it doesn't come back on reload.
    // Server reads users.timezone to compute the correct local day boundary.
    if (userId) {
      try {
        const params = new URLSearchParams({ localDateISO: today });
        await apiRequest(`/api/users/${userId}/macro-logs/today?${params}`, {
          method: "DELETE",
        });
        window.dispatchEvent(new Event("macros:updated"));
      } catch (e) {
        console.error("Failed to reset today on server:", e);
        toast({
          title: "Reset failed",
          description: "Could not clear today's macros from the server. Please try again.",
          variant: "destructive",
        });
        return;
      }
    }

    toast({
      title: "Reset Complete",
      description: "Today's macros have been cleared.",
    });
  };

  const resetToday = () => setShowResetConfirm(true);

  const handleIngredientScan = async () => {
    await launchIngredientPhotoCapture({
      onAnalyzing: () => {
        toast({
          title: "Analyzing ingredients...",
          description: "Reading the label and checking your profile — just a moment.",
        });
      },
      onSuccess: (result) => {
        setIngredientResult(result);
        setIngredientSheetOpen(true);
      },
      onError: (error) => {
        toast({
          title: "Scan failed",
          description: error,
          variant: "destructive",
        });
      },
    });
  };

  const handlePhotoUpload = () => setShowMacroModal(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);

    if (params.get("from") === "photo") {
      const protein = params.get("p");
      const carbs = params.get("c");
      const fat = params.get("f");
      const calories = params.get("k");

      if (protein) setP(protein);
      if (carbs) setC(carbs);
      if (fat) setF(fat);
      if (calories) setK(calories);

      const url = new URL(window.location.href);
      url.searchParams.delete("p");
      url.searchParams.delete("c");
      url.searchParams.delete("f");
      url.searchParams.delete("k");
      url.searchParams.delete("from");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);

    if (params.get("capture") === "1") {
      const alreadyTriggered = sessionStorage.getItem(
        "photo-capture-triggered",
      );
      if (alreadyTriggered) {
        sessionStorage.removeItem("photo-capture-triggered");
        const url = new URL(window.location.href);
        url.searchParams.delete("capture");
        window.history.replaceState({}, "", url.toString());
        return;
      }

      sessionStorage.setItem("photo-capture-triggered", "1");
      const url = new URL(window.location.href);
      url.searchParams.delete("capture");
      window.history.replaceState({}, "", url.toString());

      setTimeout(() => {
        handlePhotoUpload();
        sessionStorage.removeItem("photo-capture-triggered");
      }, 100);
    }
  }, []);

  // Draft intake from "Add to Biometrics" button (no clipboard needed!)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stop = startQueueAutoFlush();
    return () => stop();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const hasDraft = params.get("draft") === "1";
    if (!hasDraft) return;

    const d = readDraft();
    if (!d) return;

    // Normalize macro data (handles protein/protein_g/proteinGrams etc.)
    const { protein, carbs, fat, calories } = normalizeMacros(d as any);
    const starchyCarbs = Number((d as any).starchyCarbs) || 0;
    const fibrousCarbs = Number((d as any).fibrousCarbs) || 0;
    const dateISO = (d as any).dateISO || (d as any).date || today;
    const mealSlot = (d as any).mealSlot;

    // Auto-add to macros (persists to localStorage via useEffect)
    setMacroRows((prev) => {
      const idx = prev.findIndex((r) => r.day === dateISO);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          kcal: next[idx].kcal + calories,
          protein: next[idx].protein + protein,
          carbs: next[idx].carbs + carbs,
          fat: next[idx].fat + fat,
          starchyCarbs: (next[idx].starchyCarbs ?? 0) + starchyCarbs,
          fibrousCarbs: (next[idx].fibrousCarbs ?? 0) + fibrousCarbs,
        };
        return next;
      }
      return [
        { day: dateISO ?? today, kcal: calories, protein, carbs, fat, starchyCarbs, fibrousCarbs },
        ...prev,
      ];
    });

    // Optional: queue for server sync if endpoint exists
    if (SYNC_ENDPOINT) {
      queueOrPost(SYNC_ENDPOINT + "/macros", {
        day: dateISO ?? today,
        protein,
        carbs,
        fat,
        calories,
        starchyCarbs,
        fibrousCarbs,
        mealSlot: mealSlot ?? null,
      }).then((online) => {
        console.log(online ? "Synced to server" : "Queued for sync");
      });
    }

    clearDraft();

    // Clear input fields after auto-adding (so manual "Add" button works correctly)
    setP("");
    setC("");
    setF("");
    setK("");
    setSc("");
    setFc("");

    // Remove ?draft=1 from URL
    const url = new URL(window.location.href);
    url.searchParams.delete("draft");
    window.history.replaceState({}, "", url.toString());
  }, []);

  // Paste support (works with labels or just numbers: "30 40 10 370")
  const [openPaste, setOpenPaste] = useState(false);
  const [openDescribe, setOpenDescribe] = useState(false);
  const [showMacroModal, setShowMacroModal] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [showBiometricsInfoModal, setShowBiometricsInfoModal] = useState(false);
  const [showTodaysMacrosInfoModal, setShowTodaysMacrosInfoModal] =
    useState(false);

  function parsePaste(text: string) {
    // Clean mobile clipboard gibberish (URL-encoded, HTML entities, extra whitespace)
    let cleaned = text
      .replace(/%20/g, " ") // URL-encoded space
      .replace(/%2C/g, ",") // URL-encoded comma
      .replace(/&nbsp;/g, " ") // HTML non-breaking space
      .replace(/&amp;/g, "&") // HTML ampersand
      .replace(/\s+/g, " ") // Multiple spaces to single space
      .trim();

    const lower = cleaned.toLowerCase();
    const numRe = /-?\d+(?:\.\d+)?/g;

    const findLabeled = (keys: string[]) => {
      for (const k of keys) {
        const m = lower.match(
          new RegExp(k + "\\s*[:=]?\\s*(" + numRe.source + ")"),
        );
        if (m) return Number(m[1]);
      }
      return undefined;
    };

    let P = findLabeled(["protein", "prot", "p"]);
    let C = findLabeled(["carb", "carbs", "c"]);
    let F = findLabeled(["fat", "f"]);
    let K = findLabeled(["kcal", "calories", "cal", "k"]);

    if ([P, C, F].some((v) => v === undefined)) {
      const nums = (cleaned.match(numRe) || []).map(Number);
      if (nums.length >= 3) {
        P = P ?? nums[0];
        C = C ?? nums[1];
        F = F ?? nums[2];
        K = K ?? nums[3];
      }
    }

    return {
      P: Number(P || 0),
      C: Number(C || 0),
      F: Number(F || 0),
      K: K !== undefined ? Number(K) : undefined,
    };
  }

  function addMacrosParsed() {
    const { P, C, F, K } = parsePaste(pasteText);
    if ([P, C, F].every((v) => !v) && !K) return;

    const K2 = K !== undefined ? K : Math.round(kcalFrom(P, C, F));

    setMacroRows((prev) => {
      const idx = prev.findIndex((r) => r.day === today);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          kcal: next[idx].kcal + K2,
          protein: next[idx].protein + P,
          carbs: next[idx].carbs + C,
          fat: next[idx].fat + F,
        };
        return next;
      }
      return [{ day: today, kcal: K2, protein: P, carbs: C, fat: F }, ...prev];
    });

    setPasteText("");
    setOpenPaste(false);

    if (userId) {
      fetch(apiUrl("/api/macros/log"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({
          loggedAt: new Date().toISOString(),
          mealType: "manual",
          protein: P,
          carbs: C,
          fat: F,
          kcal: K2,
          source: "manual",
        }),
      })
        .then(async (r) => {
          if (r.ok) {
            window.dispatchEvent(new Event("macros:updated"));
          } else {
            const body = await r.json().catch(() => ({}));
            console.error("[MACROS/LOG] paste write failed", r.status, body);
            toast({
              title: "Macros not saved",
              description: "Your entry was added locally but couldn't be saved to your account. Check your connection and try again.",
              variant: "destructive",
            });
          }
        })
        .catch((err) => {
          console.error("[MACROS/LOG] paste network error", err);
          toast({
            title: "Macros not saved",
            description: "Network error — your entry wasn't persisted. Please try again.",
            variant: "destructive",
          });
        });
    }
  }

  // Default targets if user hasn't set any yet
  const defaultTargets = {
    calories: 2000,
    protein_g: 160,
    carbs_g: 180,
    fat_g: 70,
  };
  const activeTargets = targets || defaultTargets;

  // View toggles for charts
  const [weightView, setWeightView] = useState<"7" | "1" | "3" | "6" | "12">(
    "7",
  );

  // ------- BODY COMPOSITION (database) -------
  interface BodyCompEntry {
    id: number;
    currentBodyFatPct: string;
    goalBodyFatPct: string | null;
    scanMethod: string;
    source: string;
    recordedAt: string;
  }
  const [bodyCompLatest, setBodyCompLatest] = useState<BodyCompEntry | null>(null);
  const [bodyCompHistory, setBodyCompHistory] = useState<BodyCompEntry[]>([]);
  const [bodyCompSource, setBodyCompSource] = useState<string | null>(null);
  const [editingGoalBF, setEditingGoalBF] = useState(false);
  const [goalBFInput, setGoalBFInput] = useState("");
  const [goalBFSaving, setGoalBFSaving] = useState(false);

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser?.id) return;
    const uid = currentUser.id;

    apiRequest(`/api/users/${uid}/body-composition/latest`)
      .then((data) => {
        if (data?.entry) {
          setBodyCompLatest(data.entry);
          setBodyCompSource(data.source);
        }
      })
      .catch(() => {});

    apiRequest(`/api/users/${uid}/body-composition/history`)
      .then((data) => {
        if (data?.items) setBodyCompHistory(data.items);
      })
      .catch(() => {});
  }, []);

  const handleSaveGoalBF = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser?.id) return;
    const val = parseFloat(goalBFInput);
    if (isNaN(val) || val < 3 || val > 60) return;
    setGoalBFSaving(true);
    try {
      const data = await apiRequest(`/api/users/${currentUser.id}/body-composition/goal`, {
        method: "PATCH",
        body: JSON.stringify({ goalBodyFatPct: val }),
      });
      if (data.entry) {
        setBodyCompLatest(data.entry);
      }
      setEditingGoalBF(false);
    } catch {
    } finally {
      setGoalBFSaving(false);
    }
  };

  // ------- BODY / WEIGHT (local) -------
  // SAFE: Start with defaults, load from storage in useEffect
  const [body, setBody] = useState<{ heightIn?: number }>({ heightIn: 68 });
  const [bodyLoaded, setBodyLoaded] = useState(false);
  
  // Load body data from storage on mount (deferred read)
  useEffect(() => {
    try {
      const stored = loadJSON<{ heightIn?: number }>(LS_BODY, { heightIn: 68 });
      setBody(stored);
      setBodyLoaded(true);
    } catch (e) {
      console.error("Failed to load body data:", e);
      setBodyLoaded(true);
    }
  }, []);
  
  // Save body to storage when it changes (after initial load)
  useEffect(() => {
    if (bodyLoaded) saveJSON(LS_BODY, body);
  }, [body, bodyLoaded]);

  // SAFE: Start with empty, load from storage/database
  const [weightHistory, setWeightHistory] = useState<WeightRow[]>([]);
  const [weightLoaded, setWeightLoaded] = useState(false);
  
  // Load weight history from storage on mount (deferred read, before DB fetch)
  useEffect(() => {
    try {
      const stored = loadJSON<WeightRow[]>(LS_WEIGHT, []);
      if (stored.length > 0) setWeightHistory(stored);
      setWeightLoaded(true);
    } catch (e) {
      console.error("Failed to load weight history:", e);
      setWeightLoaded(true);
    }
  }, []);
  
  // Save weight history to storage when it changes (after initial load)
  useEffect(() => {
    if (weightLoaded) {
      saveJSON(LS_WEIGHT, weightHistory);
    }
  }, [weightHistory, weightLoaded]);

  // Fetch weight history from database (server as source of truth)
  useEffect(() => {
    const fetchWeightHistory = async () => {
      try {
        const { getAuthHeaders } = await import("@/lib/auth");
        const response = await fetch(
          apiUrl("/api/biometrics/weight?range=365d"),
          { credentials: "include", headers: getAuthHeaders() },
        );
        if (response.ok) {
          const data = await response.json();
          if (data.history && data.history.length > 0) {
            // Convert to WeightRow format for charts
            const dbWeights: WeightRow[] = data.history.map((h: any) => ({
              id: h.id,
              date: h.date,
              weight:
                h.unit === "kg" ? Math.round(h.weight * 2.20462) : h.weight, // Convert to lbs
              waist: undefined,
            }));
            setWeightHistory(dbWeights);
            console.log(
              "✅ Loaded weight history from database:",
              dbWeights.length,
              "entries",
            );
          }
        }
      } catch (error) {
        console.error("Failed to fetch weight history:", error);
        // Fallback to localStorage if database fetch fails
      }
    };
    fetchWeightHistory();
  }, []); // Fetch once on mount

  // ── Body stat tab + log-weight input ────────────────────────────────────────
  const [bodyStatTab, setBodyStatTab] = useState<"weight" | "waist" | "bodyfat">("weight");
  const [logWeightInput, setLogWeightInput] = useState("");
  const [logWeightSaving, setLogWeightSaving] = useState(false);

  // ── Waist history (server) ────────────────────────────────────────────────
  const [waistHistory, setWaistHistory] = useState<WaistRow[]>([]);
  const [waistLoaded, setWaistLoaded] = useState(false);

  useEffect(() => {
    const fetchWaistHistory = async () => {
      try {
        const res = await fetch(
          apiUrl("/api/biometrics/history?metric=waist_circumference&range=365d"),
          { credentials: "include", headers: getAuthHeaders() },
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.history)) {
            setWaistHistory(data.history as WaistRow[]);
          }
        }
      } catch {
        // fallback: stay with empty — no localStorage migration needed
      } finally {
        setWaistLoaded(true);
      }
    };
    fetchWaistHistory();
  }, []);

  // ── Log Today's Weight (measurement only — does NOT update prescription) ──
  const logTodayWeight = async () => {
    const w = Number(logWeightInput.trim());
    if (!w || w <= 0) return;
    setLogWeightSaving(true);
    try {
      const localDate = new Date().toLocaleDateString("en-CA");
      const res = await fetch(apiUrl("/api/biometrics/measurement"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ metric: "weight", value: w, unit: "lb", localDate }),
      });
      if (!res.ok) throw new Error("Save failed");

      // Optimistic update: replace today's entry if exists, otherwise prepend
      const row: WeightRow = { id: crypto.randomUUID(), date: localDate, weight: w };
      setWeightHistory((prev) => {
        const filtered = prev.filter((r) => r.date !== localDate);
        return [row, ...filtered].slice(0, 365);
      });
      setLogWeightInput("");
      toast({ title: "✓ Weight logged", description: "Your progress has been recorded." });

      const returnTo = sessionStorage.getItem("biometrics:returnTo");
      if (returnTo) {
        sessionStorage.removeItem("biometrics:returnTo");
        setTimeout(() => setLocation(returnTo), 900);
      }
    } catch {
      toast({ title: "Couldn't save weight", description: "Please try again.", variant: "destructive" });
    } finally {
      setLogWeightSaving(false);
    }
  };

  const latestWeight = useMemo(() => weightHistory[0]?.weight, [weightHistory]);

  // Waist comes from server history, not from the weight rows (old localStorage pattern removed)
  const latestWaist     = useMemo(() => waistHistory[0]?.value,                    [waistHistory]);
  const latestWaistDate = useMemo(() => waistHistory[0]?.date,                     [waistHistory]);

  // Review-macros nudge: appears when the entered log weight differs from the
  // prescription baseline by ≥ 3 lb.  Reads MacroCalculator localStorage settings.
  const reviewMacrosNudge = useMemo<string | null>(() => {
    const w = Number(logWeightInput.trim());
    if (!w || w <= 0) return null;
    try {
      const settings = JSON.parse(localStorage.getItem("mpm_macro_settings") || "{}");
      const baseline = settings.weightLbs;
      if (!baseline) return null;
      const diff = Math.round(Math.abs(w - baseline));
      if (diff < 3) return null;
      return `${diff} lb ${w < baseline ? "below" : "above"} your Macro Calculator weight`;
    } catch {
      return null;
    }
  }, [logWeightInput]);

  const bmi = useMemo(() => {
    if (!latestWeight || !body.heightIn) return undefined;
    const kg = latestWeight * 0.453592;
    const m = body.heightIn * 0.0254;
    return (kg / (m * m)).toFixed(1);
  }, [latestWeight, body.heightIn]);
  const bmiCategory = useMemo(() => {
    if (!bmi) return undefined;
    const v = parseFloat(bmi);
    if (v < 18.5) return { label: "Underweight", color: "text-blue-400" };
    if (v < 25) return { label: "Normal", color: "text-emerald-400" };
    if (v < 30) return { label: "Overweight", color: "text-yellow-400" };
    return { label: "Obese", color: "text-red-400" };
  }, [bmi]);
  const whr = useMemo(() => {
    if (!latestWaist || !body.heightIn) return undefined;
    return (latestWaist / body.heightIn).toFixed(2);
  }, [latestWaist, body.heightIn]);

  // Weight history datasets for chart
  const weight7days = useMemo(() => {
    const days = new Map<string, number[]>();
    for (const r of weightHistory) {
      const key = r.date.slice(0, 10);
      if (!days.has(key)) days.set(key, []);
      days.get(key)!.push(r.weight);
    }
    const out: { date: string; weightAvg: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const vals = days.get(key);
      const avg =
        vals && vals.length
          ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
          : 0;
      out.push({ date: key, weightAvg: avg });
    }
    return out;
  }, [weightHistory]);

  const weight1mo = useMemo(() => {
    const days = new Map<string, number[]>();
    for (const r of weightHistory) {
      const key = r.date.slice(0, 10);
      if (!days.has(key)) days.set(key, []);
      days.get(key)!.push(r.weight);
    }
    const out: { date: string; weightAvg: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const vals = days.get(key);
      const avg =
        vals && vals.length
          ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
          : 0;
      out.push({ date: key, weightAvg: avg });
    }
    return out;
  }, [weightHistory]);

  const weight3mo = useMemo(() => {
    const days = new Map<string, number[]>();
    for (const r of weightHistory) {
      const key = r.date.slice(0, 10);
      if (!days.has(key)) days.set(key, []);
      days.get(key)!.push(r.weight);
    }
    const out: { date: string; weightAvg: number }[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const vals = days.get(key);
      const avg =
        vals && vals.length
          ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
          : 0;
      out.push({ date: key, weightAvg: avg });
    }
    return out;
  }, [weightHistory]);

  const weight6mo = useMemo(() => {
    const days = new Map<string, number[]>();
    for (const r of weightHistory) {
      const key = r.date.slice(0, 10);
      if (!days.has(key)) days.set(key, []);
      days.get(key)!.push(r.weight);
    }
    const out: { date: string; weightAvg: number }[] = [];
    for (let i = 179; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const vals = days.get(key);
      const avg =
        vals && vals.length
          ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
          : 0;
      out.push({ date: key, weightAvg: avg });
    }
    return out;
  }, [weightHistory]);

  const weight12mo = useMemo(() => {
    const days = new Map<string, number[]>();
    for (const r of weightHistory) {
      const key = r.date.slice(0, 10);
      if (!days.has(key)) days.set(key, []);
      days.get(key)!.push(r.weight);
    }
    const out: { date: string; weightAvg: number }[] = [];
    for (let i = 364; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const vals = days.get(key);
      const avg =
        vals && vals.length
          ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
          : 0;
      out.push({ date: key, weightAvg: avg });
    }
    return out;
  }, [weightHistory]);

  // ── Waist time-series (mirrors weight pattern, values in inches) ─────────────
  const buildMetricSeries = (
    history: { date: string; value: number }[],
    dayCount: number,
  ): { date: string; metricAvg: number }[] => {
    const byDay = new Map<string, number[]>();
    for (const r of history) {
      const key = r.date.slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(r.value);
    }
    const out: { date: string; metricAvg: number }[] = [];
    for (let i = dayCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const vals = byDay.get(key);
      const avg  = vals?.length
        ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1))
        : 0;
      out.push({ date: key, metricAvg: avg });
    }
    return out;
  };

  const waist7days = useMemo(() => buildMetricSeries(waistHistory, 7),   [waistHistory]);
  const waist1mo   = useMemo(() => buildMetricSeries(waistHistory, 30),  [waistHistory]);
  const waist3mo   = useMemo(() => buildMetricSeries(waistHistory, 90),  [waistHistory]);
  const waist6mo   = useMemo(() => buildMetricSeries(waistHistory, 180), [waistHistory]);
  const waist12mo  = useMemo(() => buildMetricSeries(waistHistory, 365), [waistHistory]);

  const activeWaistData = useMemo(() => {
    if (weightView === "7") return waist7days;
    if (weightView === "1") return waist1mo;
    if (weightView === "3") return waist3mo;
    if (weightView === "6") return waist6mo;
    return waist12mo;
  }, [weightView, waist7days, waist1mo, waist3mo, waist6mo, waist12mo]);

  // Period change labels for each tab
  const weightPeriodChange = useMemo(() => {
    const series = weightView === "7" ? weight7days : weightView === "1" ? weight1mo
      : weightView === "3" ? weight3mo : weightView === "6" ? weight6mo : weight12mo;
    const filled = series.filter((r) => r.weightAvg > 0);
    if (filled.length < 2) return null;
    return parseFloat((filled[filled.length - 1].weightAvg - filled[0].weightAvg).toFixed(1));
  }, [weightView, weight7days, weight1mo, weight3mo, weight6mo, weight12mo]);

  const waistPeriodChange = useMemo(() => {
    const filled = activeWaistData.filter((r) => r.metricAvg > 0);
    if (filled.length < 2) return null;
    return parseFloat((filled[filled.length - 1].metricAvg - filled[0].metricAvg).toFixed(1));
  }, [activeWaistData]);

  // ── Body fat time-series (from body composition entries) ──────────────────
  const bodyFatRawPoints = useMemo(
    () =>
      bodyCompHistory.map((e) => ({
        date: e.recordedAt.slice(0, 10),
        value: parseFloat(e.currentBodyFatPct),
      })),
    [bodyCompHistory],
  );
  const bodyFat7days = useMemo(() => buildMetricSeries(bodyFatRawPoints, 7),   [bodyFatRawPoints]);
  const bodyFat1mo   = useMemo(() => buildMetricSeries(bodyFatRawPoints, 30),  [bodyFatRawPoints]);
  const bodyFat3mo   = useMemo(() => buildMetricSeries(bodyFatRawPoints, 90),  [bodyFatRawPoints]);
  const bodyFat6mo   = useMemo(() => buildMetricSeries(bodyFatRawPoints, 180), [bodyFatRawPoints]);
  const bodyFat12mo  = useMemo(() => buildMetricSeries(bodyFatRawPoints, 365), [bodyFatRawPoints]);

  const activeBodyFatData = useMemo(() => {
    if (weightView === "7") return bodyFat7days;
    if (weightView === "1") return bodyFat1mo;
    if (weightView === "3") return bodyFat3mo;
    if (weightView === "6") return bodyFat6mo;
    return bodyFat12mo;
  }, [weightView, bodyFat7days, bodyFat1mo, bodyFat3mo, bodyFat6mo, bodyFat12mo]);

  const bodyFatPeriodChange = useMemo(() => {
    const filled = activeBodyFatData.filter((r) => r.metricAvg > 0);
    if (filled.length < 2) return null;
    return parseFloat((filled[filled.length - 1].metricAvg - filled[0].metricAvg).toFixed(1));
  }, [activeBodyFatData]);

  // ------- export CSV -------
  const exportCSV = () => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const now = new Date();
    const fname = `biometrics_export_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.csv`;
    const esc = (v: any) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    let out: string[] = [];
    // Macros per-day totals
    out.push("Section,Date,Calories,Protein,Carbs,Fat");
    for (const r of [...macroRows].sort((a, b) => a.day.localeCompare(b.day))) {
      out.push(
        ["Macros", r.day, r.kcal, r.protein, r.carbs, r.fat].map(esc).join(","),
      );
    }
    out.push("");
    // Weight history
    out.push("Section,Date,Weight(lb)");
    const weightRows = [...weightHistory].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    for (const r of weightRows)
      out.push(["Weight", r.date, r.weight].map(esc).join(","));
    out.push("");
    // Body snapshot (latest values)
    out.push(
      "Section,LastUpdated,Weight(lb),Waist(in),Height(in),BMI,Waist/Height",
    );
    out.push(
      [
        "Body",
        today,
        latestWeight ?? "",
        latestWaist ?? "",
        body.heightIn ?? "",
        bmi ?? "",
        whr ?? "",
      ]
        .map(esc)
        .join(","),
    );

    const blob = new Blob([out.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // ------- helpers -------
  const ProgressBar = ({ value, goal }: { value: number; goal: number }) => {
    const pct = Math.max(0, Math.min(100, goal ? (value / goal) * 100 : 0));
    return (
      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-orange-600 to-orange-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  };

  const ViewToggle = ({
    value,
    onChange,
  }: {
    value: "today" | "7" | "30";
    onChange: (v: "today" | "7" | "30") => void;
  }) => (
    <div className="flex gap-1 bg-black/30 p-1 rounded-lg">
      {(["today", "7", "30"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-3 py-1 rounded text-xs font-medium transition ${
            value === v
              ? "bg-white/20 text-white"
              : "text-white/60 hover:text-white"
          }`}
        >
          {v === "today" ? "Today" : `${v} Days`}
        </button>
      ))}
    </div>
  );

  const MonthViewToggle = ({
    value,
    onChange,
  }: {
    value: "7" | "1" | "3" | "6" | "12";
    onChange: (v: "7" | "1" | "3" | "6" | "12") => void;
  }) => (
    <div className="flex gap-1 bg-black/30 p-1 rounded-lg">
      {(["7", "1", "3", "6", "12"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-3 py-1 rounded text-xs font-medium transition ${
            value === v
              ? "bg-white/20 text-white"
              : "text-white/60 hover:text-white"
          }`}
        >
          {v === "7"
            ? "1W"
            : v === "1"
              ? "1M"
              : v === "3"
                ? "3M"
                : v === "6"
                  ? "6M"
                  : "12M"}
        </button>
      ))}
    </div>
  );

  // ============================== UI ==============================
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen text-white bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav-generous"
    >
      {/* Universal Safe-Area Header */}
      <MobileHeaderGuard>
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-8 pb-3 flex items-center gap-3">
          {/* Return to source page (from ?from= param) */}
          {returnSource && !isProSession && (
            <Button
              onClick={() => setLocation(returnSource.path)}
              variant="ghost"
              size="sm"
              className="text-orange-300 hover:bg-orange-500/10 -ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to {returnSource.label}
            </Button>
          )}
          {/* Pro Session: Return to Pro Portal */}
          {isProSession && (
            <Button
              onClick={() => {
                const returnRoute = localStorage.getItem("pro-return-route") || "/pro/clients";
                localStorage.removeItem("pro-session");
                localStorage.removeItem("pro-client-id");
                localStorage.removeItem("pro-return-route");
                setLocation(returnRoute);
              }}
              variant="ghost"
              size="sm"
              className="text-purple-400 hover:bg-purple-500/10 -ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Return to Pro Portal
            </Button>
          )}
          {/* Guest Mode: Back to Guest Suite button - only show for actual guests, not logged-in users */}
          {isGuestMode() && !user && (
            <Button
              onClick={() => {
                markStepCompleted("biometrics_viewed");
                setLocation("/guest-suite");
              }}
              variant="ghost"
              size="sm"
              className="text-lime-400 hover:bg-lime-500/10 -ml-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              {GUEST_SUITE_BRANDING.phase2.backToSuiteButton}
            </Button>
          )}
          
          {/* Title */}
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            {t("title")}
          </h1>

          <div className="flex-grow" />

          <QuickTourButton onClick={quickTour.openTour} />
        </div>
      </div>
      </MobileHeaderGuard>

      {/* Main Content */}
      <div
        className="max-w-6xl mx-auto space-y-6 px-4 md:px-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        {/* Apple 1.4.1 Compliance: Prominent citation banner - MUST be visible */}
        <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-400/30 rounded-xl p-4">
          <p className="text-sm text-white/90 leading-relaxed">
            <span className="font-semibold text-blue-300">Scientific Sources:</span>{" "}
            Nutrient data from{" "}
            <a
              href="https://fdc.nal.usda.gov/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline font-medium"
            >
              USDA FoodData Central
            </a>
            . Daily values per{" "}
            <a
              href="https://ods.od.nih.gov/HealthInformation/Dietary_Reference_Intakes.aspx"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 underline font-medium"
            >
              NIH Dietary Reference Intakes
            </a>
            .
          </p>
        </div>

        {/* MACROS */}
        <Card
          id="biometrics-macros-section"
          data-testid="biometrics-macro-summary"
          className="bg-black/30 backdrop-blur-lg border border-white/10"
        >
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Today's Macros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Macro Targets Progress - always visible */}
            <div className="rounded-2xl border border-orange-400/30 p-4 mb-3 bg-orange-900/20 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  {targets ? "Macro Targets Active" : "Today's Macros"}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-orange-600/20 text-orange-200 border-orange-400/30 hover:bg-orange-600/30 hover:border-orange-400/50 h-auto py-1 px-3 rounded-full text-xs flex items-center gap-1"
                  data-testid="button-persistent-explanation"
                  onClick={() => setShowPersistentInfo(true)}
                >
                  <Info className="h-3 w-3" />
                  <span>Persistent</span>
                  <span className="text-orange-300/70 text-[10px]">
                    (tap)
                  </span>
                </Button>
                <InformationModal open={showPersistentInfo} onOpenChange={setShowPersistentInfo} className="bg-black/90 backdrop-blur-lg border-white/20 text-white max-w-md" title={<span className="flex items-center gap-2"><Info className="h-5 w-5 text-orange-400" />What Does "Persistent" Mean?</span>}>
                    <div className="space-y-4 pt-4">
                      <p className="text-white/90 text-sm leading-relaxed">
                        <strong className="text-orange-300">
                          Persistent
                        </strong>{" "}
                        means these macro targets stay the same every day
                        until you change them.
                      </p>
                      <p className="text-white/80 text-sm leading-relaxed">
                        Unlike your daily macro tracking (which resets each
                        day), your <strong>macro targets</strong> remain
                        constant. They don't change automatically.
                      </p>
                      <div className="rounded-lg border border-orange-400/30 bg-orange-900/20 p-3">
                        <p className="text-orange-200 text-sm">
                          💡 <strong>Example:</strong> If your target is 2000
                          calories today, it will still be 2000 calories
                          tomorrow, next week, and next month—unless you
                          update it.
                        </p>
                      </div>
                      <p className="text-white/70 text-xs mb-4">
                        {targetSource === "pro"
                          ? `These targets were set by ${proName}. They'll stay active until ${proName} changes them.`
                          : "You can change your macro targets anytime from:"}
                      </p>

                      {targetSource !== "pro" && !isGuestMode() && (
                        <div className="grid grid-cols-2 gap-3">
                          <Button
                            onClick={() => setLocation("/macro-counter")}
                            className="bg-orange-600/20 text-orange-200 border border-orange-400/30 hover:bg-orange-600/30 hover:border-orange-400/50 h-auto py-2 text-xs"
                            data-testid="button-go-macro-calculator"
                          >
                            Macro Calculator
                          </Button>
                          <Button
                            onClick={() => {
                              const userId =
                                localStorage.getItem("userId") || "1";
                              setLocation(`/athlete-meal-board/${userId}`);
                            }}
                            className="bg-orange-600/20 text-orange-200 border border-orange-400/30 hover:bg-orange-600/30 hover:border-orange-400/50 h-auto py-2 text-xs"
                            data-testid="button-go-athlete-board"
                          >
                            Professional Board
                          </Button>
                        </div>
                      )}
                    </div>
                </InformationModal>
              </div>

              {/* Pro-set badge (if targets are set by professional) */}
              {targetSource === "pro" && (
                <div className="mb-3 rounded-lg border border-orange-400/50 bg-orange-900/30 backdrop-blur-sm p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Stethoscope className="h-4 w-4 text-orange-300" />
                    <span className="font-semibold text-orange-200">
                      Set by {proName}
                    </span>
                  </div>
                  <div className="text-xs text-white/60 mt-1">
                    Your professional has customized your macro targets
                  </div>
                </div>
              )}

              {targetsLoading ? (
                /* Skeleton shimmer — shown while the prescription fetch is in flight */
                <div data-testid="biometrics-progress-bars" aria-busy="true">
                  {["Protein", "Carbs", "Fat", "Calories"].map((label) => (
                    <div key={label} className="space-y-2 mb-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-white">{label}</span>
                        <div className="animate-pulse h-4 w-20 rounded bg-white/10" />
                      </div>
                      <div className="h-2 w-full rounded bg-white/10 overflow-hidden">
                        <div className="animate-pulse h-2 w-1/3 bg-white/10 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : targets ? (
                <>
                  {/* Top summary badges with pulsing effect */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {summaryBadges.map((b) => (
                      <Badge
                        key={b.key}
                        variant="outline"
                        className={[
                          b.near
                            ? "border-yellow-400/70 bg-yellow-500/15 text-yellow-100/90 mpm-badge-pulse"
                            : "bg-white/10 text-white/80 border-white/20",
                        ].join(" ")}
                        title={`${Math.round(b.pct)}% of ${b.key}`}
                      >
                        {b.key}
                        {b.over
                          ? " (Over)"
                          : b.near
                            ? ` (${Math.round(b.pct)}%)`
                            : ""}
                      </Badge>
                    ))}
                  </div>

                  {/* Progress bars - white/yellow/pink system */}
                  <div data-testid="biometrics-progress-bars">
                    {summaryBadges.map((row) => {
                      const near = row.pct >= 90;
                      const over = row.pct >= 100;
                      const barColor = over
                        ? "bg-pink-500"
                        : near
                          ? "bg-yellow-400"
                          : "bg-white/70";
                      return (
                        <div key={row.key} className="space-y-2 mb-3">
                          <div className="flex justify-between text-sm">
                            <span className="text-white">{row.key}</span>
                            <span className="text-white">
                              {Math.round(row.used)} / {Math.round(row.max)}{" "}
                              {row.unit}{" "}
                              {over
                                ? "• Over"
                                : near
                                  ? `• ${Math.round(row.pct)}%`
                                  : ""}
                            </span>
                          </div>
                          <div className="h-2 w-full rounded bg-white/10 overflow-hidden">
                            <div
                              className={`h-2 transition-all ${barColor}`}
                              style={{ width: `${Math.min(row.pct, 110)}%` }}
                            />
                          </div>
                          {near && (
                            <div className="text-xs opacity-90 text-yellow-200">
                              {over
                                ? "Over today's limit."
                                : "Approaching limit."}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div data-testid="biometrics-progress-bars">
                  {[
                    { label: "Calories", value: todayRow.kcal, unit: "kcal" },
                    { label: "Protein", value: todayRow.protein, unit: "g" },
                    { label: "Carbs", value: todayRow.carbs, unit: "g" },
                    { label: "Fat", value: todayRow.fat, unit: "g" },
                  ].map((row) => (
                    <div key={row.label} className="space-y-2 mb-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-white">{row.label}</span>
                        <span className="text-white/60">{row.value} {row.unit}</span>
                      </div>
                      <div className="h-2 w-full rounded bg-white/10 overflow-hidden">
                        <div className="h-2 bg-white/30 transition-all" style={{ width: row.value > 0 ? "30%" : "0%" }} />
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-white/40 text-center mt-1">
                    Set targets in Macro Calculator to track progress
                  </p>
                </div>
              )}
            </div>

            {/* Photo Upload Button */}
            <Button
                data-wt="bio-scan-button"
                onClick={handlePhotoUpload}
                className="w-full bg-lime-600 hover:bg-lime-600 text-md text-white mb-3"
                data-testid="button-photo-upload"
              >
                📸 MacroScan
              </Button>

            <Button
              onClick={() => setOpenDescribe(true)}
              className="w-full bg-amber-600/80 hover:bg-amber-600 text-md text-white mb-3"
              data-testid="button-just-describe"
            >
              ✏️ Just Describe It
            </Button>

            {/* Ingredient Intelligence */}
            <>
                <Button
                  onClick={handleIngredientScan}
                  className="w-full bg-orange-600/80 text-md text-white mb-1"
                  data-testid="button-ingredient-intelligence"
                >
                  🧾 Ingredient Intelligence
                </Button>
                <p className="text-xs text-white/40 text-center leading-snug mb-3 px-2">
                  Understand packaged foods using your wellness profile, dietary preferences, and health goals.
                </p>
              </>


            <div
              data-testid="biometrics-macro-inputs"
              className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            >
              <div>
                <label className="text-xs text-white/80 font-medium mb-1 block">
                  Protein (g)
                </label>
                <Input
                  data-wt="bio-manual-protein"
                  type="text"
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/50"
                  value={p}
                  onChange={(e) => setP(e.target.value)}
                  data-testid="input-protein"
                />
              </div>
              <div>
                <label className="text-xs text-white/80 font-medium mb-1 block">
                  Starchy (g)
                </label>
                <Input
                  data-wt="bio-manual-starchy"
                  type="text"
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/50"
                  value={sc}
                  onChange={(e) => setSc(e.target.value)}
                  data-testid="input-starchy"
                />
              </div>
              <div>
                <label className="text-xs text-white/80 font-medium mb-1 block">
                  Fibrous (g)
                </label>
                <Input
                  data-wt="bio-manual-fibrous"
                  type="text"
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/50"
                  value={fc}
                  onChange={(e) => setFc(e.target.value)}
                  data-testid="input-fibrous"
                />
              </div>
              <div>
                <label className="text-xs text-white/80 font-medium mb-1 block">
                  Fat (g)
                </label>
                <Input
                  data-wt="bio-manual-fat"
                  type="text"
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/50"
                  value={f}
                  onChange={(e) => setF(e.target.value)}
                  data-testid="input-fat"
                />
              </div>
              <div>
                <label className="text-xs text-white/80 font-medium mb-1 block">
                  Calories
                </label>
                <Input
                  data-wt="bio-manual-calories"
                  type="text"
                  className="bg-black/20 border-white/20 text-white placeholder:text-white/50"
                  value={k}
                  onChange={(e) => setK(e.target.value)}
                  data-testid="input-calories"
                />
              </div>
            </div>

            {/* Additional Macros instruction note */}
            {PROFILES_ENABLED && (
              <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                <p className="text-xs text-white/90 leading-relaxed text-center">
                  <strong>Short on Protein or Carbs?</strong> Enter the amount
                  you need to add in{" "}
                  <strong>either the Protein field OR the Carbs field</strong>{" "}
                  (don't adjust Calories or Fat — leave those blank). Then use
                  the <strong>Additional Macros</strong> dropdown to select
                  which food source you're getting it from (chicken, rice,
                  veggies, etc.). Press <strong>Add</strong> and the system will
                  automatically fill in all the other macros based on that food
                  type.
                </p>
              </div>
            )}

            {/* Additional Macros selector */}
            {PROFILES_ENABLED && (
              <div className="flex items-center justify-between gap-2 mt-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/70 font-medium">
                    Additional Macros:
                  </span>
                  <Select
                    value={selectedProfile}
                    onValueChange={(v) => setSelectedProfile(v as Profile)}
                  >
                    <SelectTrigger
                      className="w-40 bg-white/10 border-white/20 text-white"
                      data-testid="select-source-profile"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whey">Whey / Isolate</SelectItem>
                      <SelectItem value="chicken">Chicken (lean)</SelectItem>
                      <SelectItem value="turkey">Turkey (lean)</SelectItem>
                      <SelectItem value="fish">White Fish (lean)</SelectItem>
                      <SelectItem value="beef">
                        Red Meat (beef/steak)
                      </SelectItem>
                      <SelectItem value="rice">Rice (starchy carb)</SelectItem>
                      <SelectItem value="oats">Oats (carb+fat tail)</SelectItem>
                      <SelectItem value="veggies">
                        Fibrous Veggies (carb)
                      </SelectItem>
                      <SelectItem value="oil">Olive Oil (fat)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center gap-2 mt-3">
              <PillButton
                data-testid="biometrics-add-button"
                onClick={addMacros}
              >
                Add
              </PillButton>
              <PillButton
                onClick={resetToday}
                data-testid="button-reset-today"
              >
                Reset Today
              </PillButton>
            </div>

            {/* Paste modal */}
            {openPaste && (
              <div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={() => setOpenPaste(false)}
              >
                <div
                  className="w-full max-w-lg rounded-2xl border border-white/20 bg-neutral-900 text-white"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-4 border-b border-white/10 font-semibold">
                    Paste Macros
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-sm text-white/70">
                      Accepts formats like:{" "}
                      <code className="bg-black/30 px-1 rounded">
                        Protein 30, Carbs 40, Fat 10, 370 kcal
                      </code>{" "}
                      or just{" "}
                      <code className="bg-black/30 px-1 rounded">
                        30 40 10 370
                      </code>
                      .
                    </p>
                    <textarea
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value)}
                      rows={6}
                      className="w-full rounded-lg bg-black/30 border border-white/20 p-3 outline-none text-white"
                      placeholder="Paste here..."
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        className="bg-white/10 border-white/20 text-white"
                        onClick={() => setOpenPaste(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                        onClick={addMacrosParsed}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </CardContent>
        </Card>

        {/* Macro Consistency Timeline - replaces standalone Calories chart */}
        <MacroConsistencyTimeline macroRows={macroRows} />

        {/* BODY STATS — tabbed: Weight | Waist */}
        <Card id="biometrics-weight-section" className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white text-xl flex items-center gap-2">
              <Scale className="h-5 w-5" /> Body Stats
            </CardTitle>
            <MonthViewToggle value={weightView} onChange={setWeightView} />
          </CardHeader>
          <CardContent>
            {/* Metric tabs */}
            <div className="flex gap-1 bg-black/30 p-1 rounded-lg mb-4 w-fit">
              {(
                [
                  { id: "weight",  label: "Weight"    },
                  { id: "waist",   label: "Waist"     },
                  { id: "bodyfat", label: "Body Fat"  },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setBodyStatTab(id)}
                  className={`px-4 py-1.5 rounded text-sm font-medium transition ${
                    bodyStatTab === id
                      ? "bg-white/20 text-white"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ── Weight tab ── */}
            {bodyStatTab === "weight" && (
              <>
                {/* Current value + period delta */}
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="text-2xl font-bold text-white">
                    {latestWeight
                      ? convertWeightLbsDisplay(latestWeight, (user as any)?.measurementSystem ?? "imperial")
                      : "—"}
                  </span>
                  {weightPeriodChange !== null && (
                    <span className={`text-sm ${weightPeriodChange < 0 ? "text-emerald-400" : weightPeriodChange > 0 ? "text-orange-400" : "text-white/50"}`}>
                      {weightPeriodChange > 0 ? "+" : ""}{weightPeriodChange} lb this period
                    </span>
                  )}
                </div>
                {/* Chart */}
                <div style={{ width: "100%", height: 200 }} className="mt-2">
                  <ResponsiveContainer>
                    <LineChart
                      data={
                        weightView === "7" ? weight7days
                          : weightView === "1" ? weight1mo
                          : weightView === "3" ? weight3mo
                          : weightView === "6" ? weight6mo
                          : weight12mo
                      }
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "#fff" }}
                        tickFormatter={(v: string) => {
                          const d = new Date(v + "T12:00:00");
                          return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
                        }}
                      />
                      <YAxis tick={{ fontSize: 10, fill: "#fff" }} domain={["auto", "auto"]} />
                      <Tooltip
                        contentStyle={{ background: "rgba(0,0,0,0.9)", border: "1px solid #333", color: "#fff", borderRadius: 8 }}
                        labelFormatter={(l) => new Date(l + "T12:00:00").toLocaleDateString()}
                        formatter={(v: any) => [`${v} lb`, "Weight"]}
                      />
                      <Line type="monotone" dataKey="weightAvg" stroke="#10b981" dot={false} name="Weight (lb)" connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Log Today's Weight — measurement only, does NOT change macros */}
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-2">
                    Log Today's Weight
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input
                      inputMode="decimal"
                      placeholder="lbs"
                      className="bg-black/20 border-white/20 text-white w-28"
                      value={logWeightInput}
                      onChange={(e) => setLogWeightInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && logTodayWeight()}
                      data-testid="input-log-weight"
                    />
                    <PillButton
                      id="save-weight-button"
                      data-testid="biometrics-save-weight-button"
                      data-walkthrough="save-weight"
                      onClick={logTodayWeight}
                      disabled={logWeightSaving || !logWeightInput.trim()}
                      className="!bg-lime-500/20 !border-lime-400 hover:!bg-lime-500/30 disabled:opacity-40"
                    >
                      {logWeightSaving ? "Saving…" : "Save"}
                    </PillButton>
                  </div>
                  {/* Review-macros nudge */}
                  {reviewMacrosNudge && (
                    <button
                      onClick={() => setLocation("/macro-calculator")}
                      className="mt-2 w-full text-left text-xs px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-400/30 text-orange-300 hover:bg-orange-500/20 transition"
                    >
                      ↗ {reviewMacrosNudge} — <span className="underline">Review Macros →</span>
                    </button>
                  )}
                  <div className="mt-2">
                    <ReadOnlyNote>
                      Logging here tracks your progress without changing your macro prescription.
                      To update your macros, go to the{" "}
                      <button onClick={() => setLocation("/macro-calculator")} className="underline text-white/80">
                        Macro Calculator
                      </button>.
                    </ReadOnlyNote>
                  </div>
                </div>

                {/* Summary stats */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mt-4">
                  {latestWeight && (
                    <Summary
                      label="Weight"
                      value={convertWeightLbsDisplay(latestWeight, (user as any)?.measurementSystem ?? "imperial")}
                    />
                  )}
                  {bmi && bmiCategory && (
                    <Summary label="BMI*" value={`${bmi} — ${bmiCategory.label}`} sub="*Height from settings" categoryColor={bmiCategory.color} />
                  )}
                  {whr && <Summary label="Waist/Height" value={whr} />}
                </div>
              </>
            )}

            {/* ── Waist tab ── */}
            {bodyStatTab === "waist" && (
              <>
                {/* Current value + period delta */}
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="text-2xl font-bold text-white">
                    {latestWaist ? `${latestWaist}"` : "—"}
                  </span>
                  {waistPeriodChange !== null && (
                    <span className={`text-sm ${waistPeriodChange < 0 ? "text-emerald-400" : waistPeriodChange > 0 ? "text-orange-400" : "text-white/50"}`}>
                      {waistPeriodChange > 0 ? "+" : ""}{waistPeriodChange}" this period
                    </span>
                  )}
                </div>
                {latestWaistDate && (
                  <div className="text-xs text-white/40 mb-3">
                    Last recorded: {new Date(latestWaistDate + "T12:00:00").toLocaleDateString()}
                  </div>
                )}
                {/* Chart */}
                {waistLoaded && waistHistory.length > 0 ? (
                  <div style={{ width: "100%", height: 200 }} className="mt-2">
                    <ResponsiveContainer>
                      <LineChart data={activeWaistData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10, fill: "#fff" }}
                          tickFormatter={(v: string) => {
                            const d = new Date(v + "T12:00:00");
                            return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
                          }}
                        />
                        <YAxis tick={{ fontSize: 10, fill: "#fff" }} domain={["auto", "auto"]} />
                        <Tooltip
                          contentStyle={{ background: "rgba(0,0,0,0.9)", border: "1px solid #333", color: "#fff", borderRadius: 8 }}
                          labelFormatter={(l) => new Date(l + "T12:00:00").toLocaleDateString()}
                          formatter={(v: any) => [`${v}"`, "Waist"]}
                        />
                        <Line type="monotone" dataKey="metricAvg" stroke="#f97316" dot={false} name='Waist (in)' connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : waistLoaded ? (
                  <div className="flex flex-col items-center justify-center py-8 text-white/40 text-sm gap-2">
                    <span>No waist data yet.</span>
                    <span className="text-xs text-center">Waist measurements are saved automatically when you use the Macro Calculator.</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-white/40 text-sm">Loading…</div>
                )}
                <div className="mt-3">
                  <ReadOnlyNote>
                    Waist is saved automatically when you update your stats in the{" "}
                    <button onClick={() => setLocation("/macro-calculator")} className="underline text-white/80">
                      Macro Calculator
                    </button>.
                  </ReadOnlyNote>
                </div>
                {/* Summary */}
                {(latestWaist || whr) && (
                  <div className="grid grid-cols-2 gap-3 text-sm mt-4">
                    {latestWaist && <Summary label="Waist" value={`${latestWaist}"`} />}
                    {whr && <Summary label="Waist/Height" value={whr} />}
                  </div>
                )}
              </>
            )}

            {/* ── Body Fat tab ── */}
            {bodyStatTab === "bodyfat" && (
              <>
                {/* Current value + period delta */}
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="text-2xl font-bold text-white">
                    {bodyCompLatest
                      ? `${parseFloat(bodyCompLatest.currentBodyFatPct).toFixed(1)}%`
                      : "—"}
                  </span>
                  {bodyFatPeriodChange !== null && (
                    <span className={`text-sm ${bodyFatPeriodChange < 0 ? "text-emerald-400" : bodyFatPeriodChange > 0 ? "text-orange-400" : "text-white/50"}`}>
                      {bodyFatPeriodChange > 0 ? "+" : ""}{bodyFatPeriodChange}% this period
                    </span>
                  )}
                </div>
                {bodyCompLatest?.recordedAt && (
                  <div className="text-xs text-white/40 mb-3">
                    Last recorded: {new Date(bodyCompLatest.recordedAt).toLocaleDateString()}
                  </div>
                )}
                {/* Chart */}
                {bodyFatRawPoints.length > 0 ? (
                  <div style={{ width: "100%", height: 200 }} className="mt-2">
                    <ResponsiveContainer>
                      <LineChart data={activeBodyFatData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10, fill: "#fff" }}
                          tickFormatter={(v: string) => {
                            const d = new Date(v + "T12:00:00");
                            return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
                          }}
                        />
                        <YAxis tick={{ fontSize: 10, fill: "#fff" }} domain={["auto", "auto"]} unit="%" />
                        <Tooltip
                          contentStyle={{ background: "rgba(0,0,0,0.9)", border: "1px solid #333", color: "#fff", borderRadius: 8 }}
                          labelFormatter={(l) => new Date(l + "T12:00:00").toLocaleDateString()}
                          formatter={(v: any) => [`${v}%`, "Body Fat"]}
                        />
                        <Line type="monotone" dataKey="metricAvg" stroke="#a78bfa" dot={true} name="Body Fat (%)" connectNulls={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-white/40 text-sm gap-2">
                    <span>No body fat data yet.</span>
                    <span className="text-xs text-center">Log a body composition scan in the Body Composition section below.</span>
                  </div>
                )}
                <div className="mt-3">
                  <ReadOnlyNote>
                    Body fat is logged in the{" "}
                    <button
                      onClick={() => {
                        document.getElementById("biometrics-body-comp-section")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="underline text-white/80"
                    >
                      Body Composition
                    </button>{" "}
                    section below. Each scan method (DEXA, BIA, calipers, etc.) is stored separately.
                  </ReadOnlyNote>
                </div>
                {/* Summary */}
                {bodyCompLatest && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mt-4">
                    <Summary
                      label="Body Fat"
                      value={`${parseFloat(bodyCompLatest.currentBodyFatPct).toFixed(1)}%`}
                    />
                    {bodyCompLatest.goalBodyFatPct && parseFloat(bodyCompLatest.goalBodyFatPct) > 0 && (
                      <Summary
                        label="Goal"
                        value={`${parseFloat(bodyCompLatest.goalBodyFatPct).toFixed(1)}%`}
                      />
                    )}
                    {bodyCompLatest.scanMethod && (
                      <Summary label="Method" value={bodyCompLatest.scanMethod} />
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* BODY COMPOSITION — Read-Only Dashboard */}
        <Card className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white text-xl flex items-center gap-2">
              <Ruler className="h-5 w-5" /> Body Composition
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bodyCompLatest ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {parseFloat(bodyCompLatest.currentBodyFatPct) > 0 && (
                    <div className="p-3 rounded-xl bg-black/25 border border-white/10">
                      <div className="text-xs text-white/60">Body Fat</div>
                      <div className="text-lg font-bold text-white">{parseFloat(bodyCompLatest.currentBodyFatPct).toFixed(1)}%</div>
                      <div className="text-[10px] text-white/40 mt-1">Estimated using the U.S. Navy Body Fat Formula.</div>
                    </div>
                  )}
                  <div className="p-3 rounded-xl bg-black/25 border border-white/10">
                    <div className="text-xs text-white/60">Target Body Fat</div>
                    {editingGoalBF ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="number"
                          inputMode="decimal"
                          value={goalBFInput}
                          onChange={(e) => setGoalBFInput(e.target.value)}
                          className="w-16 bg-black/40 border border-white/20 rounded-md px-2 py-1 text-sm text-white focus:outline-none focus:border-orange-400"
                          placeholder="%"
                          min={3}
                          max={60}
                        />
                        <button
                          onClick={handleSaveGoalBF}
                          disabled={goalBFSaving || !goalBFInput.trim() || goalBFInput === (bodyCompLatest?.goalBodyFatPct ? parseFloat(bodyCompLatest.goalBodyFatPct).toString() : "")}
                          className="px-2 py-1 text-xs font-semibold rounded-md bg-orange-600 text-white disabled:opacity-40"
                        >
                          {goalBFSaving ? "..." : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingGoalBF(false)}
                          className="px-2 py-1 text-xs rounded-md bg-white/10 text-white/60"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="text-lg font-bold text-lime-400">
                          {bodyCompLatest.goalBodyFatPct ? `${parseFloat(bodyCompLatest.goalBodyFatPct).toFixed(1)}%` : "—"}
                        </div>
                        <button
                          onClick={() => {
                            setGoalBFInput(bodyCompLatest.goalBodyFatPct ? parseFloat(bodyCompLatest.goalBodyFatPct).toString() : "");
                            setEditingGoalBF(true);
                          }}
                          className="px-2 py-0.5 text-xs rounded-md bg-orange-600/20 text-orange-400 font-medium"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
                  {parseFloat(bodyCompLatest.currentBodyFatPct) > 0 && (
                    <div className="p-3 rounded-xl bg-black/25 border border-white/10">
                      <div className="text-xs text-white/60">Method</div>
                      <div className="text-sm font-medium text-white">{bodyCompLatest.scanMethod}</div>
                    </div>
                  )}
                </div>
                {parseFloat(bodyCompLatest.currentBodyFatPct) > 0 && (
                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <span>Recorded: {new Date(bodyCompLatest.recordedAt).toLocaleDateString()}</span>
                    {bodyCompSource && (
                      <span className={`px-2 py-0.5 rounded-full ${bodyCompSource !== "client" ? "bg-amber-500/20 text-amber-300" : "bg-white/10 text-white/50"}`}>
                        {bodyCompSource}
                      </span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="py-4 space-y-3">
                <div className="text-center">
                  <Ruler className="h-8 w-8 text-white/30 mx-auto mb-2" />
                  <p className="text-white/60 text-sm mb-1">No body composition data yet</p>
                  <p className="text-white/40 text-xs">Use the Macro Calculator to estimate or enter your body fat</p>
                </div>
                <div className="p-3 rounded-xl bg-black/25 border border-white/10">
                  <div className="text-xs text-white/60 mb-1">Set Your Target Body Fat %</div>
                  {editingGoalBF ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={goalBFInput}
                        onChange={(e) => setGoalBFInput(e.target.value)}
                        className="w-16 bg-black/40 border border-white/20 rounded-md px-2 py-1 text-sm text-white focus:outline-none focus:border-orange-400"
                        placeholder="%"
                        min={3}
                        max={60}
                      />
                      <button
                        onClick={handleSaveGoalBF}
                        disabled={goalBFSaving || !goalBFInput.trim()}
                        className="px-2 py-1 text-xs font-semibold rounded-md bg-orange-600 text-white disabled:opacity-40"
                      >
                        {goalBFSaving ? "..." : "Save"}
                      </button>
                      <button
                        onClick={() => setEditingGoalBF(false)}
                        className="px-2 py-1 text-xs rounded-md bg-white/10 text-white/60"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setGoalBFInput(""); setEditingGoalBF(true); }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md bg-orange-600 text-white"
                    >
                      Set Goal
                    </button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CLINICAL LABS - visible to all, locked for non-Clinical users (trial excluded) */}
        {user && user.id && (
          canAccessClinicalLabs(user) ? (
            <ClinicalLabsCard userId={user.id} />
          ) : (
            <Card
              className="cursor-pointer active:scale-[0.99] bg-black/30 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl transition-all duration-200"
              onClick={() => requestUpgrade({ requiredTier: "clinical", featureName: "Lab Values" })}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-white text-xl flex items-center gap-2">
                  🧪 Lab Values
                </CardTitle>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-300 text-[10px] font-bold uppercase tracking-wide">
                  Clinical
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-white/60 leading-relaxed">
                  Track and manage lab markers and advanced health metrics as part of the Clinical experience. Tap to learn more.
                </p>
              </CardContent>
            </Card>
          )
        )}

        {/* THERAPEUTIC NUTRITION INTELLIGENCE — Clinical only, trial excluded */}
        {canAccessTherapeuticNutrition(user) ? (
          <TherapeuticNutritionCard />
        ) : (
          <Card
            className="cursor-pointer active:scale-[0.99] bg-black/30 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl transition-all duration-200"
            onClick={() => requestUpgrade({ requiredTier: "clinical", featureName: "Therapeutic Nutrition Intelligence" })}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-white text-xl flex items-center gap-2">
                🧬 Therapeutic Nutrition Intelligence
              </CardTitle>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-300 text-[10px] font-bold uppercase tracking-wide">
                Clinical
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-white/70 leading-relaxed">
                Log peptides, hormone therapies, medications, and active treatments so My Perfect Meals can adapt your nutrition plan around your clinical protocol. Available with the Clinical plan.
              </p>
            </CardContent>
          </Card>
        )}

        {/* WATER LOG */}
        <Card className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white text-xl flex items-center gap-2">
              {import.meta.env.DEV ? "Water & Hydration" : "💧 Water Log"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {import.meta.env.DEV ? (
              <>
                <p className="text-sm leading-relaxed text-white/65">
                  Water tracking now lives in the server-backed Hydration Center.
                  No personal target is created from body weight or a population
                  average.
                </p>
                <Button
                  onClick={() => setLocation("/hydration")}
                  className="w-full bg-sky-600 text-white hover:bg-sky-500"
                  data-testid="open-hydration-center"
                >
                  Open Hydration Center
                </Button>
              </>
            ) : (
              <WaterLog
                key={user?.id ?? "anonymous"}
                userId={user?.id ?? ""}
                dietType={((user as any)?.dietaryRestrictions?.[0] || (user as any)?.dietType || "")}
              />
            )}
          </CardContent>
        </Card>

        {/* Version tag for deployment tracking */}
        <div className="text-[10px] text-white/40 text-center mt-4 mb-2">
          Build: Biometrics v1.1 • Profiles ON • Water Logger
        </div>
      </div>

      {/* Biometrics Info Modal */}
      {showBiometricsInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-black/30 backdrop-blur-lg border border-white/20 rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4">
              {t("aboutTitle")}
            </h3>

            <div className="space-y-4 text-white/90 text-sm">
              <p>
                Track your daily macros (protein, carbs, fat, calories), weight,
                and water intake. Your data is stored locally and syncs with the
                Macro Calculator.
              </p>
              <p className="text-white/80">
                Use the "Add" button to log meals manually, or tap "Log from
                Photo" to use AI to estimate nutrition from a food picture.
              </p>
            </div>

            <button
              onClick={() => setShowBiometricsInfoModal(false)}
              className="mt-6 w-full bg-lime-700 hover:bg-lime-800 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Today's Macros Info Modal */}
      {showTodaysMacrosInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-black/30 backdrop-blur-lg border border-white/20 rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-xl font-bold text-white mb-4">
              {t("macroTargetsSet")}
            </h3>

            <div className="space-y-4 text-white/90 text-sm">
              <p>
                Your macro targets are now active in today's macros. Navigate to
                the Body Stats card below, save your weight, and you will be
                sent to the plan builder.
              </p>
            </div>

            <button
              onClick={() => setShowTodaysMacrosInfoModal(false)}
              className="mt-6 w-full bg-lime-700 hover:bg-lime-800 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      <QuickTourModal
        isOpen={quickTour.shouldShow}
        onClose={quickTour.closeTour}
        steps={biometricsTourSteps}
        title="How to Use Biometrics"
        onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
      />

      <IngredientIntelligenceSheet
        open={ingredientSheetOpen}
        result={ingredientResult}
        onClose={() => setIngredientSheetOpen(false)}
        onRescan={() => {
          setIngredientSheetOpen(false);
          handleIngredientScan();
        }}
        onAddProduct={(name) => {
          sendToShoppingList([{ name, quantity: 1, unit: "" }], { sourceBuilder: "smart-scan" });
        }}
      />

      <ConfirmationModal
        open={showResetConfirm}
        onOpenChange={(open) => setShowResetConfirm(open)}
        title="Reset Today's Macros?"
        description="This will permanently delete all macro entries logged today. Your targets, previous days, weight, and lab data are not affected."
        className="bg-black/90 backdrop-blur-lg border-white/20 text-white max-w-sm mx-4"
        footer={
          <div className="flex gap-3 w-full">
            <PillButton
              onClick={() => setShowResetConfirm(false)}
              className="flex-1 bg-white/10 text-white border border-white/20"
            >
              Cancel
            </PillButton>
            <PillButton
              onClick={confirmReset}
              className="flex-1 bg-red-600 text-white"
            >
              Reset Today
            </PillButton>
          </div>
        }
      />

      <MacroScanModal
        open={showMacroModal}
        onOpenChange={setShowMacroModal}
        onSuccess={(result) => {
          setShowMacroModal(false);
          setP(String(result.protein));
          setC(String(result.carbs));
          setF(String(result.fat));
          setK(String(result.calories));
          toast({
            title: "Macros Detected",
            description: `${Math.round(result.calories)} kcal — Protein ${result.protein}g, Carbs ${result.carbs}g, Fat ${result.fat}g.`,
          });
        }}
      />

      <JustDescribeItModal
        open={openDescribe}
        onClose={() => setOpenDescribe(false)}
        onAdd={(macros) => {
          setMacroRows((prev) => {
            const idx = prev.findIndex((r) => r.day === today);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = {
                ...next[idx],
                kcal: next[idx].kcal + macros.calories,
                protein: next[idx].protein + macros.protein,
                carbs: next[idx].carbs + macros.carbs,
                fat: next[idx].fat + macros.fat,
                starchyCarbs: (next[idx].starchyCarbs ?? 0) + macros.starchyCarbs,
                fibrousCarbs: (next[idx].fibrousCarbs ?? 0) + macros.fibrousCarbs,
              };
              return next;
            }
            return [{
              day: today,
              kcal: macros.calories,
              protein: macros.protein,
              carbs: macros.carbs,
              fat: macros.fat,
              starchyCarbs: macros.starchyCarbs,
              fibrousCarbs: macros.fibrousCarbs,
            }, ...prev];
          });
          toast({
            title: "Added to Today",
            description: `${macros.protein}g protein, ${macros.carbs}g carbs, ${macros.fat}g fat logged.`,
          });
        }}
      />

      {/* MODAL #1 — Guide modal: shown on arrival from Add to Macros / Save Day */}
      <ConfirmationModal open={showGuideModal} onOpenChange={setShowGuideModal} className="bg-black/90 backdrop-blur-lg border-white/20 text-white max-w-sm mx-4" title="Go to Quick View" footer={
        <Button
          onClick={() => {
            setShowGuideModal(false);
            setHighlightQv(true);
          }}
          className="bg-orange-600 hover:bg-orange-700 text-white px-6"
        >
          OK
        </Button>
      }>
        <p className="text-white/80 text-sm leading-relaxed">
          Scroll up to find the <strong className="text-orange-300">Quick View</strong> section, then tap <strong className="text-white">Add to Today</strong> to log your macros.
        </p>
      </ConfirmationModal>

      {/* MODAL #2 — Next action modal: shown after Add to Today or Dismiss */}
      <ConfirmationModal open={showNextActionModal} onOpenChange={setShowNextActionModal} className="bg-black/90 backdrop-blur-lg border-white/20 text-white max-w-sm mx-4" title="What would you like to do next?">
        <div className="flex flex-col gap-3 mt-2">
          <Button
            onClick={() => {
              const returnTo = sessionStorage.getItem("biometrics:returnTo");
              sessionStorage.removeItem("biometrics:returnTo");
              setShowNextActionModal(false);
              if (returnTo) {
                setLocation(returnTo);
              }
            }}
            className="bg-orange-600 hover:bg-orange-700 text-white w-full"
          >
            Return to Previous Page
          </Button>
          <Button
            onClick={() => setShowNextActionModal(false)}
            className="bg-black text-white w-full"
          >
            Stay on Biometrics
          </Button>
        </div>
      </ConfirmationModal>

    </motion.div>
  );
}

// ============================== WATER LOG ==============================

const CARNIVORE_HYDRATION_TIPS = [
  "Higher protein intake works best when hydration is consistent.",
  "Water helps your body process increased protein and fat intake.",
  "Simple meals. Consistent hydration. Better results.",
  "On a high-protein plan — aim for an extra glass with each meal.",
];

function getDayLabel(date: Date): string {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
}

function WaterLog({ userId, dietType }: { userId: string; dietType: string }) {
  const todayStr = new Date().toDateString();
  const [water, setWater] = useState({ date: todayStr, ounces: 0 });
  const [goal, setGoal] = useState(121);
  const [weekHistory, setWeekHistory] = useState<{ label: string; oz: number; dateStr: string }[]>([]);
  const [tipIndex, setTipIndex] = useState(0);
  const historyOwnerRef = useRef(userId);
  const isHighProtein = dietType === "carnivore" || dietType === "keto";
  const waterStorageKey = userId ? `mpm_bio_water:${userId}` : null;

  useEffect(() => {
    try {
      if (!waterStorageKey) {
        setWater({ date: new Date().toDateString(), ounces: 0 });
        return;
      }
      const savedWater = localStorage.getItem(waterStorageKey);
      if (savedWater) {
        const parsed = JSON.parse(savedWater);
        if (parsed.date === new Date().toDateString()) setWater(parsed);
        else setWater({ date: new Date().toDateString(), ounces: 0 });
      } else {
        setWater({ date: new Date().toDateString(), ounces: 0 });
      }
      const w = Number(localStorage.getItem("latestWeight")) || 180;
      setGoal(Math.round(w * 0.67));
    } catch (e) {
      console.error("Failed to load water data:", e);
    }
  }, [waterStorageKey]);

  useEffect(() => {
    historyOwnerRef.current = userId;
    setWeekHistory([]);
    if (!userId) return;

    let cancelled = false;
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 6);
    const fromStr = from.toISOString().split("T")[0];
    const toStr = to.toISOString().split("T")[0];
    getWaterLogs({ from: fromStr, to: toStr, limit: 200 })
      .then(data => {
        if (cancelled || !isWaterHistoryResponseCurrent(userId, historyOwnerRef.current)) return;
        const byDay: Record<string, number> = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          byDay[d.toDateString()] = 0;
        }
        (data.items || []).forEach((row: any) => {
          const d = new Date(row.intakeTime).toDateString();
          if (d in byDay) byDay[d] = (byDay[d] || 0) + Math.round(row.amountMl / 29.5735);
        });
        const history = Object.entries(byDay).map(([dateStr, oz]) => ({
          label: getDayLabel(new Date(dateStr)),
          oz,
          dateStr,
        }));
        setWeekHistory(history);
      })
      .catch(() => {
        if (!cancelled && isWaterHistoryResponseCurrent(userId, historyOwnerRef.current)) {
          setWeekHistory([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!isHighProtein) return;
    const interval = setInterval(() => {
      setTipIndex(i => (i + 1) % CARNIVORE_HYDRATION_TIPS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [isHighProtein]);

  const save = (newTotal: number, addedOz?: number) => {
    const updated = { date: new Date().toDateString(), ounces: newTotal };
    setWater(updated);
    if (waterStorageKey) localStorage.setItem(waterStorageKey, JSON.stringify(updated));
    if (userId && addedOz && addedOz > 0) {
      createWaterLog({ amount: addedOz, unit: "oz" }).catch(() => {});
    }
  };

  const addWater = (oz: number) => {
    const newTotal = Math.min(goal, water.ounces + oz);
    const actual = newTotal - water.ounces;
    save(newTotal, actual);
  };
  const resetWater = () => save(0);
  const pct = Math.min(100, (water.ounces / goal) * 100);

  const statusLabel = pct < 40 ? "Below target" : pct < 80 ? "On track" : "Goal reached";
  const statusColor = pct < 40 ? "text-red-400" : pct < 80 ? "text-sky-400" : "text-green-400";

  const maxOz = Math.max(goal, ...weekHistory.map(d => d.oz), 1);

  return (
    <div data-wt="bio-water-counter" className="flex flex-col items-center space-y-4 text-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90">
          <circle cx="64" cy="64" r="60" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
          <circle
            cx="64" cy="64" r="60" stroke="#38bdf8" strokeWidth="8" fill="none"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 60}`}
            strokeDashoffset={`${2 * Math.PI * 60 * (1 - pct / 100)}`}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-white">{water.ounces}</span>
          <span className="text-sm text-white/70">/ {goal} oz</span>
        </div>
      </div>

      <span className={`text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
      <p className="text-[10px] text-white/30">Goal = your weight × 0.67 oz</p>

      <div className="flex gap-2">
        <Button data-wt="bio-water-plus8" onClick={() => addWater(8)} className="bg-sky-600 hover:bg-sky-700 text-white" data-testid="button-add-8oz">+8 oz</Button>
        <Button data-wt="bio-water-plus16" onClick={() => addWater(16)} className="bg-sky-600 hover:bg-sky-700 text-white" data-testid="button-add-16oz">+16 oz</Button>
        <Button onClick={resetWater} className="bg-black/30 border border-white/20 text-white hover:bg-black/50" data-testid="button-reset-water">Reset</Button>
      </div>

      {isHighProtein && (
        <p className="text-xs text-sky-300/80 italic max-w-xs transition-all">
          {CARNIVORE_HYDRATION_TIPS[tipIndex]}
        </p>
      )}

      {weekHistory.length > 0 && (
        <div className="w-full pt-2">
          <p className="text-xs text-white/50 mb-2">Past 7 days</p>
          <div className="flex gap-1 items-end justify-center h-16">
            {weekHistory.map((day, i) => {
              const barH = day.oz > 0 ? Math.max(6, Math.round((day.oz / maxOz) * 52)) : 4;
              const isToday = day.dateStr === new Date().toDateString();
              const onTrack = day.oz >= goal * 0.8;
              const barColor = isToday ? "bg-sky-400" : onTrack ? "bg-sky-600/70" : "bg-white/20";
              return (
                <div key={i} className="flex flex-col items-center gap-1" style={{ width: "13%" }}>
                  <div
                    className={`w-full rounded-t-sm ${barColor} transition-all duration-300`}
                    style={{ height: `${barH}px` }}
                    title={`${day.label}: ${day.oz} oz`}
                  />
                  <span className={`text-[10px] ${isToday ? "text-sky-300 font-bold" : "text-white/40"}`}>
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================== UI bits ==============================
function Row({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-white/80">{label}</span>
        <span className="text-white">{value}</span>
      </div>
      {children}
    </div>
  );
}
function Summary({
  label,
  value,
  sub,
  categoryColor,
}: {
  label: string;
  value: string | number;
  sub?: string;
  categoryColor?: string;
}) {
  return (
    <div className="rounded-xl p-3 bg-black/20 border border-white/10">
      <div className="text-xs text-white/70">{label}</div>
      <div className={`text-lg font-semibold ${categoryColor || "text-white"}`}>{value}</div>
      {sub && <div className="text-xs text-white/60">{sub}</div>}
    </div>
  );
}
