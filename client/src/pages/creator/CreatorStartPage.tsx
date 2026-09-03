import { useLocation } from "wouter";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ChefHat, Sparkles, BookOpen, Users, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function CreatorStartPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    document.title = "Creator Studio — My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  if (user?.isCreator) {
    setLocation("/creator/studio");
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-black via-orange-950/20 to-black pb-24"
    >
      <div className="px-6 pt-16 max-w-lg mx-auto">

        <div className="flex items-center justify-center mb-6">
          <div className="p-4 rounded-2xl bg-orange-500/20 border border-orange-500/30">
            <ChefHat className="h-10 w-10 text-orange-400" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white text-center mb-2">
          Chef Studio Application
        </h1>
        <p className="text-orange-300 text-sm text-center mb-8 font-medium">
          Premium Build Service — We build it for you
        </p>

        <div className="space-y-4 mb-10">
          <div className="flex items-start gap-4 bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="p-2 rounded-lg bg-orange-500/20 flex-shrink-0 mt-0.5">
              <Sparkles className="h-4 w-4 text-orange-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">
                Your style, in the AI
              </h3>
              <p className="text-xs text-white/70 leading-relaxed">
                Your cooking techniques, flavor philosophy, and instruction style shape how meals are generated — for every user in your system.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="p-2 rounded-lg bg-orange-500/20 flex-shrink-0 mt-0.5">
              <BookOpen className="h-4 w-4 text-orange-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">
                Your signature catalog
              </h3>
              <p className="text-xs text-white/70 leading-relaxed">
                Save any generated meal to your catalog. Your audience can access and add your exact meals to their own plans.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-4 bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="p-2 rounded-lg bg-orange-500/20 flex-shrink-0 mt-0.5">
              <Users className="h-4 w-4 text-orange-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">
                Your audience, on your system
              </h3>
              <p className="text-xs text-white/70 leading-relaxed">
                Share your product code with your audience so they can generate meals in your exact style — not just generic AI suggestions.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white/5 rounded-xl border border-white/10 p-4 mb-6 text-center">
          <p className="text-white/80 text-sm font-semibold">$2,500 full build</p>
          <p className="text-white/50 text-xs mt-1">$1,250 deposit to start · $1,250 on delivery</p>
          <p className="text-white/40 text-[10px] mt-2">Payment is collected after we review your application</p>
        </div>

        <button
          onClick={() => setLocation("/creator/setup")}
          className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl bg-orange-600 hover:bg-orange-500 active:bg-orange-700 text-white font-semibold text-base transition-colors"
        >
          Start Your Application
          <ArrowRight className="h-4 w-4" />
        </button>

        <button
          onClick={() => setLocation("/creator-studio")}
          className="w-full mt-3 py-3 text-sm text-white/50 hover:text-white/80 transition-colors"
        >
          Back
        </button>

      </div>
    </motion.div>
  );
}
