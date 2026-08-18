import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { UniversalDialog } from "@/components/ui/universal-modal";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Camera,
  Mic,
  PenLine,
  Loader2,
  CheckCircle,
  Heart,
  Square,
  ImagePlus,
  ChevronLeft,
  Sparkles,
  Trash2,
} from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import AlphaGalBadge from "@/components/AlphaGalBadge";
import { CuisineOverrideControl } from "@/components/ui/CuisineOverrideControl";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import type { IngredientScanResult } from "@/lib/photoIngredientCapture";
import { useToast } from "@/hooks/use-toast";
import { MealImageSlot } from "@/components/ui/MealImageSlot";
import { useMealImages } from "@/hooks/useMealImages";
import { useCopilot } from "@/components/copilot/CopilotContext";
import { shouldAllowAutoOpen } from "@/components/copilot/CopilotRespectGuard";

type InputMode = "camera" | "upload" | "voice" | "text";
type ModalPhase = "capture" | "options" | "processing" | "preview" | "error";

interface InspirationCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destination?: "recipe" | "smart-scan";
  profileType?: "human" | "companion";
  profileId?: string;
  profileName?: string;
  onScanResult?: (result: IngredientScanResult) => void;
}

function resizeImageToBase64(file: File, maxPx = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── Exported for unit-testing — resolves the request body that handleTryMore
// sends to /api/inspiration/capture from the current capture + result state.
// Returns null when the guard fires (no image and no usable description).
export interface TryMoreContext {
  mode: string;
  capturedBase64: string | null;
  capturedText: string;
  result: { extractedDescription?: string; options?: any[] } | null;
  servings: number;
  healthMode: string;
  proteinPriority: string;
  prepStyle: string;
  cuisineOverrideEnabled: boolean;
  cuisineOverrideValue: string;
}

export function resolveTryMoreRequestBody(
  ctx: TryMoreContext,
): Record<string, any> | null {
  const {
    mode,
    capturedBase64,
    capturedText,
    result,
    servings,
    healthMode,
    proteinPriority,
    prepStyle,
    cuisineOverrideEnabled,
    cuisineOverrideValue,
  } = ctx;

  const hasImage = (mode === "camera" || mode === "upload") && !!capturedBase64;
  const effectiveContent: string =
    capturedText ||
    (result?.extractedDescription ?? "") ||
    "";
  const effectiveMode: string = hasImage ? mode : "text";

  if (!hasImage && !effectiveContent) return null;

  const currentNames: string[] = ((result?.options ?? []) as any[])
    .map((opt: any) => (opt.name || opt.title || "").trim())
    .filter(Boolean);

  const body: Record<string, any> = {
    inputType: effectiveMode,
    servings,
    healthMode,
    proteinPriority,
    prepStyle,
    skipImages: true,
    ...(cuisineOverrideEnabled && cuisineOverrideValue
      ? { cuisineOverride: cuisineOverrideValue }
      : {}),
    ...(currentNames.length > 0 ? { excludedOptionNames: currentNames } : {}),
  };

  if (hasImage) {
    body.imageBase64 = capturedBase64;
    body.content = "";
  } else {
    body.content = effectiveContent;
  }

  return body;
}

/**
 * Assign a stable client-side `id` to each option so useMealImages can key
 * by it.  Uses the meal's own id when present; otherwise generates one from
 * the dish name + index so it remains deterministic across minor re-renders.
 */
function normalizeOptions(opts: any[]): any[] {
  return opts.map((opt, i) => ({
    ...opt,
    id: opt.id || `insp-${(opt.name || opt.title || "meal").replace(/\s+/g, "-").toLowerCase()}-${i}`,
  }));
}

/**
 * Assign a stable client-side `id` to the single-result mealData so
 * useMealImages can key by it for shimmer tracking.
 */
function normalizeSingleMeal(meal: any): any {
  if (!meal) return meal;
  return {
    ...meal,
    id: meal.id || `insp-single-${(meal.name || meal.title || "meal").replace(/\s+/g, "-").toLowerCase()}`,
  };
}

/**
 * Small wrapper that fades in a single card image once the browser has loaded
 * the src.  Keeps its own `revealed` state so each card is independent.
 */
function CardImage({ src, alt }: { src: string; alt: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <img
      src={src}
      alt={alt}
      className={`w-full h-full object-cover transition-opacity duration-300 ${revealed ? "opacity-100" : "opacity-0"}`}
      onLoad={() => setRevealed(true)}
    />
  );
}

const SERVINGS_OPTIONS: { value: number; labelKey: string }[] = [
  { value: 1, labelKey: "inspiration.servingsJustMe" },
  { value: 2, labelKey: "inspiration.servings2" },
  { value: 3, labelKey: "inspiration.servings3" },
  { value: 4, labelKey: "inspiration.servingsFamily" },
  { value: 6, labelKey: "inspiration.servingsMealPrep" },
];

export default function InspirationCaptureModal({
  open,
  onOpenChange,
  destination = "recipe",
  profileType = "human",
  profileId,
  profileName,
  onScanResult,
}: InspirationCaptureModalProps) {
  const { t } = useTranslation();
  const isSmartScan = destination === "smart-scan";
  const isCompanionScan = isSmartScan && profileType === "companion" && !!profileName;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { open: openCopilot, setLastResponse } = useCopilot();
  const hasTriggeredExplanation = useRef(false);

  // Restore last recipe scan when modal opens (recipe destination only)
  useEffect(() => {
    if (!open || destination !== "recipe") return;
    try {
      const saved = localStorage.getItem("mpm.recipe.lastScan");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Ensure restored options/mealData have stable ids and hydrate any missing images
        const normalizedParsed = Array.isArray(parsed.options)
          ? { ...parsed, options: normalizeOptions(parsed.options) }
          : parsed.mealData
            ? { ...parsed, mealData: normalizeSingleMeal(parsed.mealData) }
            : parsed;
        setResult(normalizedParsed);
        setPhase("preview");
        if (Array.isArray(normalizedParsed.options)) {
          hydrateImages(normalizedParsed.options);
        } else if (normalizedParsed.mealData && !normalizedParsed.mealData.imageUrl) {
          hydrateSingleImage([normalizedParsed.mealData]);
        }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, destination]);

  useEffect(() => {
    if (!open || isSmartScan) {
      hasTriggeredExplanation.current = false;
      return;
    }
    if (hasTriggeredExplanation.current) return;
    if (!shouldAllowAutoOpen()) return;
    hasTriggeredExplanation.current = true;
    const timer = setTimeout(() => {
      openCopilot();
      setTimeout(() => {
        setLastResponse({
          title: t("inspiration.copilotTitle"),
          description: t("inspiration.copilotDescription"),
          spokenText: t("inspiration.copilotSpokenText"),
          autoClose: true,
        });
      }, 300);
    }, 800);
    return () => clearTimeout(timer);
  }, [open, openCopilot, setLastResponse]);

  // ── Phase ──
  const [phase, setPhase] = useState<ModalPhase>("capture");

  // ── Capture state ──
  const [mode, setMode] = useState<InputMode>("upload");
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null);
  const [capturedText, setCapturedText] = useState("");
  const [textInput, setTextInput] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);

  // ── Options state ──
  const [servings, setServings] = useState(2);
  const [healthMode, setHealthMode] = useState<
    "authentic" | "balanced" | "healthier"
  >("balanced");
  const [proteinPriority, setProteinPriority] = useState<
    "standard" | "high" | "athlete"
  >("standard");
  const [prepStyle, setPrepStyle] = useState<"any" | "easy">("any");
  const [cuisineOverrideEnabled, setCuisineOverrideEnabled] = useState(false);
  const [cuisineOverrideValue, setCuisineOverrideValue] = useState("");

  // ── Result state ──
  const [result, setResult] = useState<any>(null);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // Tracks which option indices have been saved — multiple saves from the same scan are allowed
  const [savedIndices, setSavedIndices] = useState<number[]>([]);
  // True while "Try 3 More" is fetching new options — keeps old cards visible during the wait
  const [isRegenerating, setIsRegenerating] = useState(false);
  // Set when Try 3 More returns a constraint_conflict (not a real error) so we
  // can show a calm inline note rather than a red toast, while keeping the
  // existing cards on screen unchanged.
  const [tryMoreConstraintMsg, setTryMoreConstraintMsg] = useState<string | null>(null);

  // ── Lazy image hydration ──
  // setOptions forwards updates from useMealImages into result.options so each
  // card's imageUrl fills in independently as its image resolves.
  const setOptions = useCallback(
    (updater: React.SetStateAction<any[]>) => {
      setResult((prev: any) => {
        if (!prev) return prev;
        const prevOptions: any[] = prev.options ?? [];
        const newOptions =
          typeof updater === "function" ? updater(prevOptions) : updater;
        return { ...prev, options: newOptions };
      });
    },
    []
  );
  const { loadingImages, hydrateImages } = useMealImages(setOptions, {
    concurrency: 3,
    mealType: "dinner",
  });

  // ── Single-result image hydration ──
  // Routes imageUrl updates into result.mealData (not result.options) so the
  // single-option fallback path gets the same shimmer + fade-in treatment.
  const setSingleMeal = useCallback(
    (updater: React.SetStateAction<any[]>) => {
      setResult((prev: any) => {
        if (!prev?.mealData) return prev;
        const prevArr: any[] = [prev.mealData];
        const newArr =
          typeof updater === "function" ? updater(prevArr) : updater;
        return { ...prev, mealData: newArr[0] ?? prev.mealData };
      });
    },
    []
  );
  const { loadingImages: singleImageLoading, hydrateImages: hydrateSingleImage } =
    useMealImages(setSingleMeal, { mealType: "dinner" });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const speechRef = useRef<any>(null);

  const reset = useCallback(() => {
    setPhase("capture");
    setMode("upload");
    setCapturedBase64(null);
    setCapturedText("");
    setTextInput("");
    setVoiceTranscript("");
    setIsListening(false);
    setServings(2);
    setHealthMode("balanced");
    setProteinPriority("standard");
    setPrepStyle("any");
    setCuisineOverrideEnabled(false);
    setCuisineOverrideValue("");
    setResult(null);
    setSelectedOptionIndex(0);
    setErrorMsg("");
    setIsSaving(false);
    setSavedIndices([]);
    if (speechRef.current) {
      try {
        speechRef.current.stop();
      } catch {}
      speechRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onOpenChange(false);
  }, [reset, onOpenChange]);

  const switchMode = useCallback((m: InputMode) => {
    setMode(m);
    setCapturedBase64(null);
    setCapturedText("");
    setTextInput("");
    setVoiceTranscript("");
    setIsListening(false);
    if (speechRef.current) {
      try {
        speechRef.current.stop();
      } catch {}
      speechRef.current = null;
    }
  }, []);

  const submitScan = useCallback(
    async (base64?: string | null, rawText?: string) => {
      setPhase("processing");
      setErrorMsg("");
      try {
        const body: Record<string, any> = {};
        if (base64) body.image = base64;
        if (rawText) body.text = rawText;
        if (profileType === "companion" && profileId) body.companionId = profileId;
        const res = await fetch(apiUrl("/api/biometrics/ingredient-intelligence"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t("inspiration.analysisFailed"));
        onScanResult?.(data.result);
        handleClose();
      } catch (err: any) {
        setErrorMsg(err.message || t("inspiration.analyzeFailedMsg"));
        setPhase("error");
      }
    },
    [profileType, profileId, onScanResult, handleClose]
  );

  const advanceToOptions = useCallback(
    (base64?: string, text?: string) => {
      if (base64) setCapturedBase64(base64);
      if (text) setCapturedText(text);
      if (isSmartScan) {
        submitScan(base64, text);
      } else {
        setPhase("options");
      }
    },
    [isSmartScan, submitScan]
  );

  const handleCameraCapture = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const base64 = await resizeImageToBase64(file);
        advanceToOptions(base64);
      } catch {
        setErrorMsg(t("inspiration.imageReadError"));
        setPhase("error");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [advanceToOptions]
  );

  const handleUploadCapture = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const base64 = await resizeImageToBase64(file);
        advanceToOptions(base64);
      } catch {
        setErrorMsg(t("inspiration.imageReadError"));
        setPhase("error");
      } finally {
        if (uploadInputRef.current) uploadInputRef.current.value = "";
      }
    },
    [advanceToOptions]
  );

  const startListening = useCallback(() => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({
        title: t("inspiration.voiceNotSupportedTitle"),
        description: t("inspiration.voiceNotSupportedDesc"),
        variant: "destructive",
      });
      switchMode("text");
      return;
    }

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    speechRef.current = recognition;

    let finalTranscript = "";
    recognition.onresult = (ev: any) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalTranscript += t + " ";
        else interim += t;
      }
      setVoiceTranscript((finalTranscript + interim).trim());
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => {
      setIsListening(false);
      toast({
        title: t("inspiration.micErrorTitle"),
        description: t("inspiration.micErrorDesc"),
        variant: "destructive",
      });
    };

    recognition.start();
    setIsListening(true);
  }, [toast, switchMode]);

  const stopListening = useCallback(() => {
    if (speechRef.current) {
      try {
        speechRef.current.stop();
      } catch {}
      speechRef.current = null;
    }
    setIsListening(false);
  }, []);

  const generate = useCallback(async () => {
    setPhase("processing");
    setErrorMsg("");
    try {
      const body: any = {
        inputType: mode,
        servings,
        healthMode,
        proteinPriority,
        prepStyle,
        ...(cuisineOverrideEnabled && cuisineOverrideValue
          ? { cuisineOverride: cuisineOverrideValue }
          : {}),
      };

      if (mode === "camera" || mode === "upload") {
        body.imageBase64 = capturedBase64;
        body.content = "";
      } else {
        body.content = capturedText;
      }

      const res = await fetch(apiUrl("/api/inspiration/capture"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("inspiration.somethingWrong"));

      // Normalize options to have stable ids before setting state and hydrating
      const normalizedData = Array.isArray(data.options)
        ? { ...data, options: normalizeOptions(data.options) }
        : data.mealData
          ? { ...data, mealData: normalizeSingleMeal(data.mealData) }
          : data;
      setResult(normalizedData);
      setPhase("preview");
      // Lazily fetch images for any options the server returned without one
      if (Array.isArray(normalizedData.options)) {
        hydrateImages(normalizedData.options);
      } else if (normalizedData.mealData && !normalizedData.mealData.imageUrl) {
        hydrateSingleImage([normalizedData.mealData]);
      }
      if (destination === "recipe") {
        // Strip base64 imageUrls before persisting — they're ephemeral and often blow past
        // the 5 MB localStorage limit when S3/GCS is unavailable (3 × ~750 KB images).
        // Real https:// URLs are kept; the card just won't show an image on restore when
        // the server fell back to base64-ephemeral mode.
        const stripBase64 = (meal: any) => {
          if (!meal) return meal;
          const url = meal.imageUrl ?? "";
          return url.startsWith("data:") ? { ...meal, imageUrl: null } : meal;
        };
        const persistable = {
          ...normalizedData,
          mealData: stripBase64(normalizedData.mealData),
          options: Array.isArray(normalizedData.options) ? normalizedData.options.map(stripBase64) : normalizedData.options,
        };
        try { localStorage.setItem("mpm.recipe.lastScan", JSON.stringify(persistable)); } catch {}
      }
    } catch (err: any) {
      setErrorMsg(err.message || t("inspiration.createFailedMsg"));
      setPhase("error");
    }
  }, [
    mode,
    capturedBase64,
    capturedText,
    servings,
    healthMode,
    proteinPriority,
    prepStyle,
    cuisineOverrideEnabled,
    cuisineOverrideValue,
    hydrateImages,
    hydrateSingleImage,
    destination,
  ]);

  const handleSave = useCallback(async () => {
    const mealToSave = result?.options?.[selectedOptionIndex] ?? result?.mealData;
    if (!mealToSave) return;
    setIsSaving(true);
    try {
      const res = await fetch(apiUrl("/api/inspiration/save"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ mealData: mealToSave }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("inspiration.saveFailedError"));
      // Mark this option as saved — stays on the 3-card view so the user can save others too
      setSavedIndices(prev => Array.from(new Set([...prev, selectedOptionIndex])));
      toast({
        title: t("inspiration.savedTitle"),
        description: t("inspiration.savedDesc"),
      });
    } catch (err: any) {
      toast({
        title: t("inspiration.saveFailedTitle"),
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [result, selectedOptionIndex, toast]);

  // Regenerate 3 new options locked to the same captured input (same dish, new variations)
  const handleTryMore = useCallback(async () => {
    // Keep the existing cards visible — only replace them once new ones arrive.
    setIsRegenerating(true);
    setTryMoreConstraintMsg(null);
    try {
      // Reconstruct generation context — the local capture state (capturedText /
      // capturedBase64 / mode) is only populated when the user generated in this
      // session.  When cards come from a localStorage restore those fields are at
      // their defaults ("upload", null, "").  Fall back to the extractedDescription
      // that the server embeds in every result so Try 3 More always has content.
      const body = resolveTryMoreRequestBody({
        mode,
        capturedBase64,
        capturedText,
        result,
        servings,
        healthMode,
        proteinPriority,
        prepStyle,
        cuisineOverrideEnabled,
        cuisineOverrideValue,
      });

      // Guard: if there is no image and no usable text description, we cannot
      // send a meaningful request.  Show a clear message so the user knows
      // what to do instead of hitting the server with a blank content field
      // and getting a generic error.
      if (!body) {
        toast({
          title: t("inspiration.tryMoreNoContentTitle", "Re-enter your request"),
          description: t(
            "inspiration.tryMoreNoContentDesc",
            "Re-enter your original request to try again."
          ),
          variant: "destructive",
        });
        setIsRegenerating(false);
        return;
      }

      const res = await fetch(apiUrl("/api/inspiration/capture"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        // Two distinct non-ok outcomes — keep them separate in the UI:
        //
        // constraint_conflict: the system worked correctly and determined no
        //   additional options exist that meet today's nutrition requirements.
        //   Show a calm inline note below the existing cards — no red toast,
        //   no "failed" language, existing cards stay visible and usable.
        //
        // everything else: a real technical failure (network, timeout, server
        //   crash, OpenAI error).  Show a toast so the user knows to retry.
        if (data.reasonCode === "constraint_conflict") {
          setTryMoreConstraintMsg(
            data.error ||
            t("inspiration.noAdditionalOptionsDesc",
              "We created additional versions of this recipe, but none met today's nutrition requirements. Your current options are still available.")
          );
          return;
        }
        throw new Error(data.error || t("inspiration.somethingWrong"));
      }

      // New results are ready — swap them in atomically.
      // Normalize options to stable ids before setting state and hydrating.
      const normalizedData = Array.isArray(data.options)
        ? { ...data, options: normalizeOptions(data.options) }
        : data;
      setResult(normalizedData);
      setSelectedOptionIndex(0);
      setSavedIndices([]);
      // Lazily load images for any options returned without one
      if (Array.isArray(normalizedData.options)) {
        hydrateImages(normalizedData.options);
      }
      if (destination === "recipe") {
        const stripBase64 = (meal: any) => {
          if (!meal) return meal;
          const url = meal.imageUrl ?? "";
          return url.startsWith("data:") ? { ...meal, imageUrl: null } : meal;
        };
        const persistable = {
          ...normalizedData,
          mealData: stripBase64(normalizedData.mealData),
          options: Array.isArray(normalizedData.options) ? normalizedData.options.map(stripBase64) : normalizedData.options,
        };
        try { localStorage.setItem("mpm.recipe.lastScan", JSON.stringify(persistable)); } catch {}
      }
    } catch (err: any) {
      // Real technical failure (network, server crash, OpenAI error).
      // Keep existing cards — only swap when new ones actually arrive.
      toast({
        title: t("inspiration.tryMoreFailedTitle", "We couldn't create new options right now"),
        description: t("inspiration.tryMoreFailedDesc", "Your current recipes haven't been changed. Please try again."),
        variant: "destructive",
      });
    } finally {
      setIsRegenerating(false);
    }
  }, [
    result,
    mode,
    capturedBase64,
    capturedText,
    servings,
    healthMode,
    proteinPriority,
    prepStyle,
    cuisineOverrideEnabled,
    cuisineOverrideValue,
    destination,
    t,
    toast,
    hydrateImages,
  ]);

  // Explicitly clear the saved scan — only the user can do this, never automatic
  const clearScan = useCallback(() => {
    try { localStorage.removeItem("mpm.recipe.lastScan"); } catch {}
    reset();
  }, [reset]);

  // Derive active mealData from selected option (multi-option) or single result (backward compat)
  const options = result?.options as any[] | undefined;
  const mealData = options?.[selectedOptionIndex] ?? result?.mealData;

  const healthModeHint = {
    authentic: t("inspiration.hintAuthentic"),
    balanced: t("inspiration.hintBalanced"),
    healthier: t("inspiration.hintHealthier"),
  };

  return (
    <UniversalDialog
      open={open}
      onOpenChange={handleClose}
      rawLayout
      className="bg-black/95 border-white/10 text-white max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-2xl p-0"
    >
        <div className="bg-gradient-to-br from-black/60 via-orange-950/30 to-black/80 rounded-2xl p-6">

          {/* ── Header ── */}
          <DialogHeader className="mb-5">
            <div className="flex items-center justify-center relative">
              {phase === "options" && (
                <button
                  onClick={() => setPhase("capture")}
                  className="absolute left-0 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all active:scale-95"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              <DialogTitle className="text-xl font-bold text-white">
                {isSmartScan
                  ? (isCompanionScan ? t("inspiration.scanFoodFor", { name: profileName }) : t("inspiration.productScan"))
                  : (phase === "options" ? t("inspiration.customizeMeal") : t("inspiration.recipeMaker"))}
              </DialogTitle>
            </div>
            <p className="text-white/60 text-sm text-center mt-1">
              {isSmartScan
                ? (isCompanionScan ? t("inspiration.analyzeForCompanion", { name: profileName }) : t("inspiration.analyzeBeforeBuy"))
                : (phase === "options"
                  ? t("inspiration.optionsSubtitle")
                  : t("inspiration.captureSubtitle"))}
            </p>
          </DialogHeader>

          {/* ── CAPTURE ── */}
          {(phase === "capture" || phase === "error") && (
            <div className="space-y-5">
              <div className="flex gap-2 justify-center flex-wrap">
                {/* "Choose Photo" pill — overlay input covers the button so the tap lands directly on the input */}
                <div className="relative overflow-hidden rounded-full inline-flex">
                  <PillButton active={mode === "upload"} onClick={() => switchMode("upload")}>
                    <ImagePlus className="h-3 w-3 mr-1" />
                    {t("inspiration.choosePhoto")}
                  </PillButton>
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => { switchMode("upload"); handleUploadCapture(e); }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
                {/* "Camera" pill — same overlay pattern with capture */}
                <div className="relative overflow-hidden rounded-full inline-flex">
                  <PillButton active={mode === "camera"} onClick={() => switchMode("camera")}>
                    <Camera className="h-3 w-3 mr-1" />
                    {t("inspiration.cameraPill")}
                  </PillButton>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => { switchMode("camera"); handleCameraCapture(e); }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
                <PillButton
                  active={mode === "voice"}
                  onClick={() => switchMode("voice")}
                >
                  <Mic className="h-3 w-3 mr-1" />
                  {t("inspiration.speakPill")}
                </PillButton>
                <PillButton
                  active={mode === "text"}
                  onClick={() => switchMode("text")}
                >
                  <PenLine className="h-3 w-3 mr-1" />
                  {t("inspiration.typePill")}
                </PillButton>
              </div>

              {mode === "upload" && (
                <div className="space-y-3">
                  <p className="text-white/60 text-sm text-center">
                    {t("inspiration.uploadHint")}
                  </p>
                  <div className="relative overflow-hidden w-full rounded-xl">
                    <div className="w-full py-5 rounded-xl border-2 border-dashed border-orange-500/40 bg-orange-500/5 flex flex-col items-center gap-2">
                      <ImagePlus className="h-8 w-8 text-orange-400" />
                      <span className="text-sm font-medium text-orange-300">
                        {t("inspiration.chooseFromGallery")}
                      </span>
                      <span className="text-xs text-white/40">
                        {t("inspiration.galleryHint")}
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadCapture}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {mode === "camera" && (
                <div className="space-y-3">
                  <p className="text-white/60 text-sm text-center">
                    {t("inspiration.cameraHint")}
                  </p>
                  <div className="relative overflow-hidden w-full rounded-xl">
                    <div className="w-full py-5 rounded-xl border-2 border-dashed border-orange-500/40 bg-orange-500/5 flex flex-col items-center gap-2">
                      <Camera className="h-8 w-8 text-orange-400" />
                      <span className="text-sm font-medium text-orange-300">
                        {t("inspiration.openCamera")}
                      </span>
                      <span className="text-xs text-white/40">
                        {t("inspiration.cameraSubHint")}
                      </span>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleCameraCapture}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {mode === "voice" && (
                <div className="space-y-3">
                  <p className="text-white/60 text-sm text-center">
                    {t("inspiration.voiceHint")}
                  </p>
                  <div className="flex flex-col items-center gap-3">
                    <button
                      onClick={isListening ? stopListening : startListening}
                      className={`w-20 h-20 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                        isListening
                          ? "bg-red-600 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                          : "bg-orange-600 hover:bg-orange-700 shadow-[0_0_20px_rgba(249,115,22,0.3)]"
                      }`}
                    >
                      {isListening ? (
                        <Square className="h-7 w-7 text-white" />
                      ) : (
                        <Mic className="h-7 w-7 text-white" />
                      )}
                    </button>
                    <p className="text-xs text-white/50">
                      {isListening ? t("inspiration.tapToStop") : t("inspiration.tapToSpeak")}
                    </p>
                  </div>
                  {voiceTranscript && (
                    <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                      <p className="text-sm text-white/80 leading-relaxed">
                        {voiceTranscript}
                      </p>
                    </div>
                  )}
                  {voiceTranscript && (
                    <button
                      onClick={() => {
                        if (isListening) stopListening();
                        advanceToOptions(undefined, voiceTranscript.trim());
                      }}
                      className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold transition-all active:scale-95"
                    >
                      {t("inspiration.nextCustomize")}
                    </button>
                  )}
                </div>
              )}

              {mode === "text" && (
                <div className="space-y-3">
                  <p className="text-white/60 text-sm text-center">
                    {t("inspiration.textHint")}
                  </p>
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder={t("inspiration.textPlaceholder")}
                    rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-orange-500/50 transition-all"
                  />
                  <button
                    onClick={() => {
                      if (!textInput.trim()) return;
                      advanceToOptions(undefined, textInput.trim());
                    }}
                    disabled={!textInput.trim()}
                    className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-all active:scale-95"
                  >
                    {t("inspiration.nextCustomize")}
                  </button>
                </div>
              )}

              {phase === "error" && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 text-center">
                  {errorMsg}
                </div>
              )}
            </div>
          )}

          {/* ── OPTIONS ── */}
          {phase === "options" && (
            <div className="space-y-5">

              {/* Servings */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                  {t("inspiration.servingsHeading")}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {SERVINGS_OPTIONS.map((opt) => (
                    <PillButton
                      key={opt.value}
                      active={servings === opt.value}
                      onClick={() => setServings(opt.value)}
                    >
                      {t(opt.labelKey)}
                    </PillButton>
                  ))}
                </div>
              </div>

              {/* Adaptation style */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                  {t("inspiration.adaptationStyleHeading")}
                </p>
                <div className="flex gap-2 flex-wrap">
                  <PillButton
                    active={healthMode === "authentic"}
                    onClick={() => setHealthMode("authentic")}
                  >
                    {t("inspiration.authentic")}
                  </PillButton>
                  <PillButton
                    active={healthMode === "balanced"}
                    onClick={() => setHealthMode("balanced")}
                  >
                    {t("inspiration.balanced")}
                  </PillButton>
                  <PillButton
                    active={healthMode === "healthier"}
                    onClick={() => setHealthMode("healthier")}
                  >
                    {t("inspiration.healthier")}
                  </PillButton>
                </div>
                <p className="text-xs text-white/35 leading-relaxed">
                  {healthModeHint[healthMode]}
                </p>
              </div>

              {/* Protein level */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                  {t("inspiration.proteinLevelHeading")}
                </p>
                <div className="flex gap-2 flex-wrap">
                  <PillButton
                    active={proteinPriority === "standard"}
                    onClick={() => setProteinPriority("standard")}
                  >
                    {t("inspiration.proteinStandard")}
                  </PillButton>
                  <PillButton
                    active={proteinPriority === "high"}
                    onClick={() => setProteinPriority("high")}
                  >
                    {t("inspiration.proteinHigh")}
                  </PillButton>
                  <PillButton
                    active={proteinPriority === "athlete"}
                    onClick={() => setProteinPriority("athlete")}
                  >
                    {t("inspiration.proteinAthlete")}
                  </PillButton>
                </div>
              </div>

              {/* Prep style */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                  {t("inspiration.prepStyleHeading")}
                </p>
                <div className="flex gap-2 flex-wrap">
                  <PillButton
                    active={prepStyle === "any"}
                    onClick={() => setPrepStyle("any")}
                  >
                    {t("inspiration.prepOriginal")}
                  </PillButton>
                  <PillButton
                    active={prepStyle === "easy"}
                    onClick={() => setPrepStyle("easy")}
                  >
                    {t("inspiration.prepEasy")}
                  </PillButton>
                </div>
              </div>

              {/* Cuisine */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                  {t("inspiration.cuisineStyleHeading")}
                </p>
                <CuisineOverrideControl
                  overrideEnabled={cuisineOverrideEnabled}
                  overrideCuisine={cuisineOverrideValue}
                  onToggle={setCuisineOverrideEnabled}
                  onCuisineChange={setCuisineOverrideValue}
                />
              </div>

              <button
                onClick={generate}
                className="w-full py-3.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-base transition-all active:scale-95"
              >
                {t("inspiration.generateMyVersion")}
              </button>
            </div>
          )}

          {/* ── PROCESSING ── */}
          {phase === "processing" && (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
                <Loader2 className="h-7 w-7 text-orange-400 animate-spin" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-white font-semibold">
                  {isSmartScan ? t("inspiration.analyzingIngredients") : t("inspiration.buildingVersion")}
                </p>
                <p className="text-white/50 text-sm">
                  {isSmartScan
                    ? (isCompanionScan ? t("inspiration.checkingCompanionProfile", { name: profileName }) : t("inspiration.checkingYourProfile"))
                    : t("inspiration.adaptingProfile")}
                </p>
              </div>
            </div>
          )}

          {/* ── PREVIEW ── */}
          {phase === "preview" && (options?.length || result?.mealData) ? (
            options && options.length > 1 ? (
              /* ── 3-OPTION SELECTOR ── */
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <p className="text-green-400 font-semibold text-sm flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    {t("inspiration.versionsReady", { count: options.length })}
                    {savedIndices.length > 0 && (
                      <span className="text-white/40 font-normal">
                        {t("inspiration.savedCount", { count: savedIndices.length })}
                      </span>
                    )}
                  </p>
                  <button
                    onClick={clearScan}
                    title={t("inspiration.deleteScan")}
                    className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all active:scale-95"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-white/40 text-xs -mt-2">
                  {savedIndices.length > 0
                    ? t("inspiration.tapAnotherHint")
                    : t("inspiration.tapSelectHint")}
                </p>

                {/* NDE adapted note */}
                {result?.ndeSummary?.wasAdapted && result.ndeSummary.adaptedNote && (
                  <div className="rounded-xl bg-orange-950/50 border border-orange-600/30 px-3 py-2.5 flex gap-2.5 items-start">
                    <Sparkles className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="text-orange-400 font-semibold tracking-wide uppercase text-[10px]">
                        {t("inspiration.adaptedForStrategy")}
                      </div>
                      <div className="text-white/80 text-xs leading-relaxed">
                        {result.ndeSummary.adaptedNote}
                      </div>
                    </div>
                  </div>
                )}

                {/* Option cards */}
                <div className={`space-y-2 transition-opacity duration-200 ${isRegenerating ? "opacity-40 pointer-events-none" : ""}`}>
                  {options.map((opt: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => setSelectedOptionIndex(i)}
                      className={`w-full text-left rounded-xl border transition-all overflow-hidden ${
                        selectedOptionIndex === i
                          ? "border-orange-500 bg-orange-500/10"
                          : "border-white/10 bg-white/5 hover:bg-white/8 active:bg-white/10"
                      }`}
                    >
                      {/* Image banner — shimmer while loading, fades in when ready */}
                      {(loadingImages[opt.id] || !!opt.imageUrl) && (
                        <div className="h-28 overflow-hidden relative">
                          {/* Shimmer: shown while the image is being fetched */}
                          {loadingImages[opt.id] && !opt.imageUrl && (
                            <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-white/5 via-white/10 to-white/5" />
                          )}
                          {/* Image: fades in once the browser loads the URL */}
                          {opt.imageUrl && (
                            <CardImage
                              src={opt.imageUrl}
                              alt={opt.title || opt.name || ""}
                            />
                          )}
                          {savedIndices.includes(i) && (
                            <div className="absolute top-2 right-2 bg-green-500 rounded-full p-0.5">
                              <CheckCircle className="h-3.5 w-3.5 text-white" />
                            </div>
                          )}
                        </div>
                      )}
                      <div className="p-3 flex items-start gap-2.5">
                        {/* Selection / saved indicator */}
                        <div
                          className={`w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                            savedIndices.includes(i)
                              ? "border-green-500 bg-green-500"
                              : selectedOptionIndex === i
                              ? "border-orange-500 bg-orange-500"
                              : "border-white/30"
                          }`}
                        >
                          {savedIndices.includes(i) ? (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          ) : selectedOptionIndex === i ? (
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          ) : null}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white text-sm leading-tight">
                            {opt.title || opt.name}
                          </p>
                          {opt.description && (
                            <p className="text-white/60 text-xs leading-snug mt-0.5 line-clamp-2">
                              {opt.description}
                            </p>
                          )}
                          {opt.nutrition && (
                            <div className="flex gap-3 mt-2">
                              <span className="text-orange-400 text-xs font-bold">
                                {t("inspiration.calValue", { value: opt.nutrition.calories })}
                              </span>
                              <span className="text-white/50 text-xs">
                                {t("inspiration.proteinValue", { value: opt.nutrition.protein })}
                              </span>
                              <span className="text-white/50 text-xs">
                                {t("inspiration.carbsValue", { value: opt.nutrition.carbs })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Action buttons — always visible; cards stay up until user explicitly clears them */}
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t("inspiration.saving")}
                        </>
                      ) : savedIndices.includes(selectedOptionIndex) ? (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          {t("inspiration.saveAgain")}
                        </>
                      ) : (
                        <>
                          <Heart className="h-4 w-4" />
                          {t("inspiration.saveThisVersion")}
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleTryMore}
                      disabled={isRegenerating}
                      className="px-4 py-2.5 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-white font-semibold text-sm transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isRegenerating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          {t("inspiration.creating3More")}
                        </>
                      ) : (
                        t("inspiration.try3More")
                      )}
                    </button>
                  </div>
                  {/* Constraint note — shown when Try 3 More found no compliant options.
                      Not an error: the system worked correctly and rejected non-compliant
                      variants.  Calm, no red colour, existing cards remain actionable. */}
                  {tryMoreConstraintMsg && (
                    <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 flex gap-2.5 items-start">
                      <span className="text-white/40 shrink-0 mt-0.5 text-base leading-none">ℹ</span>
                      <div className="space-y-0.5">
                        <div className="text-white/70 font-semibold text-xs">
                          {t("inspiration.noAdditionalOptionsTitle", "No additional options fit your plan right now")}
                        </div>
                        <div className="text-white/50 text-xs leading-relaxed">
                          {tryMoreConstraintMsg}
                        </div>
                      </div>
                    </div>
                  )}
                  {savedIndices.length > 0 && (
                    <button
                      onClick={() => { onOpenChange(false); setLocation("/saved-meals"); }}
                      className="w-full py-2 text-center text-xs text-green-400/70 hover:text-green-300 transition-colors"
                    >
                      {t("inspiration.viewSavedMeals")}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* ── SINGLE-OPTION FALLBACK (backward compat / edge case) ── */
              mealData ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 justify-center">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <p className="text-green-400 font-semibold text-sm">
                      {t("inspiration.personalizedReady")}
                    </p>
                  </div>

                  {result?.ndeSummary?.wasAdapted && result.ndeSummary.adaptedNote && (
                    <div className="rounded-xl bg-orange-950/50 border border-orange-600/30 px-3 py-2.5 flex gap-2.5 items-start">
                      <Sparkles className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <div className="text-orange-400 font-semibold tracking-wide uppercase text-[10px]">
                          {t("inspiration.adaptedForStrategy")}
                        </div>
                        <div className="text-white/80 text-xs leading-relaxed">
                          {result.ndeSummary.adaptedNote}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Use whichever loading map has an entry for this meal:
                       - loadingImages   when mealData comes from options[0] (1-item array path)
                       - singleImageLoading when mealData comes from result.mealData (legacy path) */}
                  {(mealData.imageUrl || loadingImages[mealData.id] || singleImageLoading[mealData.id]) && (
                    <div className="rounded-xl overflow-hidden h-44 relative bg-white/5">
                      {/* Shimmer shown while image is loading */}
                      {(loadingImages[mealData.id] || singleImageLoading[mealData.id]) && !mealData.imageUrl && (
                        <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-white/5 via-white/10 to-white/5" />
                      )}
                      {mealData.imageUrl && (
                        <MealImageSlot
                          imageUrl={mealData.imageUrl}
                          mealName={mealData.title || mealData.name || "Recipe Maker"}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  )}

                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                    <h3 className="font-bold text-white text-lg leading-tight">
                      {mealData.title || mealData.name}
                    </h3>
                    {mealData.description && (
                      <p className="text-white/70 text-sm leading-relaxed">
                        {mealData.description}
                      </p>
                    )}
                    {mealData.nutrition && (
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { label: t("inspiration.macroCal"), value: mealData.nutrition.calories },
                          { label: t("inspiration.macroProtein"), value: `${mealData.nutrition.protein}g` },
                          { label: t("inspiration.macroCarbs"), value: `${mealData.nutrition.carbs}g` },
                          { label: t("inspiration.macroFat"), value: `${mealData.nutrition.fat}g` },
                        ].map((m) => (
                          <div
                            key={m.label}
                            className="bg-black/40 rounded-lg p-2 text-center border border-white/5"
                          >
                            <p className="text-orange-400 font-bold text-sm">{m.value}</p>
                            <p className="text-white/50 text-xs">{m.label}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {mealData.protocolTags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {mealData.protocolTags.map((tag: string) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/20 text-orange-300 text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {(mealData.complianceSection?.badges || mealData.medicalBadges)?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {(mealData.complianceSection?.badges || mealData.medicalBadges || []).map((badge: any) => (
                          <span
                            key={badge?.label || badge}
                            className="px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/20 text-green-300 text-xs"
                          >
                            {badge?.label || badge}
                          </span>
                        ))}
                      </div>
                    )}
                    {mealData.alphaGalBadge && (
                      <AlphaGalBadge badge={mealData.alphaGalBadge} />
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                      >
                        {isSaving ? (
                          <><Loader2 className="h-4 w-4 animate-spin" />{t("inspiration.saving")}</>
                        ) : savedIndices.includes(0) ? (
                          <><CheckCircle className="h-4 w-4" />{t("inspiration.savedCheck")}</>
                        ) : (
                          <><Heart className="h-4 w-4" />{t("inspiration.saveToFavorites")}</>
                        )}
                      </button>
                      <button
                        onClick={clearScan}
                        className="px-4 py-2.5 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-white font-semibold text-sm transition-all active:scale-95"
                      >
                        {t("inspiration.scanAnother")}
                      </button>
                    </div>
                    {savedIndices.includes(0) && (
                      <button
                        onClick={() => { onOpenChange(false); setLocation("/saved-meals"); }}
                        className="w-full py-2 text-center text-xs text-green-400/70 hover:text-green-300 transition-colors"
                      >
                        {t("inspiration.viewInFavorites")}
                      </button>
                    )}
                  </div>
                </div>
              ) : null
            )
          ) : null}

        </div>
    </UniversalDialog>
  );
}
