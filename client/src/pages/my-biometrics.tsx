// client/src/pages/MyBiometrics.tsx
// Local-first, zero-fragility Biometrics page
// • No server calls. Optional one-line sync hooks are commented.
// • Stores: macros, steps, body stats, blood pressure — all in localStorage
// • Simple, readable components; black-glass aesthetic; consistent text colors
// • Charts use recharts and render from local data

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { apiUrl } from '@/lib/resolveApiBase';
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PlusCircle, RotateCcw, Home, Activity, Scale, Stethoscope, BarChart3, Target, ArrowLeft, Info } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { readDraft, clearDraft } from "@/lib/macrosDraft";
import { startQueueAutoFlush, queueOrPost } from "@/lib/queue";
import { normalizeMacros } from "@/lib/macroNormalize";
import { getQuickView, clearQuickView, QuickView } from "@/lib/macrosQuickView";
import { getMacroTargets, MacroTargets } from "@/lib/dailyLimits";
import { getResolvedTargets } from "@/lib/macroResolver";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { MACRO_SOURCES, getMacroSourceBySlug } from "@/lib/macroSourcesConfig";
import ReadOnlyNote from "@/components/ReadOnlyNote";
import { launchMacroPhotoCapture } from "@/lib/photoMacroCapture";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { QuickTourButton } from "@/components/guided/QuickTourButton";

// ============================== CONFIG ==============================
const SYNC_ENDPOINT = ""; // optional API endpoint; if set, we POST after local save

// keys
const LS_MACROS = "mpm_bio_macros_v1"; // { rows: OfflineDay[] }
const LS_BODY   = "mpm_bio_body_v1";   // { weight?: number, waist?: number, heightIn?: number }
const LS_WEIGHT = "mpm_bio_weight_v1"; // WeightRow[]

// types
type OfflineDay = { day: string; kcal: number; protein: number; carbs: number; fat: number };
interface WeightRow { id: string; date: string; weight: number; waist?: number }

// utils
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const kcalFrom = (p=0,c=0,f=0) => Math.max(0, 4*Number(p||0)+4*Number(c||0)+9*Number(f||0));

// storage helpers
const loadJSON = <T,>(k:string, fallback:T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; } };
const saveJSON = (k:string, v:any) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

