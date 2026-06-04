import { useLocation } from "wouter";
import { ArrowLeft, Share2, Briefcase, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

const paths = [
  {
    id: "social",
    title: "Social & Referral Affiliate",
    description:
      "For influencers, content creators, social media promoters, and individuals who want to refer users to My Perfect Meals.",
    icon: Share2,
    resources: [
      "Affiliate Certification",
      "Marketing Resources",
      "Monthly Marketing Packets",
      "Affiliate Dashboard",
      "Referral Link Management",
    ],
    route: "/business-center/affiliate/social",
  },
  {
    id: "coaching",
    title: "Business & Coaching Affiliate",
    description:
      "For trainers, coaches, business owners, wellness professionals, and organizations that plan to actively use My Perfect Meals in their business.",
    icon: Briefcase,
    resources: [
      "Affiliate Certification",
      "Platform Certification",
      "Business Success Academy",
      "Marketing Resources",
      "Monthly Marketing Packets",
      "Affiliate Dashboard",
      "Referral Link Management",
    ],
    route: "/business-center/affiliate/coaching",
  },
];

export default function AffiliateOpportunities() {
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
            onClick={() => setLocation("/business-center")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-lg font-bold text-white">Affiliate Opportunities</h1>
        </div>
      </div>

      {/* Content */}
      <div
        className="px-4 max-w-2xl mx-auto space-y-5"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        <div className="text-center py-4">
          <h2 className="text-xl font-bold text-white mb-2">Choose Your Path</h2>
          <p className="text-white/60 text-sm leading-relaxed">
            Select the affiliate path that best describes how you plan to promote My Perfect Meals.
          </p>
        </div>

        {paths.map((path, i) => {
          const Icon = path.icon;
          return (
            <motion.button
              key={path.id}
              className="w-full text-left p-5 rounded-2xl bg-black/30 backdrop-blur-lg border border-orange-500/30 active:scale-[0.98] transition-all duration-200"
              onClick={() => setLocation(path.route)}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-orange-500/20 flex-shrink-0 mt-0.5">
                  <Icon className="h-6 w-6 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-white">{path.title}</h3>
                    <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0" />
                  </div>
                  <p className="text-xs text-white/60 mt-1 leading-relaxed">{path.description}</p>

                  {/* Resource preview */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {path.resources.map((r) => (
                      <span
                        key={r}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-300"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
