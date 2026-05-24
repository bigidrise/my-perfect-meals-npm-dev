import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
} from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import { CuisineOverrideControl } from "@/components/ui/CuisineOverrideControl";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { MealImageSlot } from "@/components/ui/MealImageSlot";
import { useCopilot } from "@/components/copilot/CopilotContext";
import { shouldAllowAutoOpen } from "@/components/copilot/CopilotRespectGuard";

type InputMode = "camera" | "upload" | "voice" | "text";
type ModalPhase = "capture" | "options" | "processing" | "preview" | "error";

interface InspirationCaptureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

const SERVINGS_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "Just Me" },
  { value: 2, label: "2 People" },
  { value: 3, label: "3 People" },
  { value: 4, label: "Family (4)" },
  { value: 6, label: "Meal Prep (6)" },
];

export default function InspirationCaptureModal({
  open,
  onOpenChange,
}: InspirationCaptureModalProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { open: openCopilot, setLastResponse } = useCopilot();
  const hasTriggeredExplanation = useRef(false);

  useEffect(() => {
    if (!open) {
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
          title: "Recipe Scan",
          description:
            "Scan any meal idea — camera, voice, or text — and we'll personalize it for you.",
          spokenText:
            "Recipe Scan is one of the most powerful tools in the app, and it works in a way that feels almost automatic. Here is the idea: you see food somewhere — on your phone screen, in a cookbook, on a restaurant menu, or even in your imagination — and instead of bookmarking it and forgetting it, you bring it directly into My Perfect Meals and let the system make it yours. You have four ways to do this. Choose Photo is probably how most people will use this feature — you pick a screenshot, a saved photo, or any food image from your camera roll or gallery. That covers TikTok screenshots, Instagram saves, Pinterest boards, Facebook recipes, anything you have already captured on your device. Camera opens your device camera live, so you can point it at a cookbook, a restaurant menu, a food package, or another screen and take the photo right there. Speak lets you describe a meal out loud in plain language, exactly the way you would tell a friend about something you saw. Type lets you paste a description or write out a meal idea in your own words. Once you submit, the system automatically applies your entire nutritional profile — your macro targets, allergies, medical conditions, dietary identity, every protocol from your onboarding — and generates a completely personalized version of that meal.",
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
  const [errorMsg, setErrorMsg] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

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
    setErrorMsg("");
    setIsSaving(false);
    setSavedId(null);
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

  const advanceToOptions = useCallback(
    (base64?: string, text?: string) => {
      if (base64) setCapturedBase64(base64);
      if (text) setCapturedText(text);
      setPhase("options");
    },
    []
  );

  const handleCameraCapture = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const base64 = await resizeImageToBase64(file);
        advanceToOptions(base64);
      } catch {
        setErrorMsg("Could not read the image. Please try again.");
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
        setErrorMsg("Could not read the image. Please try again.");
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
        title: "Voice not supported",
        description:
          "Your browser doesn't support voice input. Try typing instead.",
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
        title: "Microphone error",
        description: "Please try again.",
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
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      setResult(data);
      setPhase("preview");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create your personalized meal.");
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
  ]);

  const handleSave = useCallback(async () => {
    if (!result?.mealData) return;
    setIsSaving(true);
    try {
      const res = await fetch(apiUrl("/api/inspiration/save"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ mealData: result.mealData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSavedId(data.id);
      toast({
        title: "Saved!",
        description: "Added to your My Inspirations in Favorites.",
      });
    } catch (err: any) {
      toast({
        title: "Save failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [result, toast]);

  const mealData = result?.mealData;

  const healthModeHint = {
    authentic:
      "Keep the original flavors and ingredients as close as possible.",
    balanced:
      "Personalize to your profile while preserving the spirit of the dish.",
    healthier:
      "Optimize aggressively for nutrition while keeping the dish recognizable.",
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-black/95 border border-white/10 text-white max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-2xl p-0">
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
                {phase === "options" ? "Customize Your Meal" : "Recipe Scan"}
              </DialogTitle>
            </div>
            <p className="text-white/60 text-sm text-center mt-1">
              {phase === "options"
                ? "Adjust these before we generate your personalized version."
                : "Scan any meal idea and we'll personalize it for you."}
            </p>
          </DialogHeader>

          {/* ── CAPTURE ── */}
          {(phase === "capture" || phase === "error") && (
            <div className="space-y-5">
              <div className="flex gap-2 justify-center flex-wrap">
                <PillButton
                  active={mode === "upload"}
                  onClick={() => switchMode("upload")}
                >
                  <ImagePlus className="h-3 w-3 mr-1" />
                  Choose Photo
                </PillButton>
                <PillButton
                  active={mode === "camera"}
                  onClick={() => switchMode("camera")}
                >
                  <Camera className="h-3 w-3 mr-1" />
                  Camera
                </PillButton>
                <PillButton
                  active={mode === "voice"}
                  onClick={() => switchMode("voice")}
                >
                  <Mic className="h-3 w-3 mr-1" />
                  Speak
                </PillButton>
                <PillButton
                  active={mode === "text"}
                  onClick={() => switchMode("text")}
                >
                  <PenLine className="h-3 w-3 mr-1" />
                  Type
                </PillButton>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleCameraCapture}
              />
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUploadCapture}
              />

              {mode === "upload" && (
                <div className="space-y-3">
                  <p className="text-white/60 text-sm text-center">
                    Pick a screenshot, saved food photo, or image from your
                    camera roll or gallery.
                  </p>
                  <button
                    onClick={() => uploadInputRef.current?.click()}
                    className="w-full py-5 rounded-xl border-2 border-dashed border-orange-500/40 bg-orange-500/5 hover:bg-orange-500/10 hover:border-orange-500/60 transition-all flex flex-col items-center gap-2 active:scale-95"
                  >
                    <ImagePlus className="h-8 w-8 text-orange-400" />
                    <span className="text-sm font-medium text-orange-300">
                      Choose from Gallery
                    </span>
                    <span className="text-xs text-white/40">
                      Screenshots, saved photos, any food image
                    </span>
                  </button>
                </div>
              )}

              {mode === "camera" && (
                <div className="space-y-3">
                  <p className="text-white/60 text-sm text-center">
                    Point your camera at any recipe, menu, screen, or food
                    photo.
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-5 rounded-xl border-2 border-dashed border-orange-500/40 bg-orange-500/5 hover:bg-orange-500/10 hover:border-orange-500/60 transition-all flex flex-col items-center gap-2 active:scale-95"
                  >
                    <Camera className="h-8 w-8 text-orange-400" />
                    <span className="text-sm font-medium text-orange-300">
                      Open Camera
                    </span>
                    <span className="text-xs text-white/40">
                      Take a live photo of any food idea
                    </span>
                  </button>
                </div>
              )}

              {mode === "voice" && (
                <div className="space-y-3">
                  <p className="text-white/60 text-sm text-center">
                    Describe the meal out loud — ingredients, style, anything
                    you remember.
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
                      {isListening ? "Tap to stop" : "Tap to speak"}
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
                      Next — Customize →
                    </button>
                  )}
                </div>
              )}

              {mode === "text" && (
                <div className="space-y-3">
                  <p className="text-white/60 text-sm text-center">
                    Type or paste a meal idea, recipe description, or dish name.
                  </p>
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="e.g. Loaded buffalo chicken bowl with rice, avocado, and ranch…"
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
                    Next — Customize →
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
                  Servings
                </p>
                <div className="flex gap-2 flex-wrap">
                  {SERVINGS_OPTIONS.map((opt) => (
                    <PillButton
                      key={opt.value}
                      active={servings === opt.value}
                      onClick={() => setServings(opt.value)}
                    >
                      {opt.label}
                    </PillButton>
                  ))}
                </div>
              </div>

              {/* Adaptation style */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                  Adaptation Style
                </p>
                <div className="flex gap-2 flex-wrap">
                  <PillButton
                    active={healthMode === "authentic"}
                    onClick={() => setHealthMode("authentic")}
                  >
                    Authentic
                  </PillButton>
                  <PillButton
                    active={healthMode === "balanced"}
                    onClick={() => setHealthMode("balanced")}
                  >
                    Balanced
                  </PillButton>
                  <PillButton
                    active={healthMode === "healthier"}
                    onClick={() => setHealthMode("healthier")}
                  >
                    Healthier
                  </PillButton>
                </div>
                <p className="text-xs text-white/35 leading-relaxed">
                  {healthModeHint[healthMode]}
                </p>
              </div>

              {/* Protein level */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                  Protein Level
                </p>
                <div className="flex gap-2 flex-wrap">
                  <PillButton
                    active={proteinPriority === "standard"}
                    onClick={() => setProteinPriority("standard")}
                  >
                    Standard
                  </PillButton>
                  <PillButton
                    active={proteinPriority === "high"}
                    onClick={() => setProteinPriority("high")}
                  >
                    High Protein
                  </PillButton>
                  <PillButton
                    active={proteinPriority === "athlete"}
                    onClick={() => setProteinPriority("athlete")}
                  >
                    Athlete
                  </PillButton>
                </div>
              </div>

              {/* Prep style */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                  Prep Style
                </p>
                <div className="flex gap-2 flex-wrap">
                  <PillButton
                    active={prepStyle === "any"}
                    onClick={() => setPrepStyle("any")}
                  >
                    Original Prep
                  </PillButton>
                  <PillButton
                    active={prepStyle === "easy"}
                    onClick={() => setPrepStyle("easy")}
                  >
                    Easy Prep
                  </PillButton>
                </div>
              </div>

              {/* Cuisine */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                  Cuisine Style
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
                Generate My Version
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
                  Building your version…
                </p>
                <p className="text-white/50 text-sm">
                  Adapting to your nutritional profile
                </p>
              </div>
            </div>
          )}

          {/* ── PREVIEW ── */}
          {phase === "preview" && mealData && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 justify-center">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <p className="text-green-400 font-semibold text-sm">
                  Your personalized version is ready.
                </p>
              </div>

              {mealData.imageUrl && (
                <div className="rounded-xl overflow-hidden h-44">
                  <MealImageSlot
                    imageUrl={mealData.imageUrl}
                    alt={mealData.title || mealData.name}
                    className="w-full h-full object-cover"
                  />
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
                      { label: "Cal", value: mealData.nutrition.calories },
                      {
                        label: "Protein",
                        value: `${mealData.nutrition.protein}g`,
                      },
                      { label: "Carbs", value: `${mealData.nutrition.carbs}g` },
                      { label: "Fat", value: `${mealData.nutrition.fat}g` },
                    ].map((m) => (
                      <div
                        key={m.label}
                        className="bg-black/40 rounded-lg p-2 text-center border border-white/5"
                      >
                        <p className="text-orange-400 font-bold text-sm">
                          {m.value}
                        </p>
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

                {(mealData.complianceSection?.badges || mealData.medicalBadges)
                  ?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      mealData.complianceSection?.badges ||
                      mealData.medicalBadges ||
                      []
                    ).map((badge: any) => (
                      <span
                        key={badge?.label || badge}
                        className="px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/20 text-green-300 text-xs"
                      >
                        {badge?.label || badge}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {!savedId ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Heart className="h-4 w-4" />
                        Save to My Inspirations
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setResult(null);
                      setPhase("options");
                    }}
                    className="px-4 py-2.5 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-white font-semibold text-sm transition-all active:scale-95"
                  >
                    Regenerate
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-green-400/70 justify-center">
                    <Heart className="h-3.5 w-3.5 fill-green-400 text-green-400" />
                    <span>Saved to My Inspirations</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        handleClose();
                        setLocation("/saved-meals");
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm transition-all active:scale-95"
                    >
                      View in Favorites
                    </button>
                    <button
                      onClick={reset}
                      className="flex-1 py-2.5 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-white font-semibold text-sm transition-all active:scale-95"
                    >
                      Scan Another
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
