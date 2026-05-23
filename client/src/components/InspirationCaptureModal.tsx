import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Camera, Mic, PenLine, Loader2, CheckCircle, Heart, Square } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { MealImageSlot } from "@/components/ui/MealImageSlot";
import { useCopilot } from "@/components/copilot/CopilotContext";
import { shouldAllowAutoOpen } from "@/components/copilot/CopilotRespectGuard";

type InputMode = "camera" | "voice" | "text";
type ModalState = "idle" | "processing" | "done" | "error";

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
          description: "Scan any meal idea — camera, voice, or text — and we'll personalize it for you.",
          spokenText: "Recipe Scan is one of the most powerful tools in the app, and it works in a way that feels almost automatic. Here is the idea: you see food somewhere — on your phone screen, in a cookbook, on a restaurant menu, or even in your imagination — and instead of bookmarking it and forgetting it, you bring it directly into My Perfect Meals and let the system make it yours. You have three ways to do this. Camera opens your device camera, so you can point it at anything — a recipe on a screen, a photo in a magazine, a dish at a table — and the system reads it, interprets it, and rebuilds it for you. Speak lets you describe a meal out loud in plain language, exactly the way you would tell a friend about something you saw. Type lets you paste a description or write out a meal idea in your own words. Once you submit, the system automatically applies your entire nutritional profile — your macro targets, allergies, medical conditions, dietary identity, every protocol from your onboarding — and generates a completely personalized version of that meal. A full meal card is created with ingredients, instructions, estimated macros, a personalized image, and any relevant protocol tags. It is saved immediately to your Favorites under My Inspirations. No extra steps. No questions asked. Just your version, ready to use.",
          autoClose: true,
        });
      }, 300);
    }, 800);
    return () => clearTimeout(timer);
  }, [open, openCopilot, setLastResponse]);

  const [mode, setMode] = useState<InputMode>("camera");
  const [state, setState] = useState<ModalState>("idle");
  const [textInput, setTextInput] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const speechRef = useRef<any>(null);

  const reset = useCallback(() => {
    setState("idle");
    setTextInput("");
    setVoiceTranscript("");
    setIsListening(false);
    setErrorMsg("");
    setResult(null);
    if (speechRef.current) {
      try { speechRef.current.stop(); } catch {}
      speechRef.current = null;
    }
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onOpenChange(false);
  }, [reset, onOpenChange]);

  const switchMode = useCallback((m: InputMode) => {
    setMode(m);
    setTextInput("");
    setVoiceTranscript("");
    setIsListening(false);
    if (speechRef.current) {
      try { speechRef.current.stop(); } catch {}
      speechRef.current = null;
    }
  }, []);

  const submitCapture = useCallback(
    async (inputType: InputMode, content?: string, imageBase64?: string) => {
      setState("processing");
      setErrorMsg("");
      try {
        const res = await fetch(apiUrl("/api/inspiration/capture"), {
          method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify({ inputType, content, imageBase64 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Something went wrong");
        setResult(data);
        setState("done");
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to create your personalized meal.");
        setState("error");
      }
    },
    []
  );

  const handleCameraCapture = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        setState("processing");
        const base64 = await resizeImageToBase64(file);
        await submitCapture("camera", undefined, base64);
      } catch {
        setErrorMsg("Could not read the image. Please try again.");
        setState("error");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [submitCapture]
  );

  const startListening = useCallback(() => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({
        title: "Voice not supported",
        description: "Your browser doesn't support voice input. Try typing instead.",
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
      toast({ title: "Microphone error", description: "Please try again.", variant: "destructive" });
    };

    recognition.start();
    setIsListening(true);
  }, [toast, switchMode]);

  const stopListening = useCallback(() => {
    if (speechRef.current) {
      try { speechRef.current.stop(); } catch {}
      speechRef.current = null;
    }
    setIsListening(false);
  }, []);

  const handleVoiceSubmit = useCallback(() => {
    if (isListening) stopListening();
    if (!voiceTranscript.trim()) {
      toast({ title: "Nothing heard", description: "Tap the mic and describe the meal.", variant: "destructive" });
      return;
    }
    submitCapture("voice", voiceTranscript.trim());
  }, [isListening, voiceTranscript, stopListening, submitCapture, toast]);

  const handleTextSubmit = useCallback(() => {
    if (!textInput.trim()) {
      toast({ title: "Nothing entered", description: "Describe a meal first.", variant: "destructive" });
      return;
    }
    submitCapture("text", textInput.trim());
  }, [textInput, submitCapture, toast]);

  const mealData = result?.mealData;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-black/95 border border-white/10 text-white max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-2xl p-0">
        <div className="bg-gradient-to-br from-black/60 via-orange-950/30 to-black/80 rounded-2xl p-6">
          <DialogHeader className="mb-5">
            <DialogTitle className="text-xl font-bold text-white text-center">
              Recipe Scan
            </DialogTitle>
            <p className="text-white/60 text-sm text-center mt-1">
              Scan any meal idea and we'll personalize it for you.
            </p>
          </DialogHeader>

          {/* ── IDLE / INPUT ── */}
          {(state === "idle" || state === "error") && (
            <div className="space-y-5">
              {/* Mode selector */}
              <div className="flex gap-2 justify-center">
                <PillButton
                  active={mode === "camera"}
                  onClick={() => switchMode("camera")}
                >
                  <Camera className="h-3 w-3 mr-1" />Camera
                </PillButton>
                <PillButton
                  active={mode === "voice"}
                  onClick={() => switchMode("voice")}
                >
                  <Mic className="h-3 w-3 mr-1" />Speak
                </PillButton>
                <PillButton
                  active={mode === "text"}
                  onClick={() => switchMode("text")}
                >
                  <PenLine className="h-3 w-3 mr-1" />Type
                </PillButton>
              </div>

              {/* Camera */}
              {mode === "camera" && (
                <div className="space-y-3">
                  <p className="text-white/60 text-sm text-center">
                    Point your camera at any recipe, menu, screen, or food photo.
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleCameraCapture}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-5 rounded-xl border-2 border-dashed border-orange-500/40 bg-orange-500/5 hover:bg-orange-500/10 hover:border-orange-500/60 transition-all flex flex-col items-center gap-2 active:scale-95"
                  >
                    <Camera className="h-8 w-8 text-orange-400" />
                    <span className="text-sm font-medium text-orange-300">Open Camera</span>
                    <span className="text-xs text-white/40">or tap to upload an image</span>
                  </button>
                </div>
              )}

              {/* Voice */}
              {mode === "voice" && (
                <div className="space-y-3">
                  <p className="text-white/60 text-sm text-center">
                    Describe the meal out loud — ingredients, style, anything you remember.
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
                      <p className="text-sm text-white/80 leading-relaxed">{voiceTranscript}</p>
                    </div>
                  )}
                  {voiceTranscript && (
                    <button
                      onClick={handleVoiceSubmit}
                      className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold transition-all active:scale-95"
                    >
                      Personalize This Meal
                    </button>
                  )}
                </div>
              )}

              {/* Text */}
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
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-orange-500/50 focus:bg-white/8 transition-all"
                  />
                  <button
                    onClick={handleTextSubmit}
                    disabled={!textInput.trim()}
                    className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-all active:scale-95"
                  >
                    Personalize This Meal
                  </button>
                </div>
              )}

              {/* Error */}
              {state === "error" && (
                <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 text-center">
                  {errorMsg}
                </div>
              )}
            </div>
          )}

          {/* ── PROCESSING ── */}
          {state === "processing" && (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
                  <Loader2 className="h-7 w-7 text-orange-400 animate-spin" />
                </div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-white font-semibold">Building your version…</p>
                <p className="text-white/50 text-sm">Adapting to your nutritional profile</p>
              </div>
            </div>
          )}

          {/* ── DONE ── */}
          {state === "done" && mealData && (
            <div className="space-y-4">
              {/* Success header */}
              <div className="flex items-center gap-2 justify-center">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <p className="text-green-400 font-semibold text-sm">Your personalized version is ready.</p>
              </div>

              {/* Meal image */}
              {mealData.imageUrl && (
                <div className="rounded-xl overflow-hidden h-44">
                  <MealImageSlot
                    imageUrl={mealData.imageUrl}
                    alt={mealData.title || mealData.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Meal card */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-white text-lg leading-tight">
                  {mealData.title || mealData.name}
                </h3>
                {mealData.description && (
                  <p className="text-white/70 text-sm leading-relaxed">{mealData.description}</p>
                )}

                {/* Macros */}
                {mealData.nutrition && (
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Cal", value: mealData.nutrition.calories },
                      { label: "Protein", value: `${mealData.nutrition.protein}g` },
                      { label: "Carbs", value: `${mealData.nutrition.carbs}g` },
                      { label: "Fat", value: `${mealData.nutrition.fat}g` },
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

                {/* Protocol tags */}
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

                {/* Saved indicator */}
                <div className="flex items-center gap-1.5 text-xs text-white/40 pt-1">
                  <Heart className="h-3.5 w-3.5 fill-orange-400 text-orange-400" />
                  <span>Saved to Favorites under My Inspirations</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => { handleClose(); setLocation("/saved-meals"); }}
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
      </DialogContent>
    </Dialog>
  );
}
