import { useLocation } from "wouter";
import { ArrowLeft, TrendingUp, Users, Building2, HeartPulse, ChevronRight, Handshake } from "lucide-react";
import { motion } from "framer-motion";

const sections = [
  {
    id: "affiliate",
    title: "Affiliate Opportunities",
    description: "Earn commissions by referring members to My Perfect Meals",
    icon: TrendingUp,
    color: "orange",
    route: "/business-center/affiliate",
  },
  {
    id: "coach",
    title: "Coach Opportunities",
    description: "Apply to work with clients as a certified MPM ProCare provider",
    icon: Users,
    color: "blue",
    route: "/procare-welcome",
  },
  {
    id: "industry",
    title: "Industry & Strategic Partnerships",
    description: "Supplement brands, nutrition companies, fitness organizations, certification bodies, and software partners",
    icon: Handshake,
    color: "orange",
    route: "/business-center/industry",
  },
  {
    id: "white-label",
    title: "White Label Opportunities",
    description: "License the My Perfect Meals platform for your brand",
    icon: Building2,
    color: "orange",
    route: "/business-center/white-label",
  },
  {
    id: "partnerships",
    title: "Healthcare & Clinical Partnerships",
    description: "For physicians, dietitians, clinics, hospitals, and patient-care organizations",
    icon: HeartPulse,
    color: "orange",
    route: "/business-center/partnerships",
  },
];

const colorMap = {
  orange: {
    bg: "bg-orange-500/20",
    icon: "text-orange-400",
    border: "border-orange-500/30",
  },
  blue: {
    bg: "bg-blue-500/20",
    icon: "text-blue-400",
    border: "border-blue-500/30",
  },
};

export default function BusinessCenter() {
  const [, setLocation] = useLocation();

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-900 to-black/80 pb-28"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/10"
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
          <h1 className="text-lg font-bold text-white">Business Center</h1>
        </div>
      </div>

      {/* Content */}
      <div
        className="px-4 max-w-2xl mx-auto space-y-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        <div className="text-center py-4">
          <p className="text-white/70 text-sm leading-relaxed">
            Grow with My Perfect Meals — whether you want to earn as an affiliate,
            coach clients, or build a business partnership.
          </p>
        </div>

        {sections.map((section, i) => {
          const Icon = section.icon;
          const colors = colorMap[section.color as keyof typeof colorMap];
          return (
            <motion.button
              key={section.id}
              className={`w-full text-left p-4 rounded-2xl bg-black/30 backdrop-blur-lg border ${colors.border} active:scale-[0.98] transition-all duration-200`}
              onClick={() => setLocation(section.route)}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${colors.bg} flex-shrink-0`}>
                  <Icon className={`h-6 w-6 ${colors.icon}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white">{section.title}</h3>
                  <p className="text-xs text-white/60 mt-0.5 leading-relaxed">{section.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0" />
              </div>
            </motion.button>
          );
        })}

        <p className="text-center text-white/30 text-xs pb-4 pt-2">
          New opportunities added regularly
        </p>
      </div>
    </motion.div>
  );
}
