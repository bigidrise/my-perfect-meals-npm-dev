import { useLocation } from "wouter";
import {
  ArrowLeft,
  Users,
  ChefHat,
  GraduationCap,
  Handshake,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";

const pillars = [
  {
    id: "partners",
    title: "Partner Programs",
    description:
      "Founding Business Partner, Industry & Strategic, Healthcare & Clinical, White Label Solutions, and Partner Program — all in one place.",
    icon: Handshake,
    route: "/business-center/partners",
    accent: "bg-orange-500/20",
    iconColor: "text-orange-400",
    border: "border-orange-500/20",
  },
  {
    id: "procare",
    title: "ProCare",
    description:
      "The professional platform for coaches, trainers, physicians, and dietitians managing clients with My Perfect Meals.",
    icon: Users,
    route: "/procare-welcome",
    accent: "bg-blue-500/20",
    iconColor: "text-blue-400",
    border: "border-blue-500/20",
  },
  {
    id: "academy",
    title: "My Perfect Meals Academy",
    description:
      "Platform certification and ProCare training for everyone who represents My Perfect Meals professionally.",
    icon: GraduationCap,
    route: "/business-center/academy",
    accent: "bg-orange-500/20",
    iconColor: "text-orange-400",
    border: "border-orange-500/20",
  },
  {
    id: "creator-brand",
    title: "Creator & Brand Studio",
    description:
      "Build a custom branded experience for chefs, supplement companies, beverage brands, and culinary creators.",
    icon: ChefHat,
    route: "/creator-studio",
    accent: "bg-orange-500/20",
    iconColor: "text-orange-400",
    border: "border-orange-500/20",
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

      <div
        className="px-4 max-w-2xl mx-auto space-y-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        <div className="py-3 text-center">
          <p className="text-white/55 text-sm leading-relaxed">
            Every way to grow with My Perfect Meals — as a partner, a professional, or a creator.
          </p>
        </div>

        {pillars.map((pillar, i) => {
          const Icon = pillar.icon;
          return (
            <motion.button
              key={pillar.id}
              className={`w-full text-left p-5 rounded-2xl bg-black/50 border ${pillar.border} active:scale-[0.98] transition-all duration-200`}
              onClick={() => setLocation(pillar.route)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
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

        <p className="text-center text-white/25 text-xs pb-4 pt-1">
          New opportunities added regularly
        </p>
      </div>
    </motion.div>
  );
}
