import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function WelcomeGate({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [fade, setFade] = useState(false);
  const [skipNextTime, setSkipNextTime] = useState(
    localStorage.getItem("mpm.skipWelcomeGate") === "true"
  );

  const chooseMode = (mode: "guided" | "self") => {
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
          <div className="text-center space-y-6 px-6 max-w-md">
            <h1 className="text-2xl font-bold text-white">Choose Your Journey</h1>
            <p className="text-sm text-white/80">Select the experience that best fits your style. You can turn copilot on and off at anytime.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
              <button
                onClick={() => chooseMode("guided")}
                className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl border border-white/20 transition-all"
                data-testid="button-coach-mode"
              >
                My Perfect Copilot
              </button>
              <button
                onClick={() => chooseMode("self")}
                className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl border border-white/20 transition-all"
                data-testid="button-self-mode"
              >
                Do-it-Yourself
              </button>
            </div>

            <label className="flex items-center justify-center gap-2 pt-4 cursor-pointer select-none">
              <button
                type="button"
                onClick={() => setSkipNextTime(!skipNextTime)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  skipNextTime ? "bg-lime-600" : "bg-white/20"
                }`}
                data-testid="toggle-skip-welcome"
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    skipNextTime ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span className="text-xs text-white/50">Don't show this again</span>
            </label>

            <p className="text-xs text-white/40">
              You can change this anytime in Settings under "Coach Mode."
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
