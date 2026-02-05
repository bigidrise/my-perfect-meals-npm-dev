// client/src/pages/GuestBuilder.tsx
// Apple App Review Compliant: Guest Experience with Real Talking Copilot

import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  Sparkles,
  UserPlus,
  Calculator,
  Calendar,
  Refrigerator,
  Heart,
  Home,
  BarChart3,
  ShoppingCart,
  ChefHat,
  Pill,
  Stethoscope,
  Leaf,
} from "lucide-react";
import { GUEST_SUITE_BRANDING } from "@/lib/guestSuiteBranding";
import { GuestModeBanner } from "@/components/GuestModeBanner";
import { ChefCapIcon } from "@/components/copilot/ChefCapIcon";
import { useCopilot } from "@/components/copilot/CopilotContext";
import { getGuestPageExplanation } from "@/components/copilot/CopilotPageExplanations";
import { CopilotExplanationStore } from "@/components/copilot/CopilotExplanationStore";
import {
  isGuestMode,
  endGuestSession,
  GuestFeature,
} from "@/lib/guestMode";
import { useGuestProgress } from "@/hooks/useGuestProgress";
import { hasCompletedFirstLoop } from "@/lib/guestSuiteNavigator";
import { Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GuestUpgradePromptModal } from "@/components/modals/GuestUpgradePromptModal";
import { MedicalSourcesInfo } from "@/components/MedicalSourcesInfo";
import { isFeatureEnabled } from "@/lib/productionGates";

interface ActionButton {
  id: string;
  label: string;
  description: string;
  lockedDescription?: string;
  icon: React.ReactNode;
  iconColor: string;
  route: string;
  feature: GuestFeature;
  phase1Only?: boolean;
  phase2Only?: boolean;
  isPreview?: boolean;
  isSignature?: boolean;
  signatureBadge?: string;
}

const PHASE_1_BUTTONS: ActionButton[] = [
  {
    id: "macros",
    label: GUEST_SUITE_BRANDING.features.macroCalculator.label,
    description: GUEST_SUITE_BRANDING.features.macroCalculator.description,
    lockedDescription: GUEST_SUITE_BRANDING.features.macroCalculator.lockedDescription,
    icon: <Calculator className="h-6 w-6" />,
    iconColor: "text-orange-400",
    route: "/macro-counter",
    feature: "macro-calculator",
    phase1Only: true,
  },
  {
    id: "create",
    label: GUEST_SUITE_BRANDING.features.weeklyMealBuilder.label,
    description: GUEST_SUITE_BRANDING.features.weeklyMealBuilder.description,
    lockedDescription: GUEST_SUITE_BRANDING.features.weeklyMealBuilder.lockedDescription,
    icon: <Calendar className="h-6 w-6" />,
    iconColor: "text-orange-400",
    route: "/weekly-meal-board",
    feature: "weekly-meal-builder",
    phase1Only: true,
  },
  {
    id: "glp1",
    label: "GLP-1 Meal Builder",
    description: "Meals designed for GLP-1 medication users with smaller portions",
    lockedDescription: "Complete macros to unlock",
    icon: <Pill className="h-6 w-6" />,
    iconColor: "text-teal-400",
    route: "/glp1-meal-builder",
    feature: "macro-calculator",
    phase1Only: true,
  },
  {
    id: "diabetic",
    label: "Diabetic Menu Builder",
    description: "Blood sugar friendly meals with balanced carbs",
    lockedDescription: "Complete macros to unlock",
    icon: <Stethoscope className="h-6 w-6" />,
    iconColor: "text-blue-400",
    route: "/diabetic-menu-builder",
    feature: "macro-calculator",
    phase1Only: true,
  },
  {
    id: "anti-inflammatory",
    label: "Anti-Inflammatory Builder",
    description: "Reduce inflammation with healing whole foods",
    lockedDescription: "Complete macros to unlock",
    icon: <Leaf className="h-6 w-6" />,
    iconColor: "text-green-400",
    route: "/anti-inflammatory-menu-builder",
    feature: "macro-calculator",
    phase1Only: true,
  },
];

