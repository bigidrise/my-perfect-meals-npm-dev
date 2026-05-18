// client/src/components/kitchen/ChefCoPilotWalkthrough.tsx
// 9-step guided walkthrough for chef/partner onboarding on the Signature Kitchen Hub.
// Phase 1 narration: browser SpeechSynthesis. Architecture allows swap to ElevenLabs/OpenAI.
// Dismiss:    localStorage key  mpm.dismiss.chefCoPilotWalkthrough
// Narration:  localStorage key  mpm.copilot.narration.enabled

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChefHat, BookOpen, Wand2, ShieldCheck, Globe, Sparkles,
  TrendingUp, Handshake, ArrowRight, ChevronLeft, ChevronRight,
  X, Volume2, VolumeX, Pause, Play,
} from "lucide-react";

const DISMISS_KEY    = "mpm.dismiss.chefCoPilotWalkthrough";
const NARRATION_KEY  = "mpm.copilot.narration.enabled";

// ── Narration text per step ─────────────────────────────────────────────────
// Deliberately written as spoken sentences, not read-aloud text blocks.
// Pause cues come naturally from punctuation in the TTS engine.
const NARRATION_SCRIPTS = [
  "Welcome to the Kitchen Network. A Signature Kitchen is your permanent branded space inside My Perfect Meals. Your culinary identity — your dishes, your style, your philosophy — lives here, and reaches every user, personalized to their life. Not a recipe page. A living culinary presence.",
  "Your Culinary Library. Your library is your catalog. Real dishes, sauces, techniques, and recipes that define your approach. Every item you add teaches the platform what your kitchen stands for. The richer your library, the more authentically your identity comes through in every meal generated.",
  "Adaptive Culinary Intelligence. My Perfect Meals extends your kitchen's style across thousands of users. When someone generates a dish in your kitchen, they receive a meal that feels like it came from you — adapted to their dietary needs, health goals, and lifestyle. You don't do extra work. The platform does.",
  "Your Brand, Protected. Every meal generated in your kitchen still honors the user's health protocols — allergies, medical conditions, dietary restrictions, clinical guidelines. Your style shapes the flavor, the technique, the voice. The platform handles the wellness layer. Your brand is never compromised.",
  "The Kitchen Directory. Users discover your kitchen through the platform's Kitchen Network — browsing by cuisine, flavor profile, and culinary identity. Once they find you, they explore your full library, read your philosophy, and choose to cook in your style. Discovery is built in.",
  "Create With Chef. Users generate personalized recipes directly in your kitchen's style. They describe what they want, and the platform builds it in a way that honors your culinary identity — your flavors, your techniques, your voice. They receive something that feels genuinely curated by you.",
  "Your Identity Scales. Your culinary identity reaches users at a scale that's impossible through content alone. Every dish generated, every recipe created, every meal personalized — your kitchen's fingerprint is embedded in the outcome. Your style grows with the platform, not despite it.",
  "The Partnership Model. Signature Kitchen partners contribute their identity, their library, and their brand. We handle the platform, the technology, the user experience, and the wellness intelligence layer. Onboarding takes days, not months — we work from what you already have.",
  "Open Your Kitchen. Three ways to begin: apply directly, book a discovery call, or reach our partnerships team. We're building a network of the most forward-thinking culinary voices in the world. If that's you — let's talk.",
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
    icon: ChefHat,
    eyebrow: "01 of 09",
    title: "What Is a Signature Kitchen?",
    body: "A Signature Kitchen is your permanent branded space inside My Perfect Meals. Your culinary identity — your dishes, your style, your philosophy — lives here and reaches every user, personalized to their life. Not a recipe page. A living culinary presence.",
    accentClass: "text-orange-400",
  },
  {
    icon: BookOpen,
    eyebrow: "02 of 09",
    title: "Your Culinary Library",
    body: "Your library is your catalog — real dishes, sauces, techniques, and recipes that define your approach. Every item you add teaches the platform what your kitchen stands for. The richer your library, the more authentically your identity comes through in every meal generated.",
    accentClass: "text-orange-400",
  },
  {
    icon: Wand2,
    eyebrow: "03 of 09",
    title: "Adaptive Culinary Intelligence",
    body: "My Perfect Meals extends your kitchen's style across thousands of users. When someone generates a dish in your kitchen, they receive a meal that feels like it came from you — adapted to their dietary needs, health goals, and lifestyle. You don't do extra work. The platform does.",
    accentClass: "text-orange-300",
  },
  {
    icon: ShieldCheck,
    eyebrow: "04 of 09",
    title: "Your Brand, Protected",
    body: "Every meal generated in your kitchen still honors the user's health protocols — allergies, medical conditions, dietary restrictions, clinical guidelines. Your style shapes the flavor, the technique, the voice. The platform handles the wellness layer. Your brand is never compromised.",
    accentClass: "text-emerald-400",
  },
  {
    icon: Globe,
    eyebrow: "05 of 09",
    title: "The Kitchen Directory",
    body: "Users discover your kitchen through the platform's Kitchen Network — browsing by cuisine, flavor profile, and culinary identity. Once they find you, they explore your full library, read your philosophy, and choose to cook in your style. Discovery is built in.",
    accentClass: "text-orange-400",
  },
  {
    icon: Sparkles,
    eyebrow: "06 of 09",
    title: "Create With Chef",
    body: "Users generate personalized recipes directly in your kitchen's style. They describe what they want, and the platform builds it in a way that honors your culinary identity — your flavors, your techniques, your voice. They receive something that feels genuinely curated by you.",
    accentClass: "text-orange-300",
  },
  {
    icon: TrendingUp,
    eyebrow: "07 of 09",
    title: "Your Identity Scales",
    body: "Your culinary identity reaches users at a scale that's impossible through content alone. Every dish generated, every recipe created, every meal personalized — your kitchen's fingerprint is embedded in the outcome. Your style grows with the platform, not despite it.",
    accentClass: "text-orange-400",
  },
  {
    icon: Handshake,
    eyebrow: "08 of 09",
    title: "The Partnership Model",
    body: "Signature Kitchen partners contribute their identity, their library, and their brand. We handle the platform, the technology, the user experience, and the wellness intelligence layer. Onboarding takes days, not months — we work from what you already have.",
    accentClass: "text-orange-300",
  },
  {
    icon: ArrowRight,
    eyebrow: "09 of 09",
    title: "Open Your Kitchen",
    body: "Three ways to begin: apply directly, book a discovery call, or reach our partnerships team. We're building a network of the most forward-thinking culinary voices in the world. If that's you — let's talk.",
    accentClass: "text-orange-400",
    isCTA: true,
  },
];

