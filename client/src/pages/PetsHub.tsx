import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { PawPrint, ArrowLeft, ChevronRight, Clock } from "lucide-react";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { useIsDesktop } from "@/hooks/useIsDesktop";

const pets = [
  {
    id: "dog",
    emoji: "🐕",
    title: "Dogs",
    subtitle: "Canine Nutrition Intelligence",
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
  const isDesktop = useIsDesktop();
  usePageTitle("My Perfect Pets");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen pb-24"
      style={{
        backgroundImage: "linear-gradient(rgba(0,0,0,0.52), rgba(0,0,0,0.62)), url('/images/pets-hero-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div
        className="max-w-2xl mx-auto px-4"
        style={{ paddingTop: isDesktop ? "2rem" : "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      >
        {!isDesktop && (
          <button
            onClick={() => setLocation("/lifestyle")}
            className="flex items-center gap-1.5 text-orange-400 hover:text-orange-300 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back</span>
          </button>
        )}

        <h1 className="text-2xl font-bold text-white mb-4">My Perfect Pets</h1>

        {/* Companion Nutrition Intelligence banner */}
        <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-2xl px-4 py-3 mb-5">
          <p className="text-white font-semibold text-sm">Companion Nutrition Intelligence</p>
          <p className="text-white/80 text-xs mt-1 leading-relaxed">
            The same adaptive protocol engine that powers your meals — now for your pets.
          </p>
        </div>

        {/* Choose Your Pet */}
        <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-3 px-1">
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
                  ? "bg-black/10 backdrop-blur-lg border-orange-500/30 active:scale-[0.98]"
                  : "bg-black/10 backdrop-blur-lg border-white/10 opacity-70 cursor-default"
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
                  <p className="text-[11px] font-medium text-orange-300 mb-1">{pet.subtitle}</p>
                  <p className="text-xs text-white/80 leading-relaxed">{pet.description}</p>
                </div>
                {pet.available && (
                  <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0" />
                )}
              </div>
            </motion.button>
          ))}
        </div>

        <p className="text-center text-white/55 text-xs mt-6">
          More species coming as the platform grows
        </p>
      </div>
    </motion.div>
  );
}
