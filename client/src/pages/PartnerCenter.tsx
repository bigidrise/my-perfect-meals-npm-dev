import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, QrCode, Megaphone, BookOpen } from "lucide-react";
import { motion } from "framer-motion";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";
import ReferralTools from "@/components/partner-center/ReferralTools";
import MonthlyMarketing from "@/components/partner-center/MonthlyMarketing";
import MessagingGuide from "@/components/partner-center/MessagingGuide";

const TABS = [
  { id: "referral", label: "Referral Tools", icon: QrCode },
  { id: "marketing", label: "Monthly Marketing", icon: Megaphone },
  { id: "guidelines", label: "Messaging Guide", icon: BookOpen },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function PartnerCenter() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>("referral");

  return (
    <motion.div
      className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} pb-28`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Fixed header — flush to top with no gap */}
      <div
        className={BC_HEADER}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => setLocation("/business-center")}
            className="flex items-center gap-1.5 text-orange-400 text-sm font-medium active:scale-[0.95] transition-transform"
          >
            <ArrowLeft className="h-4 w-4" />
            Business Suite
          </button>
          <h1 className="text-lg font-bold text-white">Partner Center</h1>
        </div>

        {/* Tab bar */}
        <div className="px-4 pb-2 max-w-2xl mx-auto">
          <div className="flex gap-1 bg-white/5 rounded-xl p-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    active
                      ? "bg-orange-500 text-white shadow"
                      : "text-white/50 hover:text-white/80"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab content — padded to clear the two-row fixed header */}
      <div
        className="px-4 max-w-2xl mx-auto"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 7.5rem)" }}
      >
        {activeTab === "referral" && <ReferralTools />}
        {activeTab === "marketing" && <MonthlyMarketing />}
        {activeTab === "guidelines" && <MessagingGuide />}
      </div>
    </motion.div>
  );
}
