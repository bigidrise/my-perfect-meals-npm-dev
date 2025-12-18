import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { motion } from "framer-motion";

export default function TermsOfService() {
  const [, setLocation] = useLocation();

  const handleBack = () => {
    setLocation("/dashboard");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-900 to-black/80 pb-safe-nav"
    >
      <div
        className="fixed left-0 right-0 z-50 bg-black/10 backdrop-blur-none border-b border-white/10"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3">
          <Button
            onClick={handleBack}
            className="bg-black/10 hover:bg-black/50 text-white rounded-xl border border-white/10 backdrop-blur-none flex items-center gap-1.5 px-2.5 h-9 flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs font-medium">Back</span>
          </Button>
          <h1 className="text-lg font-bold text-white">Terms of Service</h1>
        </div>
      </div>

      <div
        className="max-w-3xl mx-auto px-4 text-white"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        <div className="bg-black/40 backdrop-blur-lg rounded-xl border border-white/10 p-6 space-y-6">
          <div className="text-center border-b border-white/10 pb-4">
            <h2 className="text-2xl font-bold">Terms of Service</h2>
            <p className="text-white/60 text-sm mt-1">My Perfect Meals</p>
            <p className="text-white/50 text-xs mt-2">Last Updated: January 2025</p>
          </div>

          <p className="text-white/80 text-sm leading-relaxed">
            These Terms of Service ("Terms") govern your use of My Perfect Meals. By using the app, you agree to these Terms.
          </p>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">1. Use of the App</h3>
            <p className="text-white/70 text-sm">You may use the app for personal nutrition guidance. You agree not to:</p>
            <ul className="text-white/70 text-sm list-disc list-inside space-y-1">
              <li>Repurpose our content</li>
              <li>Misuse AI systems</li>
              <li>Attempt to reverse engineer the platform</li>
              <li>Share accounts</li>
              <li>Circumvent paywalls (after launch)</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">2. Not Medical Advice</h3>
            <p className="text-white/70 text-sm">My Perfect Meals provides nutrition guidance, not medical care.</p>
            <p className="text-white/70 text-sm">The app does not:</p>
            <ul className="text-white/70 text-sm list-disc list-inside space-y-1">
              <li>Diagnose any condition</li>
              <li>Prescribe medication</li>
              <li>Replace a physician or registered dietitian</li>
            </ul>
            <p className="text-white/80 text-sm font-medium mt-2">Always consult a licensed medical professional about your health.</p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">3. Accounts and Security</h3>
            <ul className="text-white/70 text-sm list-disc list-inside space-y-1">
              <li>You must provide accurate information.</li>
              <li>You are responsible for your login credentials.</li>
              <li>We may suspend accounts for violations of these Terms.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">4. Subscriptions & Billing</h3>
            
            <h4 className="text-md font-medium text-white/90">4.1 Subscription Tiers</h4>
            <p className="text-white/70 text-sm">My Perfect Meals may offer: Basic, Premium, Ultimate, ProCare (for professionals), and Affiliate discount options.</p>

            <h4 className="text-md font-medium text-white/90 mt-3">4.2 Payments</h4>
            <ul className="text-white/70 text-sm list-disc list-inside space-y-1">
              <li>All in-app payments must use Apple In-App Purchases.</li>
              <li>Website purchases are processed via Stripe.</li>
              <li>We do NOT store payment information.</li>
            </ul>

            <h4 className="text-md font-medium text-white/90 mt-3">4.3 Trials</h4>
            <p className="text-white/70 text-sm">Trials may convert automatically unless canceled before expiration.</p>

            <h4 className="text-md font-medium text-white/90 mt-3">4.4 Refunds</h4>
            <p className="text-white/70 text-sm">Refunds for Apple purchases must be requested through Apple Support.</p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">5. Coaches, Trainers, and Physicians</h3>
            <p className="text-white/70 text-sm">If you connect your account to a coach or medical professional:</p>
            <ul className="text-white/70 text-sm list-disc list-inside space-y-1">
              <li>You authorize us to share relevant nutrition data with them</li>
              <li>They may assign goals, macros, or meal plans</li>
              <li>You can disconnect at any time</li>
            </ul>
            <p className="text-white/70 text-sm mt-2">Professionals are independent contractors, not employees of My Perfect Meals.</p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">6. Affiliate Program</h3>
            <p className="text-white/70 text-sm">My Perfect Meals may offer an affiliate program. Affiliates receive compensation for users who subscribe using their code. Fraudulent referrals or self-referrals are prohibited. Affiliate benefits do not override subscription pricing rules. We may change commission structures with notice.</p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">7. AI Systems</h3>
            <p className="text-white/70 text-sm">AI-generated content may be imperfect, approximate, based on your inputs, and subject to nutritional limitations. You agree not to rely solely on AI recommendations for health decisions.</p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">8. Termination</h3>
            <p className="text-white/70 text-sm">We may suspend or terminate accounts that violate these Terms, abuse the system, attempt to exploit subscriptions, or harm the platform. You may close your account at any time.</p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">9. Limitation of Liability</h3>
            <p className="text-white/70 text-sm">To the maximum extent permitted by law:</p>
            <ul className="text-white/70 text-sm list-disc list-inside space-y-1">
              <li>My Perfect Meals is not liable for medical outcomes</li>
              <li>Not liable for reliance on dietary suggestions</li>
              <li>Not liable for indirect, incidental, or consequential damages</li>
            </ul>
            <p className="text-white/70 text-sm mt-2">Use the app at your own discretion.</p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">10. Governing Law</h3>
            <p className="text-white/70 text-sm">These Terms are governed by the laws of the United States and the state where the company is registered.</p>
          </section>

          <section className="space-y-3 border-t border-white/10 pt-4">
            <h3 className="text-lg font-semibold text-white">11. Contact Us</h3>
            <p className="text-white/70 text-sm">My Perfect Meals</p>
            <p className="text-white/70 text-sm">Support Email: <a href="mailto:support@myperfectmeals.com" className="text-lime-400 underline">support@myperfectmeals.com</a></p>
          </section>
        </div>

        <div className="h-20" />
      </div>
    </motion.div>
  );
}
