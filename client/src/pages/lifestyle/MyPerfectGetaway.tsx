import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, MapPin, Send, Plane, Palmtree, Ship, Star, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";
import { PillButton } from "@/components/ui/pill-button";
import { useIsDesktop } from "@/hooks/useIsDesktop";

const QUICK_VENUES = [
  { label: "Disney World", emoji: "🏰" },
  { label: "Disneyland", emoji: "🎡" },
  { label: "Universal Studios", emoji: "🎬" },
  { label: "LAX Airport", emoji: "✈️" },
  { label: "DFW Airport", emoji: "✈️" },
  { label: "Royal Caribbean Cruise", emoji: "🚢" },
  { label: "Six Flags", emoji: "🎢" },
  { label: "A resort", emoji: "🏖️" },
];

interface BestChoice {
  name: string;
  where: string;
  why: string;
}

interface AvoidItem {
  item: string;
  reason: string;
}

interface GetawayResult {
  venue: string;
  venueType: string;
  bestChoices: BestChoice[];
  whyTheyFit: string[];
  avoid: AvoidItem[];
  familyNote?: string[];
  coachNote: string;
}

interface PersistedState {
  result: GetawayResult;
  message: string;
}

function getStorageKey(userId?: number | string) {
  return `mpm.getaway.lastResult.v2${userId ? `.${userId}` : ""}`;
}

