import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PillButton } from "@/components/ui/pill-button";

export default function WelcomeGate({
  onComplete,
  previewMode = false,
}: {
  onComplete: () => void;
  previewMode?: boolean;
}) {
  const [fade, setFade] = useState(false);
  const [skipNextTime, setSkipNextTime] = useState(
    localStorage.getItem("mpm.skipWelcomeGate") === "true"
  );

  const chooseMode = (mode: "guided" | "self") => {
    if (previewMode) {
      setFade(true);
      setTimeout(onComplete, 300);
      return;
    }

    localStorage.setItem("coachMode", mode);
    sessionStorage.setItem("mpm.welcomeGateDone", "true");

    if (skipNextTime) {
      localStorage.setItem("mpm.skipWelcomeGate", "true");
    } else {
      localStorage.removeItem("mpm.skipWelcomeGate");
    }

    if (mode === "guided") {
      localStorage.setItem("trigger-copilot-intro", "true");
    }

    setFade(true);
    setTimeout(onComplete, 1000);
  };

  return (
    <AnimatePresence>
      {!fade && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: fade ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md"
          data-testid="welcome-gate"
        >
          <div className="relative w-full max-w-md space-y-6 px-6 text-center">
            {previewMode && (
              <button
                type="button"
                onClick={onComplete}
                className="absolute -top-8 right-4 rounded-full border border-white/20 bg-black/70 px-3 py-1.5 text-xs font-semibold text-white"
                aria-label="Close welcome screen preview"
              >
                Close preview
              </button>
            )}
            <h1 className="text-2xl font-bold text-white">
              Choose How You'd Like to Get Started
            </h1>
            <p className="text-sm text-white/80">
              Choose the experience that works best for you. You can change this anytime.
            </p>
            <div className="flex flex-col gap-4 mt-6">
              <button
                onClick={() => chooseMode("guided")}
                className="w-full rounded-xl border border-white/20 bg-white/10 px-5 py-4 text-left text-white transition-all hover:bg-white/20"
                data-testid="button-coach-mode"
              >
                <span className="block font-semibold">
                  My Perfect Copilot — Guide Me
                </span>
                <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-amber-300">
                  Recommended for new users
                </span>
                <span className="mt-2 block text-sm leading-relaxed text-white/70">
                  Get step-by-step guidance as you set up and use My Perfect Meals.
                </span>
              </button>
              <button
                onClick={() => chooseMode("self")}
                className="w-full rounded-xl border border-white/20 bg-white/10 px-5 py-4 text-left text-white transition-all hover:bg-white/20"
                data-testid="button-self-mode"
              >
                <span className="block font-semibold">Explore on My Own</span>
                <span className="mt-2 block text-sm leading-relaxed text-white/70">
                  Use My Perfect Meals independently and explore the tools at your own pace.
                </span>
              </button>
            </div>

            <div className="flex justify-center pt-4">
              <PillButton
                active={skipNextTime}
                onClick={() => setSkipNextTime(!skipNextTime)}
                data-testid="toggle-skip-welcome"
              >
                Don't show this again
              </PillButton>
            </div>

            <p className="text-xs text-white/40">
              You can change this anytime in Settings under "Coach Mode."
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
