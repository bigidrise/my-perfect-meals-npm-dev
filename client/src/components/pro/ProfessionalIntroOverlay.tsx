import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PillButton } from "@/components/ui/pill-button";
import { ttsService } from "@/lib/tts";
import {
  TRAINER_INTRO_SCRIPT,
  PHYSICIAN_INTRO_SCRIPT,
} from "@/components/copilot/scripts/professionalIntroScripts";
import {
  Target,
  Dumbbell,
  Users,
  Utensils,
  Shield,
  HeartPulse,
  Activity,
  Stethoscope,
  ChevronRight,
  Award,
  X,
} from "lucide-react";

type WorkspaceType = "trainer" | "physician";

interface ProfessionalIntroOverlayProps {
  type: WorkspaceType;
  onEnter: () => void;
}

const STORAGE_KEYS = {
  trainer: "mpm_hide_trainer_studio_intro",
  physician: "mpm_hide_physician_clinic_intro",
};

const CONTENT = {
  trainer: {
    badge: "Professional Workspace",
    badgeColor: "bg-orange-500/20 border-orange-500/30 text-orange-300",
    title: "Welcome to Your Coaching Studio",
    subtitle:
      "This is your professional environment inside My Perfect Meals for personalized nutrition guidance and client meal planning.",
    purpose: {
      title: "What This Workspace Is For",
      items: [
        {
          icon: Target,
          title: "Macro Strategy",
          description:
            "Set precise macro targets tailored to each client's body composition goals.",
        },
        {
          icon: Dumbbell,
          title: "Performance Coaching",
          description:
            "Guide athletes through competition prep, bulking, cutting, and maintenance.",
        },
        {
          icon: Utensils,
          title: "Builder Assignment",
          description:
            "Assign specialized meal builders to unlock pro-level meal planning for clients.",
        },
        {
          icon: Users,
          title: "Client Management",
          description:
            "Track client progress and provide ongoing nutritional guidance.",
        },
      ],
    },
    notFor: [
      "Not a medical record system",
      "Not diagnostic software",
      "Not replacing professional judgment",
    ],
    quickStart: [
      "Invite clients into your studio",
      "Set nutrition targets",
      "Assign a meal builder",
      "Guide, review, and adjust over time",
    ],
    tools: [
      "Macro & calorie targets",
      "Builder assignment",
      "Client activity history",
      "Nutrition adjustment tools",
    ],
    disclaimer: undefined as string | undefined,
    buttonColor:
      "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700",
    buttonShadow: "shadow-orange-500/20",
  },
  physician: {
    badge: "Clinical Workspace",
    badgeColor: "bg-orange-500/20 border-orange-500/30 text-orange-300",
    title: "Welcome to Your Clinical Nutrition Workspace",
    subtitle:
      "This is your professional environment inside My Perfect Meals for medical-grade nutrition oversight and safety-guarded meal planning.",
    purpose: {
      title: "What This Workspace Is For",
      items: [
        {
          icon: Shield,
          title: "Nutrition Oversight",
          description:
            "Review and approve nutrition plans with clinical considerations.",
        },
        {
          icon: HeartPulse,
          title: "Condition-Specific Tools",
          description:
            "Connect with diabetic, cardiac, and renal nutrition hubs.",
        },
        {
          icon: Activity,
          title: "SafetyGuard Configuration",
          description:
            "Set allergen restrictions and dietary guardrails for each patient.",
        },
        {
          icon: Stethoscope,
          title: "Clinical Nutrition Support",
          description:
            "Evidence-based dietary guidance for metabolic conditions.",
        },
      ],
    },
    notFor: [
      "Not an EHR or medical record system",
      "Not diagnostic software",
      "Not replacing clinical judgment",
    ],
    disclaimer:
      "This workspace does not store or manage medical records and is not an EHR.",
    quickStart: [
      "Review patient nutrition context",
      "Select appropriate nutrition hubs",
      "Apply safety guardrails",
      "Monitor nutrition adherence",
    ],
    tools: [
      "Condition-specific nutrition hubs",
      "Guardrails configuration",
      "Clinical nutrition builders",
      "Patient nutrition activity log",
    ],
    buttonColor:
      "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700",
    buttonShadow: "shadow-orange-500/20",
  },
};

