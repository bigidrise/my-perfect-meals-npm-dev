import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { proStore } from "@/lib/proData";
import {
  ArrowLeft,
  Stethoscope,
  AlertCircle,
} from "lucide-react";

export default function ClinicianClientDashboard() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/pro/clients/:id/clinician");
  const clientId = params?.id as string;

  const [client, setClient] = useState(() => proStore.getClient(clientId));

  useEffect(() => {
    const c = proStore.getClient(clientId);
    if (c) setClient(c);
  }, [clientId]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen text-white bg-gradient-to-br from-black/60 via-blue-700 to-black/80 pb-safe-nav"
    >
      <div
        className="fixed left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-2 flex-nowrap">
          <button
            onClick={() => setLocation("/care-team")}
            className="flex items-center gap-1 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Stethoscope className="h-5 w-5 text-blue-400 flex-shrink-0" />
            <h1 className="text-base font-bold text-white truncate">
              Clinician Dashboard
            </h1>
          </div>
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
            <CardTitle className="text-white">Medical Hubs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-white/70 text-sm mb-4">
              Access specialized medical meal guidance for your patient.
            </p>
            <Button
              onClick={() => {
                localStorage.setItem("pro-client-id", clientId);
                setLocation("/diabetic-hub");
              }}
              className="w-full sm:w-[400px] bg-amber-600 hover:bg-amber-700 border border-white/20 text-white font-semibold rounded-xl shadow-lg"
            >
              Diabetic Hub
            </Button>
            <Button
              onClick={() => {
                localStorage.setItem("pro-client-id", clientId);
                setLocation("/glp1-hub");
              }}
              className="w-full sm:w-[400px] bg-purple-600 hover:bg-purple-700 border border-white/20 text-white font-semibold rounded-xl shadow-lg"
            >
              GLP-1 Hub
            </Button>
            <Button
              onClick={() => {
                localStorage.setItem("pro-client-id", clientId);
                setLocation(`/pro/clients/${clientId}/anti-inflammatory-builder`);
              }}
              className="w-full sm:w-[400px] bg-emerald-600 hover:bg-emerald-700 border border-white/20 text-white font-semibold rounded-xl shadow-lg"
            >
              Anti-Inflammatory Menu Builder
            </Button>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
