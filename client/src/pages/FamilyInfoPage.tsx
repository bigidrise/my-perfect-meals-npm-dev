import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check } from "lucide-react";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";

const FAMILY_BULLETS = [
  "Personalized profiles for up to 4 household members",
  "Shared weekly meal planning and smart shopping lists",
  "Individual macro tracking and dietary preferences per profile",
  "Family-friendly meal generation with parental controls",
];

export default function FamilyInfoPage() {
  const [, setLocation] = useLocation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-900 to-black/80 pb-safe-nav"
    >
      <MobileHeaderGuard>
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/10 backdrop-blur-none border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center gap-3">
            <Button
              onClick={() => setLocation("/pricing")}
              className="bg-black/10 hover:bg-black/50 text-white rounded-xl border border-white/10 backdrop-blur-none flex items-center gap-1.5 px-2.5 h-9 flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-xs font-medium">Back</span>
            </Button>
            <h1 className="text-lg font-bold text-white">Family Plans</h1>
          </div>
        </div>
      </MobileHeaderGuard>

      <div
        className="max-w-lg mx-auto px-6 text-white"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        <img
          src="/images/family-chef.png"
          alt="Family Plan with Chef"
          className="w-full rounded-2xl mb-6 shadow-xl"
        />

        <h2 className="text-2xl font-bold mb-2">Family Plans</h2>

        <p className="text-white/70 text-sm leading-relaxed mb-6">
          Every household is different. My Perfect Meals Family Plans give each
          person their own personalized nutrition profile while keeping the
          whole household coordinated around shared meal planning and wellness.
        </p>

        <div className="bg-black/40 backdrop-blur-lg border border-white/15 rounded-xl p-5 mb-8">
          <ul className="space-y-3">
            {FAMILY_BULLETS.map((bullet, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <Check className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-white">{bullet}</span>
              </li>
            ))}
          </ul>
        </div>

        <Button
          onClick={() => setLocation("/pricing")}
          className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl h-12"
        >
          Back to Plans
        </Button>
      </div>
    </motion.div>
  );
}
