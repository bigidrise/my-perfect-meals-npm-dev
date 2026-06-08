import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { PawPrint, ArrowLeft, ChevronRight, Clock } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";

const DOG_HERO = "/images/companion-hero.png";

const pets = [
  {
    id: "dog",
    emoji: "🐕",
    title: "Dogs",
    subtitle: "Companion Nutrition Intelligence",
    description:
      "Personalized homemade meals, treats, and ingredient safety — built on the same adaptive protocol engine as your own nutrition.",
    route: "/companion/dogs",
    available: true,
    badge: null,
  },
  {
    id: "cat",
    emoji: "🐈",
    title: "Cats",
    subtitle: "Feline Nutrition Intelligence",
    description:
      "Obligate carnivore meal planning, taurine-optimized recipes, and cat-safe ingredient guidance — built on the same adaptive protocol engine.",
    route: "/companion/cats",
    available: true,
    badge: null,
  },
];

export default function PetsHub() {
  const [, setLocation] = useLocation();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-24"
    >
      <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-40 bg-black/40 backdrop-blur-lg border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center gap-2">
            <PawPrint className="h-4 w-4 text-orange-400" />
            <h1 className="text-base font-bold text-white">My Perfect Pets</h1>
          </div>
        </div>
      </MobileHeaderGuard>

      <div className="max-w-2xl mx-auto px-4" style={{ paddingTop: "5rem" }}>

        {/* Back */}
        <div className="mb-4">
          <PillButton onClick={() => window.history.back()}>
            <ArrowLeft className="h-3 w-3" /> Back
          </PillButton>
        </div>

        {/* Hero */}
        <div className="relative h-48 rounded-2xl overflow-hidden mb-4">
          <img
            src={DOG_HERO}
            alt="My Perfect Pets"
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
        </div>

        {/* Companion Nutrition Intelligence banner */}
        <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3 mb-5">
          <p className="text-white font-semibold text-sm">Companion Nutrition Intelligence</p>
          <p className="text-white/65 text-xs mt-1 leading-relaxed">
            The same adaptive protocol engine that powers your meals — now for your pets.
          </p>
        </div>

        {/* Choose Your Pet */}
        <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-3 px-1">
          Choose Your Pet
        </p>

        <div className="flex flex-col gap-3">
          {pets.map((pet, i) => (
            <motion.button
              key={pet.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              disabled={!pet.available}
              onClick={() => pet.available && pet.route && setLocation(pet.route)}
              className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 ${
                pet.available
                  ? "bg-black/40 backdrop-blur-lg border-orange-500/30 active:scale-[0.98]"
                  : "bg-black/20 backdrop-blur-lg border-white/10 opacity-70 cursor-default"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-500/15 border border-orange-500/20 flex items-center justify-center flex-shrink-0 text-2xl">
                  {pet.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <h3 className="text-sm font-bold text-white">{pet.title}</h3>
                    {pet.badge && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-white/50">
                        <Clock className="h-2.5 w-2.5" />
                        {pet.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-orange-300/80 mb-1">{pet.subtitle}</p>
                  <p className="text-xs text-white/55 leading-relaxed">{pet.description}</p>
                </div>
                {pet.available && (
                  <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0" />
                )}
              </div>
            </motion.button>
          ))}
        </div>

        <p className="text-center text-white/25 text-xs mt-6">
          More species coming as the platform grows
        </p>
      </div>
    </motion.div>
  );
}
