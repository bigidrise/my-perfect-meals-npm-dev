import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Droplets, TrendingDown, Target, TrendingUp, AlertTriangle, Activity } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import { ttsService } from "@/lib/tts";
import { GLUCOSE_GUARD_EXPLANATION_SCRIPT } from "@/components/copilot/scripts/glucoseGuardScripts";

interface GlucoseGuardExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GLUCOSE_LEVELS = [
  {
    icon: AlertTriangle,
    label: "High",
    range: "> 180 mg/dL",
    color: "text-red-400",
    bgColor: "bg-red-500/20 border-red-500/30",
    iconColor: "text-red-400",
    description: "Very low net carbs. Low-glycemic vegetables only. No refined carbs. Higher protein and fiber to help bring levels down.",
    carbRange: "Under 15g carbs",
  },
  {
    icon: TrendingUp,
    label: "Elevated",
    range: "130–180 mg/dL",
    color: "text-orange-400",
    bgColor: "bg-orange-500/20 border-orange-500/30",
    iconColor: "text-orange-400",
    description: "Lower carb meals with emphasis on protein and fiber-rich foods. Complex carbs only.",
    carbRange: "15–25g carbs",
  },
  {
    icon: Target,
    label: "In Range",
    range: "80–130 mg/dL",
    color: "text-green-400",
    bgColor: "bg-green-500/20 border-green-500/30",
    iconColor: "text-green-400",
    description: "Balanced diabetic-friendly meal. Moderate, quality complex carbohydrates to maintain good control.",
    carbRange: "20–35g carbs",
  },
  {
    icon: TrendingDown,
    label: "Lower-Normal",
    range: "70–80 mg/dL",
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20 border-yellow-500/30",
    iconColor: "text-yellow-400",
    description: "Balanced carbohydrates to keep levels stable. Careful balance of energy sources.",
    carbRange: "25–35g carbs",
  },
  {
    icon: Droplets,
    label: "Low",
    range: "< 70 mg/dL",
    color: "text-amber-400",
    bgColor: "bg-amber-500/20 border-amber-500/30",
    iconColor: "text-amber-400",
    description: "Adequate carbohydrates to help stabilize blood sugar while avoiding rapid spikes. Faster-acting carb sources included.",
    carbRange: "30–45g carbs",
  },
];

function cleanupAudio(audioRef: React.MutableRefObject<HTMLAudioElement | null>) {
  if (audioRef.current) {
    const src = audioRef.current.src;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current.onended = null;
    audioRef.current.onerror = null;
    audioRef.current = null;
    if (src.startsWith("blob:")) {
      URL.revokeObjectURL(src);
    }
  }
}

