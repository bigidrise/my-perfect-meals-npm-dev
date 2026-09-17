import { useRoute } from "wouter";
import { Clock } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

export default function BusinessCenterSection() {
  const { t } = useTranslation();
  const [matchAffiliate] = useRoute("/business-center/affiliate");
  const [matchAcademy] = useRoute("/business-center/academy");
  const [matchIndustry] = useRoute("/business-center/industry");
  const [matchWhiteLabel] = useRoute("/business-center/white-label");
  const [matchPartnerships] = useRoute("/business-center/partnerships");

  const sectionKey = matchAffiliate ? "affiliate"
    : matchAcademy ? "academy"
    : matchIndustry ? "industry"
    : matchWhiteLabel ? "whiteLabel"
    : matchPartnerships ? "partnerships"
    : null;

  if (!sectionKey) return null;

  const title = t(`businessCenterSection.${sectionKey}.title`);
  const description = t(`businessCenterSection.${sectionKey}.description`);
  const eta = t(`businessCenterSection.${sectionKey}.eta`);

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black pb-28"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Content */}
      <div
        className="px-4 max-w-2xl mx-auto flex flex-col items-center justify-center"
        style={{
          paddingTop: "2rem",
          minHeight: "70vh",
        }}
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
            <h2 className="text-xl font-bold text-white">{title}</h2>
            <p className="text-sm text-gray-300 leading-relaxed">{description}</p>
          </div>
          <div className="bg-orange-500/20 border border-orange-500/30 rounded-xl px-4 py-3">
            <p className="text-xs text-orange-400 font-medium">{eta}</p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
