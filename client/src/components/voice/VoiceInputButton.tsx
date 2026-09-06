import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VoiceInputButtonProps {
  value: string;
  onChange: (value: string) => void;
  mode?: "append" | "replace";
  separator?: string;
  disabled?: boolean;
  label?: string;
  className?: string;
  maxLength?: number;
}

type VoiceState = "idle" | "recording" | "transcribing" | "error";

export function VoiceInputButton({
  value,
  onChange,
  mode = "append",
  separator = " ",
  disabled = false,
  label = "Use voice input",
  className,
  maxLength,
}: VoiceInputButtonProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const valueRef = useRef(value);
  const stopTimerRef = useRef<number | null>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const cleanUpStream = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
  };

  useEffect(() => () => cleanUpStream(), []);

  const applyTranscript = (transcript: string) => {
    const spoken = transcript.trim();
    if (!spoken) return;
    const existing = valueRef.current.trim();
    const next = mode === "replace" || !existing
      ? spoken
      : `${existing}${separator}${spoken}`;
    onChange(maxLength ? next.slice(0, maxLength) : next);
  };

  const startRecording = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice input is not supported in this browser. You can keep typing.");
      setState("error");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const preferredType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
        .find(type => MediaRecorder.isTypeSupported?.(type));
      const recorder = preferredType
        ? new MediaRecorder(stream, { mimeType: preferredType })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = event => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        cleanUpStream();
        setError("Recording failed. You can retry or keep typing.");
        setState("error");
      };
      recorder.onstop = async () => {
        const mimeType = recorder.mimeType || preferredType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        cleanUpStream();
        if (!blob.size) {
          setError("No speech was recorded. Please try again.");
          setState("error");
          return;
        }
        setState("transcribing");
        try {
          const form = new FormData();
          const extension = mimeType.includes("mp4") ? "mp4" : "webm";
          form.append("audio", blob, `voice-input.${extension}`);
          const response = await fetch("/api/voice/transcribe", {
            method: "POST",
            body: form,
            credentials: "include",
          });
          const data = await response.json();
          if (!response.ok || typeof data.transcript !== "string") {
            throw new Error("Transcription failed");
          }
          applyTranscript(data.transcript);
          setState("idle");
        } catch {
          setError("Could not transcribe that recording. Your typed text was not changed.");
          setState("error");
        }
      };
      recorder.start();
      setState("recording");
      stopTimerRef.current = window.setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 60_000);
    } catch {
      cleanUpStream();
      setError("Microphone access was denied. You can keep typing.");
      setState("error");
    }
  };

  const toggleRecording = () => {
    if (state === "recording") {
      recorderRef.current?.stop();
      return;
    }
    void startRecording();
  };

  const isBusy = state === "transcribing";
  return (
    <div className={cn("inline-flex flex-col items-end gap-1", className)}>
      <button
        type="button"
        onClick={toggleRecording}
        disabled={disabled || isBusy}
        aria-label={state === "recording" ? "Stop voice recording" : label}
        aria-pressed={state === "recording"}
        data-testid="voice-input-button"
        className={cn(
          "inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
          state === "recording"
            ? "border-red-300 bg-red-600 text-white hover:bg-red-500"
            : "border-emerald-400/80 bg-emerald-950/45 text-white hover:border-emerald-300 hover:bg-emerald-900/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
          (disabled || isBusy) && "cursor-not-allowed opacity-60",
        )}
      >
        {state === "recording" ? (
          <><Square className="h-4 w-4 fill-current" /> Stop</>
        ) : state === "transcribing" ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Transcribing</>
        ) : (
          <><Mic className="h-4 w-4" /> Voice Input</>
        )}
      </button>
      {error && (
        <span role="alert" className="max-w-64 text-right text-xs text-red-200">
          {error}
        </span>
      )}
    </div>
  );
}

export default VoiceInputButton;