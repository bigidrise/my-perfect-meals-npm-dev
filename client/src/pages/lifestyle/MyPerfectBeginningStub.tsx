import React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Baby, Sprout } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { usePageTitle } from "@/contexts/PageTitleContext";

const SECTION_META: Record<string, { title: string; emoji: string; desc: string }> = {
  "create-meal": {
    title: "Create a Meal",
    emoji: "🍽",
    desc: "Recipe creator for every stage — coming soon.",
  },
  "parents-corner": {
    title: "Parent's Corner",
    emoji: "🧑‍🍼",
    desc: "Your trusted nutrition guide for every stage of childhood — coming soon.",
  },
  profile: {
    title: "Child Nutrition Profile",
    emoji: "👶",
    desc: "Build and edit your child's full nutrition profile — coming soon.",
  },
  journey: {
    title: "The Journey",
    emoji: "🌱",
    desc: "Your child's developmental stage timeline — coming soon.",
  },
  "better-favorites": {
    title: "Better Favorites",
    emoji: "🎂",
    desc: "Healthier versions of foods they already love — coming soon.",
  },
  lunchbox: {
    title: "Lunchbox Builder",
    emoji: "🎒",
    desc: "Pack the perfect lunch — coming soon.",
  },
  "nutrition-support": {
    title: "Nutrition Support",
    emoji: "❤️",
    desc: "Specialized protocols for allergies, celiac, T1D, and more — coming soon.",
  },
  growth: {
    title: "Growth & Development",
    emoji: "📚",
    desc: "Education hub tied to developmental milestones — coming soon.",
  },
};

export default function MyPerfectBeginningStub() {
  const [, setLocation] = useLocation();
  const isDesktop = useIsDesktop();

  // Infer section from current path
  const path = window.location.pathname;
  const slug = path.split("/").pop() ?? "";
  const meta = SECTION_META[slug] ?? {
    title: "Coming Soon",
    emoji: "🌱",
    desc: "This section is being built.",
  };

  usePageTitle(meta.title);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen pb-36"
      style={{
        backgroundImage: "linear-gradient(rgba(2,14,8,0.78), rgba(1,10,5,0.74)), url('/images/mpb-hero-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {!isDesktop && (
        <div
          className="fixed top-0 left-0 right-0 z-40 bg-black/50 backdrop-blur-lg border-b border-emerald-500/20"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 pb-3 pt-2 flex items-center gap-3">
            <button
              onClick={() => setLocation("/lifestyle/my-perfect-beginning")}
              className="flex items-center gap-1.5 text-emerald-400 text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>My Perfect Beginnings</span>
            </button>
          </div>
        </div>
      )}

      <div
        className="max-w-2xl mx-auto px-4"
        style={{
          paddingTop: isDesktop
            ? "2rem"
            : "calc(env(safe-area-inset-top, 0px) + 4rem)",
        }}
      >
        {isDesktop && (
          <div className="mb-6">
            <button
              onClick={() => setLocation("/lifestyle/my-perfect-beginning")}
              className="flex items-center gap-1.5 text-emerald-400 text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to My Perfect Beginnings</span>
            </button>
          </div>
        )}

        <div className="mt-16 flex flex-col items-center text-center px-4">
          <div className="w-20 h-20 rounded-3xl bg-emerald-500/15 border border-emerald-400/25 flex items-center justify-center mb-6 text-4xl">
            {meta.emoji}
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">{meta.title}</h2>
          <p className="text-white text-sm leading-relaxed max-w-sm mb-8">
            {meta.desc}
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-400/25">
            <Sprout className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-emerald-300 text-xs font-semibold">Phase 2 — In development</span>
          </div>
          <button
            onClick={() => setLocation("/lifestyle/my-perfect-beginning")}
            className="mt-8 flex items-center gap-2 text-emerald-400 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to My Perfect Beginning
          </button>
        </div>
      </div>
    </motion.div>
  );
}
