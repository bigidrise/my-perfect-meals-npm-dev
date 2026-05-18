// client/src/components/kitchen/ChefCoPilotWalkthrough.tsx
// "Inside the Kitchen Network" — 10-step premium chef partnership walkthrough.
// Voice: ElevenLabs via ttsService (same voice as the rest of the app CoPilot).
// Dismiss:    localStorage  mpm.dismiss.chefCoPilotWalkthrough
// Narration:  localStorage  mpm.copilot.narration.enabled

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, BookOpen, Globe, Wand2, Users, ShieldCheck,
  TrendingUp, BarChart2, Award, ArrowRight,
  ChevronLeft, ChevronRight, X, Volume2, VolumeX, Pause, Play,
} from "lucide-react";
import { ttsService } from "@/lib/tts";

const DISMISS_KEY   = "mpm.dismiss.chefCoPilotWalkthrough";
const NARRATION_KEY = "mpm.copilot.narration.enabled";

// ── ElevenLabs narration scripts ────────────────────────────────────────────
// Written as spoken sentences for the CoPilot voice — calm, cinematic, visionary.
// No AI architecture language. No affiliate framing. No prompts or fingerprints.
const NARRATION_SCRIPTS = [
  // 01 — Your Culinary Identity, Scaled
  "Welcome to the Kitchen Network. What you're about to explore is not a feature. It's an infrastructure for your culinary identity. Everything you've built as a chef — your flavor combinations, your techniques, your signature approach — has always lived in your recipes, your videos, your content. My Perfect Meals transforms that identity into something that scales digitally, adapts to every user, and continues generating value long after you create it. This is your culinary presence, amplified.",

  // 02 — Your Content. Your Kitchen.
  "Your content. Your kitchen. Every recipe you've developed, every dish that defines your style, every technique that sets you apart — that becomes the foundation of your Signature Library inside the platform. When users browse your kitchen, they're not seeing a feed. They're exploring a curated catalog of your actual culinary identity. Every item you contribute deepens the platform's understanding of who you are as a chef — and that understanding is what powers every meal generated in your name.",

  // 03 — How Users Discover You
  "Discovery is built in. Users browse the Kitchen Network by cuisine, by flavor profile, by culinary identity. They find your kitchen the same way they'd find a chef they love — by exploring, by browsing, by recommendation. Once they find you, they can explore your full library, read your philosophy, and choose to cook in your style. Your audience grows through the platform's user base — not just through your own channels.",

  // 04 — Create With Chef
  "Create With Chef is where your culinary identity becomes interactive. A user describes what they want — a quick weeknight dinner, something bold and smoky, a high-protein meal — and the platform builds it in your style. Your flavors. Your techniques. Your voice. They receive something that feels genuinely curated by you — because in every meaningful sense, it is. You don't cook more. Your kitchen does.",

  // 05 — Adaptive for Every Life
  "Every meal generated in your kitchen is adapted to the life of the person requesting it. A user managing diabetes receives a version that respects their glucose targets. Someone building muscle gets a higher-protein expression of your dish. A plant-based user gets a version that honors their choices. Your culinary identity shapes the experience. The platform handles the adaptation. Your style reaches people you would never have reached through content alone.",

  // 06 — Your Brand, Always Protected
  "Your brand is never at risk. Every meal generated in your kitchen still honors the user's health protocols — their allergies, their medical conditions, their dietary restrictions, their clinical guidelines. Your name is on every meal. And every meal is safe. The platform's wellness intelligence layer operates beneath your style — invisible to users, but always active. You bring the culinary vision. The platform ensures it's always appropriate.",

  // 07 — The Living Kitchen
  "Your kitchen is not static. It grows with you. Every dish you add deepens the platform's understanding of your culinary identity. Every technique you contribute refines how meals are generated in your style. Your kitchen compounds over time — becoming more expressive, more nuanced, more authentically yours. This is not a content calendar. It's a living culinary ecosystem. Your content doesn't disappear after you post it. It keeps evolving.",

  // 08 — How Kitchens Generate Revenue
  "Signature Kitchens generate recurring subscription revenue through the platform. Users who discover and cook in your kitchen contribute to a growing revenue stream — one that scales with the platform, not your posting schedule. The value of your kitchen grows as your library grows, as your audience expands, as the platform scales. You're not earning per post. You're building a culinary ecosystem that generates value continuously — long after any single piece of content would have faded.",

  // 09 — Curated, Not Open
  "This is a curated network — not an open platform. Every Signature Kitchen partner is reviewed before onboarding begins. We are building a network of the most forward-thinking culinary voices in the world — chefs, coaches, wellness creators, and food professionals whose identity is worth scaling. That curation is what makes the Kitchen Network premium. It's what protects every chef's brand within it. And it's what makes belonging to it meaningful.",

  // 10 — Open Your Kitchen
  "Three ways to begin. Apply directly — submit your chef identity, your brand assets, and your content catalog. Our partnerships team reviews every application. Book a discovery call — talk with us before you commit. We'll walk through how your kitchen would be built and what the partnership looks like. Or reach our partnerships team directly. We're ready when you are.",
];

