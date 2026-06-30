import { useLocation } from "wouter";
import {
  ArrowLeft,
  TrendingUp,
  Users,
  Building2,
  HeartPulse,
  ChevronRight,
  Handshake,
  ChefHat,
  Star,
  GraduationCap,
  Stethoscope,
} from "lucide-react";
import { motion } from "framer-motion";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";

const partnershipPrograms = [
  {
    id: "founding-partner",
    title: "Founding Business Partner Program",
    description: "For practices, clinics, and organizations building on MPM",
    icon: Star,
    route: "/business-center/founding-partner",
  },
  {
    id: "industry",
    title: "Industry & Strategic Partnerships",
    description: "How organizations work with My Perfect Meals at scale",
    icon: Handshake,
    route: "/business-center/industry",
  },
  {
    id: "healthcare",
    title: "Healthcare & Clinical Partnerships",
    description: "For physicians, dietitians, clinics, and hospitals",
    icon: Stethoscope,
    route: "/business-center/partnerships",
  },
  {
    id: "white-label",
    title: "White Label Solutions",
    description: "License the My Perfect Meals platform under your brand",
    icon: Building2,
    route: "/business-center/white-label",
  },
  {
    id: "partner-program",
    title: "Partner Program",
    description: "Earn commissions by referring members to My Perfect Meals",
    icon: TrendingUp,
    route: "/business-center/affiliate",
  },
];

const pillars = [
  {
    id: "procare",
    title: "ProCare",
    description:
      "The professional coaching platform for trainers, coaches, physicians, and dietitians serving clients with My Perfect Meals",
    icon: Users,
    route: "/procare-welcome",
    accent: "bg-blue-500/20",
    iconColor: "text-blue-400",
    borderAccent: "border-blue-500/20",
  },
  {
    id: "academy",
    title: "My Perfect Meals Academy",
    description:
      "Platform certification and professional development for everyone who represents My Perfect Meals",
    icon: GraduationCap,
    route: "/business-center/affiliate",
    accent: "bg-orange-500/20",
    iconColor: "text-orange-400",
    borderAccent: "border-orange-500/20",
  },
  {
    id: "creator-brand",
    title: "Creator & Brand Studio",
    description:
      "Build a custom branded experience for chefs, supplement companies, beverage brands, and culinary creators",
    icon: ChefHat,
    route: "/creator-studio",
    accent: "bg-orange-500/20",
    iconColor: "text-orange-400",
    borderAccent: "border-orange-500/20",
  },
];

export default function BusinessCenter() {
  const [, setLocation] = useLocation();

  return (
    <motion.div
      className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} pb-28`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 ${BC_HEADER}`}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => setLocation("/more")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-lg font-bold text-white">Business Suite</h1>
        </div>
      </div>

      {/* Content */}
      <div
        className="px-4 max-w-2xl mx-auto space-y-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        <div className="text-center py-2">
          <p className="text-white/60 text-sm leading-relaxed">
            Every way to grow with My Perfect Meals — as a partner, a professional, or a creator.
          </p>
        </div>

        {/* ── PARTNERSHIP PROGRAMS ─────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-3 px-1">
            <Handshake className="h-4 w-4 text-orange-400" />
            <h2 className="text-xs font-semibold text-orange-400 uppercase tracking-widest">
              Partnership Programs
            </h2>
          </div>
          <div className="space-y-2">
            {partnershipPrograms.map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.button
                  key={item.id}
                  className="w-full text-left p-4 rounded-2xl bg-black/50 border border-white/10 active:scale-[0.98] transition-all duration-200"
                  onClick={() => setLocation(item.route)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-orange-500/20 flex-shrink-0">
                      <Icon className="h-5 w-5 text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-white leading-snug">
                        {item.title}
                      </h3>
                      <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* ── THREE PRIMARY PILLARS ────────────────────────────── */}
        <section>
          <div className="space-y-3">
            {pillars.map((pillar, i) => {
              const Icon = pillar.icon;
              return (
                <motion.button
                  key={pillar.id}
                  className={`w-full text-left p-5 rounded-2xl bg-black/50 border ${pillar.borderAccent} active:scale-[0.98] transition-all duration-200`}
                  onClick={() => setLocation(pillar.route)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 + i * 0.07 }}
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${pillar.accent} flex-shrink-0`}>
                      <Icon className={`h-6 w-6 ${pillar.iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-white leading-snug">
                        {pillar.title}
                      </h3>
                      <p className="text-xs text-white/55 mt-1 leading-relaxed">
                        {pillar.description}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0 mt-1" />
                  </div>
                </motion.button>
              );
            })}
          </div>
        </section>

        <p className="text-center text-white/25 text-xs pb-4 pt-1">
          New opportunities added regularly
        </p>
      </div>
    </motion.div>
  );
}