// ============================== PAGE ==============================
export default function MyBiometrics() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const biometricsTourSteps: TourStep[] = [
    {
      title: "Track Your Macros",
      description: "Log your daily protein, carbs, and fat. Your targets stay persistent until you recalculate them.",
    },
    {
      title: "Persist Your Targets",
      description: "Tap the Persist button to lock in your macro targets. They'll stay until you change them in the Macro Calculator.",
    },
    {
      title: "Top Off with Additional Macros",
      description: "Short on protein or carbs? Pick a food source (like Whey for a protein shake) and tap Add to apply the right macro tails.",
    },
    {
      title: "Log Your Weight",
      description: "Save your weight regularly to track progress over time. Charts show your 7-day to 12-month trends.",
    },
    {
      title: "Photo Logging",
      description: "Use 'Log from Photo' to snap a pic of your meal - AI estimates the macros automatically.",
    },
    {
      title: "Track Your Water",
      description: "Log your daily water intake at the bottom of the page to stay on top of hydration."
    }

  ];

  const quickTour = useQuickTour("my-biometrics");

  // ------- MACROS (local) -------
  const [macroRows, setMacroRows] = useState<OfflineDay[]>(() => {
    const stored = loadJSON<{rows?:OfflineDay[]}>(LS_MACROS, {});
    return stored.rows || [];
  });
  useEffect(() => saveJSON(LS_MACROS, { rows: macroRows }), [macroRows]);

  const today = todayKey();
  const sortedRows = useMemo(() => [...macroRows].sort((a,b)=>b.day.localeCompare(a.day)), [macroRows]);
  const todayRow = sortedRows.find(r=>r.day===today) || { day: today, kcal:0, protein:0, carbs:0, fat:0 };
  const history30 = sortedRows.slice(0,30);
  const history7 = sortedRows.slice(0,7);
  const historyToday = [todayRow];

  // Calories series: continuous (matches Steps pattern)
  const calories30 = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const r of macroRows) byDay.set(r.day, r.kcal || 0);
    const out: { date: string; kcal: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      out.push({ date: key, kcal: byDay.get(key) ?? 0 });
    }
    return out;
  }, [macroRows]);
  const calories7 = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const r of macroRows) byDay.set(r.day, r.kcal || 0);
    const out: { date: string; kcal: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      out.push({ date: key, kcal: byDay.get(key) ?? 0 });
    }
    return out;
  }, [macroRows]);
  const caloriesToday = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const r of macroRows) byDay.set(r.day, r.kcal || 0);
    return [{ date: today, kcal: byDay.get(today) ?? 0 }];
  }, [macroRows, today]);

  const [p,setP]=useState(""); const [c,setC]=useState(""); const [f,setF]=useState(""); const [k,setK]=useState("");

  // Check URL params for pre-filled values from photo log
  useEffect(() => {
    if (typeof window === 'undefined') return;
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
  type Profile = 'pure'|'chicken'|'turkey'|'whey'|'rice'|'oats'|'oil'|'fish'|'veggies'|'beef';
  const [selectedProfile, setSelectedProfile] = useState<Profile>('whey');
  const PROFILES_ENABLED = false; // DISABLED: Moved to AdditionalMacrosModal in meal builders

  // Heuristic tails (kept tiny + transparent)
  const applyProfile = (profile: Profile, P: number, C: number, F: number) => {
    switch (profile) {
      case 'pure':   return { P: P, C: C, F: F };                       // macro-only
      case 'whey':   return { P: P, C: C, F: F };                       // similar to pure (0 F/C)
      case 'chicken':return { P: P, C: C, F: F + Math.round(P * 0.12) };// ~12% of P shows up as fat
      case 'turkey': return { P: P, C: C, F: F + Math.round(P * 0.08) };
      case 'fish':   return { P: P, C: C, F: F + Math.round(P * 0.10) };// white fish ~10% fat
      case 'beef':   return { P: P, C: C, F: F + Math.round(P * 0.25) };// lean beef ~25% fat
      case 'rice':   return { P: P + Math.round(C * 0.05), C: C, F: F };// small protein tail
      case 'oats':   return { P: P + Math.round(C * 0.20), C: C, F: F + Math.round(C * 0.12) };
      case 'veggies':return { P: P + Math.round(C * 0.15), C: C, F: F };// fibrous carbs have some protein
      case 'oil':    return { P: P, C: C, F: F };                       // user enters F directly
      default:       return { P: P, C: C, F: F };
    }
  };

  // Macro Targets state (persistent, not date-specific) - now with pro override support
  const [targets, setTargets] = useState<MacroTargets | null>(null);
  const [targetSource, setTargetSource] = useState<'pro' | 'self' | 'none'>('none');
  const [proName, setProName] = useState<string>('');

  const refreshTargets = () => {
    const resolved = getResolvedTargets(user?.id);
    if (resolved.source !== 'none') {
      setTargets({
        calories: resolved.calories,
        protein_g: resolved.protein_g,
        carbs_g: resolved.carbs_g,
        fat_g: resolved.fat_g,
      });
      setTargetSource(resolved.source);
      if (resolved.source === 'pro' && resolved.setBy) {
        setProName(resolved.setBy);
      }
    } else {
      setTargets(null);
      setTargetSource('none');
    }
  };

  useEffect(() => {
    refreshTargets();
  }, [user?.id]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key?.includes('macro') || e.key?.includes('targets') || e.key?.includes('pro')) {
        refreshTargets();
      }
    };

    const handleCustomEvent = () => {
      refreshTargets();
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('mpm:targetsUpdated', handleCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('mpm:targetsUpdated', handleCustomEvent);
    };
  }, []);

  // Toast hook
  const { toast } = useToast();

  // Summary badges for top display (yellow-only system)
  const summaryBadges = useMemo(() => {
    if (!targets) return [];
    const items = [
      { key: "Calories", used: todayRow.kcal, max: targets.calories, unit: "kcal" },
      { key: "Protein", used: todayRow.protein, max: targets.protein_g, unit: "g" },
      { key: "Carbs", used: todayRow.carbs, max: targets.carbs_g, unit: "g" },
      { key: "Fat", used: todayRow.fat, max: targets.fat_g, unit: "g" },
    ];
    return items.map(i => {
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

      const anyNear = summaryBadges.some(b => b.pct >= 90);
      if (anyNear) {
        const highs = summaryBadges.filter(b => b.pct >= 90).map(b => `${b.key} ${Math.round(b.pct)}%`).join(", ");
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
  const [qv, setQv] = useState<QuickView | null>(() => {
    if (typeof window === 'undefined') return null;
    return getQuickView();
  });

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

  const fillFromQuickView = () => {
    if (!qv) return;
    setP(String(qv.protein));
    setC(String(qv.carbs));
    setF(String(qv.fat));
    setK(String(qv.calories));
  };

  const dismissQuickView = () => {
    clearQuickView();
    setQv(null);
  };

  const addMacros = () => {
    let P = Number(p || 0), C = Number(c || 0), F = Number(f || 0);
    // If nothing entered, do nothing (silent)
    if (![P, C, F, Number(k || 0)].some(Boolean)) return;

    // Apply optional profile tails
    const adj = PROFILES_ENABLED ? applyProfile(selectedProfile, P, C, F) : { P, C, F };
    P = adj.P; C = adj.C; F = adj.F;

    // Derive calories if blank
    const K = k.trim() ? Number(k) : Math.round(kcalFrom(P, C, F));

    setMacroRows(prev => {
      const idx = prev.findIndex(r => r.day === today);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          kcal: next[idx].kcal + K,
          protein: next[idx].protein + P,
          carbs: next[idx].carbs + C,
          fat: next[idx].fat + F
        };
        return next;
      }
      return [{ day: today, kcal: K, protein: P, carbs: C, fat: F }, ...prev];
    });

    // Clear inputs (keep profile sticky)
    setP(""); setC(""); setF(""); setK("");
    
    // Dispatch "done" event after successfully adding macros (500ms debounce)
    setTimeout(() => {
      const event = new CustomEvent("walkthrough:event", {
        detail: { testId: "biometrics-macros-added", event: "done" },
      });
      window.dispatchEvent(event);
    }, 500);
    
    // if (SYNC_ENDPOINT) fetch(SYNC_ENDPOINT+"/macros", {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ day: today, P,C,F,K })}).catch(()=>{});
  };
  
  const resetToday = () => {
    setMacroRows(prev => prev.filter(r => r.day !== today));
    // Clear any input fields too
    setP(""); 
    setC(""); 
    setF(""); 
    setK("");
    // Show confirmation toast
    toast({
      title: "Reset Complete",
      description: "Today's macros have been cleared.",
    });
  };

  const handlePhotoUpload = async () => {
    await launchMacroPhotoCapture({
      onAnalyzing: () => {
        toast({
          title: "Analyzing photo...",
          description: "Please wait while AI estimates the nutrition values.",
        });
      },
      onSuccess: (result) => {
        setP(String(result.protein));
        setC(String(result.carbs));
        setF(String(result.fat));
        setK(String(result.calories));

        toast({
          title: "AI Estimate Added",
          description: `Detected ${Math.round(result.calories)} kcal — Protein ${result.protein}g, Carbs ${result.carbs}g, Fat ${result.fat}g.`,
        });
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        });
      },
    });
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
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
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    
    if (params.get("capture") === "1") {
      const alreadyTriggered = sessionStorage.getItem("photo-capture-triggered");
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
    if (typeof window === 'undefined') return;
    const stop = startQueueAutoFlush();
    return () => stop();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const hasDraft = params.get("draft") === "1";
    if (!hasDraft) return;

    const d = readDraft();
    if (!d) return;

    // Normalize macro data (handles protein/protein_g/proteinGrams etc.)
    const { protein, carbs, fat, calories } = normalizeMacros(d as any);
    const dateISO = (d as any).dateISO || (d as any).date || today;
    const mealSlot = (d as any).mealSlot;

    // Auto-add to macros (persists to localStorage via useEffect)
    setMacroRows(prev => {
      const idx = prev.findIndex(r => r.day === dateISO);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          kcal: next[idx].kcal + calories,
          protein: next[idx].protein + protein,
          carbs: next[idx].carbs + carbs,
          fat: next[idx].fat + fat
        };
        return next;
      }
      return [{ day: dateISO ?? today, kcal: calories, protein, carbs, fat }, ...prev];
    });

    // Optional: queue for server sync if endpoint exists
    if (SYNC_ENDPOINT) {
      queueOrPost(SYNC_ENDPOINT + "/macros", {
        day: dateISO ?? today,
        protein,
        carbs,
        fat,
        calories,
        mealSlot: mealSlot ?? null
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

    // Remove ?draft=1 from URL
    const url = new URL(window.location.href);
    url.searchParams.delete("draft");
    window.history.replaceState({}, "", url.toString());
  }, []);

  // Paste support (works with labels or just numbers: "30 40 10 370")
  const [openPaste, setOpenPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [showBiometricsInfoModal, setShowBiometricsInfoModal] = useState(false);
  const [showTodaysMacrosInfoModal, setShowTodaysMacrosInfoModal] = useState(false);

  function parsePaste(text: string){
    // Clean mobile clipboard gibberish (URL-encoded, HTML entities, extra whitespace)
    let cleaned = text
      .replace(/%20/g, ' ')           // URL-encoded space
      .replace(/%2C/g, ',')           // URL-encoded comma
      .replace(/&nbsp;/g, ' ')        // HTML non-breaking space
      .replace(/&amp;/g, '&')         // HTML ampersand
      .replace(/\s+/g, ' ')           // Multiple spaces to single space
      .trim();

    const lower = cleaned.toLowerCase();
    const numRe = /-?\d+(?:\.\d+)?/g;

    const findLabeled = (keys: string[]) => {
      for (const k of keys) {
        const m = lower.match(new RegExp(k + "\\s*[:=]?\\s*(" + numRe.source + ")"));
        if (m) return Number(m[1]);
      }
      return undefined;
    };

    let P = findLabeled(["protein","prot","p"]);
    let C = findLabeled(["carb","carbs","c"]);
    let F = findLabeled(["fat","f"]);
    let K = findLabeled(["kcal","calories","cal","k"]);

    if ([P,C,F].some(v => v === undefined)) {
      const nums = (cleaned.match(numRe) || []).map(Number);
      if (nums.length >= 3) {
        P = P ?? nums[0]; C = C ?? nums[1]; F = F ?? nums[2]; K = K ?? nums[3];
      }
    }

    return {
      P: Number(P || 0),
      C: Number(C || 0),
      F: Number(F || 0),
      K: K !== undefined ? Number(K) : undefined
    };
  }

  function addMacrosParsed(){
    const { P, C, F, K } = parsePaste(pasteText);
    if ([P,C,F].every(v => !v) && !K) return;

    const K2 = K !== undefined ? K : Math.round(kcalFrom(P, C, F));

    setMacroRows(prev => {
      const idx = prev.findIndex(r => r.day === today);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          kcal: next[idx].kcal + K2,
          protein: next[idx].protein + P,
          carbs: next[idx].carbs + C,
          fat: next[idx].fat + F
        };
        return next;
      }
      return [{ day: today, kcal: K2, protein: P, carbs: C, fat: F }, ...prev];
    });

    setPasteText("");
    setOpenPaste(false);
  }

  // Default targets if user hasn't set any yet
  const defaultTargets = { calories: 2000, protein_g: 160, carbs_g: 180, fat_g: 70 };
  const activeTargets = targets || defaultTargets;

  // View toggles for charts
  const [caloriesView, setCaloriesView] = useState<'today' | '7' | '30'>('30');
  const [weightView, setWeightView] = useState<'7' | '1' | '3' | '6' | '12'>('12');

  // ------- BODY / WEIGHT (local) -------
  const [body, setBody] = useState<{ heightIn?: number }>(() => loadJSON(LS_BODY, { heightIn: 68 }));
  useEffect(() => saveJSON(LS_BODY, body), [body]);

  const [weightHistory, setWeightHistory] = useState<WeightRow[]>(() => loadJSON(LS_WEIGHT, [] as WeightRow[]));
  useEffect(() => saveJSON(LS_WEIGHT, weightHistory), [weightHistory]);

  // Fetch weight history from database (server as source of truth)
  useEffect(() => {
    const fetchWeightHistory = async () => {
      try {
        const response = await fetch(apiUrl("/api/biometrics/weight?range=365d"));
        if (response.ok) {
          const data = await response.json();
          if (data.history && data.history.length > 0) {
            // Convert to WeightRow format for charts
            const dbWeights: WeightRow[] = data.history.map((h: any) => ({
              id: h.id,
              date: h.date,
              weight: h.unit === "kg" ? Math.round(h.weight * 2.20462) : h.weight, // Convert to lbs
              waist: undefined
            }));
            setWeightHistory(dbWeights);
            console.log("✅ Loaded weight history from database:", dbWeights.length, "entries");
          }
        }
      } catch (error) {
        console.error("Failed to fetch weight history:", error);
        // Fallback to localStorage if database fetch fails
      }
    };
    fetchWeightHistory();
  }, []); // Fetch once on mount

  // Check for pending weight sync from MacroCounter
  const [pendingWeightSync, setPendingWeightSync] = useState<{ weight: number; units: string; timestamp: number } | null>(() => {
    try {
      const raw = localStorage.getItem("pending-weight-sync");
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {}
    return null;
  });

  const [weightLbs, setWeightLbs] = useState("");
  const [waistIn, setWaistIn] = useState("");

  // Pre-fill weight if pending sync exists
  useEffect(() => {
    if (pendingWeightSync && !weightLbs) {
      // Convert to lbs if needed
      const weightInLbs = pendingWeightSync.units === "imperial" 
        ? pendingWeightSync.weight 
        : Math.round(pendingWeightSync.weight * 2.20462);
      setWeightLbs(String(weightInLbs));
    }
  }, [pendingWeightSync]);

  const saveWeight = async () => {
    const w = weightLbs.trim() ? Number(weightLbs) : undefined;
    const wst = waistIn.trim() ? Number(waistIn) : undefined;
    if (!w) return;
    
    try {
      // Save to database
      const response = await fetch(apiUrl("/api/biometrics/weight"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value: w,
          unit: "lb",
          measuredAt: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error("Failed to save weight");
      }

      const savedData = await response.json();
      
      // Update local state with saved data
      const row: WeightRow = { 
        id: savedData.id || crypto.randomUUID(), 
        date: today, 
        weight: w, 
        waist: wst 
      };
      setWeightHistory(prev => [row, ...prev].slice(0, 365));
      setWeightLbs(""); 
      setWaistIn("");

      // Clear pending sync after saving
      if (pendingWeightSync) {
        localStorage.removeItem("pending-weight-sync");
        setPendingWeightSync(null);
        toast({ title: "✓ Weight saved", description: "Weight from Macro Calculator has been logged to your history." });
        // Redirect to Planner page after saving weight from macro calculator
        setLocation("/planner");
      } else {
        toast({ title: "✓ Weight saved", description: "Your weight has been saved successfully." });
      }
    } catch (error) {
      console.error("Error saving weight:", error);
      toast({ 
        title: "Error saving weight", 
        description: "Failed to save weight. Please try again.",
        variant: "destructive"
      });
    }
  };

  const latestWeight = useMemo(() => weightHistory[0]?.weight, [weightHistory]);
  const latestWaist = useMemo(() => weightHistory.find(r => r.waist)?.waist, [weightHistory]);

  const bmi = useMemo(() => {
    if (!latestWeight || !body.heightIn) return undefined;
    const kg = latestWeight * 0.453592; const m = body.heightIn * 0.0254; return (kg/(m*m)).toFixed(1);
  }, [latestWeight, body.heightIn]);
  const whr = useMemo(() => {
    if (!latestWaist || !body.heightIn) return undefined; return (latestWaist / body.heightIn).toFixed(2);
  }, [latestWaist, body.heightIn]);

  // Weight history datasets for chart
  const weight7days = useMemo(() => {
    const days = new Map<string, number[]>();
    for (const r of weightHistory) {
      const key = r.date.slice(0,10);
      if (!days.has(key)) days.set(key, []);
      days.get(key)!.push(r.weight);
    }
    const out: { date: string; weightAvg: number }[] = [];
    for (let i=6;i>=0;i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const vals = days.get(key);
      const avg = vals && vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
      out.push({ date: key, weightAvg: avg });
    }
    return out;
  }, [weightHistory]);

  const weight1mo = useMemo(() => {
    const days = new Map<string, number[]>();
    for (const r of weightHistory) {
      const key = r.date.slice(0,10);
      if (!days.has(key)) days.set(key, []);
      days.get(key)!.push(r.weight);
    }
    const out: { date: string; weightAvg: number }[] = [];
    for (let i=29;i>=0;i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const vals = days.get(key);
      const avg = vals && vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
      out.push({ date: key, weightAvg: avg });
    }
    return out;
  }, [weightHistory]);

  const weight3mo = useMemo(() => {
    const days = new Map<string, number[]>();
    for (const r of weightHistory) {
      const key = r.date.slice(0,10);
      if (!days.has(key)) days.set(key, []);
      days.get(key)!.push(r.weight);
    }
    const out: { date: string; weightAvg: number }[] = [];
    for (let i=89;i>=0;i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const vals = days.get(key);
      const avg = vals && vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
      out.push({ date: key, weightAvg: avg });
    }
    return out;
  }, [weightHistory]);

  const weight6mo = useMemo(() => {
    const days = new Map<string, number[]>();
    for (const r of weightHistory) {
      const key = r.date.slice(0,10);
      if (!days.has(key)) days.set(key, []);
      days.get(key)!.push(r.weight);
    }
    const out: { date: string; weightAvg: number }[] = [];
    for (let i=179;i>=0;i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const vals = days.get(key);
      const avg = vals && vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
      out.push({ date: key, weightAvg: avg });
    }
    return out;
  }, [weightHistory]);

  const weight12mo = useMemo(() => {
    const days = new Map<string, number[]>();
    for (const r of weightHistory) {
      const key = r.date.slice(0,10);
      if (!days.has(key)) days.set(key, []);
      days.get(key)!.push(r.weight);
    }
    const out: { date: string; weightAvg: number }[] = [];
    for (let i=364;i>=0;i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
      const vals = days.get(key);
      const avg = vals && vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : 0;
      out.push({ date: key, weightAvg: avg });
    }
    return out;
  }, [weightHistory]);

  // ------- export CSV -------
  const exportCSV = () => {
    const pad = (n:number)=>String(n).padStart(2,'0');
    const now=new Date();
    const fname=`biometrics_export_${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}.csv`;
    const esc=(v:any)=>{
      const s=String(v ?? "");
      return (s.includes(',')||s.includes('"')||s.includes('\n'))?`"${s.replace(/"/g,'""')}"`:s;
    };
    let out:string[]=[];
    // Macros per-day totals
    out.push('Section,Date,Calories,Protein,Carbs,Fat');
    for (const r of [...macroRows].sort((a,b)=>a.day.localeCompare(b.day))) {
      out.push(['Macros', r.day, r.kcal, r.protein, r.carbs, r.fat].map(esc).join(','));
    }
    out.push('');
    // Weight history
    out.push('Section,Date,Weight(lb),Waist(in)');
    const weightRows = [...weightHistory].sort((a,b)=>a.date.localeCompare(b.date));
    for (const r of weightRows) out.push(['Weight', r.date, r.weight, r.waist ?? ''].map(esc).join(','));
    out.push('');
    // Body snapshot (latest values)
    out.push('Section,LastUpdated,Weight(lb),Waist(in),Height(in),BMI,Waist/Height');
    out.push(['Body', today, latestWeight ?? '', latestWaist ?? '', body.heightIn ?? '', bmi ?? '', whr ?? ''].map(esc).join(','));

    const blob=new Blob([out.join('\n')], {type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a'); a.href=url; a.download=fname; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  // ------- helpers -------
  const ProgressBar = ({ value, goal }: { value: number; goal: number }) => {
    const pct = Math.max(0, Math.min(100, goal ? (value/goal)*100 : 0));
    return (
      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-orange-600 to-orange-500" style={{ width: `${pct}%` }} />
      </div>
    );
  };

  const ViewToggle = ({ value, onChange }: { value: 'today' | '7' | '30'; onChange: (v: 'today' | '7' | '30') => void }) => (
    <div className="flex gap-1 bg-black/30 p-1 rounded-lg">
      {(['today', '7', '30'] as const).map(v => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-3 py-1 rounded text-xs font-medium transition ${
            value === v ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
          }`}
        >
          {v === 'today' ? 'Today' : `${v} Days`}
        </button>
      ))}
    </div>
  );

  const MonthViewToggle = ({ value, onChange }: { value: '7' | '1' | '3' | '6' | '12'; onChange: (v: '7' | '1' | '3' | '6' | '12') => void }) => (
    <div className="flex gap-1 bg-black/30 p-1 rounded-lg">
      {(['7', '1', '3', '6', '12'] as const).map(v => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-3 py-1 rounded text-xs font-medium transition ${
            value === v ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
          }`}
        >
          {v === '7' ? '1W' : v === '1' ? '1M' : v === '3' ? '3M' : v === '6' ? '6M' : '12M'}
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
      <div
        className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-8 py-3 flex items-center gap-3">
        

          {/* Title */}
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            My Biometrics
          </h1>

          <div className="flex-grow" />

          <QuickTourButton onClick={quickTour.openTour} />
        </div>
      </div>

      {/* Main Content */}
      <div
        className="max-w-6xl mx-auto space-y-6 px-4 md:px-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        


        {/* MACROS */}
        <Card data-testid="biometrics-macro-summary" className="bg-black/30 backdrop-blur-lg border border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5"/> 
              Today's Macros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">

              {/* Macro Targets Progress */}
              {targets ? (
                <div className="rounded-2xl border border-orange-400/30 p-4 mb-3 bg-orange-900/20 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-semibold text-white flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Macro Targets Active
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="bg-orange-600/20 text-orange-200 border-orange-400/30 hover:bg-orange-600/30 hover:border-orange-400/50 h-auto py-1 px-3 rounded-full text-xs flex items-center gap-1"
                          data-testid="button-persistent-explanation"
                        >
                          <Info className="h-3 w-3" />
                          <span>Persistent</span>
                          <span className="text-orange-300/70 text-[10px]">(tap)</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-black/90 backdrop-blur-lg border border-white/20 text-white max-w-md">
                        <DialogHeader>
                          <DialogTitle className="text-white flex items-center gap-2">
                            <Info className="h-5 w-5 text-orange-400" />
                            What Does "Persistent" Mean?
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-4">
                          <p className="text-white/90 text-sm leading-relaxed">
                            <strong className="text-orange-300">Persistent</strong> means these macro targets stay the same every day until you change them.
                          </p>
                          <p className="text-white/80 text-sm leading-relaxed">
                            Unlike your daily macro tracking (which resets each day), your <strong>macro targets</strong> remain constant. They don't change automatically.
                          </p>
                          <div className="rounded-lg border border-orange-400/30 bg-orange-900/20 p-3">
                            <p className="text-orange-200 text-sm">
                              💡 <strong>Example:</strong> If your target is 2000 calories today, it will still be 2000 calories tomorrow, next week, and next month—unless you update it.
                            </p>
                          </div>
                          <p className="text-white/70 text-xs mb-4">
                            {targetSource === "pro"
                              ? `These targets were set by ${proName}. They'll stay active until ${proName} changes them.`
                              : "You can change your macro targets anytime from:"}
                          </p>

                          {targetSource !== "pro" && (
                            <div className="grid grid-cols-2 gap-3">
                              <Button
                                onClick={() => setLocation("/macro-calculator")}
                                className="bg-orange-600/20 text-orange-200 border border-orange-400/30 hover:bg-orange-600/30 hover:border-orange-400/50 h-auto py-2 text-xs"
                                data-testid="button-go-macro-calculator"
                              >
                                Macro Calculator
                              </Button>
                              <Button
                                onClick={() => {
                                  const userId = localStorage.getItem("userId") || "1";
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
                      </DialogContent>
                    </Dialog>
                  </div>

                  {/* Pro-set badge (if targets are set by professional) */}
                  {targetSource === 'pro' && (
                    <div className="mb-3 rounded-lg border border-orange-400/50 bg-orange-900/30 backdrop-blur-sm p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Stethoscope className="h-4 w-4 text-orange-300" />
                        <span className="font-semibold text-orange-200">Set by {proName}</span>
                      </div>
                      <div className="text-xs text-white/60 mt-1">
                        Your professional has customized your macro targets
                      </div>
                    </div>
                  )}

                  {/* Top summary badges with pulsing effect */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {summaryBadges.map(b => (
                      <Badge
                        key={b.key}
                        variant="outline"
                        className={[
                          b.near ? "border-yellow-400/70 bg-yellow-500/15 text-yellow-100/90 mpm-badge-pulse" : "bg-white/10 text-white/80 border-white/20"
                        ].join(" ")}
                        title={`${Math.round(b.pct)}% of ${b.key}`}
                      >
                        {b.key}{b.over ? " (Over)" : b.near ? ` (${Math.round(b.pct)}%)` : ""}
                      </Badge>
                    ))}
                  </div>

                  {/* Progress bars - white/yellow/pink system */}
                  <div data-testid="biometrics-progress-bars">
                  {summaryBadges.map(row => {
                    const near = row.pct >= 90;
                    const over = row.pct >= 100;
                    const barColor = over ? "bg-pink-500" : near ? "bg-yellow-400" : "bg-white/70";
                    return (
                      <div key={row.key} className="space-y-2 mb-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-white">{row.key}</span>
                          <span className="text-white">
                            {Math.round(row.used)} / {Math.round(row.max)} {row.unit} {over ? "• Over" : near ? `• ${Math.round(row.pct)}%` : ""}
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
                            {over ? "Over today's limit." : "Approaching limit."}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-orange-400/30 p-4 mb-3 bg-orange-900/10 backdrop-blur-sm">
                  <div className="text-sm text-white/70 text-center">
                    💡 Go to <span className="font-semibold text-white">Macro Calculator</span> and tap{" "}
                    <span className="font-semibold text-orange-300">"Set Macro Targets"</span> to track progress here
                  </div>
                </div>
              )}

              {/* Photo Upload Button */}
              <Button
                data-wt="bio-scan-button"
                onClick={handlePhotoUpload}
                className="w-full bg-lime-500 hover:bg-lime-700 text-md text-white mb-3"
                data-testid="button-photo-upload"
              >
                📸 Log from Photo
              </Button>

              {/* Quick View Panel (display only, no auto-logging) */}
              {qv && (
                <div className="rounded-2xl border border-white/20 p-3 mb-3 bg-black/20 backdrop-blur-sm">
                  <div className="text-sm font-semibold mb-2 text-white">Quick View (not logged)</div>
                  <div className="text-sm text-white/90 mb-2">
                    Protein <b className="text-white">{qv.protein} g</b> · Carbs <b className="text-white">{qv.carbs} g</b> · Fat <b className="text-white">{qv.fat} g</b> · Calories <b className="text-white">{qv.calories}</b>
                  </div>
                  <div className="text-xs text-white/60 mb-2">
                    Date: {qv.dateISO}{qv.mealSlot ? ` · ${qv.mealSlot}` : ""}
                  </div>
                  <div className="flex gap-2 mb-2">
                    <Button
                      onClick={fillFromQuickView}
                      className="px-3 py-1 rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 text-sm"
                      data-testid="button-fill-inputs"
                    >
                      Fill Inputs
                    </Button>
                    <Button
                      onClick={dismissQuickView}
                      className="px-3 py-1 rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 text-sm"
                      data-testid="button-dismiss-quickview"
                    >
                      Dismiss
                    </Button>
                  </div>
                  <div className="text-[11px] text-white/60">
                    Tip: Review or edit your numbers below, then press <b>Add</b> to log for today.
                  </div>
                </div>
              )}

              <div data-testid="biometrics-macro-inputs" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-white/80 font-medium mb-1 block">Protein (g)</label>
                  <Input data-wt="bio-manual-protein" type="text" className="bg-black/20 border-white/20 text-white placeholder:text-white/50" value={p} onChange={e=>setP(e.target.value)} data-testid="input-protein" />
                </div>
                <div>
                  <label className="text-xs text-white/80 font-medium mb-1 block">Carbs (g)</label>
                  <Input data-wt="bio-manual-carbs" type="text" className="bg-black/20 border-white/20 text-white placeholder:text-white/50" value={c} onChange={e=>setC(e.target.value)} data-testid="input-carbs" />
                </div>
                <div>
                  <label className="text-xs text-white/80 font-medium mb-1 block">Fat (g)</label>
                  <Input data-wt="bio-manual-fat" type="text" className="bg-black/20 border-white/20 text-white placeholder:text-white/50" value={f} onChange={e=>setF(e.target.value)} data-testid="input-fat" />
                </div>
                <div>
                  <label className="text-xs text-white/80 font-medium mb-1 block">Calories</label>
                  <Input data-wt="bio-manual-calories" type="text" className="bg-black/20 border-white/20 text-white placeholder:text-white/50" value={k} onChange={e=>setK(e.target.value)} data-testid="input-calories" />
                </div>
              </div>

              {/* Additional Macros instruction note */}
              {PROFILES_ENABLED && (
                <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <p className="text-xs text-white/90 leading-relaxed text-center">
                    <strong>Short on Protein or Carbs?</strong> Enter the amount you need to add in{" "}
                    <strong>either the Protein field OR the Carbs field</strong> (don't adjust Calories or Fat — leave those
                    blank). Then use the <strong>Additional Macros</strong> dropdown to select which food source you're getting
                    it from (chicken, rice, veggies, etc.). Press <strong>Add</strong> and the system will automatically fill in
                    all the other macros based on that food type.
                  </p>
                </div>
              )}

              {/* Additional Macros selector */}
              {PROFILES_ENABLED && (
                <div className="flex items-center justify-between gap-2 mt-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/70 font-medium">Additional Macros:</span>
                    <Select value={selectedProfile} onValueChange={(v) => setSelectedProfile(v as Profile)}>
                      <SelectTrigger className="w-40 bg-white/10 border-white/20 text-white" data-testid="select-source-profile">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whey">Whey / Isolate</SelectItem>
                        <SelectItem value="chicken">Chicken (lean)</SelectItem>
                        <SelectItem value="turkey">Turkey (lean)</SelectItem>
                        <SelectItem value="fish">White Fish (lean)</SelectItem>
                        <SelectItem value="beef">Red Meat (beef/steak)</SelectItem>
                        <SelectItem value="rice">Rice (starchy carb)</SelectItem>
                        <SelectItem value="oats">Oats (carb+fat tail)</SelectItem>
                        <SelectItem value="veggies">Fibrous Veggies (carb)</SelectItem>
                        <SelectItem value="oil">Olive Oil (fat)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center gap-2 mt-3">
                <Button data-testid="biometrics-add-button" onClick={addMacros} className="bg-white/10 border border-white/20 text-white hover:bg-white/20"><PlusCircle className="h-4 w-4 mr-1"/> Add</Button>
                <Button onClick={resetToday} className="bg-white/10 border border-white/20 text-white hover:bg-white/20" data-testid="button-reset-today"><RotateCcw className="h-4 w-4 mr-1"/> Reset Today</Button>
              </div>

              {/* Paste modal */}
              {openPaste && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={()=>setOpenPaste(false)}>
                  <div className="w-full max-w-lg rounded-2xl border border-white/20 bg-neutral-900 text-white" onClick={e=>e.stopPropagation()}>
                    <div className="p-4 border-b border-white/10 font-semibold">Paste Macros</div>
                    <div className="p-4 space-y-3">
                      <p className="text-sm text-white/70">
                        Accepts formats like: <code className="bg-black/30 px-1 rounded">Protein 30, Carbs 40, Fat 10, 370 kcal</code>
                        {" "}or just{" "} <code className="bg-black/30 px-1 rounded">30 40 10 370</code>.
                      </p>
                      <textarea
                        value={pasteText}
                        onChange={e=>setPasteText(e.target.value)}
                        rows={6}
                        className="w-full rounded-lg bg-black/30 border border-white/20 p-3 outline-none text-white"
                        placeholder="Paste here..."
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" className="bg-white/10 border-white/20 text-white" onClick={()=>setOpenPaste(false)}>Cancel</Button>
                        <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={addMacrosParsed}>Add</Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2 mt-2">
                <Row data-wt="bio-calories-today" label="Calories" value={`${todayRow.kcal} / ${activeTargets.calories} kcal`}><ProgressBar value={todayRow.kcal} goal={activeTargets.calories}/></Row>
                <Row label="Protein" value={`${todayRow.protein} / ${activeTargets.protein_g} g`}><ProgressBar value={todayRow.protein} goal={activeTargets.protein_g}/></Row>
                <Row label="Carbs" value={`${todayRow.carbs} / ${activeTargets.carbs_g} g`}><ProgressBar value={todayRow.carbs} goal={activeTargets.carbs_g}/></Row>
                <Row label="Fat" value={`${todayRow.fat} / ${activeTargets.fat_g} g`}><ProgressBar value={todayRow.fat} goal={activeTargets.fat_g}/></Row>
              </div>
            </CardContent>
        </Card>

        {/* Calories chart - continuous 30 days (matches Steps) */}
        <Card data-testid="biometrics-charts-section" className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white text-xl flex items-center gap-2"><BarChart3 className="h-5 w-5"/> Calories</CardTitle>
              <ViewToggle value={caloriesView} onChange={setCaloriesView} />
            </CardHeader>
            <CardContent>
              <div style={{ width:"100%", height:220 }}>
                <ResponsiveContainer>
                  <LineChart data={(caloriesView === 'today' ? caloriesToday : caloriesView === '7' ? calories7 : calories30)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#fff" }} tickFormatter={(v:string)=>{ const d=new Date(v+"T12:00:00"); return `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`; }} />
                    <YAxis tick={{ fontSize: 10, fill: "#fff" }} />
                    <Tooltip contentStyle={{ background:"rgba(0,0,0,0.9)", border:"1px solid #333", color:"#fff", borderRadius:8 }} labelFormatter={(l)=>new Date(l+"T12:00:00").toLocaleDateString()} />
                    <Line type="monotone" dataKey="kcal" stroke="#fbbf24" dot={false} name="Calories" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

        {/* BODY with weight history */}
        <Card className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-white text-xl flex items-center gap-2"><Scale className="h-5 w-5"/> Body Stats</CardTitle>
              <MonthViewToggle value={weightView} onChange={setWeightView} />
            </CardHeader>
            <CardContent>
              <div data-testid="biometrics-weight-input" className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <div className="text-xs text-white/70">Weight (lb)</div>
                  <Input inputMode="decimal" className="bg-black/20 border-white/20 text-white" value={weightLbs} onChange={e=>setWeightLbs(e.target.value)} data-testid="input-weight" />
                </div>
                <div>
                  <div className="text-xs text-white/70">Waist (in)</div>
                  <Input inputMode="decimal" className="bg-black/20 border-white/20 text-white" value={waistIn} onChange={e=>setWaistIn(e.target.value)} data-testid="input-waist" />
                </div>
              </div>
              <Button id="save-weight-button" data-testid="biometrics-save-weight-button" data-walkthrough="save-weight" onClick={saveWeight} className="bg-lime-500 border border-white/20 text-white hover:bg-lime-700 mb-2">Save Weight</Button>
              <ReadOnlyNote>
                Track your weight progress here over time. Your weight data automatically syncs with the <strong>Macro Calculator</strong>.
              </ReadOnlyNote>
              <div style={{ width:"100%", height:220 }} className="mt-2">
                <ResponsiveContainer>
                  <LineChart data={weightView === '7' ? weight7days : weightView === '1' ? weight1mo : weightView === '3' ? weight3mo : weightView === '6' ? weight6mo : weight12mo}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#fff" }} tickFormatter={(v:string)=>{ const d=new Date(v+"T12:00:00"); return `${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`; }} />
                    <YAxis tick={{ fontSize: 10, fill: "#fff" }} />
                    <Tooltip contentStyle={{ background:"rgba(0,0,0,0.9)", border:"1px solid #333", color:"#fff", borderRadius:8 }} labelFormatter={(l)=>new Date(l+"T12:00:00").toLocaleDateString()} />
                    <Line type="monotone" dataKey="weightAvg" stroke="#10b981" dot={false} name="Weight (lb)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-4">
                {latestWeight && <Summary label="Weight" value={`${latestWeight} lb`} />}
                {latestWaist && <Summary label="Waist" value={`${latestWaist}"`} />}
                {bmi && <Summary label="BMI*" value={bmi} sub="*Height from settings" />}
                {whr && <Summary label="Waist/Height" value={whr} />}
              </div>
            </CardContent>
          </Card>

        {/* WATER LOG */}
        <Card className="bg-black/30 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white text-xl flex items-center gap-2">
              💧 Water Log
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <WaterLog />
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
            <h3 className="text-xl font-bold text-white mb-4">About My Biometrics</h3>
            
            <div className="space-y-4 text-white/90 text-sm">
              <p>
                Track your daily macros (protein, carbs, fat, calories), weight, and water intake. Your data is stored locally and syncs with the Macro Calculator.
              </p>
              <p className="text-white/80">
                Use the "Add" button to log meals manually, or tap "Log from Photo" to use AI to estimate nutrition from a food picture.
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
            <h3 className="text-xl font-bold text-white mb-4">Your Macro Targets Are Set</h3>
            
            <div className="space-y-4 text-white/90 text-sm">
              <p>
                Your macro targets are now active in today's macros. Navigate to the Body Stats card below, save your weight, and you will be sent to the plan builder.
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
      />
    </motion.div>
  );
}

// ============================== WATER LOG ==============================
function WaterLog() {
  const [water, setWater] = useState(() => {
    const saved = localStorage.getItem("mpm_bio_water");
    const today = new Date().toDateString();
    if (!saved) return { date: today, ounces: 0 };
    const parsed = JSON.parse(saved);
    return parsed.date === today ? parsed : { date: today, ounces: 0 };
  });

  const goal = useMemo(() => {
    const w = Number(localStorage.getItem("latestWeight")) || 180;
    return Math.round(w * 0.67); // standard hydration formula
  }, []);

  const save = (oz: number) => {
    const today = new Date().toDateString();
    const updated = { date: today, ounces: oz };
    setWater(updated);
    localStorage.setItem("mpm_bio_water", JSON.stringify(updated));
  };

  const addWater = (oz: number) => {
    save(Math.min(goal, water.ounces + oz));
  };

  const resetWater = () => save(0);

  const pct = Math.min(100, (water.ounces / goal) * 100);

  return (
    <div data-wt="bio-water-counter" className="flex flex-col items-center space-y-4 text-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90">
          <circle cx="64" cy="64" r="60" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
          <circle
            cx="64"
            cy="64"
            r="60"
            stroke="#38bdf8"
            strokeWidth="8"
            fill="none"
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

      <div className="flex gap-2">
        <Button data-wt="bio-water-plus8" onClick={() => addWater(8)} className="bg-sky-600 hover:bg-sky-700 text-white" data-testid="button-add-8oz">
          +8 oz
        </Button>
        <Button data-wt="bio-water-plus16" onClick={() => addWater(16)} className="bg-sky-600 hover:bg-sky-700 text-white" data-testid="button-add-16oz">
          +16 oz
        </Button>
        <Button onClick={resetWater} className="bg-black/30 border border-white/20 text-white hover:bg-black/50" data-testid="button-reset-water">
          Reset
        </Button>
      </div>

      <p className="text-xs text-white/60">
        {pct < 40
          ? "Stay hydrated — your body loves water!"
          : pct < 80
          ? "Looking good — keep sipping 💧"
          : "Perfect hydration! 💦"}
      </p>
    </div>
  );
}

// ============================== UI bits ==============================
function Row({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1"><span className="text-white/80">{label}</span><span className="text-white">{value}</span></div>
      {children}
    </div>
  );
}
function Summary({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl p-3 bg-black/20 border border-white/10">
      <div className="text-xs text-white/70">{label}</div>
      <div className="text-lg font-semibold text-white">{value}</div>
      {sub && <div className="text-xs text-white/60">{sub}</div>}
    </div>
  );
}