export function ProfessionalIntroOverlay({
  type,
  onEnter,
}: ProfessionalIntroOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const content = CONTENT[type];
  const storageKey = STORAGE_KEYS[type];
  const script = type === "trainer" ? TRAINER_INTRO_SCRIPT : PHYSICIAN_INTRO_SCRIPT;

  const handleListenToggle = useCallback(async () => {
    if (isPlaying) {
      ttsService.stop();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);

    try {
      const result = await ttsService.speak(script, {
        onStart: () => setIsPlaying(true),
        onEnd: () => setIsPlaying(false),
        onError: () => setIsPlaying(false),
      });

      if (result.audioUrl) {
        const audio = new Audio(result.audioUrl);
        audioRef.current = audio;
        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(result.audioUrl!);
        };
        audio.onerror = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(result.audioUrl!);
        };
        await audio.play();
      }
    } catch {
      setIsPlaying(false);
    }
  }, [isPlaying, script]);

  useEffect(() => {
    const shouldHide = localStorage.getItem(storageKey) === "true";
    if (!shouldHide) {
      setIsVisible(true);
    }
  }, [storageKey]);

  const handleEnter = () => {
    if (isPlaying) {
      ttsService.stop();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
    }
    if (dontShowAgain) {
      localStorage.setItem(storageKey, "true");
    }
    setIsVisible(false);
    onEnter();
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-gradient-to-br from-[#0f0f0f] via-[#1a1a1a] to-[#2b2b2b] overflow-y-auto"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="min-h-full flex flex-col">
          <div className="flex justify-end p-4">
            <button
              onClick={handleEnter}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
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
              <div
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border mb-5 ${content.badgeColor}`}
              >
                <Award className="h-4 w-4" />
                <span className="text-sm font-medium">{content.badge}</span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                {content.title}
              </h1>

              <p className="text-white/60 text-base max-w-lg mx-auto">
                {content.subtitle}
              </p>

              {/* Listen Button */}
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
              <h2 className="text-lg font-semibold text-white mb-4">
                {content.purpose.title}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {content.purpose.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-lg bg-white/5"
                  >
                    <div className="p-1.5 rounded-lg bg-orange-500/20">
                      <item.icon className="h-4 w-4 text-orange-400" />
                    </div>
                    <div>
                      <h3 className="font-medium text-white text-sm">
                        {item.title}
                      </h3>
                      <p className="text-white/50 text-xs mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-xl p-5 bg-white/5 border border-white/10 mb-5"
            >
              <h2 className="text-lg font-semibold text-white mb-3">
                What This Is NOT
              </h2>
              <ul className="space-y-2">
                {content.notFor.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-center gap-2 text-white/60 text-sm"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                    {item}
                  </li>
                ))}
              </ul>
              {type === "physician" && content.disclaimer && (
                <p className="mt-3 text-xs text-amber-400/80 bg-amber-500/10 rounded-lg px-3 py-2 border border-amber-500/20">
                  {content.disclaimer}
                </p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="rounded-xl p-5 bg-white/5 border border-white/10 mb-5"
            >
              <h2 className="text-lg font-semibold text-white mb-3">
                Quick Start
              </h2>
              <ol className="space-y-2">
                {content.quickStart.map((step, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-sm">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-orange-500/20 text-orange-400">
                      {idx + 1}
                    </span>
                    <span className="text-white/80">{step}</span>
                  </li>
                ))}
              </ol>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-xl p-5 bg-white/5 border border-white/10 mb-8"
            >
              <h2 className="text-lg font-semibold text-white mb-3">
                Tools You'll Find Inside
              </h2>
              <div className="flex flex-wrap gap-2">
                {content.tools.map((tool, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 rounded-full bg-white/10 text-white/70 text-xs"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="space-y-4"
            >
              <Button
                onClick={handleEnter}
                className={`w-full py-5 text-base font-semibold text-white rounded-xl shadow-lg ${content.buttonColor} ${content.buttonShadow} active:scale-[0.98] transition-transform`}
              >
                Enter Workspace
                <ChevronRight className="h-5 w-5 ml-2" />
              </Button>

              <label className="flex items-center justify-center gap-2 cursor-pointer py-2 text-sm text-white/60 select-none">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="h-4 w-4 rounded border-white/30 bg-white/10 text-orange-500 focus:ring-orange-500/50"
                />
                Don't show this again
              </label>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export function useProfessionalIntro(type: WorkspaceType) {
  const [hasSeenIntro, setHasSeenIntro] = useState(true);

  useEffect(() => {
    const storageKey = STORAGE_KEYS[type];
    const shouldHide = localStorage.getItem(storageKey) === "true";
    setHasSeenIntro(shouldHide);
  }, [type]);

  return { showIntro: !hasSeenIntro };
}
