import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import MobileHeaderGuard from "@/components/layout/MobileHeaderGuard";
import { useOrgBranding } from "@/hooks/useOrgBranding";

export default function DeleteAccount() {
  const [, setLocation] = useLocation();
  const { supportEmail } = useOrgBranding();

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      setLocation("/home");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-900 to-black/80 pb-safe-nav"
    >
      <MobileHeaderGuard>
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/10 backdrop-blur-none border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            onClick={handleBack}
            className="bg-black/10 hover:bg-black/50 text-white rounded-xl border border-white/10 backdrop-blur-none flex items-center gap-1.5 px-2.5 h-9 flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-medium">Back</span>
          </Button>
          <h1 className="text-lg font-bold text-white">Delete Account</h1>
        </div>
      </div>
      </MobileHeaderGuard>

      <div
        className="max-w-3xl mx-auto px-4 text-white"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        <div className="bg-black/10 backdrop-blur-none rounded-xl border border-white/10 p-6 space-y-6">
          <div className="text-center border-b border-white/10 pb-4">
            <h2 className="text-2xl font-bold">Account Deletion</h2>
            <p className="text-white/60 text-sm mt-1">My Perfect Meals</p>
            <p className="text-white/50 text-xs mt-2">Last Updated: March 2026</p>
          </div>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">How to Delete Your Account</h3>
            <p className="text-white/80 text-sm leading-relaxed">
              To request deletion of your My Perfect Meals account and all associated data, please email us at:
            </p>
            <div className="bg-white/5 rounded-lg border border-white/10 p-4">
              <p className="text-orange-400 font-semibold text-sm">{supportEmail}</p>
              <p className="text-white/60 text-xs mt-1">Subject: "Account Deletion Request"</p>
            </div>
            <p className="text-white/80 text-sm leading-relaxed">
              Please include the email address associated with your My Perfect Meals account in your request so we can locate and process it.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">What Data Is Deleted</h3>
            <p className="text-white/80 text-sm leading-relaxed">
              When your account is deleted, the following data will be permanently removed:
            </p>
            <ul className="list-disc list-inside text-white/80 text-sm space-y-1.5 ml-2">
              <li>Your profile information (name, email, preferences)</li>
              <li>Meal plans, saved meals, and meal logs</li>
              <li>Macro targets and nutrition tracking data</li>
              <li>Biometrics and body composition data</li>
              <li>Shopping lists and saved recipes</li>
              <li>Weekly meal boards and archived plans</li>
              <li>ProCare connections and coaching data</li>
              <li>Push notification subscriptions</li>
              <li>Any AI-generated content tied to your account</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">How Long Deletion Takes</h3>
            <p className="text-white/80 text-sm leading-relaxed">
              Your account and all associated data will be permanently deleted within 7 days of receiving your request. You will receive a confirmation email once the deletion is complete.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">Important Notes</h3>
            <ul className="list-disc list-inside text-white/80 text-sm space-y-1.5 ml-2">
              <li>Account deletion is permanent and cannot be undone.</li>
              <li>If you have an active subscription, please cancel it before requesting deletion to avoid further charges.</li>
              <li>Anonymized, aggregated data that cannot identify you may be retained for analytics purposes.</li>
            </ul>
          </section>

          <div className="border-t border-white/10 pt-4">
            <p className="text-white/50 text-xs text-center">
              If you have questions about data deletion, contact us at {supportEmail}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