type Step = {
  icon: React.ElementType;
  eyebrow: string;
  title: string;
  body: string;
  accentClass: string;
  isCTA?: boolean;
};

const STEPS: Step[] = [
  {
    icon: Sparkles,
    eyebrow: "01 of 10",
    title: "Your Culinary Identity, Scaled",
    body: "Everything you've built as a chef — your flavors, your techniques, your signature approach — has always lived in your recipes and your content. My Perfect Meals transforms that identity into something that scales digitally, adapts to every user, and continues generating value long after you create it.",
    accentClass: "text-orange-400",
  },
  {
    icon: BookOpen,
    eyebrow: "02 of 10",
    title: "Your Content. Your Kitchen.",
    body: "Every recipe you've developed, every dish that defines your style, every technique that sets you apart — that becomes the foundation of your Signature Library inside the platform. When users browse your kitchen, they're not seeing a feed. They're exploring a curated catalog of your actual culinary identity.",
    accentClass: "text-orange-400",
  },
  {
    icon: Globe,
    eyebrow: "03 of 10",
    title: "How Users Discover You",
    body: "Users browse the Kitchen Network by cuisine, by flavor profile, by culinary identity. Once they find you, they explore your full library, read your philosophy, and choose to cook in your style. Your audience grows through the platform's user base — not just through your own channels.",
    accentClass: "text-orange-300",
  },
  {
    icon: Wand2,
    eyebrow: "04 of 10",
    title: "Create With Chef",
    body: "A user describes what they want and the platform builds it in your style — your flavors, your techniques, your voice. They receive something that feels genuinely curated by you. Because in every meaningful sense, it is. You don't cook more. Your kitchen does.",
    accentClass: "text-orange-400",
  },
  {
    icon: Users,
    eyebrow: "05 of 10",
    title: "Adaptive for Every Life",
    body: "Every meal generated in your kitchen is adapted to the life of the person requesting it. Your culinary identity shapes the experience. The platform handles the adaptation. Your style reaches people you would never have reached through content alone.",
    accentClass: "text-orange-300",
  },
  {
    icon: ShieldCheck,
    eyebrow: "06 of 10",
    title: "Your Brand, Always Protected",
    body: "Your name is on every meal. And every meal is safe. The platform's wellness layer honors each user's health protocols — allergies, medical conditions, dietary restrictions — beneath your style. Invisible to users, always active. You bring the culinary vision. The platform ensures it's always appropriate.",
    accentClass: "text-emerald-400",
  },
  {
    icon: TrendingUp,
    eyebrow: "07 of 10",
    title: "The Living Kitchen",
    body: "Your kitchen compounds over time. Every dish you add deepens the platform's understanding of your culinary identity. Every technique you contribute refines how meals are generated in your style. This is not a content calendar. It's a living culinary ecosystem. Your content doesn't disappear. It keeps evolving.",
    accentClass: "text-orange-400",
  },
  {
    icon: BarChart2,
    eyebrow: "08 of 10",
    title: "How Kitchens Generate Revenue",
    body: "Signature Kitchens generate recurring subscription revenue through the platform. The value of your kitchen grows as your library grows, as your audience expands, as the platform scales. You're not earning per post. You're building a culinary ecosystem that generates value continuously — long after any single piece of content would have faded.",
    accentClass: "text-orange-300",
  },
  {
    icon: Award,
    eyebrow: "09 of 10",
    title: "Curated, Not Open",
    body: "Every Signature Kitchen partner is reviewed before onboarding begins. We are building a network of the most forward-thinking culinary voices in the world. That curation is what makes the Kitchen Network premium. It's what protects every chef's brand within it. And it's what makes belonging to it meaningful.",
    accentClass: "text-amber-400",
  },
  {
    icon: ArrowRight,
    eyebrow: "10 of 10",
    title: "Open Your Kitchen",
    body: "Three ways to begin: apply directly, book a discovery call, or reach our partnerships team. We review every application personally. We're building this with the right partners — chefs whose culinary identity is worth scaling. If that's you, let's talk.",
    accentClass: "text-orange-400",
    isCTA: true,
  },
];

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
  onBook: () => void;
  onContact: () => void;
};

