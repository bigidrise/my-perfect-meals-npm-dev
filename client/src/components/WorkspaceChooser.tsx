import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Home, Briefcase, Crown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface WorkspaceChooserProps {
  onChoose: (choice: "personal" | "workspace") => void;
}

export function WorkspaceChooser({ onChoose }: WorkspaceChooserProps) {
  const { user } = useAuth();
  const [rememberChoice, setRememberChoice] = useState(false);

  const workspaceName = user?.professionalRole === "physician"
    ? "Physicians Clinic"
    : "Trainers Studio";

  const handleChoice = (choice: "personal" | "workspace") => {
    if (rememberChoice) {
      localStorage.setItem("mpm_workspace_preference", choice);
    }
    onChoose(choice);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-sm mx-6 space-y-5"
        >
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/20 rounded-full border border-orange-500/30 mb-4">
              <Crown className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-medium text-orange-300">Welcome Back</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Where to?</h1>
            <p className="text-white/60 text-sm">Choose how you'd like to start today.</p>
          </div>

          <button
            onClick={() => handleChoice("personal")}
            className="w-full p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-lg active:scale-[0.98] transition-transform text-left"
          >
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/20">
                <Home className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold text-base">Personal Space</h3>
                <p className="text-white/50 text-sm mt-0.5">Your meals, your macros, your life.</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleChoice("workspace")}
            className="w-full p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-lg active:scale-[0.98] transition-transform text-left"
          >
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-orange-500/20 border border-orange-500/20">
                <Briefcase className="h-5 w-5 text-orange-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-semibold text-base">Workspace</h3>
                <p className="text-white/50 text-sm mt-0.5">Manage clients in {workspaceName}.</p>
              </div>
            </div>
          </button>

          <label className="flex items-center justify-center gap-2 cursor-pointer py-2 text-sm text-white/50 select-none">
            <input
              type="checkbox"
              checked={rememberChoice}
              onChange={(e) => setRememberChoice(e.target.checked)}
              className="h-4 w-4 rounded border-white/30 bg-white/10 text-orange-500 focus:ring-orange-500/50"
            />
            Always start here
          </label>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
