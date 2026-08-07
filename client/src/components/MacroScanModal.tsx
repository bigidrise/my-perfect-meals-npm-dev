import { useState, useRef, useCallback } from "react";
import { UniversalDialog } from "@/components/ui/universal-modal";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Camera,
  Mic,
  PenLine,
  Loader2,
  ImagePlus,
  Square,
} from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

export interface MacroResult {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  description?: string;
}

interface MacroScanModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (result: MacroResult) => void;
}

type InputMode = "upload" | "camera" | "voice" | "text";
type Phase = "capture" | "processing" | "error";

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

export default function MacroScanModal({
  open,
  onOpenChange,
  onSuccess,
}: MacroScanModalProps) {
  const [mode, setMode] = useState<InputMode>("upload");
  const [phase, setPhase] = useState<Phase>("capture");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const handleClose = useCallback(
    (v: boolean) => {
      if (!v) {
        setPhase("capture");
        setErrorMsg(null);
        setTextInput("");
        setIsRecording(false);
        recognitionRef.current?.stop();
      }
      onOpenChange(v);
    },
    [onOpenChange]
  );

  const runAnalysis = useCallback(
    async (payload: { image?: string; text?: string }) => {
      setPhase("processing");
      setErrorMsg(null);
      try {
        const res = await fetch(apiUrl("/api/biometrics/analyze-photo"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || err.detail || "Analysis failed");
        }
        const result: MacroResult = await res.json();
        onSuccess(result);
        handleClose(false);
      } catch (e: any) {
        setErrorMsg(e.message || "Something went wrong. Please try again.");
        setPhase("error");
      }
    },
    [onSuccess, handleClose]
  );

  const handleImageFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      try {
        const base64 = await resizeImageToBase64(file);
        await runAnalysis({ image: base64 });
      } catch {
        setErrorMsg("Could not read image. Please try again.");
        setPhase("error");
      }
    },
    [runAnalysis]
  );

  const handleTextSubmit = useCallback(async () => {
    const text = textInput.trim();
    if (!text) return;
    await runAnalysis({ text });
  }, [textInput, runAnalysis]);

  const startVoice = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMode("text");
      return;
    }
    const rec = new SpeechRecognition();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onstart = () => setIsRecording(true);
    rec.onresult = (e: any) => {
      const transcript = e.results[0]?.[0]?.transcript ?? "";
      setTextInput(transcript);
      setMode("text");
    };
    rec.onerror = () => {
      setIsRecording(false);
      setMode("text");
    };
    rec.onend = () => setIsRecording(false);
    recognitionRef.current = rec;
    rec.start();
  }, []);

  const stopVoice = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  return (
    <UniversalDialog
      open={open}
      onOpenChange={handleClose}
      rawLayout
      className="bg-black/95 border-white/10 text-white max-w-lg w-full max-h-[90vh] overflow-y-auto rounded-2xl p-0"
    >
      <div className="bg-gradient-to-br from-black/60 via-amber-950/30 to-black/80 rounded-2xl p-6">

        {/* Header */}
        <DialogHeader className="mb-5">
          <div className="flex items-center justify-center">
            <DialogTitle className="text-xl font-bold text-white">MacroScan</DialogTitle>
          </div>
          <p className="text-white/60 text-sm text-center mt-1">
            Scan a nutrition label, food photo, or describe what you ate — we'll estimate the macros.
          </p>
        </DialogHeader>

        {/* Capture phase */}
        {(phase === "capture" || phase === "error") && (
          <div className="space-y-5">

            {/* Mode pills */}
            <div className="flex gap-2 justify-center flex-wrap">
              {/* Choose Photo */}
              <div className="relative overflow-hidden rounded-full inline-flex">
                <PillButton active={mode === "upload"} onClick={() => setMode("upload")}>
                  <ImagePlus className="h-3 w-3 mr-1" />
                  Choose Photo
                </PillButton>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => { setMode("upload"); handleImageFile(e.target.files?.[0]); }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>

              {/* Camera */}
              <div className="relative overflow-hidden rounded-full inline-flex">
                <PillButton active={mode === "camera"} onClick={() => setMode("camera")}>
                  <Camera className="h-3 w-3 mr-1" />
                  Camera
                </PillButton>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => { setMode("camera"); handleImageFile(e.target.files?.[0]); }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>

              {/* Speak */}
              <PillButton
                active={mode === "voice"}
                onClick={() => { setMode("voice"); if (!isRecording) startVoice(); }}
              >
                <Mic className="h-3 w-3 mr-1" />
                Speak
              </PillButton>

              {/* Type */}
              <PillButton active={mode === "text"} onClick={() => setMode("text")}>
                <PenLine className="h-3 w-3 mr-1" />
                Type
              </PillButton>
            </div>

            {/* Choose Photo drop zone */}
            {mode === "upload" && (
              <div className="relative overflow-hidden w-full rounded-xl">
                <div className="w-full py-5 rounded-xl border-2 border-dashed border-amber-500/40 bg-amber-500/5 flex flex-col items-center gap-2">
                  <ImagePlus className="h-8 w-8 text-amber-400" />
                  <span className="text-sm font-medium text-amber-300">Choose from Gallery</span>
                  <span className="text-xs text-white/40">Nutrition labels, food photos, screenshots</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageFile(e.target.files?.[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            )}

            {/* Camera drop zone */}
            {mode === "camera" && (
              <div className="relative overflow-hidden w-full rounded-xl">
                <div className="w-full py-5 rounded-xl border-2 border-dashed border-amber-500/40 bg-amber-500/5 flex flex-col items-center gap-2">
                  <Camera className="h-8 w-8 text-amber-400" />
                  <span className="text-sm font-medium text-amber-300">Open Camera</span>
                  <span className="text-xs text-white/40">Point at a nutrition label or food</span>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handleImageFile(e.target.files?.[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
            )}

            {/* Voice mode */}
            {mode === "voice" && (
              <div className="space-y-3">
                <p className="text-white/60 text-sm text-center">
                  Describe what you ate out loud and we'll estimate the macros.
                </p>
                <div className="flex flex-col items-center gap-3">
                  {isRecording ? (
                    <>
                      <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-400/60 flex items-center justify-center animate-pulse">
                        <Mic className="h-7 w-7 text-red-400" />
                      </div>
                      <p className="text-red-300 text-sm font-medium">Listening…</p>
                      <PillButton onClick={stopVoice}>
                        <Square className="h-3 w-3 mr-1" /> Stop
                      </PillButton>
                    </>
                  ) : (
                    <PillButton onClick={startVoice}>
                      <Mic className="h-3 w-3 mr-1" /> Start Recording
                    </PillButton>
                  )}
                </div>
                {textInput && (
                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-white/70 text-sm italic">"{textInput}"</p>
                    <button
                      onClick={handleTextSubmit}
                      className="mt-2 w-full py-2 rounded-lg bg-amber-500/20 border border-amber-400/30 text-amber-300 text-sm font-medium hover:bg-amber-500/30 transition-colors"
                    >
                      Analyze This →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Text mode */}
            {mode === "text" && (
              <div className="space-y-3">
                <p className="text-white/60 text-sm text-center">
                  Describe the food or meal and we'll estimate the macros.
                </p>
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="e.g. Grilled chicken breast 6oz, brown rice 1 cup, steamed broccoli…"
                  rows={4}
                  className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 resize-none focus:outline-none focus:border-amber-400/50"
                />
                <button
                  onClick={handleTextSubmit}
                  disabled={!textInput.trim()}
                  className="w-full py-3 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-300 text-sm font-semibold hover:bg-amber-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Analyze →
                </button>
              </div>
            )}

            {/* Error */}
            {phase === "error" && errorMsg && (
              <div className="bg-red-900/30 border border-red-500/30 rounded-xl p-3">
                <p className="text-red-300 text-sm">{errorMsg}</p>
              </div>
            )}
          </div>
        )}

        {/* Processing phase */}
        {phase === "processing" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-10 w-10 text-amber-400 animate-spin" />
            <p className="text-white/70 text-sm font-medium">Analyzing macros…</p>
            <p className="text-white/40 text-xs text-center">
              Reading the nutrition info and calculating calories, protein, carbs, and fat.
            </p>
          </div>
        )}
      </div>
    </UniversalDialog>
  );
}
