import { useEffect, useRef, useState } from "react";

// Simple heuristic parser. It finds chunks like "2 eggs", "1 cup rice", "6 oz chicken"
const ITEM_REGEX = /(\d+(?:\.\d+)?)\s*(oz|g|gram|grams|cup|cups|tbsp|tsp|slice|slices|piece|pieces)?\s*([^,]+?)(?=\band\b|,|$)/gi;

export type ParsedItem = { qty: number; unit: string; name: string };

export function parseVoiceToItems(text: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const cleaned = text.replace(/\s+/g, " ").replace(/\./g, ",").toLowerCase();
  let m: RegExpExecArray | null;
  while ((m = ITEM_REGEX.exec(cleaned)) !== null) {
    const qty = parseFloat(m[1]);
    const unit = (m[2] || "").toLowerCase();
    const name = m[3].trim().replace(/^(of\s+)/, "");
    if (!isNaN(qty) && name) items.push({ qty, unit, name });
  }
  // Fallback: if nothing parsed, return the whole sentence as one item (qty=1)
  if (items.length === 0 && cleaned.trim()) items.push({ qty: 1, unit: "", name: cleaned.trim() });
  return items;
}

// Web Speech wrapper (graceful fallback)
function useSpeechRecognition() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recRef = useRef<any>(null);

  useEffect(() => {
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (e: any) => {
      let t = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        t += e.results[i][0].transcript;
      }
      setTranscript(t);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
  }, []);

  const start = () => {
    if (!recRef.current) return;
    setTranscript("");
    setListening(true);
    recRef.current.start();
  };
  const stop = () => {
    if (!recRef.current) return;
    recRef.current.stop();
  };

  return { listening, transcript, start, stop, supported: !!recRef.current };
}

export function VoiceAddModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (items: ParsedItem[]) => void;
}) {
  const { listening, transcript, start, stop, supported } = useSpeechRecognition();
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (!open && listening) stop();
  }, [open]);

  if (!open) return null;

  const text = (transcript || manual).trim();
  const parsed = text ? parseVoiceToItems(text) : [];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-6 w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-lg text-white">Voice Add</div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl">
            ✕
          </button>
        </div>

        {supported ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              {!listening ? (
                <button
                  onClick={start}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                >
                  🎤 Start
                </button>
              ) : (
                <button
                  onClick={stop}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                >
                  ⏹️ Stop
                </button>
              )}
            </div>
            <div className="text-sm text-white/80 bg-white/5 rounded p-3">
              💡 Speak: e.g., "6 oz chicken, 1 cup rice and 1 cup broccoli"
            </div>
          </div>
        ) : (
          <div className="text-sm text-amber-200 bg-amber-900/20 border border-amber-500/20 rounded p-3">
            Speech recognition not supported; paste or type below.
          </div>
        )}

        <textarea
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder="Or type/paste what you ate…"
          rows={3}
          className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white placeholder-white/60"
        />

        {text && (
          <div className="bg-white/5 border border-white/10 rounded p-3">
            <div className="font-medium mb-2 text-white">Parsed items</div>
            <ul className="text-sm space-y-1">
              {parsed.map((p, i) => (
                <li key={i} className="text-white/90">
                  {p.qty} {p.unit} {p.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 bg-white/10 border border-white/20 rounded text-white hover:bg-white/20 transition-colors"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50"
            onClick={() => onConfirm(parsed)}
            disabled={parsed.length === 0}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}