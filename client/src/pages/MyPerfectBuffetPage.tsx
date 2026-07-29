/**
 * My Perfect Buffet
 *
 * User describes the foods at a buffet (free-form or by category).
 * AI builds the best plate from those foods, honoring the user's full
 * active nutrition profile (diet, medical protocols, macros).
 *
 * No Google Places. No Restaurant Intelligence Engine. No chain menu data.
 * Source: "buffet" · nutritionStatus: "estimated"
 * Renders exclusively through AwayFromHomeMealCard.
 */

import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, ChefHat, Loader2, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { usePageTitle } from "@/contexts/PageTitleContext";
import AwayFromHomeMealCard from "@/components/away-from-home/AwayFromHomeMealCard";
import type { AwayFromHomeRecommendation } from "@shared/awayFromHome";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";

const BUFFET_CACHE_KEY = "mpm.buffet.cache.v1";

const CATEGORY_LABELS: { key: string; label: string; placeholder: string }[] = [
  { key: "proteins",   label: "Proteins",           placeholder: "grilled chicken, brisket, shrimp..." },
  { key: "vegetables", label: "Vegetables",          placeholder: "green beans, roasted broccoli, salad bar..." },
  { key: "starches",   label: "Starches / Grains",   placeholder: "mashed potatoes, rice, rolls..." },
  { key: "sauces",     label: "Sauces & Condiments", placeholder: "gravy, ranch, butter, salsa..." },
  { key: "desserts",   label: "Desserts",            placeholder: "cake, fruit, cookies..." },
  { key: "beverages",  label: "Beverages",           placeholder: "water, sweet tea, lemonade..." },
];

