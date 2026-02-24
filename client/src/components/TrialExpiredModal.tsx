import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";

const STORAGE_KEY = "mpm_trial_expired_modal_seen";

export function TrialExpiredModal() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (user.accessTier !== "FREE") return;
    if (!user.hasHadTrial) return;
    if (!user.onboardingCompletedAt) return;
    if (localStorage.getItem(STORAGE_KEY) === "true") return;

    setShow(true);
  }, [user]);

  if (!show) return null;

  const handleUpgrade = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setShow(false);
    setLocation("/pricing");
  };

  const handleContinueFree = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setShow(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 max-w-sm w-full text-center space-y-4">
        <div className="text-4xl">⏰</div>
        <h2 className="text-xl font-bold text-white">
          Your 7-Day Full Access Has Ended
        </h2>
        <p className="text-sm text-zinc-400">
          Upgrade to keep using AI meal generation, builders, and all premium
          features. Or continue with your free membership.
        </p>
        <div className="space-y-3 pt-2">
          <button
            onClick={handleUpgrade}
            className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl transition-colors"
          >
            Upgrade Now
          </button>
          <button
            onClick={handleContinueFree}
            className="w-full py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-colors"
          >
            Continue with Free Membership
          </button>
        </div>
      </div>
    </div>
  );
}