// ── SpeechSynthesis engine ──────────────────────────────────────────────────
// Isolated here so it can be swapped for ElevenLabs / OpenAI TTS in Phase 2.
// Phase 2 hook: replace `browserSpeak` with an async streaming fetch.

function getPreferredVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = speechSynthesis.getVoices();
  // Ordered by cinematic/premium quality across platforms
  const preferred = ["Samantha", "Karen", "Moira", "Victoria", "Fiona", "Zira", "Microsoft Zira"];
  for (const name of preferred) {
    const v = voices.find(v => v.name.includes(name) && v.lang.startsWith("en"));
    if (v) return v;
  }
  return voices.find(v => v.lang.startsWith("en-")) ?? voices[0] ?? null;
}

type SpeakOptions = { onEnd?: () => void; onStart?: () => void };
function browserSpeak(text: string, opts: SpeakOptions = {}): SpeechSynthesisUtterance | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate  = 0.88;   // slightly slower = cinematic
  u.pitch = 0.97;   // ever-so-slightly deeper
  u.volume = 1.0;
  const voice = getPreferredVoice();
  if (voice) u.voice = voice;
  u.onstart = () => opts.onStart?.();
  u.onend   = () => opts.onEnd?.();
  u.onerror = () => opts.onEnd?.();  // treat error as end so state doesn't get stuck
  speechSynthesis.speak(u);
  return u;
}

// ── Component ───────────────────────────────────────────────────────────────

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
  onBook: () => void;
  onContact: () => void;
};

type NarrationState = "off" | "speaking" | "paused";

