// 🔒 LOCKED FEATURE - DO NOT MODIFY WITHOUT EXPLICIT USER APPROVAL
// Feature: Blood Sugar Input Button | Locked: 20250108-1925 | Status: PERFECT DESIGN ACHIEVED
// User Warning: "I'm gonna be pissed off" if this gets messed up later
// This feature matches the exact design of other dailies buttons with orange gradient

import React from "react";
import { ArrowRight, Activity } from "lucide-react";
import { useLocation } from "wouter";
import { useGlycemicSettings } from "@/hooks/useGlycemicSettings";
import FeatureLabel from "@/components/FeatureLabel";

// Glass card helper classes for consistency
const cardCx =
  "rounded-2xl border border-white/40 bg-white/60 backdrop-blur-md shadow-lg p-4 md:p-5";

export function DailiesGlucoseCard() {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-2">
      <button
        onClick={() => setLocation("/blood-sugar-hub")}
        className="w-full bg-gradient-to-r from-black/80 via-orange-700/90 to-black/80 text-white p-3 rounded-xl shadow-2xl shadow-black/80 hover:shadow-2xl hover:shadow-black/90 transition-all duration-200 text-center relative border-2 border-orange-300/40 hover:border-orange-300/90"
      >
        <div className="text-2xl mb-2">🩸</div>
        <h3 className="font-bold text-lg mb-1">Blood Sugar Hub</h3>
        <p className="text-xs opacity-90">Track glucose & carbs</p>
        <div className="absolute top-2 right-2 text-green-300 text-lg">
          ✓
        </div>
      </button>
      
      {/* Badges Row */}
      <div className="flex gap-2 items-center justify-center">
        {/* Testing Badge */}
        <FeatureLabel 
          plan="Ultimate"
          isOpenDuringTesting={true}
        />
        
        {/* Upgrade Badge */}
        <div className="text-xs text-white font-semibold text-center px-3 py-1 bg-red-600 rounded-lg border border-red-500 shadow-md">
          🔒 Unlock with Ultimate Plan – $29.99/month
        </div>
      </div>
    </div>
  );
}