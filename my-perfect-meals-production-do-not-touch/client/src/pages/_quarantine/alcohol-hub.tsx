// 🔒 LOCKED: QUARANTINED PAGE
// This file is an obsolete/duplicate page and is intentionally removed from routing.
// DO NOT edit, modify, refactor, or auto-route this file without explicit user approval.

// client/src/pages/AlcoholHub.tsx
import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
  Wine,
  GlassWater,
  ArrowLeft,
  CookingPot,
  Sparkles,
  Home,
  ChevronUp,
  Beer,
  Cigarette,
  TrendingDown,
} from "lucide-react";

const AlcoholSpiritsHub = () => {
  const [, setLocation] = useLocation();
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 300);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const FeaturePlaceholder = ({ icon, title, description, plan }: any) => (
    <Card className="opacity-75 cursor-not-allowed bg-black/30 backdrop-blur-lg border border-white/20 shadow-lg">
      <CardContent className="p-6 text-center">
        <div className="text-4xl mb-4">{icon}</div>
        <h3 className="font-semibold text-lg mb-2 text-white">{title}</h3>
        <p className="text-sm text-white/70 mb-4">{description}</p>
        <div className="bg-black/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-white border border-white/30">
          🔒 {plan}
        </div>
      </CardContent>
    </Card>
  );

  const HubCard = ({
    icon,
    title,
    description,
    path,
    gradient,
  }: {
    icon: React.ReactNode;
    title: string;
    description: string;
    path: string;
    gradient: string;
  }) => (
    <div className={`rounded-2xl p-[1px] bg-gradient-to-r ${gradient} transition`}>
      <Card
        className="cursor-pointer transform hover:scale-105 transition-all duration-200 bg-black/30 backdrop-blur-lg border-transparent hover:bg-black/40 shadow-lg hover:shadow-xl text-white"
        onClick={() => setLocation(path)}
        role="button"
        aria-label={title}
      >
        <CardContent className="p-6 text-center">
          <div className="text-4xl mb-4">{icon}</div>
          <h3 className="font-semibold text-lg mb-2 text-white">{title}</h3>
          <p className="text-sm text-white/90">{description}</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="max-w-4xl mx-auto">
        {/* Back to Emotion AI */}
        <Button
          variant="ghost"
          onClick={() => setLocation("/lifestyle")}
          className="fixed top-2 left-2 sm:top-4 sm:left-4 z-50 bg-black/10 backdrop-blur-none border border-white/20 hover:bg-black/20 text-white px-3 sm:px-6 py-2 sm:py-3 rounded-xl shadow-lg flex items-center gap-2 font-semibold text-sm sm:text-base transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Lifestyle
        </Button>

        {/* Title */}
        <div className="rounded-2xl p-[1px] bg-gradient-to-r from-black/60 via-gray-400 to-black/80 transition mb-8 mt-14">
          <div className="bg-black/10 backdrop-blur-lg border-transparent shadow-xl rounded-2xl p-8 text-center">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 text-white">
              <span className="block">🍷 Alcohol & Spirits</span>
              <span className="block">Hub</span>
            </h1>
            <p className="text-white">
              Explore your wine, spirits, and beer lifestyle — track, pair, or
              reduce with AI-powered recommendations.
            </p>
          </div>
        </div>

        {/* Actions (ordered by importance) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {/* 1) Lean & Social (Diet-Friendly Drinks) */}
          <HubCard
            icon={<Wine />}
            title="Lean & Social"
            description="Diet-friendly drinks & wines"
            path="/alcohol/lean-and-social"
            gradient="from-black/60 via-rose-500 to-black/80"
          />

          {/* 2) Wine Pairing Mode */}
          <HubCard
            icon={<Wine />}
            title="Wine Pairing Mode"
            description="Discover wines and ideal pairings"
            path="/wine-pairing"
            gradient="from-black/60 via-purple-500 to-black/80"
          />

          {/* 3) Beer Pairing Mode (NEW: clickable) */}
          <HubCard
            icon={<Beer />}
            title="Beer Pairing Mode"
            description="Match your meals with the perfect beer"
            path="/beer-pairing"
            gradient="from-black/60 via-amber-500 to-black/80"
          />

          {/* 4) Mocktails & Low-Cal Mixers (moved up) */}
          <HubCard
            icon={<Sparkles />}
            title="Mocktails & Low-Cal Mixers"
            description="Enjoy light and alcohol-free blends"
            path="/mocktails-low-cal-mixers"
            gradient="from-black/60 via-emerald-500 to-black/80"
          />

          {/* 5) Bourbon & Spirits Mode */}
          <HubCard
            icon={<GlassWater />}
            title="Bourbon & Spirits Mode"
            description="Find the perfect spirit for your vibe"
            path="/bourbon-spirits"
            gradient="from-black/60 via-orange-500 to-black/80"
          />

          {/* 6) Meal Pairing AI */}
          <HubCard
            icon={<CookingPot />}
            title="Meal Pairing AI"
            description="Pair meals based on your drink"
            path="/meal-pairing-ai"
            gradient="from-black/60 via-blue-500 to-black/80"
          />

          {/* 7) Cigar Lounge (NEW: clickable) */}
          <HubCard
            icon={<Cigarette />}
            title="Cigar Lounge"
            description="Cigar recommendations + drink pairings"
            path="/cigar-lounge"
            gradient="from-black/60 via-stone-500 to-black/80"
          />

          {/* 8) Alcohol Log */}
          <HubCard
            icon={<Sparkles />}
            title="Alcohol Log"
            description="Track your intake without judgment"
            path="/alcohol-log"
            gradient="from-black/60 via-red-500 to-black/80"
          />

          {/* 9) Weaning Off Tool */}
          <HubCard
            icon={<TrendingDown />}
            title="Weaning Off Tool"
            description="Taper gently at your pace"
            path="/weaning-off-tool"
            gradient="from-black/60 via-teal-500 to-black/80"
          />
        </div>
      </div>

      {/* Back to Top */}
      <div className="flex justify-center mt-8 pb-6">
        <button
          onClick={scrollToTop}
          className="!rounded-full bg-black/30 backdrop-blur-lg border border-black/50 text-white p-3 shadow-xl hover:bg-black/40 hover:border-black/60 transition-all duration-300 transform hover:scale-110"
          aria-label="Back to top"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default AlcoholSpiritsHub;