export default function ChefCoPilotWalkthrough({ isOpen, onClose, onApply, onBook, onContact }: Props) {
  const [step, setStep] = useState(0);
  const [narrationEnabled, setNarrationEnabled] = useState<boolean>(
    () => localStorage.getItem(NARRATION_KEY) === "true",
  );
  const [narrationState, setNarrationState] = useState<NarrationState>("off");
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const current = STEPS[step];
  const Icon    = current.icon;
  const isFirst = step === 0;
  const isLast  = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  // ── Narration control ──────────────────────────────────────────────────────
  const stopNarration = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      speechSynthesis.cancel();
    }
    setNarrationState("off");
  }, []);

  const speakCurrentStep = useCallback((stepIndex: number) => {
    const text = NARRATION_SCRIPTS[stepIndex];
    setNarrationState("speaking");
    const u = browserSpeak(text, {
      onStart: () => setNarrationState("speaking"),
      onEnd:   () => setNarrationState("off"),
    });
    utteranceRef.current = u;
  }, []);

  // When narration is enabled and step changes, speak the new step
  useEffect(() => {
    if (!isOpen) return;
    if (narrationEnabled) {
      speakCurrentStep(step);
    } else {
      stopNarration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, isOpen]);

  // When narration is toggled on mid-walkthrough, start speaking immediately
  useEffect(() => {
    if (!isOpen) return;
    if (narrationEnabled) {
      speakCurrentStep(step);
    } else {
      stopNarration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrationEnabled]);

  // Stop narration when panel closes
  useEffect(() => {
    if (!isOpen) {
      stopNarration();
    }
  }, [isOpen, stopNarration]);

  // Reset to step 0 each time the sheet opens
  useEffect(() => {
    if (isOpen) setStep(0);
  }, [isOpen]);

  function toggleNarration() {
    const next = !narrationEnabled;
    localStorage.setItem(NARRATION_KEY, String(next));
    setNarrationEnabled(next);
  }

  function handlePause() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      speechSynthesis.pause();
    }
    setNarrationState("paused");
  }

  function handleResume() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      speechSynthesis.resume();
    }
    setNarrationState("speaking");
  }

  function handleReplay() {
    speakCurrentStep(step);
  }

  function handleClose() {
    stopNarration();
    localStorage.setItem(DISMISS_KEY, "true");
    onClose();
  }

  function goToStep(next: number) {
    stopNarration();
    setStep(next);
    // The step useEffect will fire narration if enabled
  }

  // ── Narration button UI ────────────────────────────────────────────────────
  // Three micro-states: off / speaking / paused
  function NarrationControls() {
    if (!narrationEnabled) {
      // Off → single speaker-off icon, tap to enable
      return (
        <button
          type="button"
          onClick={toggleNarration}
          title="Enable narration"
          className="p-1.5 rounded-full transition-transform active:scale-95"
          style={{ backgroundColor: "#ffffff08" }}
        >
          <VolumeX className="h-3.5 w-3.5 text-white/25" />
        </button>
      );
    }

    if (narrationState === "speaking") {
      // Speaking → animated pulse dot + pause button
      return (
        <div className="flex items-center gap-1.5">
          {/* Animated waveform indicator */}
          <div className="flex items-center gap-0.5 h-4">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="w-0.5 rounded-full"
                style={{ backgroundColor: "#ea580c" }}
                animate={{ height: ["4px", "12px", "4px"] }}
                transition={{
                  duration: 0.7,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: "easeInOut",
                }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={handlePause}
            title="Pause narration"
            className="p-1.5 rounded-full transition-transform active:scale-95"
            style={{ backgroundColor: "#ea580c22" }}
          >
            <Pause className="h-3 w-3 text-orange-400" />
          </button>
          <button
            type="button"
            onClick={toggleNarration}
            title="Turn off narration"
            className="p-1.5 rounded-full transition-transform active:scale-95"
            style={{ backgroundColor: "#ffffff08" }}
          >
            <VolumeX className="h-3 w-3 text-white/30" />
          </button>
        </div>
      );
    }

    if (narrationState === "paused") {
      // Paused → resume + mute options
      return (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleResume}
            title="Resume narration"
            className="p-1.5 rounded-full transition-transform active:scale-95"
            style={{ backgroundColor: "#ea580c22" }}
          >
            <Play className="h-3 w-3 text-orange-400" />
          </button>
          <button
            type="button"
            onClick={toggleNarration}
            title="Turn off narration"
            className="p-1.5 rounded-full transition-transform active:scale-95"
            style={{ backgroundColor: "#ffffff08" }}
          >
            <VolumeX className="h-3 w-3 text-white/30" />
          </button>
        </div>
      );
    }

    // Narration enabled but idle (finished or not yet started) → show replay + mute
    return (
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleReplay}
          title="Replay narration"
          className="p-1.5 rounded-full transition-transform active:scale-95"
          style={{ backgroundColor: "#ea580c22" }}
        >
          <Volume2 className="h-3.5 w-3.5 text-orange-400" />
        </button>
        <button
          type="button"
          onClick={toggleNarration}
          title="Turn off narration"
          className="p-1.5 rounded-full transition-transform active:scale-95"
          style={{ backgroundColor: "#ffffff08" }}
        >
          <VolumeX className="h-3 w-3 text-white/30" />
        </button>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Slide-over panel */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
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
              <motion.div
                className="h-full bg-orange-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Header row */}
            <div className="px-6 pt-5 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-orange-500/70">
                  Kitchen CoPilot
                </span>
                {/* Narration label when active */}
                {narrationEnabled && (
                  <span className="text-[9px] font-medium uppercase tracking-widest text-orange-400/50">
                    Narration
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Narration controls */}
                <NarrationControls />

                {/* Close */}
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-1.5 rounded-full bg-white/8 text-white/40 active:scale-95 transition-transform"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22 }}
                className="px-6 pt-2 pb-6 space-y-5"
              >
                {/* Step eyebrow */}
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/25">
                  {current.eyebrow}
                </p>

                {/* Icon + title — subtle orange ring when narrating */}
                <div className="flex items-start gap-4">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-500"
                    style={{
                      background: "linear-gradient(135deg, #ea580c18 0%, #7c2d1210 100%)",
                      border: narrationState === "speaking"
                        ? "1.5px solid #ea580c70"
                        : "1px solid #ea580c30",
                      boxShadow: narrationState === "speaking"
                        ? "0 0 12px #ea580c25"
                        : "none",
                    }}
                  >
                    <Icon className={`h-5 w-5 ${current.accentClass}`} />
                  </div>
                  <h2 className="text-xl font-bold text-white leading-tight pt-1">{current.title}</h2>
                </div>

                {/* Body */}
                <p
                  className="text-sm leading-relaxed transition-colors duration-300"
                  style={{ color: narrationState === "speaking" ? "rgba(255,255,255,0.80)" : "rgba(255,255,255,0.65)" }}
                >
                  {current.body}
                </p>

                {/* CTA step */}
                {current.isCTA && (
                  <div className="space-y-2.5 pt-1">
                    <button
                      type="button"
                      onClick={onApply}
                      className="w-full py-3.5 rounded-xl text-white font-semibold text-sm transition-transform active:scale-[0.98] shadow-lg"
                      style={{ backgroundColor: "#ea580c" }}
                    >
                      Apply for a Signature Kitchen
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={onBook}
                        className="py-3 rounded-xl text-white/85 font-medium text-sm transition-transform active:scale-[0.98]"
                        style={{ backgroundColor: "#ffffff12", border: "1px solid #ffffff18" }}
                      >
                        Book a Demo
                      </button>
                      <button
                        type="button"
                        onClick={onContact}
                        className="py-3 rounded-xl text-white/85 font-medium text-sm transition-transform active:scale-[0.98]"
                        style={{ backgroundColor: "#ffffff12", border: "1px solid #ffffff18" }}
                      >
                        Contact Us
                      </button>
                    </div>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => goToStep(step - 1)}
                    disabled={isFirst}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all active:scale-95 disabled:opacity-20"
                    style={{ backgroundColor: "#ffffff0f", color: "rgba(255,255,255,0.65)" }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </button>

                  {/* Step dots */}
                  <div className="flex gap-1.5">
                    {STEPS.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => goToStep(i)}
                        className="transition-all"
                        style={{
                          width: i === step ? 20 : 6,
                          height: 6,
                          borderRadius: 9999,
                          backgroundColor: i === step ? "#ea580c" : "#ffffff20",
                        }}
                      />
                    ))}
                  </div>

                  {isLast ? (
                    <button
                      type="button"
                      onClick={handleClose}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all active:scale-95"
                      style={{ backgroundColor: "#ea580c22", color: "#ea580c" }}
                    >
                      Done
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => goToStep(step + 1)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all active:scale-95"
                      style={{ backgroundColor: "#ea580c", color: "#fff" }}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Narration footer hint — only shown when narration is off and not yet tried */}
                {!narrationEnabled && (
                  <button
                    type="button"
                    onClick={toggleNarration}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] text-white/30 transition-opacity active:opacity-60"
                    style={{ backgroundColor: "#ffffff05", border: "1px dashed #ffffff10" }}
                  >
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
