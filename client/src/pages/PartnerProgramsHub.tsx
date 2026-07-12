import { useLocation } from "wouter";
import {
  ArrowLeft,
  Star,
  Handshake,
  Stethoscope,
  Building2,
  TrendingUp,
  GraduationCap,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";

const programs = [
  {
    id: "founding-partner",
    title: "Founding Business Partner Program",
    description:
      "A limited program for practices, clinics, and organizations building on My Perfect Meals as a foundation for their services.",
    icon: Star,
    route: "/business-center/founding-partner",
    accent: "bg-orange-500/20",
    iconColor: "text-orange-400",
    border: "border-orange-500/20",
  },
  {
    id: "industry",
    title: "Industry & Strategic Partnerships",
    description:
      "For wellness organizations, fitness brands, and industry leaders exploring platform partnerships at scale.",
    icon: Handshake,
    route: "/business-center/industry",
    accent: "bg-white/8",
    iconColor: "text-orange-400",
    border: "border-white/10",
  },
  {
    id: "healthcare",
    title: "Healthcare & Clinical Partnerships",
    description:
      "For physicians, dietitians, hospitals, and clinical organizations serving patients through nutrition.",
    icon: Stethoscope,
    route: "/business-center/healthcare",
    accent: "bg-white/8",
    iconColor: "text-orange-400",
    border: "border-white/10",
  },
  {
    id: "white-label",
    title: "White Label Partnerships",
    description:
      "License the My Perfect Meals platform to deliver a fully branded nutrition product under your own identity.",
    icon: Building2,
    route: "/business-center/white-label",
    accent: "bg-white/8",
    iconColor: "text-orange-400",
    border: "border-white/10",
  },
  {
    id: "partner-program",
    title: "Partner Program (Affiliate)",
    description:
      "Earn recurring commissions by referring subscribers to My Perfect Meals.",
    icon: TrendingUp,
    route: "/business-center/affiliate",
    accent: "bg-white/8",
    iconColor: "text-orange-400",
    border: "border-white/10",
  },
  {
    id: "academy",
    title: "My Perfect Meals Academy",
    description:
      "Platform certification for everyone who represents My Perfect Meals — partners, coaches, physicians, and all healthcare professionals.",
    icon: GraduationCap,
    route: "/business-center/academy",
    accent: "bg-orange-500/20",
    iconColor: "text-orange-400",
    border: "border-orange-500/20",
  },
];

export default function PartnerProgramsHub() {
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
            onClick={() => setLocation("/business-center")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
          >
            <ArrowLeft className="h-4 w-4" />
            Business Center
          </button>
          <h1 className="text-lg font-bold text-white">Partner Programs</h1>
        </div>
      </div>

      <div
        className="px-4 max-w-2xl mx-auto space-y-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        <div className="py-3 text-center">
          <p className="text-white/55 text-sm leading-relaxed">
            Choose the partnership type that best fits your organization or goals.
          </p>
        </div>

        {programs.map((program, i) => {
          const Icon = program.icon;
          return (
            <motion.button
              key={program.id}
              className={`w-full text-left p-4 rounded-2xl bg-black/50 border ${program.border} active:scale-[0.98] transition-all duration-200`}
              onClick={() => setLocation(program.route)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${program.accent} flex-shrink-0`}>
                  <Icon className={`h-5 w-5 ${program.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white leading-snug">
                    {program.title}
                  </h3>
                  <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
                    {program.description}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0" />
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
