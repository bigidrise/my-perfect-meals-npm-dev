import { useEffect } from "react";
import { useLocation } from "wouter";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import {
  ArrowLeft,
  Star,
  Handshake,
  Stethoscope,
  Building2,
  TrendingUp,
  GraduationCap,
  ChevronRight,
  HelpCircle,
  Shield,
  Package,
} from "lucide-react";
import { motion } from "framer-motion";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";
import { useAuth } from "@/contexts/AuthContext";

const programs = [
  {
    id: "how-it-works",
    title: "How Partnerships Work",
    description:
      "Understand promo codes, referral links, commissions, customer discounts, and the four partnership models before choosing a path.",
    icon: HelpCircle,
    route: "/business-center/how-partnerships-work",
    accent: "bg-orange-500/20",
    iconColor: "text-orange-400",
    border: "border-orange-500/30",
  },
  {
    id: "founding-affiliate",
    title: "Founding Affiliate Program",
    description:
      "Earn 40% recurring commission sharing My Perfect Meals. Complete the Affiliate Academy and your account activates automatically.",
    icon: Star,
    route: "/business-center/founding-affiliate",
    accent: "bg-orange-500/20",
    iconColor: "text-orange-400",
    border: "border-orange-500/30",
    badge: "Founding",
  },
  {
    id: "founding-partner",
    title: "Founding Business Partner Program",
    description:
      "Feature your brand's products inside My Perfect Meals. A commercial partnership for companies that want their products infused directly into the platform experience.",
    icon: Package,
    route: "/business-center/founding-partner",
    accent: "bg-blue-500/20",
    iconColor: "text-blue-400",
    border: "border-blue-500/30",
    badge: "Product Placement",
    badgeColor: "bg-blue-500/25 border-blue-500/40 text-blue-400",
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
  // Partner & Revenue Center — feature-hidden during Founding Affiliate launch.
  // Routes and backend are preserved. Un-hide by removing the `hidden` flag.
  // {
  //   id: "partner-program",
  //   title: "Partner & Revenue Center",
  //   description:
  //     "Access your promo code, referral link, QR code, commission terms, and partner performance tools.",
  //   icon: TrendingUp,
  //   route: "/business-center/affiliate",
  //   accent: "bg-white/8",
  //   iconColor: "text-orange-400",
  //   border: "border-white/10",
  // },
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
  const { user } = useAuth();
  const isDesktop = useIsDesktop();

  useEffect(() => {
    document.title = "Partner Programs | My Perfect Meals";
    return () => { document.title = "My Perfect Meals"; };
  }, []);

  return (
    <motion.div
      className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} pb-28`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      {/* Header — mobile only; desktop uses DesktopLayout shell header */}
      {!isDesktop && (
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
      )}

      <div
        className="px-4 max-w-2xl mx-auto space-y-3"
        style={{ paddingTop: isDesktop ? "1rem" : "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        {/* In-content back button — always visible on desktop where fixed header is trapped */}
        <button
          onClick={() => setLocation("/business-center")}
          className="flex items-center gap-1.5 text-orange-400 text-sm font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Business Center
        </button>

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
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-white leading-snug">
                      {program.title}
                    </h3>
                    {"badge" in program && program.badge && (
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide ${"badgeColor" in program && program.badgeColor ? program.badgeColor : "bg-orange-500/25 border-orange-500/40 text-orange-400"}`}>
                        {program.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
                    {program.description}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0" />
              </div>
            </motion.button>
          );
        })}

        {/* Admin-only: Partner Management */}
        {user?.isAdmin && (
          <motion.button
            className="w-full text-left p-4 rounded-2xl bg-black/50 border border-orange-500/40 active:scale-[0.98] transition-all duration-200"
            onClick={() => setLocation("/business-center/partners/manage")}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: programs.length * 0.06 }}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-orange-500/20 flex-shrink-0">
                <Shield className="h-5 w-5 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-sm font-semibold text-white leading-snug">Partner Management</h3>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-600/30 border border-orange-500/40 text-orange-400 font-bold uppercase tracking-wide">Admin</span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">
                  Configure partner capabilities, lifecycle milestones, commission terms, and activity log.
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0" />
            </div>
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
