import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";

export default function ProPortal() {
  const { t } = useTranslation("pro");
  const [, setLocation] = useLocation();
  const quickTour = useQuickTour("pro-portal");

  const PRO_PORTAL_TOUR_STEPS: TourStep[] = [
    {
      icon: "1",
      title: t("physicianPortal.tour.step1Title"),
      description: t("physicianPortal.tour.step1Desc"),
    },
    {
      icon: "2",
      title: t("physicianPortal.tour.step2Title"),
      description: t("physicianPortal.tour.step2Desc"),
    },
    {
      icon: "3",
      title: t("physicianPortal.tour.step3Title"),
      description: t("physicianPortal.tour.step3Desc"),
    },
    {
      icon: "4",
      title: t("physicianPortal.tour.step4Title"),
      description: t("physicianPortal.tour.step4Desc"),
    },
  ];

  return (
    <div className="min-h-screen text-white bg-gradient-to-br from-black/60 via-indigo-600 to-black/80 pb-safe-nav">
      {/* Universal Safe-Area Header */}
      <MobileHeaderGuard>
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-8 py-3 flex items-center gap-3">
          {/* Back Button */}
          <button
            onClick={() => setLocation("/dashboard")}
            className="flex items-center gap-1 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {/* Title */}
          <h1 className="text-lg font-bold text-white">{t("physicianPortal.title")}</h1>

          <div className="flex-grow" />

          {/* Quick Tour Help Button */}
          <QuickTourButton onClick={quickTour.openTour} />
        </div>
      </div>
      </MobileHeaderGuard>

      <div
        className="max-w-6xl mx-auto px-6 space-y-6"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        <Card className="bg-black/20 backdrop-blur-lg border-white/20">
          <CardHeader>
            <CardTitle className="text-2xl text-white">{t("physicianPortal.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-white/80">
                {t("physicianPortal.comingSoon")}
              </p>
              <Button
                onClick={() => setLocation("/pro/physician-clients")}
                className="w-full bg-white/10 border border-white/20 text-white hover:bg-white/20"
              >
                {t("physicianPortal.viewClients")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Tour Modal */}
      <QuickTourModal
        isOpen={quickTour.shouldShow}
        onClose={quickTour.closeTour}
        title={t("physicianPortal.tourTitle")}
        steps={PRO_PORTAL_TOUR_STEPS}
        onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
      />
    </div>
  );
}