export default function MyPerfectGetaway() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isDesktop = useIsDesktop();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GetawayResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // ── Restore persisted result on mount ──────────────────────────────────
  useEffect(() => {
    try {
      const key = getStorageKey(user?.id);
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const saved: PersistedState = JSON.parse(raw);
        if (saved?.result) {
          setResult(saved.result);
          setMessage(saved.message || "");
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [user?.id]);

  useEffect(() => {
    document.title = "My Perfect Getaway | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    if (result && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [result]);

  // ── Core submit — accepts the message string directly ──────────────────
  const submitMessage = useCallback(async (msg: string) => {
    const trimmed = msg.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress(p => {
        if (p >= 85) { clearInterval(progressInterval); return p; }
        return p + Math.random() * 12;
      });
    }, 400);

    try {
      const res = await fetch(apiUrl("/api/getaway/coach"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ userId: user?.id, message: trimmed }),
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong");
      }

      const data: GetawayResult = await res.json();
      setTimeout(() => {
        setResult(data);
        setLoading(false);
        // Persist so navigating away and back restores the result
        try {
          const key = getStorageKey(user?.id);
          sessionStorage.setItem(key, JSON.stringify({ result: data, message: trimmed }));
        } catch {
          // storage full or unavailable — not critical
        }
      }, 300);
    } catch (err: any) {
      clearInterval(progressInterval);
      setLoading(false);
      setError(err.message || "Could not reach the Getaway Coach. Try again.");
    }
  }, [loading, user?.id]);

  // ── Quick venue tap → auto-submit immediately ──────────────────────────
  const handleQuickVenue = (venue: string) => {
    const msg = `I'm at ${venue}. What should I eat?`;
    setMessage(msg);
    submitMessage(msg);
  };

  // ── Manual send button / Enter key ────────────────────────────────────
  const handleSubmit = () => submitMessage(message);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleReset = () => {
    setResult(null);
    setMessage("");
    setError(null);
    setProgress(0);
    try {
      sessionStorage.removeItem(getStorageKey(user?.id));
    } catch {
      // ignore
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-black via-orange-950/40 to-black pb-36"
    >
      {/* Header */}
      {!isDesktop && (
        <div
          className="fixed top-0 left-0 right-0 z-40 bg-black/50 backdrop-blur-lg border-b border-orange-500/20"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 pb-3 pt-2 flex items-center gap-3">
            <button
              onClick={() => setLocation("/lifestyle")}
              className="p-1.5 rounded-lg bg-white/10 text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <Palmtree className="h-5 w-5 text-orange-400" />
              <h1 className="text-base font-bold text-white">My Perfect Getaway</h1>
            </div>
          </div>
        </div>
      )}

      <div
        className="max-w-2xl mx-auto px-4"
        style={{ paddingTop: isDesktop ? "2rem" : "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}
      >
        {isDesktop && (
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setLocation("/lifestyle")}
              className="p-1.5 rounded-lg bg-white/10 text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <Palmtree className="h-5 w-5 text-orange-400" />
            <h1 className="text-xl font-bold text-white">My Perfect Getaway</h1>
          </div>
        )}

        {/* Hero banner */}
        <div className="relative rounded-2xl overflow-hidden mb-6 border border-orange-500/20">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-900/60 via-amber-900/40 to-black" />
          <div className="absolute inset-0 opacity-20">
            <svg viewBox="0 0 400 160" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
              <circle cx="60" cy="80" r="45" fill="rgba(251,146,60,0.3)" />
              <path d="M340 160 Q360 80 380 60 Q370 100 360 160Z" fill="rgba(251,191,36,0.2)" />
              <path d="M300 160 Q330 70 350 50 Q335 90 320 160Z" fill="rgba(251,146,60,0.15)" />
              <path d="M20 160 Q40 90 50 70 Q42 100 35 160Z" fill="rgba(251,191,36,0.15)" />
              <ellipse cx="60" cy="155" rx="30" ry="6" fill="rgba(0,0,0,0.3)" />
              <path d="M350 155 Q370 100 380 85" stroke="rgba(251,146,60,0.4)" strokeWidth="3" fill="none" />
              <path d="M320 155 Q340 95 355 78" stroke="rgba(251,191,36,0.3)" strokeWidth="2.5" fill="none" />
            </svg>
          </div>
          <div className="relative px-5 py-6">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/20 border border-orange-400/30 rounded-full mb-3">
              <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse" />
              <span className="text-orange-200 text-[10px] font-semibold tracking-wide">Coach In Your Pocket™</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-1.5">Your coach travels with you.</h2>
            <p className="text-sm text-white/70 leading-relaxed">
              Disney, airports, cruises, resorts — wherever life takes you,
              get personalized picks based on your goals and health profile.
            </p>
          </div>
        </div>

        {!result && (
          <>
            {/* Input */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-orange-300 mb-2 ml-1">
                WHERE ARE YOU RIGHT NOW?
              </label>
              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={"\"I'm at Disney World. What should I eat?\""}
                  rows={3}
                  className="w-full bg-black/40 border border-orange-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-white/30 resize-none focus:outline-none focus:border-orange-400/60 focus:ring-1 focus:ring-orange-400/30"
                  disabled={loading}
                />
                <button
                  onClick={handleSubmit}
                  disabled={!message.trim() || loading}
                  className="absolute bottom-3 right-3 p-2 rounded-lg bg-orange-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-white/40 mt-1.5 ml-1">
                You can also ask things like "What fits my cardiac plan?" or "What should I avoid?"
              </p>
            </div>

            {/* Quick venue pills — tap to auto-submit */}
            <div className="mb-6">
              <p className="text-xs text-white/50 mb-2 ml-1">QUICK START — TAP TO GO</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_VENUES.map(v => (
                  <button
                    key={v.label}
                    onClick={() => handleQuickVenue(v.label)}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/8 border border-white/15 rounded-full text-xs text-white/80 transition-all active:scale-95 active:bg-orange-600/20 active:border-orange-500/30 active:text-orange-300 disabled:opacity-40"
                  >
                    <span>{v.emoji}</span>
                    <span>{v.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* How it works */}
            <div className="rounded-xl bg-black/30 border border-white/8 p-4">
              <p className="text-xs font-semibold text-white/50 mb-3">HOW IT WORKS</p>
              <div className="space-y-2.5">
                {[
                  { icon: MapPin, text: "Tell the coach where you are — or tap a quick start above" },
                  { icon: Star, text: "Get picks matched to your health profile, goals, and any medical protocols" },
                  { icon: Plane, text: "Works at theme parks, airports, cruises, resorts — anywhere" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-start gap-2.5">
                    <div className="p-1 rounded-lg bg-orange-500/15 flex-shrink-0 mt-0.5">
                      <Icon className="h-3 w-3 text-orange-400" />
                    </div>
                    <p className="text-xs text-white/65 leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Loading */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 rounded-2xl bg-black/40 border border-orange-500/20 p-6 text-center"
            >
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <Palmtree className="h-10 w-10 text-orange-400 animate-pulse" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full animate-bounce" />
                </div>
              </div>
              <p className="text-white font-medium text-sm mb-1">Your Getaway Coach is on it…</p>
              <p className="text-white/50 text-xs mb-4">Checking what's available and what fits your profile</p>
              <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full"
                  animate={{ width: `${Math.min(progress, 100)}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-xl bg-red-900/20 border border-red-500/30 p-4">
            <p className="text-red-300 text-sm">{error}</p>
            <button onClick={handleReset} className="mt-2 text-orange-400 text-xs underline">
              Try again
            </button>
          </div>
        )}

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              ref={resultsRef}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-4"
            >
              {/* Venue badge */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/15 border border-orange-500/30 rounded-full">
                  <MapPin className="h-3 w-3 text-orange-400" />
                  <span className="text-orange-200 text-xs font-semibold">{result.venue}</span>
                </div>
              </div>

              {/* Best Choices */}
              {result.bestChoices?.length > 0 && (
                <div className="rounded-2xl bg-black/40 border border-orange-500/20 overflow-hidden">
                  <div className="px-4 py-3 border-b border-orange-500/15 flex items-center gap-2">
                    <Star className="h-4 w-4 text-orange-400" />
                    <h3 className="text-sm font-bold text-white">Best Choices For You</h3>
                  </div>
                  <div className="divide-y divide-white/8">
                    {result.bestChoices.map((choice, i) => (
                      <div key={i} className="px-4 py-3.5">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-orange-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-white text-[10px] font-bold">{i + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold text-sm leading-tight">{choice.name}</p>
                            {choice.where && (
                              <p className="text-orange-300/80 text-xs mt-0.5 flex items-center gap-1">
                                <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                                {choice.where}
                              </p>
                            )}
                            {choice.why && (
                              <p className="text-white/60 text-xs mt-1 leading-relaxed">{choice.why}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Why These Fit */}
              {result.whyTheyFit?.length > 0 && (
                <div className="rounded-2xl bg-black/30 border border-white/10 px-4 py-4">
                  <h3 className="text-xs font-bold text-white/60 uppercase tracking-wide mb-3">Why These Fit You</h3>
                  <div className="space-y-2">
                    {result.whyTheyFit.map((reason, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <ChevronRight className="h-3.5 w-3.5 text-orange-400 flex-shrink-0 mt-0.5" />
                        <p className="text-white/75 text-xs leading-relaxed">{reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* What to Avoid */}
              {result.avoid?.length > 0 && (
                <div className="rounded-2xl bg-red-950/20 border border-red-500/20 px-4 py-4">
                  <h3 className="text-xs font-bold text-red-300/70 uppercase tracking-wide mb-3">What To Avoid</h3>
                  <div className="space-y-2">
                    {result.avoid.map((item, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-400/60 flex-shrink-0 mt-1.5" />
                        <div>
                          <span className="text-red-300/80 text-xs font-medium">{item.item}</span>
                          {item.reason && (
                            <span className="text-white/40 text-xs"> — {item.reason}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Family Note */}
              {result.familyNote && result.familyNote.length > 0 && (
                <div className="rounded-2xl bg-amber-950/20 border border-amber-500/20 px-4 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg leading-none">👨‍👩‍👧‍👦</span>
                    <h3 className="text-xs font-bold text-amber-300/80 uppercase tracking-wide">Family Note</h3>
                  </div>
                  <div className="space-y-2">
                    {result.familyNote.map((tip, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <ChevronRight className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-white/75 text-xs leading-relaxed">{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Coach Note */}
              {result.coachNote && (
                <div className="rounded-2xl bg-gradient-to-br from-orange-950/40 to-amber-950/20 border border-orange-500/20 px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded-lg bg-orange-500/20 flex-shrink-0">
                      <Ship className="h-4 w-4 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-orange-300 mb-1">Coach Note</p>
                      <p className="text-white/80 text-sm leading-relaxed">{result.coachNote}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Ask about another venue */}
              <div className="pt-2 pb-4 flex flex-col gap-2">
                <button
                  onClick={handleReset}
                  className="w-full py-3 rounded-xl bg-orange-600 text-white text-sm font-semibold active:scale-95 transition-transform"
                >
                  Ask About Another Venue
                </button>
                <button
                  onClick={() => setLocation("/lifestyle")}
                  className="w-full py-2.5 rounded-xl bg-white/8 border border-white/10 text-white/70 text-sm"
                >
                  Back to Lifestyle
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