export default function MyPerfectBuffetPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  usePageTitle("My Perfect Buffet");

  const [foodsDescription, setFoodsDescription] = useState("");
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [showCategories, setShowCategories] = useState(false);

  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recommendation, setRecommendation] = useState<AwayFromHomeRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Restore last recommendation on mount so navigating away and back keeps the result
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BUFFET_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AwayFromHomeRecommendation;
        if (parsed?.meal) setRecommendation(parsed);
      }
    } catch { /* corrupt cache — ignore */ }
  }, []);

  if (!user) return null;

  // ── Voice input ────────────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        try {
          const form = new FormData();
          form.append("audio", blob, "buffet.webm");
          const resp = await fetch("/api/voice/transcribe", { method: "POST", body: form });
          const data = await resp.json();
          if (data.transcript) {
            setFoodsDescription((prev) =>
              prev.trim() ? `${prev.trim()}, ${data.transcript}` : data.transcript
            );
          }
        } catch {
          setError("Could not transcribe voice — please type your foods.");
        }
        setRecording(false);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      setError("Microphone access denied — please type your foods.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    const hasInput =
      foodsDescription.trim() ||
      Object.values(categories).some((v) => v.trim());
    if (!hasInput) {
      setError("Describe what's available at the buffet.");
      return;
    }

    setLoading(true);
    setError(null);
    setRecommendation(null);

    try {
      const body: Record<string, unknown> = { foodsDescription };
      const catPayload: Record<string, string> = {};
      for (const { key } of CATEGORY_LABELS) {
        if (categories[key]?.trim()) catPayload[key] = categories[key].trim();
      }
      if (Object.keys(catPayload).length > 0) body.categories = catPayload;

      const data = await apiRequest("/api/buffet/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }) as { recommendation: AwayFromHomeRecommendation };

      setRecommendation(data.recommendation);
      try { localStorage.setItem(BUFFET_CACHE_KEY, JSON.stringify(data.recommendation)); } catch {}
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setRecommendation(null);
    setError(null);
    setFoodsDescription("");
    setCategories({});
    try { localStorage.removeItem(BUFFET_CACHE_KEY); } catch {}
  }

  return (
    <motion.div
      className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} pb-28`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 ${BC_HEADER}`}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => setLocation("/social-hub")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
          >
            ← Back
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white">My Perfect Buffet</h1>
            <p className="text-xs text-white/60">AI plate-building from what's available</p>
          </div>
          <div className="h-9 w-9 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
            <ChefHat className="h-5 w-5 text-orange-400" />
          </div>
        </div>
      </div>

      <div
        className="px-4 max-w-2xl mx-auto space-y-5"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}
      >
        <AnimatePresence mode="wait">
          {!recommendation ? (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* ── Intro card ─────────────────────────────────────────── */}
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10">
                <p className="text-sm text-white leading-relaxed">
                  Tell me what foods are available and I'll build the best plate for your goals.
                  Speak or type freely — no need to categorize.
                </p>
              </div>

              {/* ── Free-form entry ────────────────────────────────────── */}
              <div className="rounded-2xl bg-black/50 border border-white/10 overflow-hidden">
                <div className="px-4 pt-4 pb-2">
                  <p className="text-xs text-white font-semibold uppercase tracking-wider mb-2">
                    What's at the buffet?
                  </p>
                  <textarea
                    value={foodsDescription}
                    onChange={(e) => setFoodsDescription(e.target.value)}
                    placeholder="They have grilled chicken, brisket, mashed potatoes, mac and cheese, green beans, salad bar, rolls, fruit, and cake..."
                    className="w-full bg-transparent text-sm text-white placeholder-white/40 resize-none outline-none leading-relaxed min-h-[96px]"
                    rows={4}
                  />
                </div>

                {/* Voice button */}
                <div className="px-4 pb-4 flex items-center gap-3">
                  <button
                    onPointerDown={startRecording}
                    onPointerUp={stopRecording}
                    onPointerLeave={stopRecording}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      recording
                        ? "bg-red-600/30 border border-red-500/50 text-red-300 animate-pulse"
                        : "bg-white/10 border border-white/20 text-white"
                    }`}
                  >
                    {recording ? (
                      <><MicOff className="h-3.5 w-3.5" /> Release to transcribe</>
                    ) : (
                      <><Mic className="h-3.5 w-3.5" /> Hold to speak</>
                    )}
                  </button>
                  {foodsDescription && (
                    <button
                      onClick={() => setFoodsDescription("")}
                      className="text-xs text-white/60 active:text-white"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* ── Optional categories ────────────────────────────────── */}
              <button
                onClick={() => setShowCategories((v) => !v)}
                className="flex items-center gap-2 text-xs text-white/80 px-1 font-medium"
              >
                {showCategories ? (
                  <><ChevronUp className="h-3.5 w-3.5" /> Hide categories</>
                ) : (
                  <><ChevronDown className="h-3.5 w-3.5" /> Add by category (optional)</>
                )}
              </button>

              <AnimatePresence>
                {showCategories && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2">
                      {CATEGORY_LABELS.map(({ key, label, placeholder }) => (
                        <div key={key} className="rounded-xl bg-black/40 border border-white/15 px-4 py-3">
                          <p className="text-[11px] text-white font-semibold uppercase tracking-wider mb-1.5">
                            {label}
                          </p>
                          <input
                            type="text"
                            value={categories[key] ?? ""}
                            onChange={(e) =>
                              setCategories((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            placeholder={placeholder}
                            className="w-full bg-transparent text-sm text-white placeholder-white/35 outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Error ─────────────────────────────────────────────── */}
              {error && (
                <p className="text-sm text-red-400 px-1">{error}</p>
              )}

              {/* ── Submit ────────────────────────────────────────────── */}
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Building your plate...</>
                ) : (
                  <><ChefHat className="h-4 w-4" /> Build My Plate</>
                )}
              </button>

              <p className="text-center text-[10px] text-white/50 px-4 leading-relaxed">
                Nutrition values are estimated. Review before logging.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs text-white font-semibold uppercase tracking-wider">Your Plate</p>
                <button
                  onClick={reset}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
                >
                  <RotateCcw className="h-3 w-3" /> New Search
                </button>
              </div>

              <AwayFromHomeMealCard recommendation={recommendation} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
