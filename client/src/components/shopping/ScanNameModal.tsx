import { useState, useEffect, useRef } from "react";
import { ShoppingBag, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export function ScanNameModal({ open, onConfirm, onCancel }: Props) {
  const [name, setName] = useState("");
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setListening(false);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  function startVoice() {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setListening(true);
    rec.onresult = (e: any) => {
      setName(e.results[0][0].transcript.trim());
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
  }

  function handleConfirm() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scan-name-overlay"
            className="fixed inset-0 bg-black/70 z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
          />
          <motion.div
            key="scan-name-modal"
            className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[61] rounded-2xl bg-gradient-to-b from-gray-900 to-black border border-white/15 p-5 max-w-sm mx-auto shadow-2xl"
            initial={{ opacity: 0, scale: 0.93 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.93 }}
            transition={{ type: "spring", damping: 24, stiffness: 360 }}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-400">
                Add to Shopping List
              </p>
              <button
                onClick={onCancel}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-white/10 text-white/50"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <h3 className="text-white font-bold text-base mb-1">
              What's the product name?
            </h3>
            <p className="text-xs text-white/35 mb-4 leading-relaxed">
              Type or speak the name so you'll recognise it in your list.
            </p>

            <div className="flex items-center gap-2 mb-4">
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirm();
                  if (e.key === "Escape") onCancel();
                }}
                placeholder="e.g. Quaker Oatmeal Squares"
                className="flex-1 bg-white/8 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-orange-500/60 caret-white"
              />
              <button
                onClick={startVoice}
                disabled={listening}
                title="Speak the product name"
                className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${
                  listening
                    ? "bg-orange-500/30 border-orange-400/50 animate-pulse"
                    : "bg-white/8 border-white/15 active:opacity-70"
                }`}
              >
                <span className="text-base leading-none">
                  {listening ? "🎙️" : "🎤"}
                </span>
              </button>
            </div>

            <button
              onClick={handleConfirm}
              disabled={!name.trim()}
              className="w-full flex items-center justify-center gap-2 bg-orange-600 disabled:opacity-40 rounded-xl py-3 text-white font-semibold text-sm mb-2 active:scale-[.98] transition-transform"
            >
              <ShoppingBag className="w-4 h-4" />
              Add to List
            </button>
            <button
              onClick={onCancel}
              className="w-full text-center text-xs text-white/35 py-1 active:opacity-60"
            >
              Cancel
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default ScanNameModal;
