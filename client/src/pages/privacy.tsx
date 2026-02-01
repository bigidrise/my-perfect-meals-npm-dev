import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { SafetyPinSettings } from "@/components/SafetyPinSettings";

export default function PrivacySecurity() {
  const [, setLocation] = useLocation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-900 to-black/80 pb-safe-nav"
    >
      {/* Fixed Black Glass Navigation Banner */}
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/30 backdrop-blur-lg border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            onClick={() => setLocation("/dashboard")}
            className="bg-black/10 hover:bg-black/50 text-white rounded-xl border border-white/10 backdrop-blur-none flex items-center gap-1.5 px-2.5 h-9 flex-shrink-0"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-medium">Back</span>
          </Button>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            Privacy & Security
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div
        className="max-w-4xl mx-auto px-4 space-y-6 text-white"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
      >
        {/* MPM SafetyGuard Section */}
        <section className="space-y-4">
          <div className="bg-black/40 backdrop-blur-lg p-4 rounded-xl border border-green-500/30">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h2 className="font-semibold text-white">MPM SafetyGuard</h2>
                <p className="text-xs text-green-400">Two-layer allergy protection</p>
              </div>
            </div>
            <p className="text-sm text-white/70 mb-4">
              SafetyGuard is always on by default, checking ingredients before and after meal generation 
              to help protect you from allergens. Manage your 4-digit Safety PIN below.
            </p>
            <SafetyPinSettings />
          </div>
        </section>

        {/* Privacy Policy Section */}
        <section className="space-y-4">
          <div className="bg-black/40 backdrop-blur-lg p-4 rounded-xl border border-white/10">
            <h2 className="font-semibold mb-2">Privacy Policy</h2>
            <p className="text-sm text-white/80 mb-3">
              Review how My Perfect Meals handles and protects your data.
            </p>
            <button
              onClick={() => setLocation("/privacy-policy")}
              className="text-lime-400 underline hover:text-lime-300"
            >
              View Privacy Policy
            </button>
          </div>
        </section>
      </div>
    </motion.div>
  );
}
