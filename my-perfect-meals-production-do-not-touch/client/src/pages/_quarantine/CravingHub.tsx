// 🔒 LOCKED: QUARANTINED PAGE
// This file is an obsolete/duplicate page and is intentionally removed from routing.
// DO NOT edit, modify, refactor, or auto-route this file without explicit user approval.

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useLocation } from "wouter";
import { Brain, Sparkles, ArrowLeft, Home } from "lucide-react";
import { useState } from "react";

export default function CravingHub() {
  const [, setLocation] = useLocation();
  const [showInfoModal, setShowInfoModal] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
    >
      {/* Universal Safe-Area Header */}
      <div
        className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-8 py-3 flex items-center gap-3">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => setLocation("/lifestyle")}
            className="flex items-center gap-2 text-white hover:bg-white/10 transition-all duration-200 p-2"
            data-testid="button-back-dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          {/* Title */}
          <h1 className="text-lg font-bold text-white">
            Craving Creator Hub
          </h1>

          {/* Info Button */}
          
        </div>
      </div>

      {/* Main Content */}
      <div
        className="max-w-5xl mx-auto px-4 pb-8"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-black/20 border-white/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <Brain className="w-4 h-4" /> Create Your Own
              </CardTitle>
              <CardDescription className="text-white/70 text-sm">
                Use the original AI Craving Creator you already know. No
                changes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setLocation("/craving-creator")}
                className="bg-white text-black w-full hover:bg-white/90 transition-colors"
                data-testid="button-craving-creator"
              >
                Open Craving Creator
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-black/20 border-white/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <Sparkles className="w-4 h-4" /> Healthy Premade Cravings
              </CardTitle>
              <CardDescription className="text-white/70 text-sm">
                20 smarter recipes that satisfy the feeling you're chasing —
                with servings 1–10.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => setLocation("/craving-presets")}
                className="bg-white text-black w-full hover:bg-white/90 transition-colors"
                data-testid="button-craving-presets"
              >
                Browse Presets
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-black/30 backdrop-blur-lg border border-white/20 rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-white mb-4">How to Use Craving Creator Hub</h2>
            <div className="space-y-3 text-white/90 text-sm mb-6">
              <p>
                <strong>Create Your Own:</strong> Use the original AI Craving Creator to generate custom meals based on what you're craving.
              </p>
              <p>
                <strong>Healthy Premade Cravings:</strong> Choose from 20 smarter recipes designed to satisfy cravings while supporting your goals. Select servings from 1-10.
              </p>
              <p className="text-lime-400 font-medium mt-4">
                💡 Tip: Both options scale ingredients automatically and can be added to your weekly meal plan!
              </p>
            </div>
            <button
              onClick={() => setShowInfoModal(false)}
              className="w-full bg-lime-700 hover:bg-lime-800 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Got It!
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
