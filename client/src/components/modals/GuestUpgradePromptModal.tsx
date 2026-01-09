import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Lock, Sparkles, Clock, Zap } from "lucide-react";
import { getGuestGenerationsRemaining, getGuestDaysRemaining } from "@/lib/guestMode";

interface GuestUpgradePromptModalProps {
  open: boolean;
  onClose: () => void;
  reason?: "limit" | "expired" | "feature";
  featureName?: string;
}

export const GuestUpgradePromptModal: React.FC<GuestUpgradePromptModalProps> = ({
  open,
  onClose,
  reason = "limit",
  featureName,
}) => {
  const [, setLocation] = useLocation();
  const generationsRemaining = getGuestGenerationsRemaining();
  const daysRemaining = getGuestDaysRemaining();

  const handleUpgrade = () => {
    onClose();
    setLocation("/login?upgrade=true");
  };

  const getTitle = () => {
    switch (reason) {
      case "expired":
        return "Trial Ended";
      case "feature":
        return `Unlock ${featureName || "This Feature"}`;
      case "limit":
      default:
        return "You've Used Your Guest Meals";
    }
  };

  const getDescription = () => {
    switch (reason) {
      case "expired":
        return "Your 14-day guest access has ended. Create a free account to continue building meals and unlock all features.";
      case "feature":
        return `${featureName || "This feature"} is available to registered users. Create a free account to unlock full access.`;
      case "limit":
      default:
        return "You've built all 4 guest meals. Create a free account to continue building unlimited meals and unlock all features.";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-sm mx-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/10">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-amber-400/30">
              {reason === "expired" ? (
                <Clock className="w-8 h-8 text-amber-400" />
              ) : reason === "feature" ? (
                <Lock className="w-8 h-8 text-amber-400" />
              ) : (
                <Sparkles className="w-8 h-8 text-amber-400" />
              )}
            </div>
          </div>
          <DialogTitle className="text-xl font-bold text-white">
            {getTitle()}
          </DialogTitle>
          <DialogDescription className="text-white/70 mt-2">
            {getDescription()}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
            <h4 className="text-sm font-semibold text-white mb-2">With a free account you get:</h4>
            <ul className="space-y-1.5 text-xs text-white/80">
              <li className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-green-400" />
                Unlimited meal generation
              </li>
              <li className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-green-400" />
                Smart Shopping List
              </li>
              <li className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-green-400" />
                AI Fridge Rescue
              </li>
              <li className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-green-400" />
                Craving Creator
              </li>
              <li className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-green-400" />
                Sync across all devices
              </li>
            </ul>
          </div>

          {daysRemaining > 0 && reason !== "expired" && (
            <p className="text-xs text-center text-white/50">
              {daysRemaining} days left in your guest trial
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 mt-4">
          <Button
            onClick={handleUpgrade}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold py-3"
          >
            Create Free Account
          </Button>
          <Button
            onClick={onClose}
            variant="ghost"
            className="w-full text-white/60 hover:text-white hover:bg-white/5"
          >
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GuestUpgradePromptModal;
