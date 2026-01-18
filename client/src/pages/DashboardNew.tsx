 import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Calculator,
  ShoppingCart,
  Lightbulb,
  Activity,
  User,
  TrendingUp,
  Flame,
  Camera,
} from "lucide-react";
import { ProfileSheet } from "@/components/ProfileSheet";
import { MedicalSourcesInfo } from "@/components/MedicalSourcesInfo";
import { HubControlIcon } from "@/components/icons/HubControlIcon";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useCopilot } from "@/components/copilot/CopilotContext";

interface FeatureCard {
  title: string;
  description: string;
  icon: any;
  route: string;
  size: "large" | "small";
  testId: string;
}

// Placeholder for todayMacros - this would typically come from a query or state management
const todayMacros = {
  protein: 50,
  carbs: 150,
  fat: 70,
};
export default function DashboardNew() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showScanner, setShowScanner] = useState(false);
  const [isGuidedMode, setIsGuidedMode] = useState(false);
  const { open: openCopilot } = useCopilot();

  const handlePhotoLog = () => {
    setLocation("/my-biometrics?capture=1");
  };

  useEffect(() => {
    document.title = "Home | My Perfect Meals";
    window.scrollTo({ top: 0, behavior: "instant" });

    const coachMode = localStorage.getItem("coachMode");
    setIsGuidedMode(coachMode === "guided");
  }, []);

  // =========================================
  // AUTO-OPEN COPILOT INTRO - Guided Mode Only
  // =========================================
  useEffect(() => {
    const triggerFlag = localStorage.getItem("trigger-copilot-intro");
    
    if (triggerFlag === "true") {
      // Open Copilot sheet - use minimal delay to preserve user gesture context
      // CopilotSheet will handle flag removal and intro playback
      setTimeout(() => {
        openCopilot(); // Open the Copilot sheet
      }, 100); // 100ms delay - short enough to preserve user gesture for audio autoplay
    }
  }, [openCopilot]);

  // Use the authenticated user's name for greeting
  const firstName = user?.name?.split(" ")[0] || "there";

  const features: FeatureCard[] = [
    {
      title: "Macro Calculator",
      description: "Precision macro targeting",
      icon: Calculator,
      route: "/macro-counter",
      size: "large",
      testId: "macro-calculator", // Updated testId for tour
    },
    {
      title: "My Biometrics",
      description: "Track your health metrics",
      icon: Activity,
      route: "/my-biometrics",
      size: "large",
      testId: "biometrics", // Updated testId for tour
    },
    {
      title: "Get Inspiration",
      description: "Daily motivation",
      icon: Lightbulb,
      route: "/get-inspiration",
      size: "small",
      testId: "card-inspiration",
    },
  ];

  const handleCardClick = (route: string) => {
    setLocation(route);
  };

  // Handler for when food is found via barcode scanner
  const handleFoodFound = (foodData: any) => {
    console.log("Food found:", foodData);
    // Here you would typically process foodData:
    // 1. Save to draft (if applicable)
    // 2. Navigate to biometrics with the found food data
    // For now, let's just navigate to biometrics and close the scanner
    setLocation("/my-biometrics"); // Navigate to biometrics
    setShowScanner(false); // Close the scanner modal
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-full flex flex-col bg-black pb-safe-nav"
    >
      {/* Fixed My Hub - Top Right */}
      <div
        className="fixed right-4 z-50"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
      >
        <ProfileSheet>
          <button
            className="p-2 bg-black/50 backdrop-blur-sm border border-white/10 rounded-lg hover:bg-black/70 hover:border-orange-500/30 transition-all"
            data-testid="button-my-hub"
          >
            <HubControlIcon size="md" />
          </button>
        </ProfileSheet>
      </div>


      {/* Header Banner */}
      <div
        className="fixed left-0 right-0 z-40 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 h-16 flex items-center justify-center">
          <h1 className="text-md font-bold text-white">MPM</h1>
        </div>
      </div>


      {/* Main Content */}
      {/* Main Content */}
      <div
        className="max-w-6xl mx-auto px-4 pb-32 flex flex-col gap-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >

        {/* Hero Image Section with Welcome Text */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mb-4"
        >
          <div className="relative h-48 lg:h-64 rounded-xl overflow-hidden">
            <img
              src="/images/home-hero.jpg"
              alt="My Perfect Meals Dashboard"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <h2 className="text-2xl lg:text-4xl font-bold text-white mb-2">
                Welcome back, {firstName}! 👋
              </h2>
              <p className="text-white/90 text-sm lg:text-base mb-4">
                Ready to hit your macro goals today?
              </p>

              {/* Quick Stats - Real Macro Data */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center p-2 lg:p-3 rounded-lg bg-black/30 backdrop-blur-sm border border-white/10">
                  <Flame className="h-4 w-4 lg:h-5 lg:w-5 text-blue-500 mb-1" />
                  <div className="text-xs text-white/60">Protein</div>
                  <div className="text-sm lg:text-lg font-bold text-white">
                    {Math.round(todayMacros.protein)}g
                  </div>
                </div>
                <div className="flex flex-col items-center p-2 lg:p-3 rounded-lg bg-black/30 backdrop-blur-sm border border-white/10">
                  <TrendingUp className="h-4 w-4 lg:h-5 lg:w-5 text-orange-500 mb-1" />
                  <div className="text-xs text-white/60">Carbs</div>
                  <div className="text-sm lg:text-lg font-bold text-white">
                    {Math.round(todayMacros.carbs)}g
                  </div>
                </div>
                <div className="flex flex-col items-center p-2 lg:p-3 rounded-lg bg-black/30 backdrop-blur-sm border border-white/10">
                  <Activity className="h-4 w-4 lg:h-5 lg:w-5 text-purple-500 mb-1" />
                  <div className="text-xs text-white/60">Fat</div>
                  <div className="text-sm lg:text-lg font-bold text-white">
                    {Math.round(todayMacros.fat)}g
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Medical Safety & Sources Card - Apple App Store Compliance (Guideline 1.4.1) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="mb-4"
        >
          <MedicalSourcesInfo
            trigger={
              <Card
                className="cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(59,130,246,0.35)] active:scale-95 bg-black/30 backdrop-blur-lg border border-white/10 hover:border-blue-400/50 rounded-xl group"
                data-testid="card-medical-safety"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-700/20 border border-blue-500/30">
                      <Activity className="h-6 w-6 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-white text-lg">
                        Sources & Medical Information
                      </CardTitle>
                      <CardDescription className="text-white/70 text-sm mt-1">
                        NIH · USDA · WHO · ADA
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            }
          />
        </motion.div>

        {/* Shopping List Quick Access Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mb-4"
        >
          <Card
            className="cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(249,115,22,0.4)] active:scale-95 bg-black/30 backdrop-blur-lg border border-white/10 hover:border-orange-500/50 rounded-xl group"
            onClick={() => setLocation("/shopping-list-v2")}
            data-testid="card-shopping-list"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-700/20 border border-orange-500/30 group-hover:from-orange-500/30 group-hover:to-orange-700/30 transition-all">
                  <ShoppingCart className="h-6 w-6 text-orange-500" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-white text-lg">
                    Master Shopping List
                  </CardTitle>
                  <CardDescription className="text-white/70 text-sm mt-1">
                    Smart grocery list manager
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </motion.div>

        {/* Quick Log from Photo Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.5 }}
          className="mb-4"
        >
          <Card
            className="cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(249,115,22,0.4)] active:scale-95 bg-black/30 backdrop-blur-lg border border-white/10 hover:border-orange-500/50 rounded-xl group"
            onClick={handlePhotoLog} // Use the new photo log handler
            data-testid="card-photo-log"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-700/20 border border-orange-500/30 group-hover:from-orange-500/30 group-hover:to-orange-700/30 transition-all">
                  <Camera className="h-6 w-6 text-orange-500" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-white text-lg">
                    MacroScan
                  </CardTitle>
                  <CardDescription className="text-white/70 text-sm mt-1">
                    Scan nutrition. Log macros instantly
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </motion.div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isMacroCalculator = feature.testId === "macro-calculator";
            const shouldFlash = isGuidedMode && isMacroCalculator;

            return (
              <motion.div
                key={feature.testId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1, duration: 0.5 }}
                className={
                  feature.size === "large" ? "md:col-span-1" : "md:col-span-1"
                }
              >
                <Card
                  onClick={() => handleCardClick(feature.route)}
                  className={`cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(249,115,22,0.4)] active:scale-95 bg-black/30 backdrop-blur-lg border border-white/10 hover:border-orange-500/50 rounded-xl group ${shouldFlash ? "flash-border" : ""}`}
                  data-testid={feature.testId}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-700/20 border border-orange-500/30 group-hover:from-orange-500/30 group-hover:to-orange-700/30 transition-all">
                        <Icon className="h-6 w-6 text-orange-500" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          {feature.title}
                        </h3>
                        <p className="text-sm text-white/70">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom CTA Section - Go to Planner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.5 }}
        >
          <Card className="bg-black/30 backdrop-blur-lg border border-white/10 hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] transition-all">
            <CardContent className="p-6 text-center">
              <h3 className="text-white font-semibold mb-2">
                Ready to Plan Your Meals?
              </h3>
              <p className="text-white/70 text-sm mb-4">
                Start building your perfect week with AI-powered meal planning
              </p>
              <button
                onClick={() => setLocation("/planner")}
                className="px-6 py-2 bg-gradient-to-r from-orange-500 to-orange-700 hover:from-orange-600 hover:to-orange-800 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl"
                data-testid="button-go-to-planner"
              >
                Go to Planner
              </button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Barcode Scanner Modal - This will be removed or modified based on the new requirements */}
      {/* Removed the BarcodeScanner card and its onClick handler from the dashboard.
          The BarcodeScanner component itself might still be used in the shopping list feature. */}

    </motion.div>
  );
}