const PHASE_2_BUTTONS: ActionButton[] = [
  {
    id: "biometrics",
    label: GUEST_SUITE_BRANDING.features.biometrics.label,
    description: GUEST_SUITE_BRANDING.features.biometrics.description,
    lockedDescription: GUEST_SUITE_BRANDING.features.biometrics.lockedDescription,
    icon: <BarChart3 className="h-6 w-6" />,
    iconColor: "text-lime-400",
    route: "/my-biometrics",
    feature: "biometrics",
    phase2Only: true,
  },
  {
    id: "shopping",
    label: GUEST_SUITE_BRANDING.features.shoppingList.label,
    description: GUEST_SUITE_BRANDING.features.shoppingList.description,
    lockedDescription: GUEST_SUITE_BRANDING.features.shoppingList.lockedDescription,
    icon: <ShoppingCart className="h-6 w-6" />,
    iconColor: "text-blue-400",
    route: "/shopping-list",
    feature: "shopping-list",
  },
  {
    id: "fridge",
    label: GUEST_SUITE_BRANDING.features.fridgeRescue.label,
    description: GUEST_SUITE_BRANDING.features.fridgeRescue.description,
    lockedDescription: GUEST_SUITE_BRANDING.features.fridgeRescue.lockedDescription,
    icon: <Refrigerator className="h-6 w-6" />,
    iconColor: "text-orange-400",
    route: "/fridge-rescue",
    feature: "fridge-rescue",
    isPreview: true,
  },
  {
    id: "craving",
    label: GUEST_SUITE_BRANDING.features.cravingCreator.label,
    description: GUEST_SUITE_BRANDING.features.cravingCreator.description,
    lockedDescription: GUEST_SUITE_BRANDING.features.cravingCreator.lockedDescription,
    icon: <Heart className="h-6 w-6" />,
    iconColor: "text-pink-400",
    route: "/craving-creator",
    feature: "craving-creator",
    isSignature: true,
    signatureBadge: "Powered by Emotion AI™",
  },
  {
    id: "chefs-kitchen",
    label: GUEST_SUITE_BRANDING.features.chefsKitchen.label,
    description: GUEST_SUITE_BRANDING.features.chefsKitchen.description,
    lockedDescription: GUEST_SUITE_BRANDING.features.chefsKitchen.lockedDescription,
    icon: <ChefHat className="h-6 w-6" />,
    iconColor: "text-amber-400",
    route: "/lifestyle/chefs-kitchen",
    feature: "chefs-kitchen",
    isSignature: true,
    signatureBadge: "Powered by Emotion AI™",
  },
];

