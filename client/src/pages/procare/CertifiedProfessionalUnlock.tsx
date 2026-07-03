import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "framer-motion";
import { Trophy, Star, Users, ClipboardList, Briefcase, TrendingUp, ArrowRight, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

const UNLOCKED_ITEMS = [
  { icon: "🏢", label: "Professional Studio" },
  { icon: "👥", label: "Client Management" },
  { icon: "📋", label: "Care Plans" },
  { icon: "📝", label: "Professional Questionnaires" },
  { icon: "💼", label: "Business Suite" },
  { icon: "💰", label: "Affiliate Resources" },
  { icon: "📣", label: "Marketing Materials" },
  { icon: "🎓", label: "Continuing Education" },
];

const NEXT_STEPS = [
  "Complete your professional profile",
  "Create your first client",
  "Invite your first client to the platform",
  "Build your first meal plan",
  "Set up your affiliate account to earn commissions",
  "Explore the Business Suite",
];

export default function CertifiedProfessionalUnlock() {
  const [, setLocation] = useLocation();
  const { user, refreshUser } = useAuth();
  const [refreshing, setRefreshing] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        await refreshUser();
      } catch {}
      setRefreshing(false);
    })();
  }, []);

  const handleEnterStudio = () => {
    localStorage.setItem("mpm_active_space", "workspace");
    localStorage.setItem("mpm.studio.firstEntry", "true");
    const route =
      user?.professionalRole === "physician" ? "/pro/physician-clients" : "/pro/clients";
    setLocation(route);
  };

  if (refreshing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 text-white overflow-y-auto pb-36"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="px-4 pt-16 max-w-lg mx-auto">
        {/* Hero */}
        <motion.div
          className="flex flex-col items-center text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <motion.div
            className="w-24 h-24 rounded-full bg-orange-500/20 border-2 border-orange-500/40 flex items-center justify-center mb-4"
            initial={{ scale: 0.7 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          >
            <Trophy className="w-12 h-12 text-orange-400" />
          </motion.div>

          <motion.div
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-500/20 rounded-full border border-orange-500/30 mb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <Star className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-xs font-semibold text-orange-300">Certified My Perfect Meals Professional</span>
            <Star className="w-3.5 h-3.5 text-orange-400" />
          </motion.div>

          <h1 className="text-3xl font-black leading-tight mb-3">
            Congratulations!
          </h1>
          <p className="text-white/70 text-sm leading-relaxed max-w-xs">
            You are now a Certified My Perfect Meals Professional.
            You're now ready to begin working with clients.
          </p>
        </motion.div>

        {/* Unlocked Features */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-orange-400 mb-3">
            You've Unlocked
          </p>
          <div className="grid grid-cols-2 gap-2">
            {UNLOCKED_ITEMS.map((item, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-2 p-3 rounded-xl bg-black/30 border border-white/10"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + i * 0.05 }}
              >
                <span className="text-lg">{item.icon}</span>
                <p className="text-xs font-medium text-white leading-tight">{item.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Next Steps */}
        <motion.div
          className="mb-6 p-4 rounded-2xl bg-black/30 border border-white/10"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <p className="text-sm font-bold text-white mb-3">Your Next Steps</p>
          <div className="space-y-2">
            {NEXT_STEPS.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-xs font-bold text-orange-400 mt-0.5 w-4 shrink-0">{i + 1}.</span>
                <p className="text-xs text-white/70 leading-relaxed">{step}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Cert badge */}
        <motion.div
          className="p-4 rounded-2xl bg-orange-900/20 border border-orange-500/20 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
        >
          <p className="text-xs text-orange-300 leading-relaxed">
            🏆 <span className="font-semibold">Certified My Perfect Meals Professional</span><br />
            <span className="text-white/40">Your certification is permanently recorded in your Business Suite.</span>
          </p>
        </motion.div>
      </div>

      {/* Fixed CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent">
        <motion.button
          onClick={handleEnterStudio}
          className="w-full h-14 font-bold rounded-2xl bg-orange-600 text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
        >
          Enter Your Studio
          <ArrowRight className="w-5 h-5" />
        </motion.button>
      </div>
    </motion.div>
  );
}
