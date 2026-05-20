import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, MicOff, X, Check, Trash2, Loader2 } from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";

interface ParsedItem {
  name: string;
  quantity: number;
  unit: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (items: ParsedItem[]) => void;
}

export default function VoiceShoppingModal({ open, onClose, onConfirm }: Props) {
  const [phase, setPhase] = useState<"record" | "parsing" | "review">("record");
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [parseError, setParseError] = useState("");
  const [supported, setSupported] = useState(true);

  const recRef = useRef<any>(null);
  const accumulatedRef = useRef("");

  const stopRecognition = useCallback(() => {
    if (recRef.current) {
      try { recRef.current.stop(); } catch {}
      recRef.current = null;
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    if (!open) {
      stopRecognition();
      setPhase("record");
      setLiveTranscript("");
      setFinalTranscript("");
      setParsedItems([]);
      setParseError("");
      accumulatedRef.current = "";
    }
  }, [open, stopRecognition]);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) setSupported(false);
  }, []);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    accumulatedRef.current = finalTranscript;

    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: any) => {
      let interim = "";
      let newFinal = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          newFinal += e.results[i][0].transcript + " ";
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      if (newFinal) {
        accumulatedRef.current = (accumulatedRef.current + newFinal).trim();
        setFinalTranscript(accumulatedRef.current);
      }
      setLiveTranscript(interim);
    };

    rec.onerror = (e: any) => {
      if (e.error !== "no-speech") {
        setIsListening(false);
      }
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recRef.current = rec;
    rec.start();
    setIsListening(true);
    setLiveTranscript("");
  }, [finalTranscript]);

  const handleStop = useCallback(async () => {
    stopRecognition();
    const text = accumulatedRef.current.trim();
    if (!text) return;

    setFinalTranscript(text);
    setPhase("parsing");
    setParseError("");

    try {
      const res = await fetch("/api/shopping-list-v2/parse-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ transcript: text }),
      });
      if (!res.ok) throw new Error("Parse failed");
      const data = await res.json();
      setParsedItems(data.items || []);
      setPhase("review");
    } catch {
      setParseError("Couldn't parse — you can edit the text and try again.");
      setPhase("record");
    }
  }, [stopRecognition]);

  const removeItem = (idx: number) => {
    setParsedItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleConfirm = () => {
    if (parsedItems.length > 0) {
      onConfirm(parsedItems);
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/70 px-0 sm:px-4">
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#0f0f0f] border border-white/15 flex flex-col overflow-hidden"
        style={{
          maxHeight: "calc(85dvh - env(safe-area-inset-bottom))",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <Mic className="h-5 w-5 text-orange-400" />
            <span className="text-white font-semibold text-base">
              {phase === "record" && "Voice Add"}
              {phase === "parsing" && "Understanding…"}
              {phase === "review" && `${parsedItems.length} item${parsedItems.length !== 1 ? "s" : ""} found`}
            </span>
          </div>
          <button
            onClick={() => { stopRecognition(); onClose(); }}
            className="text-white/50 active:text-white p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* RECORD PHASE */}
        {phase === "record" && (
          <div className="px-5 pb-6 space-y-4">
            {!supported ? (
              <p className="text-amber-300 text-sm bg-amber-900/20 border border-amber-500/20 rounded-xl p-3">
                Voice input isn't supported in this browser. Type your items below instead.
              </p>
            ) : (
              <p className="text-white/60 text-sm leading-relaxed">
                {isListening
                  ? "Speak freely — list everything you need. Tap Stop when you're done."
                  : "Tap Start, then say everything you need like you're talking to someone."}
              </p>
            )}

            {parseError && (
              <p className="text-red-400 text-xs bg-red-900/20 border border-red-500/20 rounded-xl p-3">
                {parseError}
              </p>
            )}

            {/* Live transcript display */}
            {(finalTranscript || liveTranscript) && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-3 min-h-[64px]">
                <p className="text-white/90 text-sm leading-relaxed">
                  {finalTranscript}
                  {liveTranscript && (
                    <span className="text-white/40"> {liveTranscript}</span>
                  )}
                </p>
              </div>
            )}

            {/* Mic button */}
            <div className="flex flex-col items-center gap-3 pt-1">
              {isListening ? (
                <>
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
                    <button
                      onClick={handleStop}
                      className="relative h-20 w-20 rounded-full bg-red-600 flex items-center justify-center active:scale-95 transition-transform shadow-lg shadow-red-900/40"
                    >
                      <MicOff className="h-8 w-8 text-white" />
                    </button>
                  </div>
                  <span className="text-red-400 text-xs font-medium tracking-wide animate-pulse">
                    LISTENING — TAP TO STOP
                  </span>
                </>
              ) : (
                <>
                  <button
                    onClick={startListening}
                    disabled={!supported}
                    className="h-20 w-20 rounded-full bg-orange-600 flex items-center justify-center active:scale-95 transition-transform shadow-lg shadow-orange-900/40 disabled:opacity-40"
                  >
                    <Mic className="h-8 w-8 text-white" />
                  </button>
                  <span className="text-white/50 text-xs">
                    {finalTranscript ? "Tap to continue speaking" : "Tap to start"}
                  </span>
                </>
              )}
            </div>

            {/* Manual fallback textarea */}
            <div>
              <p className="text-white/40 text-xs mb-1">Or type your items:</p>
              <textarea
                value={finalTranscript}
                onChange={(e) => {
                  accumulatedRef.current = e.target.value;
                  setFinalTranscript(e.target.value);
                }}
                rows={3}
                placeholder="milk, eggs, Planters peanuts, 2 boxes Kleenex..."
                className="w-full rounded-xl bg-black/40 border border-white/15 text-white text-sm p-3 focus:outline-none focus:ring-1 focus:ring-orange-500/50 placeholder:text-white/30 resize-none"
              />
            </div>

            {finalTranscript && !isListening && (
              <button
                onClick={handleStop}
                className="w-full py-3.5 rounded-2xl bg-orange-600 text-white font-semibold text-sm active:scale-[.98] transition-transform"
              >
                Parse Items with AI
              </button>
            )}
          </div>
        )}

        {/* PARSING PHASE */}
        {phase === "parsing" && (
          <div className="px-5 pb-8 flex flex-col items-center gap-4 pt-2">
            <Loader2 className="h-10 w-10 text-orange-400 animate-spin" />
            <p className="text-white/70 text-sm text-center">
              Figuring out what you said…
            </p>
            <p className="text-white/40 text-xs text-center max-w-xs leading-relaxed">
              "{finalTranscript.slice(0, 120)}{finalTranscript.length > 120 ? "…" : ""}"
            </p>
          </div>
        )}

        {/* REVIEW PHASE */}
        {phase === "review" && (
          <div className="px-5 pb-5 space-y-3">
            <p className="text-white/50 text-xs">
              Review before adding. Tap × to remove any item.
            </p>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {parsedItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-white text-sm font-medium truncate block">
                      {item.name}
                    </span>
                    {(item.quantity > 1 || item.unit) && (
                      <span className="text-white/50 text-xs">
                        {item.quantity}{item.unit ? ` ${item.unit}` : ""}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => removeItem(idx)}
                    className="text-white/30 active:text-red-400 p-1 shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {parsedItems.length === 0 && (
              <p className="text-white/40 text-sm text-center py-3">
                All items removed. Go back to try again.
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => {
                  setPhase("record");
                  setParsedItems([]);
                }}
                className="flex-1 py-3 rounded-2xl bg-white/8 border border-white/15 text-white/70 text-sm font-medium active:scale-[.98] transition-transform"
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={parsedItems.length === 0}
                className="flex-[2] py-3 rounded-2xl bg-orange-600 text-white font-semibold text-sm active:scale-[.98] transition-transform disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <Check className="h-4 w-4" />
                Add {parsedItems.length} Item{parsedItems.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
