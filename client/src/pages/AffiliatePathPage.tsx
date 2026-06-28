import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Share2, Briefcase, ChevronRight, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { BC_HEADER } from "@/components/BusinessCenterShell";

const pathMeta = {
  social: {
    title: "Social & Referral Affiliate",
    icon: Share2,
    description:
      "Everything you need to promote My Perfect Meals as a social or referral affiliate — your certification, marketing assets, your dashboard, and your referral link.",
    resources: [
      { name: "Affiliate Certification", action: "certification", description: "Complete your affiliate certification to unlock access" },
      { name: "Marketing Resources", eta: "Coming soon" },
      { name: "Monthly Marketing Packets", eta: "Coming soon" },
      { name: "Affiliate Dashboard", eta: "Unlocks after certification" },
      { name: "Referral Link Management", eta: "Unlocks after certification" },
    ],
  },
  coaching: {
    title: "Business & Coaching Affiliate",
    icon: Briefcase,
    description:
      "The full affiliate toolkit for coaches, trainers, and wellness professionals — including the Business Success Academy and Platform Certification.",
    resources: [
      { name: "Learning & Certifications", action: "learning", description: "Business Success + Platform Certifications (both required)" },
      { name: "Marketing Resources", eta: "Coming soon" },
      { name: "Monthly Marketing Packets", eta: "Coming soon" },
      { name: "Affiliate Dashboard", eta: "Unlocks after both certifications" },
      { name: "Referral Link Management", eta: "Unlocks after both certifications" },
    ],
  },
};

export default function AffiliatePathPage() {
  const [, setLocation] = useLocation();
  const [isSocial] = useRoute("/business-center/affiliate/social");
  const [isCoaching] = useRoute("/business-center/affiliate/coaching");

  const key = isSocial ? "social" : isCoaching ? "coaching" : null;
  const meta = key ? pathMeta[key] : null;

  if (!meta) return null;

  const Icon = meta.icon;

  return (
    <motion.div
      className="min-h-screen bg-gray-50 pb-28"
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
            onClick={() => setLocation("/business-center/affiliate/choose")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-base font-bold text-white truncate">{meta.title}</h1>
        </div>
      </div>

      {/* Content */}
      <div
        className="px-4 max-w-2xl mx-auto space-y-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        {/* Hero */}
        <div className="flex items-center gap-4 py-4">
          <div className="p-4 rounded-2xl bg-orange-100 flex-shrink-0">
            <Icon className="h-8 w-8 text-orange-500" />
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">{meta.description}</p>
        </div>

        {/* Resource list */}
        <div className="space-y-3">
          {meta.resources.map((resource, i) => {
            const isLive = "action" in resource;
            return isLive ? (
              <motion.button
                key={resource.name}
                className="w-full text-left flex items-center gap-4 p-4 rounded-2xl bg-orange-50 border border-orange-200 active:scale-[0.98] transition-transform"
                onClick={() => {
                  if (resource.action === "learning") {
                    setLocation("/learning");
                  } else if (resource.action === "certification") {
                    setLocation(`/business-center/affiliate/${key}/certification`);
                  }
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <div className="p-2 rounded-lg bg-orange-100 flex-shrink-0">
                  <Briefcase className="h-4 w-4 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{resource.name}</p>
                  <p className="text-xs text-orange-600">{"description" in resource ? resource.description : "Start here"}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-orange-400 flex-shrink-0" />
              </motion.button>
            ) : (
              <motion.div
                key={resource.name}
                className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-200 shadow-sm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <div className="p-2 rounded-lg bg-orange-50 flex-shrink-0">
                  <Clock className="h-4 w-4 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{resource.name}</p>
                  <p className="text-xs text-gray-500">{"eta" in resource ? resource.eta : ""}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
