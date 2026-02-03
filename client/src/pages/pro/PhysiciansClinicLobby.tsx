import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, Shield, Stethoscope, Activity, HeartPulse, ChevronRight, Sparkles, Award, ClipboardList, FileCheck } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useCopilotPageExplanation } from "@/hooks/useCopilotPageExplanation";

const SKIP_INTRO_KEY = "mpm_physician_lobby_skip";

export default function PhysiciansClinicLobby() {
  const [, setLocation] = useLocation();
  const [skipIntro, setSkipIntro] = useState(false);

  useEffect(() => {
    const shouldSkip = localStorage.getItem(SKIP_INTRO_KEY) === "true";
    if (shouldSkip) {
      setLocation("/care-team/physician");
    }
  }, [setLocation]);

  useCopilotPageExplanation({
    pageId: "physicians-clinic-lobby",
    explanation: "Welcome to the Physicians Clinic. This is your clinical oversight workspace where you'll provide medical guidance and safety guardrails for patients. You can review medical conditions, set clinical parameters, and ensure nutrition plans align with each patient's health needs. Let me walk you through the tools available.",
    autoTrigger: true,
  });

  const handleSkipIntroToggle = () => {
    const newValue = !skipIntro;
    setSkipIntro(newValue);
    localStorage.setItem(SKIP_INTRO_KEY, newValue.toString());
  };

  const handleEnterWorkspace = () => {
    setLocation("/care-team/physician");
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-[100dvh] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-y-auto"
    >
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex items-center gap-3 px-4 pb-3 pt-2">
          <button
            onClick={() => setLocation("/pro-care")}
            className="flex items-center gap-1 text-white hover:bg-white/10 transition-all duration-200 p-2 rounded-lg flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="flex-1" />
        </div>
      </div>

      <div
        className="max-w-4xl mx-auto px-4 pb-16"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-500/20 border border-teal-500/30 mb-6">
            <Award className="h-4 w-4 text-teal-400" />
            <span className="text-teal-300 text-sm font-medium">Clinical Workspace</span>
          </div>
          
          <h1 className="text-4xl font-bold text-white mb-4">
            Welcome to <span className="text-teal-400">Physicians Clinic</span>
          </h1>
          
          <p className="text-white/70 text-lg max-w-2xl mx-auto">
            Your clinical oversight command center for medical-grade nutrition guidance, 
            safety guardrails, and evidence-based dietary interventions.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl p-6 bg-white/5 border border-white/10 mb-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-teal-500/20">
              <Sparkles className="h-5 w-5 text-teal-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">What This Workspace Is For</h2>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            {[
              {
                icon: Shield,
                title: "Medical Oversight",
                description: "Review and approve nutrition plans with clinical considerations, ensuring patient safety comes first.",
                color: "text-emerald-400",
                bg: "bg-emerald-500/20",
              },
              {
                icon: HeartPulse,
                title: "Health Hub Integration",
                description: "Connect with diabetic, cardiac, and renal health hubs to inject clinical context into meal generation.",
                color: "text-rose-400",
                bg: "bg-rose-500/20",
              },
              {
                icon: Activity,
                title: "SafetyGuard Configuration",
                description: "Set allergen restrictions, medication interactions, and dietary guardrails for each patient's unique needs.",
                color: "text-amber-400",
                bg: "bg-amber-500/20",
              },
              {
                icon: Stethoscope,
                title: "Clinical Nutrition",
                description: "Prescribe evidence-based dietary interventions for conditions like diabetes, hypertension, and metabolic disorders.",
                color: "text-blue-400",
                bg: "bg-blue-500/20",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-200"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${item.bg}`}>
                    <item.icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                    <p className="text-white/60 text-sm">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl p-6 bg-white/5 border border-white/10 mb-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <ClipboardList className="h-5 w-5 text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">How To Use It</h2>
          </div>
          
          <div className="space-y-4">
            {[
              {
                step: "1",
                title: "Review Patient Profiles",
                description: "Access patient medical history, conditions, and current medications to inform dietary decisions.",
              },
              {
                step: "2",
                title: "Configure Health Hubs",
                description: "Activate relevant health hubs (Diabetic, Cardiac, GLP-1) to ensure AI-generated meals respect clinical parameters.",
              },
              {
                step: "3",
                title: "Set Safety Guardrails",
                description: "Define allergen restrictions, macro limits, and food exclusions based on medical needs.",
              },
              {
                step: "4",
                title: "Monitor & Adjust",
                description: "Review patient progress and refine clinical recommendations as treatment evolves.",
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/10"
              >
                <div className="w-8 h-8 rounded-full bg-teal-500/30 flex items-center justify-center text-teal-300 font-bold text-sm flex-shrink-0">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{item.title}</h3>
                  <p className="text-white/60 text-sm">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl p-6 bg-white/5 border border-white/10 mb-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <FileCheck className="h-5 w-5 text-purple-400" />
            </div>
            <h2 className="text-xl font-semibold text-white">Key Tools Inside</h2>
          </div>
          
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { name: "Medical Hubs", desc: "Condition-specific guidance" },
              { name: "SafetyGuard", desc: "Allergen & safety controls" },
              { name: "GlucoseGuard", desc: "Diabetic meal protection" },
              { name: "Clinical Notes", desc: "Add medical annotations" },
              { name: "Patient Dashboard", desc: "Manage all patients" },
              { name: "Intervention Log", desc: "Track clinical actions" },
            ].map((tool, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-200"
              >
                <p className="text-white font-medium text-sm">{tool.name}</p>
                <p className="text-white/50 text-xs">{tool.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="space-y-4"
        >
          <Button
            onClick={handleEnterWorkspace}
            className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white rounded-xl shadow-lg shadow-teal-500/20 active:scale-[0.98] transition-transform"
          >
            Enter Workspace
            <ChevronRight className="h-5 w-5 ml-2" />
          </Button>
          
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleSkipIntroToggle}
              className="text-white/50 hover:text-white/70 text-sm transition-colors"
            >
              {skipIntro ? "✓ Skipping intro next time" : "Skip intro next time"}
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
