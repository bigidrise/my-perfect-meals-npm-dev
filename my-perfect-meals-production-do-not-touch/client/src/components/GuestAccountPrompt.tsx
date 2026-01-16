// client/src/components/GuestAccountPrompt.tsx
// Apple App Review Compliant: Soft prompts for account creation

import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { UserPlus, X, Sparkles, Save, History, ShoppingCart } from "lucide-react";
import { isGuestMode, endGuestSession } from "@/lib/guestMode";

interface GuestAccountPromptProps {
  isOpen: boolean;
  onClose: () => void;
  context?: "save" | "history" | "shopping" | "general";
  customMessage?: string;
}

const contextMessages = {
  save: {
    icon: Save,
    title: "Want to save this?",
    message: "Create a free account to save your meals and access them anytime.",
  },
  history: {
    icon: History,
    title: "Track your progress",
    message: "Create an account to see your meal history and nutrition trends.",
  },
  shopping: {
    icon: ShoppingCart,
    title: "Shopping list ready!",
    message: "Create an account to save and export your shopping list.",
  },
  general: {
    icon: Sparkles,
    title: "Like what you see?",
    message: "Create a free account to unlock all features and save your progress.",
  },
};

export function GuestAccountPrompt({ 
  isOpen, 
  onClose, 
  context = "general",
  customMessage 
}: GuestAccountPromptProps) {
  const [, setLocation] = useLocation();

  if (!isOpen || !isGuestMode()) {
    return null;
  }

  const { icon: Icon, title, message } = contextMessages[context];

  const handleCreateAccount = () => {
    endGuestSession();
    setLocation("/auth");
    onClose();
  };

  const handleContinueGuest = () => {
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={handleContinueGuest}
        >
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm"
          >
            <Card className="bg-zinc-900/95 border border-white/10 shadow-2xl">
              <CardContent className="p-6 space-y-5">
                {/* Close button */}
                <button
                  onClick={handleContinueGuest}
                  className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>

                {/* Icon */}
                <div className="w-14 h-14 mx-auto bg-gradient-to-br from-lime-500/20 to-emerald-500/20 rounded-2xl flex items-center justify-center">
                  <Icon className="h-7 w-7 text-lime-400" />
                </div>

                {/* Title & Message */}
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-bold text-white">{title}</h3>
                  <p className="text-white/70 text-sm">
                    {customMessage || message}
                  </p>
                </div>

                {/* Actions */}
                <div className="space-y-3 pt-2">
                  <Button
                    onClick={handleCreateAccount}
                    className="w-full bg-gradient-to-r from-lime-600 to-emerald-600 hover:from-lime-500 hover:to-emerald-500 text-white font-medium"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create Free Account
                  </Button>

                  <Button
                    onClick={handleContinueGuest}
                    variant="ghost"
                    className="w-full text-white/50 hover:text-white hover:bg-white/5"
                  >
                    Continue as Guest
                  </Button>
                </div>

                {/* Fine print */}
                <p className="text-center text-white/30 text-xs">
                  No credit card required
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Hook for easy usage
export function useGuestAccountPrompt() {
  const isGuest = isGuestMode();

  const shouldPrompt = (action: "save" | "history" | "shopping" | "feature") => {
    return isGuest;
  };

  return {
    isGuest,
    shouldPrompt,
  };
}

export default GuestAccountPrompt;