type NarrationState = "idle" | "loading" | "playing" | "paused";

export default function ChefCoPilotWalkthrough({ isOpen, onClose, onApply, onBook, onContact }: Props) {
  const [step, setStep] = useState(0);
  const [narrationEnabled, setNarrationEnabled] = useState<boolean>(
    () => localStorage.getItem(NARRATION_KEY) !== "false",
  );
  const [narrationState, setNarrationState] = useState<NarrationState>("idle");
  const audioRef           = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef         = useRef<string | null>(null);
  const stepRef            = useRef(step);          // always current step, safe in event handlers
  const narrationEnabledRef = useRef(narrationEnabled);
  const autoAdvanceTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs in sync
  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => { narrationEnabledRef.current = narrationEnabled; }, [narrationEnabled]);

  const current  = STEPS[step];
  const Icon     = current.icon;
  const isFirst  = step === 0;
  const isLast   = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  // ── Auto-advance after narration ends ───────────────────────────────────────
  function scheduleAutoAdvance() {
    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    autoAdvanceTimer.current = setTimeout(() => {
      const currentStep = stepRef.current;
      if (currentStep < STEPS.length - 1 && narrationEnabledRef.current) {
        setStep(currentStep + 1);
      } else {
        setNarrationState("idle");
      }
    }, 800);
  }

  function cancelAutoAdvance() {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
  }

  // ── Audio helpers ───────────────────────────────────────────────────────────
  function stopAudio() {
    cancelAutoAdvance();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = "";
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setNarrationState("idle");
  }

  async function speakStep(stepIndex: number) {
    stopAudio();
    setNarrationState("loading");
    const text = NARRATION_SCRIPTS[stepIndex];
    try {
      const result = await ttsService.speak(text, {
        onStart: () => setNarrationState("playing"),
        onEnd:   () => setNarrationState("idle"),
        onError: () => setNarrationState("idle"),
      });
      if (result.audioUrl) {
        blobUrlRef.current = result.audioUrl;
        if (!audioRef.current) audioRef.current = new Audio();
        const audio = audioRef.current;
        audio.src     = result.audioUrl;
        audio.onplay  = () => setNarrationState("playing");
        audio.onended = () => scheduleAutoAdvance();
        audio.onerror = () => setNarrationState("idle");
        audio.onpause = () => { if (!audio.ended) setNarrationState("paused"); };
        await audio.play();
      } else {
        setNarrationState("idle");
      }
    } catch {
      setNarrationState("idle");
    }
  }

  // ── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    if (narrationEnabled) speakStep(step); else stopAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (narrationEnabled) speakStep(step); else stopAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrationEnabled]);

  useEffect(() => { if (!isOpen) stopAudio(); }, [isOpen]);
  useEffect(() => { if (isOpen) setStep(0); }, [isOpen]);

  // ── Controls ────────────────────────────────────────────────────────────────
  function toggleNarration() {
    const next = !narrationEnabled;
    localStorage.setItem(NARRATION_KEY, String(next));
    setNarrationEnabled(next);
  }
  function pauseAudio()  { audioRef.current?.pause(); setNarrationState("paused"); }
  function resumeAudio() { audioRef.current?.play();  setNarrationState("playing"); }
  function replayAudio() {
    if (audioRef.current?.src) { audioRef.current.currentTime = 0; audioRef.current.play(); setNarrationState("playing"); }
    else speakStep(step);
  }
  function handleClose() { stopAudio(); localStorage.setItem(DISMISS_KEY, "true"); onClose(); }
  function goToStep(n: number) { stopAudio(); setStep(n); }

  // ── Narration controls UI ───────────────────────────────────────────────────
  function NarrationControls() {
    if (!narrationEnabled) {
      return (
        <button type="button" onClick={toggleNarration} title="Enable narration"
          className="p-1.5 rounded-full active:scale-95" style={{ backgroundColor: "#ffffff08" }}>
          <VolumeX className="h-3.5 w-3.5 text-white/25" />
        </button>
      );
    }
    if (narrationState === "loading") {
      return (
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 h-4">
            {[0,1,2].map(i => (
              <motion.div key={i} className="w-0.5 rounded-full" style={{ backgroundColor: "#ea580c60" }}
                animate={{ height: ["3px","10px","3px"] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }} />
            ))}
          </div>
          <button type="button" onClick={toggleNarration} className="p-1.5 rounded-full active:scale-95" style={{ backgroundColor: "#ffffff08" }}>
            <VolumeX className="h-3 w-3 text-white/30" />
          </button>
        </div>
      );
    }
    if (narrationState === "playing") {
      return (
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 h-4">
            {[0,1,2].map(i => (
              <motion.div key={i} className="w-0.5 rounded-full" style={{ backgroundColor: "#ea580c" }}
                animate={{ height: ["4px","12px","4px"] }}
                transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }} />
            ))}
          </div>
          <button type="button" onClick={pauseAudio} title="Pause" className="p-1.5 rounded-full active:scale-95" style={{ backgroundColor: "#ea580c22" }}>
            <Pause className="h-3 w-3 text-orange-400" />
          </button>
          <button type="button" onClick={toggleNarration} title="Turn off" className="p-1.5 rounded-full active:scale-95" style={{ backgroundColor: "#ffffff08" }}>
            <VolumeX className="h-3 w-3 text-white/30" />
          </button>
        </div>
      );
    }
    if (narrationState === "paused") {
      return (
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={resumeAudio} title="Resume" className="p-1.5 rounded-full active:scale-95" style={{ backgroundColor: "#ea580c22" }}>
            <Play className="h-3 w-3 text-orange-400" />
          </button>
          <button type="button" onClick={toggleNarration} title="Turn off" className="p-1.5 rounded-full active:scale-95" style={{ backgroundColor: "#ffffff08" }}>
            <VolumeX className="h-3 w-3 text-white/30" />
          </button>
        </div>
      );
    }
    // idle + enabled
    return (
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={replayAudio} title="Replay" className="p-1.5 rounded-full active:scale-95" style={{ backgroundColor: "#ea580c22" }}>
          <Volume2 className="h-3.5 w-3.5 text-orange-400" />
        </button>
        <button type="button" onClick={toggleNarration} title="Turn off narration" className="p-1.5 rounded-full active:scale-95" style={{ backgroundColor: "#ffffff08" }}>
          <VolumeX className="h-3 w-3 text-white/30" />
        </button>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />

          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden"
            style={{
              background: "linear-gradient(160deg, #0d0500 0%, #1a0800 40%, #0a0300 100%)",
              border: "1px solid #ea580c25",
              boxShadow: "0 -20px 60px #ea580c15, 0 -2px 0 #ea580c30",
              maxHeight: "88vh",
              paddingBottom: "env(safe-area-inset-bottom, 16px)",
            }}
          >
            {/* Progress bar */}
            <div className="h-0.5 w-full bg-white/5">
              <motion.div className="h-full bg-orange-500"
                initial={{ width: 0 }} animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }} />
            </div>

            {/* Header */}
            <div className="px-6 pt-5 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-orange-500/60">
                    Inside the Kitchen Network
                  </p>
                  {narrationEnabled && narrationState !== "idle" && (
                    <p className="text-[8px] uppercase tracking-widest text-orange-400/40 mt-0.5">
                      {narrationState === "loading" ? "Loading audio…" : narrationState === "playing" ? "Narrating" : "Paused"}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <NarrationControls />
                <button type="button" onClick={handleClose}
                  className="p-1.5 rounded-full bg-white/8 text-white/40 active:scale-95 transition-transform">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div key={step}
                initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22 }}
                className="px-6 pt-2 pb-6 space-y-5"
              >
                {/* Eyebrow */}
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/25">
                  {current.eyebrow}
                </p>

                {/* Icon + title */}
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-500"
                    style={{
                      background: "linear-gradient(135deg, #ea580c18 0%, #7c2d1210 100%)",
                      border: narrationState === "playing" ? "1.5px solid #ea580c70" : "1px solid #ea580c30",
                      boxShadow: narrationState === "playing" ? "0 0 14px #ea580c28" : "none",
                    }}>
                    <Icon className={`h-5 w-5 ${current.accentClass}`} />
                  </div>
                  <h2 className="text-xl font-bold text-white leading-tight pt-1">{current.title}</h2>
                </div>

                {/* Body */}
                <p className="text-sm leading-relaxed transition-colors duration-300"
                  style={{ color: narrationState === "playing" ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.65)" }}>
                  {current.body}
                </p>

                {/* Revenue step callout */}
                {step === 7 && (
                  <div className="rounded-xl px-4 py-3 space-y-1"
                    style={{ background: "#ea580c0e", border: "1px solid #ea580c28" }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-orange-400/60">Kitchen Revenue</p>
                    <p className="text-xs text-white/50 leading-relaxed">
                      Recurring subscription attribution · Digital scalability · Audience growth · Content longevity · Ecosystem compounding
                    </p>
                  </div>
                )}

                {/* Curated callout */}
                {step === 8 && (
                  <div className="rounded-xl px-4 py-3"
                    style={{ background: "#f59e0b0d", border: "1px solid #f59e0b25" }}>
                    <p className="text-xs text-amber-300/60 leading-relaxed">
                      Every partner is reviewed personally. Curation is what makes this premium.
                    </p>
                  </div>
                )}

                {/* CTA step */}
                {current.isCTA && (
                  <div className="space-y-2.5 pt-1">
                    <button type="button" onClick={onApply}
                      className="w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-transform active:scale-[0.98] shadow-lg"
                      style={{ backgroundColor: "#ea580c" }}>
                      Apply for a Signature Kitchen
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={onBook}
                        className="py-3 rounded-xl text-white/85 font-medium text-sm transition-transform active:scale-[0.98]"
                        style={{ backgroundColor: "#ffffff12", border: "1px solid #ffffff18" }}>
                        Book a Call
                      </button>
                      <button type="button" onClick={onContact}
                        className="py-3 rounded-xl text-white/85 font-medium text-sm transition-transform active:scale-[0.98]"
                        style={{ backgroundColor: "#ffffff12", border: "1px solid #ffffff18" }}>
                        Contact Us
                      </button>
                    </div>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between pt-1">
                  <button type="button" onClick={() => goToStep(step - 1)} disabled={isFirst}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all active:scale-95 disabled:opacity-20"
                    style={{ backgroundColor: "#ffffff0f", color: "rgba(255,255,255,0.65)" }}>
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </button>

                  <div className="flex gap-1.5">
                    {STEPS.map((_, i) => (
                      <button key={i} type="button" onClick={() => goToStep(i)} className="transition-all"
                        style={{
                          width: i === step ? 20 : 6, height: 6, borderRadius: 9999,
                          backgroundColor: i === step ? "#ea580c" : "#ffffff20",
                        }} />
                    ))}
                  </div>

                  {isLast ? (
                    <button type="button" onClick={handleClose}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all active:scale-95"
                      style={{ backgroundColor: "#ea580c22", color: "#ea580c" }}>
                      Done
                    </button>
                  ) : (
                    <button type="button" onClick={() => goToStep(step + 1)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all active:scale-95"
                      style={{ backgroundColor: "#ea580c", color: "#fff" }}>
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Narration off hint */}
                {!narrationEnabled && (
                  <button type="button" onClick={toggleNarration}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] text-white/30 active:opacity-60"
                    style={{ backgroundColor: "#ffffff05", border: "1px dashed #ffffff10" }}>
                    <Volume2 className="h-3 w-3" />
                    Listen to narration
                  </button>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
