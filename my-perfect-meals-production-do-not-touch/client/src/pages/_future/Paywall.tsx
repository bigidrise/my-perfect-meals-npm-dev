// 🔒 LOCKED: FUTURE FEATURE
// This page is intentionally not imported in the router yet.
// It is reserved for launch or future upgrades.
// DO NOT delete, refactor, or auto-route this file without explicit user approval.

import React from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Check, Lock } from "lucide-react";

export default function Paywall() {
  const [, setLocation] = useLocation();

  const handleUpgrade = () => {
    window.location.href = "/api/stripe/checkout"; // Your working Stripe route
  };

  const restorePurchases = () => {
    alert(
      "Restore Purchases will be handled automatically after production build.",
    );
  };

  return (
    <motion.div
      className="min-h-screen w-full bg-gradient-to-b from-black to-purple-950 p-6 flex flex-col items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <h1 className="text-white text-3xl font-bold mb-6 drop-shadow-xl">
        Choose Your Plan
      </h1>

      {/* BASIC PLAN */}
      <motion.div
        className="w-full max-w-md mb-6 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6"
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h2 className="text-xl text-white font-semibold mb-2">Basic Plan</h2>
        <p className="text-gray-300 text-sm mb-4">Free during testing</p>

        <div className="space-y-2 text-gray-200 text-sm">
          <Feature text="1 Meal Builder" />
          <Feature text="Daily Macro Calculator" />
          <Feature text="Supplement Hub" />
          <Feature text="Biometrics Tracker" />
          <Feature text="Daily Health Journal" />
          <Feature text="Shopping List (manual only)" />
        </div>

        <div className="mt-4">
          <span className="text-emerald-400 text-xs font-semibold">
            CURRENT PLAN
          </span>
        </div>
      </motion.div>

      {/* UPGRADE PLAN */}
      <motion.div
        className="w-full max-w-md bg-purple-900/40 backdrop-blur-xl border border-purple-400/20 rounded-2xl shadow-2xl p-6"
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.45 }}
      >
        <h2 className="text-xl text-purple-200 font-semibold mb-2">
          Upgrade Plan
        </h2>
        <p className="text-purple-300 text-sm mb-4">$9.99 / month</p>

        <div className="space-y-2 text-purple-100 text-sm">
          <Feature text="ALL Meal Builders" />
          <Feature text="Fridge Rescue" />
          <Feature text="Craving Creator" />
          <Feature text="Kids & Toddler Hubs" />
          <Feature text="Lifestyle Hubs (GLP-1, Diabetic, Athlete)" />
          <Feature text="Shopping Delivery" />
          <Feature text="Fast Food Survival Guide" />
          <Feature text="Holiday Meal Planner" />
          <Feature text="Potluck Planner" />
        </div>

        <Button
          onClick={handleUpgrade}
          className="mt-6 w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white py-3 text-lg shadow-xl"
        >
          Upgrade Now
        </Button>

        <button
          onClick={restorePurchases}
          className="w-full text-center text-xs text-purple-300 mt-3 underline opacity-80"
        >
          Restore Purchases
        </button>
      </motion.div>

      <p className="text-center text-gray-400 text-xs mt-6 max-w-md">
        Subscriptions will be processed through your App Store account after
        approval. You will not be charged during testing. Cancel anytime in your
        App Store settings.
      </p>
    </motion.div>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <div className="flex flex-row items-center space-x-2">
      <Check size={16} className="text-emerald-400" />
      <span>{text}</span>
    </div>
  );
}
