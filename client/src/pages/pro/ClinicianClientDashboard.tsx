import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { proStore } from "@/lib/proData";
import { apiUrl } from "@/lib/resolveApiBase";
import {
  ArrowLeft,
  Stethoscope,
  AlertCircle,
  Ruler,
} from "lucide-react";
import { useQuickTour } from "@/hooks/useQuickTour";
import { QuickTourButton } from "@/components/guided/QuickTourButton";
import { QuickTourModal, TourStep } from "@/components/guided/QuickTourModal";

const CLINICIAN_DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    icon: "1",
    title: "Clinician Workspace",
    description:
      "This workspace is designed for medical professionals to guide patient nutrition with clinical oversight.",
  },
  {
    icon: "2",
    title: "Patient Overview",
    description:
      "Here you'll see the selected patient and access their medical nutrition tools.",
  },
  {
    icon: "3",
    title: "Medical Meal Builders",
    description:
      "Use condition-specific meal builders like Diabetic, GLP-1, and Anti-Inflammatory to guide patient nutrition safely.",
  },
  {
    icon: "4",
    title: "What's Coming Next",
    description:
      "Clinical context, diagnosis tracking, and follow-up scheduling will be added here as this workspace expands.",
  },
];

export default function ClinicianClientDashboard() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/pro/clients/:id/clinician");
  const clientId = params?.id as string;

  const quickTour = useQuickTour("clinician-client-dashboard");

  const [client, setClient] = useState(() => proStore.getClient(clientId));

  interface BodyCompEntry {
    id: number;
    currentBodyFatPct: string;
    goalBodyFatPct: string | null;
    scanMethod: string;
    source: string;
    recordedAt: string;
  }
  const [bodyComp, setBodyComp] = useState<BodyCompEntry | null>(null);
  const [bodyCompSource, setBodyCompSource] = useState<string | null>(null);

  useEffect(() => {
    const c = proStore.getClient(clientId);
    if (c) setClient(c);
  }, [clientId]);

  useEffect(() => {
    const c = proStore.getClient(clientId);
    const uid = c?.userId;
    if (!uid) return;
    fetch(apiUrl(`/api/users/${uid}/body-composition/latest`))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.entry) {
          setBodyComp(data.entry);
          setBodyCompSource(data.source);
        }
      })
      .catch(() => {});
  }, [clientId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen text-white bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-safe-nav"
    >
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-2 flex-nowrap">
          <button
            onClick={() => setLocation("/care-team/physician")}
            className="flex items-center gap-1 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-base font-bold text-white truncate">
              Physicians Clinic
            </h1>
          </div>
          <QuickTourButton onClick={quickTour.openTour} />
        </div>
      </div>

      <div
        className="max-w-5xl mx-auto px-4 space-y-6 pb-16"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        <div className="rounded-2xl p-6 bg-white/5 border border-white/20">
          <p className="text-white/90 text-lg">
            {client?.name || "Client"}
          </p>
        </div>

        <Card className="bg-blue-900/20 border border-blue-400/30">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-400" /> Clinician Workspace
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-black/30 border border-blue-400/30 rounded-xl p-6 text-center">
              <Stethoscope className="h-12 w-12 text-blue-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">
                Clinician Workspace Coming Soon
              </h3>
              <p className="text-white/70 text-sm max-w-md mx-auto">
                The full clinician dashboard with clinical context, diagnosis management, 
                follow-up scheduling, and medical oversight is being developed.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Ruler className="h-5 w-5" /> Body Composition
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bodyComp ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-black/25 border border-white/10">
                    <div className="text-xs text-white/60">Body Fat</div>
                    <div className="text-lg font-bold text-white">{parseFloat(bodyComp.currentBodyFatPct).toFixed(1)}%</div>
                  </div>
                  {bodyComp.goalBodyFatPct && (
                    <div className="p-3 rounded-xl bg-black/25 border border-white/10">
                      <div className="text-xs text-white/60">Goal</div>
                      <div className="text-lg font-bold text-blue-400">{parseFloat(bodyComp.goalBodyFatPct).toFixed(1)}%</div>
                    </div>
                  )}
                  <div className="p-3 rounded-xl bg-black/25 border border-white/10">
                    <div className="text-xs text-white/60">Scan Method</div>
                    <div className="text-sm font-medium text-white">{bodyComp.scanMethod}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/50">
                  <span>Last scan: {new Date(bodyComp.recordedAt).toLocaleDateString()}</span>
                  {bodyCompSource && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                      recorded by {bodyCompSource}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-white/50 text-sm">No body composition data recorded for this patient yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/5 border border-white/20">
          <CardHeader>
            <CardTitle className="text-white">Medical Hubs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-white/70 text-sm mb-4">
              Access specialized medical meal guidance for your patient.
            </p>
            <Button
              onClick={() => {
                setLocation(`/pro/clients/${clientId}/diabetic-builder`);
              }}
              className="w-full sm:w-[400px] bg-black border border-white/20 text-white font-semibold rounded-xl shadow-lg"
            >
              Diabetic Meal Builder
            </Button>
            <Button
              onClick={() => {
                setLocation(`/pro/clients/${clientId}/glp1-builder`);
              }}
              className="w-full sm:w-[400px] bg-black border border-white/20 text-white font-semibold rounded-xl shadow-lg"
            >
              GLP-1 Meal Builder
            </Button>
            <Button
              onClick={() => {
                setLocation(`/pro/clients/${clientId}/anti-inflammatory-builder`);
              }}
              className="w-full sm:w-[400px] bg-black border border-white/20 text-white font-semibold rounded-xl shadow-lg"
            >
              Anti-Inflammatory Meal Builder
            </Button>
          </CardContent>
        </Card>
      </div>

      <QuickTourModal
        isOpen={quickTour.shouldShow}
        onClose={quickTour.closeTour}
        title="Physicians Clinic Guide"
        steps={CLINICIAN_DASHBOARD_TOUR_STEPS}
        onDisableAllTours={() => quickTour.setGlobalDisabled(true)}
      />
    </motion.div>
  );
}
