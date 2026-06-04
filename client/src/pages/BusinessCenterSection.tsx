import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Clock } from "lucide-react";
import { motion } from "framer-motion";

const sectionMeta: Record<string, { title: string; description: string; eta: string }> = {
  affiliate: {
    title: "Affiliate Opportunities",
    description: "The affiliate program and certification are being finalized. Once launched, you'll be able to earn commissions, access marketing assets, and track your referrals — all inside My Perfect Meals.",
    eta: "Launching with Affiliate Certification",
  },
  academy: {
    title: "Business Success Academy",
    description: "A full curriculum for building and scaling your nutrition coaching business using the My Perfect Meals platform. Courses, assessments, and credentials — coming soon.",
    eta: "Launching with Platform Certification",
  },
  industry: {
    title: "Industry & Strategic Partnerships",
    description: "We partner with supplement companies, nutrition brands, fitness organizations, certification bodies, and software platforms to build meaningful integrations and co-branded opportunities. If your organization serves the nutrition or wellness space, we'd love to connect.",
    eta: "Contact us to explore a strategic partnership",
  },
  "white-label": {
    title: "White Label Opportunities",
    description: "Interested in licensing the My Perfect Meals platform for your organization or brand? We'd love to talk. White label partnerships are handled personally — reach out below.",
    eta: "Contact us to start a conversation",
  },
  partnerships: {
    title: "Healthcare & Clinical Partnerships",
    description: "We work with physicians, registered dietitians, clinics, hospitals, and patient-care organizations to integrate My Perfect Meals into clinical and care workflows.",
    eta: "Contact us to explore clinical partnership options",
  },
};

export default function BusinessCenterSection() {
  const [, setLocation] = useLocation();
  const [matchAffiliate] = useRoute("/business-center/affiliate");
  const [matchAcademy] = useRoute("/business-center/academy");
  const [matchIndustry] = useRoute("/business-center/industry");
  const [matchWhiteLabel] = useRoute("/business-center/white-label");
  const [matchPartnerships] = useRoute("/business-center/partnerships");

  const sectionKey = matchAffiliate ? "affiliate"
    : matchAcademy ? "academy"
    : matchIndustry ? "industry"
    : matchWhiteLabel ? "white-label"
    : matchPartnerships ? "partnerships"
    : null;

  const meta = sectionKey ? sectionMeta[sectionKey] : null;

  if (!meta) return null;

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
          <h1 className="text-lg font-bold text-white truncate">{meta.title}</h1>
        </div>
      </div>

      {/* Content */}
      <div
        className="px-4 max-w-2xl mx-auto flex flex-col items-center justify-center"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 7rem)", minHeight: "70vh" }}
      >
        <motion.div
          className="text-center space-y-6 max-w-sm"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="w-16 h-16 rounded-2xl bg-orange-500/20 flex items-center justify-center mx-auto">
            <Clock className="h-8 w-8 text-orange-400" />
          </div>
          <div className="space-y-3">
            <h2 className="text-xl font-bold text-white">{meta.title}</h2>
            <p className="text-sm text-white/60 leading-relaxed">{meta.description}</p>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3">
            <p className="text-xs text-orange-300 font-medium">{meta.eta}</p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
