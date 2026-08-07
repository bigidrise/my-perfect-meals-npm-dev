import { useLocation } from "wouter";
import { ArrowLeft, Baby, Utensils, BookOpen, Apple, Brain, ShoppingBag, Sparkles, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { usePageTitle } from "@/contexts/PageTitleContext";

const FEATURES = [
  { icon: Baby, label: "Child Nutrition Profiles", description: "Personalized profiles for every stage of your child's growth" },
  { icon: Heart, label: "Better versions of their favorite foods", description: "Healthier takes on the meals kids already love" },
  { icon: BookOpen, label: "Pediatric nutrition protocols", description: "Evidence-based guidance for each developmental stage" },
  { icon: Brain, label: "Parent's Corner AI", description: "Get answers to your child nutrition questions, any time" },
  { icon: ShoppingBag, label: "Lunchbox Builder", description: "Build balanced, kid-approved lunchboxes in seconds" },
  { icon: Sparkles, label: "Developmental nutrition guidance", description: "Milestone-aware meal planning as your child grows" },
  { icon: Utensils, label: "Child-safe recipe generation", description: "AI-generated recipes sized and seasoned for little ones" },
  { icon: Apple, label: "Growth-stage meal planning", description: "Weekly plans calibrated to your child's age and needs" },
];

export default function MyPerfectBeginning() {
  const [, setLocation] = useLocation();
  const isDesktop = useIsDesktop();
  usePageTitle("My Perfect Beginning");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-green-950 via-emerald-900 to-black/90 pb-safe-nav"
    >
      {/* Content */}
      <div
        className="max-w-4xl mx-auto px-4 text-white"
        style={{ paddingTop: isDesktop ? "1rem" : "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
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
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-4 border border-green-400/30">
            <Baby className="w-8 h-8 text-green-400" />
          </div>
          {!isDesktop && <h2 className="text-3xl font-bold mb-3">My Perfect Beginning</h2>}
          <p className="text-white/70 text-base max-w-lg mx-auto leading-relaxed">
            Age-appropriate nutrition guidance for infants, toddlers, and children — personalized to your child's stage and needs.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {FEATURES.map(({ icon: Icon, label, description }) => (
            <Card
              key={label}
              className="bg-black/30 backdrop-blur-lg border border-green-500/20 text-white"
            >
              <CardContent className="pt-5 pb-5 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-green-500/15 border border-green-400/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-white">{label}</p>
                  <p className="text-white/60 text-xs mt-0.5 leading-relaxed">{description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Coming soon notice */}
        <div className="bg-green-500/10 border border-green-400/20 rounded-xl p-6 text-center mb-10">
          <p className="text-green-300 font-semibold text-base mb-1">Full Hub Coming Soon</p>
          <p className="text-white/60 text-sm leading-relaxed">
            My Perfect Beginning is being built out. Check back soon for child nutrition profiles,
            the Lunchbox Builder, and the Parent's Corner AI.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
