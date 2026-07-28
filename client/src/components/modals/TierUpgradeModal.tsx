import React from "react";
import { useTranslation } from "react-i18next";
import { UniversalDialog } from "@/components/ui/universal-modal";
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { Lock, CheckCircle2 } from "lucide-react";
import type { RequiredTier } from "@/contexts/UpgradeModalContext";

interface TierUpgradeModalProps {
  open: boolean;
  onClose: () => void;
  requiredTier: RequiredTier;
  featureName?: string;
}

export function TierUpgradeModal({ open, onClose, requiredTier, featureName }: TierUpgradeModalProps) {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const TIER_CONFIG: Record<RequiredTier, { label: string; badgeLabel?: string; tagline: string; benefits: string[] }> = {
    essential: {
      label: t("upgrade.essentialPlan"),
      tagline: t("upgrade.essentialTagline"),
      benefits: [
        "Create a Dish — AI meals tailored to your exact nutritional protocols",
        "Shopping List, Saved Meals & Weekly Meal Planner",
        "Recipe Scan, Snack Creator & Unlimited Fridge Rescue",
      ],
    },
    pro: {
      label: t("upgrade.proPlan"),
      tagline: t("upgrade.proTagline"),
      benefits: [
        "Craving Creator, Beverage Creator & Sushi Creator",
        "Restaurant Assistant — protocol-aware ordering at any restaurant",
        "My Perfect Gatherings & My Perfect Pets nutrition plans",
      ],
    },
    clinical: {
      label: t("upgrade.clinicalPlan"),
      tagline: t("upgrade.clinicalTagline"),
      benefits: [
        "Clinical Lab Integration — your blood work shapes your meal protocols",
        "Care Team Access — connect with a physician or trainer in-app",
        "Performance Nutrition, Competition Prep & Athlete Builders",
      ],
    },
    "meal-builders": {
      label: "Essential, Pro & Clinical",
      badgeLabel: t("upgrade.mostPopular"),
      tagline: t("upgrade.proPromo"),
      benefits: [
        "Craving Creator, Beverage Creator, Dessert Creator & Sushi Creator",
        "Meal Builder Exchange — switch builders anytime as your goals evolve",
        "Restaurant Assistant, My Perfect Gatherings & expanded lifestyle tools",
        "Essential gets you started · Clinical adds medical-grade nutrition tools",
      ],
    },
  };

  const config = TIER_CONFIG[requiredTier];

  const handleViewPlans = () => {
    onClose();
    setLocation("/pricing");
  };

  const handleDismiss = () => {
    onClose();
    setLocation("/dashboard");
  };

  return (
    <UniversalDialog rawLayout open={open} onOpenChange={(isOpen) => { if (!isOpen) handleDismiss(); }} className="max-w-sm mx-auto bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 border-white/10 rounded-2xl">
        <DialogHeader className="text-center items-center">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center">
              <Lock className="w-7 h-7 text-orange-400" />
            </div>
          </div>
          <div className="flex justify-center mb-2">
            <span className="px-3 py-1 rounded-full bg-orange-600/20 border border-orange-500/30 text-orange-400 text-xs font-semibold tracking-wide">
              {config.badgeLabel ?? `${config.label} Plan`}
            </span>
          </div>
          <DialogTitle className="text-lg font-bold text-white leading-snug">
            {featureName
              ? `${featureName} is part of ${config.label}`
              : `Available on ${config.label}`}
          </DialogTitle>
          <DialogDescription className="text-white/55 text-sm mt-1">
            {config.tagline}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 bg-white/5 rounded-xl p-4 border border-white/10 space-y-3">
          {config.benefits.map((benefit, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
              <span className="text-xs text-white/80 leading-relaxed">{benefit}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 mt-4">
          <button
            onClick={handleViewPlans}
            className="w-full py-3 rounded-xl bg-orange-600 text-white font-semibold text-sm transition-colors active:bg-orange-700"
          >
            {t("upgrade.viewPlans")}
          </button>
          <button
            onClick={handleDismiss}
            className="w-full py-2.5 rounded-xl bg-white/5 text-white/55 text-sm transition-colors active:bg-white/10"
          >
            {t("upgrade.maybeLater")}
          </button>
        </div>
    </UniversalDialog>
  );
}

export default TierUpgradeModal;