export function GlucoseGuardExplainerModal({ isOpen, onClose }: GlucoseGuardExplainerModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      ttsService.stop();
      cleanupAudio(audioRef);
    };
  }, []);

  const handleListenToggle = useCallback(async () => {
    if (isPlaying) {
      ttsService.stop();
      cleanupAudio(audioRef);
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);

    try {
      const result = await ttsService.speak(GLUCOSE_GUARD_EXPLANATION_SCRIPT, {
        onStart: () => setIsPlaying(true),
        onEnd: () => setIsPlaying(false),
        onError: () => setIsPlaying(false),
      });

      if (result.audioUrl) {
        const audio = new Audio(result.audioUrl);
        audioRef.current = audio;
        audio.onended = () => {
          setIsPlaying(false);
          cleanupAudio(audioRef);
        };
        audio.onerror = () => {
          setIsPlaying(false);
          cleanupAudio(audioRef);
        };
        await audio.play();
      }
    } catch {
      setIsPlaying(false);
      cleanupAudio(audioRef);
    }
  }, [isPlaying]);

  const handleClose = () => {
    ttsService.stop();
    cleanupAudio(audioRef);
    setIsPlaying(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="GlucoseGuard explanation — how blood sugar controls your meals"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2b2b2b] overflow-y-auto"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="min-h-full flex flex-col">
          <div className="flex justify-end p-4">
            <button
              onClick={handleClose}
              aria-label="Close"
              className="p-2 rounded-full bg-white/10 active:scale-[0.98] transition-transform"
            >
              <X className="h-5 w-5 text-white/70" />
            </button>
          </div>

          <div className="flex-1 max-w-2xl mx-auto px-5 pb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-center mb-8"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-5 bg-orange-500/20 border-orange-500/30 text-orange-300">
                <Activity className="h-4 w-4" />
                <span className="text-sm font-medium">GlucoseGuard™</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                How Your Blood Sugar Controls Your Meals
              </h1>

              <p className="text-white/60 text-base max-w-lg mx-auto">
                Every meal we generate is built around your most recent blood glucose reading. Here's exactly how it works.
              </p>

              <div className="flex flex-col items-center gap-1.5 mt-5">
                <div
                  className="rounded-full overflow-hidden"
                  style={{
                    width: 40,
                    height: 40,
                    backgroundImage: "url(/icons/chef.png?v=2026c)",
                    backgroundSize: "130%",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }}
                />
                <PillButton onClick={handleListenToggle} active={isPlaying}>
                  {isPlaying ? "Stop" : "Listen"}
                </PillButton>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="rounded-xl p-5 bg-white/5 border border-white/10 mb-5"
            >
              <h2 className="text-lg font-semibold text-white mb-2">
                The Core Rule
              </h2>
              <p className="text-white/80 text-sm leading-relaxed">
                Your very next meal is always generated based on your <span className="text-orange-400 font-semibold">most recent blood glucose reading</span>. Not an average. Not a default. Not a guess. Your actual last reading determines what carbohydrates go into your meal, how much, and how fast they act.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl p-5 bg-white/5 border border-white/10 mb-5"
            >
              <h2 className="text-lg font-semibold text-white mb-4">
                What Happens at Each Level
              </h2>
              <div className="space-y-3">
                {GLUCOSE_LEVELS.map((level, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg border p-4 ${level.bgColor}`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-1.5 rounded-lg bg-black/30">
                        <level.icon className={`h-4 w-4 ${level.iconColor}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className={`font-semibold text-sm ${level.color}`}>
                            {level.label}
                          </span>
                          <span className="text-xs text-white/50 font-mono">
                            {level.range}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-white/70 text-xs leading-relaxed mb-1.5">
                      {level.description}
                    </p>
                    <div className="inline-flex items-center px-2 py-0.5 rounded-full bg-black/30 text-xs text-white/60">
                      {level.carbRange}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="rounded-xl p-5 bg-white/5 border border-white/10 mb-5"
            >
              <h2 className="text-lg font-semibold text-white mb-3">
                Why This Matters
              </h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-orange-500/20 text-orange-400 flex-shrink-0 mt-0.5">1</span>
                  <p className="text-white/80 text-sm">The <span className="text-orange-400 font-medium">same meal</span> can be appropriate at 95 mg/dL, inappropriate at 180 mg/dL, and dangerous at 65 mg/dL. That's why every reading matters.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-orange-500/20 text-orange-400 flex-shrink-0 mt-0.5">2</span>
                  <p className="text-white/80 text-sm">If you haven't logged a new reading, we use your <span className="text-orange-400 font-medium">last known value</span> and tell you we're doing so. We never assume.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-orange-500/20 text-orange-400 flex-shrink-0 mt-0.5">3</span>
                  <p className="text-white/80 text-sm"><span className="text-orange-400 font-medium">Log before you eat.</span> That's how you get the most accurate meals from this system. It holds you accountable in a way that actually helps.</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-xl p-4 bg-amber-500/10 border border-amber-500/20 mb-8"
            >
              <p className="text-xs text-amber-400/90 leading-relaxed">
                This is a nutrition tool, not medical advice. We respond to the blood glucose data you provide and generate food suggestions within clinical guardrails. Always follow your healthcare provider's guidance for medication, insulin, and treatment decisions.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <button
                onClick={handleClose}
                className="w-full py-4 text-base font-semibold text-white rounded-xl shadow-lg bg-gradient-to-r from-orange-500 to-orange-600 active:scale-[0.98] transition-transform"
              >
                Got It
              </button>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default GlucoseGuardExplainerModal;