export default function GuestBuilder() {
  const [, setLocation] = useLocation();
  const { open, isOpen, setLastResponse } = useCopilot();
  const hasAutoOpenedRef = useRef(false);
  const { 
    isFeatureUnlocked, 
    getUnlockMessage, 
    nextStepMessage, 
    shouldShowUpgrade, 
    generationsRemaining, 
    daysRemaining,
    phase,
    showSoftNudge,
    showHardGate,
    biometricsRevealed,
  } = useGuestProgress();
  const { toast } = useToast();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [hasShownPhase2Toast, setHasShownPhase2Toast] = useState(false);
  const [firstLoopComplete, setFirstLoopComplete] = useState(() => hasCompletedFirstLoop());
  
  useEffect(() => {
    const handleProgressUpdate = (event: CustomEvent) => {
      if (event.detail?.action === "firstLoopComplete") {
        setFirstLoopComplete(true);
      }
    };
    
    window.addEventListener("guestProgressUpdate", handleProgressUpdate as EventListener);
    return () => window.removeEventListener("guestProgressUpdate", handleProgressUpdate as EventListener);
  }, []);

  useEffect(() => {
    if (!isGuestMode()) {
      setLocation("/welcome");
      return;
    }

    const hasSeenWelcome = sessionStorage.getItem("guest_copilot_welcome_seen");
    if (!hasSeenWelcome && !hasAutoOpenedRef.current) {
      hasAutoOpenedRef.current = true;
      const timer = setTimeout(() => {
        const explanation = getGuestPageExplanation("/guest-builder", true);
        if (explanation) {
          CopilotExplanationStore.resetPath("/guest-builder");
          open();
          setTimeout(() => {
            setLastResponse({
              title: explanation.title,
              description: explanation.description,
              spokenText: explanation.spokenText,
              autoClose: explanation.autoClose,
            });
          }, 300);
        }
        sessionStorage.setItem("guest_copilot_welcome_seen", "true");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [setLocation, open, setLastResponse]);

  useEffect(() => {
    if (shouldShowUpgrade && !showUpgradeModal) {
      const hasSeenUpgradePrompt = sessionStorage.getItem("guest_upgrade_prompt_seen");
      if (!hasSeenUpgradePrompt) {
        setShowUpgradeModal(true);
        sessionStorage.setItem("guest_upgrade_prompt_seen", "true");
      }
    }
  }, [shouldShowUpgrade, showUpgradeModal]);

  // Show Phase 2 reveal toast when biometrics becomes available
  useEffect(() => {
    if (biometricsRevealed && !hasShownPhase2Toast) {
      const hasSeenReveal = sessionStorage.getItem("guest_phase2_reveal_seen");
      if (!hasSeenReveal) {
        toast({
          title: GUEST_SUITE_BRANDING.phase2.biometricsRevealToast,
          description: "Explore your nutrition data and more features",
          duration: 5000,
        });
        sessionStorage.setItem("guest_phase2_reveal_seen", "true");
        setHasShownPhase2Toast(true);
      }
    }
  }, [biometricsRevealed, hasShownPhase2Toast, toast]);

  const handleCreateAccount = () => {
    endGuestSession();
    setLocation("/auth");
  };

  const handleActionClick = (action: ActionButton) => {
    const unlocked = isFeatureUnlocked(action.feature);
    
    if (!unlocked) {
      toast({
        title: "Feature Locked",
        description: getUnlockMessage(action.feature),
        duration: 4000,
      });
      return;
    }
    
    setLocation(action.route);
  };

  const handleChefClick = () => {
    const explanation = getGuestPageExplanation("/guest-builder", true);
    if (explanation) {
      CopilotExplanationStore.resetPath("/guest-builder");
      open();
      setTimeout(() => {
        setLastResponse({
          title: explanation.title,
          description: explanation.description,
          spokenText: explanation.spokenText,
          autoClose: explanation.autoClose,
        });
      }, 300);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 text-white pb-32"
    >
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            onClick={() => setLocation("/welcome")}
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-lime-400" />
              {GUEST_SUITE_BRANDING.headerTitle}
            </h1>
          </div>
          <MedicalSourcesInfo asPillButton />
        </div>
      </div>

      <div
        className="max-w-2xl mx-auto px-4 space-y-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        <GuestModeBanner variant="full" />

        <Card className="bg-zinc-900/60 border border-white/10">
          <CardContent className="p-5">
            <h2 className="text-xl font-bold text-white mb-2">
              {GUEST_SUITE_BRANDING.heroTitle}
            </h2>
            <p className="text-white/70 text-sm">
              {GUEST_SUITE_BRANDING.heroSubtitle}
            </p>
            <p className="text-white/50 text-xs mt-2">
              {GUEST_SUITE_BRANDING.heroDescription}
            </p>
          </CardContent>
        </Card>

        {/* Phase 1 - Guided Build */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide px-1">
            {GUEST_SUITE_BRANDING.phase1.sectionTitle}
          </h3>

          {PHASE_1_BUTTONS.map((action) => {
            const unlocked = isFeatureUnlocked(action.feature);
            
            return (
              <Card
                key={action.id}
                className={`border transition-all cursor-pointer ${
                  unlocked 
                    ? "bg-zinc-900/40 border-white/10 hover:border-white/20 hover:bg-zinc-800/40" 
                    : "bg-zinc-900/20 border-white/5 opacity-60"
                }`}
                onClick={() => handleActionClick(action)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-xl flex items-center justify-center bg-white/10 ${
                      unlocked ? action.iconColor : "text-white/40"
                    }`}
                  >
                    {unlocked ? action.icon : <Lock className="h-6 w-6" />}
                  </div>
                  <div className="flex-1">
                    <div className={`font-semibold ${unlocked ? "text-white" : "text-white/50"}`}>
                      {action.label}
                      {!unlocked && (
                        <Lock className="inline-block h-3.5 w-3.5 ml-2 text-white/40" />
                      )}
                    </div>
                    <div className={`text-sm mt-0.5 ${unlocked ? "text-white/60" : "text-white/40"}`}>
                      {unlocked ? action.description : (action.lockedDescription || getUnlockMessage(action.feature))}
                    </div>
                  </div>
                  <div className={unlocked ? "text-white/30" : "text-white/20"}>
                    {unlocked ? (
                      <ArrowLeft className="h-4 w-4 rotate-180" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Phase 2 - Additional Tools (always visible, unlocked progressively) */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-lime-400/80 uppercase tracking-wide px-1 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            {GUEST_SUITE_BRANDING.phase2.sectionTitle}
          </h3>

          {PHASE_2_BUTTONS.map((action) => {
            const unlocked = isFeatureUnlocked(action.feature);
            const isRevealed = action.id === "biometrics" && biometricsRevealed;
            const isChefsKitchen = action.feature === "chefs-kitchen";
            const isCravingCreator = action.feature === "craving-creator";
            const isSignatureCard = isChefsKitchen || isCravingCreator;

            const getCardStyle = () => {
              if (unlocked) {
                if (isChefsKitchen) return "bg-gradient-to-br from-amber-900/30 via-orange-900/20 to-zinc-900/40 border-amber-500/40 ring-1 ring-amber-500/20";
                if (isCravingCreator) return "bg-gradient-to-br from-pink-900/30 via-purple-900/20 to-zinc-900/40 border-pink-500/40 ring-1 ring-pink-500/20";
                if (isRevealed) return "bg-lime-900/20 border-lime-500/30 ring-1 ring-lime-500/20";
                return "bg-zinc-900/40 border-white/10";
              }
              if (isChefsKitchen) return "bg-zinc-900/30 border-amber-500/20 opacity-70";
              if (isCravingCreator) return "bg-zinc-900/30 border-pink-500/20 opacity-70";
              return "bg-zinc-900/20 border-white/5 opacity-60";
            };

            const getIconStyle = () => {
              if (unlocked) {
                if (isChefsKitchen) return "bg-amber-500/20 shadow-inner shadow-amber-500/10";
                if (isCravingCreator) return "bg-pink-500/20 shadow-inner shadow-pink-500/10";
                if (isRevealed) return "bg-lime-500/20";
              }
              return "bg-white/10";
            };
            
            return (
              <Card
                key={action.id}
                className={`border transition-all cursor-pointer relative overflow-hidden ${getCardStyle()}`}
                onClick={() => handleActionClick(action)}
              >
                {isChefsKitchen && (
                  <div className="absolute top-2 right-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-black via-orange-600 to-black rounded-full border border-orange-400/30 shadow-lg">
                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-pulse"></div>
                    <span className="text-white font-semibold text-[9px]">
                      {action.signatureBadge}
                    </span>
                  </div>
                )}
                {isCravingCreator && (
                  <div className="absolute top-2 right-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-black via-pink-600 to-black rounded-full border border-pink-400/30 shadow-lg">
                    <div className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-pulse"></div>
                    <span className="text-white font-semibold text-[9px]">
                      {action.signatureBadge}
                    </span>
                  </div>
                )}
                <CardContent className="p-4 flex items-center gap-4">
                  <div
                    className={`w-14 h-14 rounded-xl flex items-center justify-center ${getIconStyle()} ${unlocked ? action.iconColor : "text-white/40"}`}
                  >
                    {unlocked ? action.icon : <Lock className="h-6 w-6" />}
                  </div>
                  <div className="flex-1">
                    <div className={`font-semibold ${unlocked ? "text-white" : "text-white/50"}`}>
                      {action.label}
                      {action.isPreview && unlocked && !isSignatureCard && (
                        <span className="text-xs text-amber-400/80 ml-2">Preview</span>
                      )}
                      {!unlocked && (
                        <Lock className="inline-block h-3.5 w-3.5 ml-2 text-white/40" />
                      )}
                    </div>
                    <div className={`text-sm mt-0.5 ${unlocked ? "text-white/60" : "text-white/40"}`}>
                      {unlocked ? action.description : (action.lockedDescription || getUnlockMessage(action.feature))}
                    </div>
                  </div>
                  <div className={unlocked ? "text-white/30" : "text-white/20"}>
                    {unlocked ? (
                      <ArrowLeft className="h-4 w-4 rotate-180" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Soft nudge banner (at loop 3) */}
        {showSoftNudge && !showHardGate && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/15 border border-amber-400/30"
          >
            <div className="text-sm font-medium text-amber-300">
              {GUEST_SUITE_BRANDING.loopLimits.softNudgeBanner}
            </div>
            <button 
              onClick={handleCreateAccount}
              className="mt-2 text-xs text-white/70 hover:text-white underline"
            >
              Create a free account to continue
            </button>
          </motion.div>
        )}

        {/* Hard gate modal (at loop 4) */}
        {showHardGate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-zinc-900 border border-white/20 rounded-3xl p-6 max-w-md w-full text-center shadow-2xl"
            >
              <div className="w-16 h-16 rounded-full bg-lime-500/20 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-8 w-8 text-lime-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">
                {GUEST_SUITE_BRANDING.loopLimits.hardGateTitle}
              </h2>
              <p className="text-white/70 text-sm mb-6">
                {GUEST_SUITE_BRANDING.loopLimits.hardGateDescription}
              </p>
              <div className="flex flex-col gap-3">
                <Button
                  onClick={handleCreateAccount}
                  className="w-full bg-lime-600 hover:bg-lime-700 text-white font-semibold py-3"
                >
                  {GUEST_SUITE_BRANDING.loopLimits.createAccountButton}
                </Button>
                <Button
                  onClick={() => setLocation("/pricing")}
                  variant="outline"
                  className="w-full border-white/20 text-white hover:bg-white/10"
                >
                  {GUEST_SUITE_BRANDING.loopLimits.comparePlansButton}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {generationsRemaining > 0 && !shouldShowUpgrade && (
          <div className="text-center text-white/40 text-xs py-4">
            {generationsRemaining} AI generation{generationsRemaining !== 1 ? "s" : ""} remaining in
            guest mode
          </div>
        )}
        
        {shouldShowUpgrade && (
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="w-full mt-4 p-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/15 border border-amber-400/30 text-center"
          >
            <div className="text-sm font-semibold text-amber-300">
              You've used your guest meals
            </div>
            <div className="text-xs text-white/60 mt-1">
              Tap here to create a free account and continue
            </div>
          </button>
        )}
      </div>

      {/* Guest Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/70 backdrop-blur-xl border-t border-white/10 shadow-2xl pb-[var(--safe-bottom)]">
        <div className="max-w-screen-xl mx-auto px-4">
          <div className="relative h-12 flex items-center justify-between">
            {/* LEFT - Back to Welcome */}
            <div className="flex items-center justify-start flex-1">
              <button
                onClick={() => setLocation("/welcome")}
                className="flex items-center justify-center px-4 h-full text-gray-400 hover:text-white transition-all duration-300"
                style={{ flexDirection: "column" }}
              >
                <Home className="h-4 w-4" />
                <span className="text-[11px] mt-0.5 font-medium">Welcome</span>
              </button>
            </div>

            {/* CENTER - Chef Copilot Button */}
            <div className="absolute left-1/2 -translate-x-1/2 top-2 z-10">
              <motion.button
                onClick={handleChefClick}
                className="flex items-center justify-center w-14 h-14 rounded-full bg-black/70 border-2 border-white/15 backdrop-blur-xl shadow-lg shadow-orange-500/60 hover:shadow-orange-500/100 hover:border-orange-400/100 transition-all duration-300"
                whileTap={{ scale: 0.92 }}
                whileHover={{ y: -2, scale: 1.08 }}
                style={{
                  boxShadow:
                    "0 0 15px rgba(251,146,60,0.3), 0 0 25px rgba(251,146,60,0.2)",
                }}
              >
                <ChefCapIcon size={54} />
              </motion.button>
            </div>

            {/* RIGHT - Sign Up */}
            <div className="flex items-center justify-end flex-1">
              <button
                onClick={handleCreateAccount}
                className="flex items-center justify-center px-4 h-full text-lime-400 hover:text-lime-300 transition-all duration-300"
                style={{ flexDirection: "column" }}
              >
                <UserPlus className="h-4 w-4" />
                <span className="text-[11px] mt-0.5 font-medium">Sign Up</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <GuestUpgradePromptModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        reason={daysRemaining <= 0 ? "expired" : "limit"}
      />
    </motion.div>
  );
}
