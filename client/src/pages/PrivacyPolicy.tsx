import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { motion } from "framer-motion";

export default function PrivacyPolicy() {
  const [, setLocation] = useLocation();

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
          <h1 className="text-lg font-bold text-white">Privacy Policy</h1>
        </div>
      </div>

      <div
        className="max-w-3xl mx-auto px-4 text-white"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
      >
        <div className="bg-black/10 backdrop-blur-none rounded-xl border border-white/10 p-6 space-y-6">
          <div className="text-center border-b border-white/10 pb-4">
            <h2 className="text-2xl font-bold">Privacy Policy</h2>
            <p className="text-white/60 text-sm mt-1">My Perfect Meals</p>
            <p className="text-white/50 text-xs mt-2">Last Updated: January 2025</p>
          </div>

          <p className="text-white/80 text-sm leading-relaxed">
            My Perfect Meals ("we," "us," "our") provides a personalized nutrition application powered by AI meal generation, lifestyle guidance, and optional ProCare coaching features. We are committed to protecting your privacy and handling your information responsibly.
          </p>
          <p className="text-white/80 text-sm">By using My Perfect Meals, you agree to this Privacy Policy.</p>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">1. Information We Collect</h3>
            <p className="text-white/70 text-sm">We collect information to personalize nutrition guidance, improve app performance, and provide safe user experiences.</p>
            
            <h4 className="text-md font-medium text-white/90 mt-4">1.1 Information You Provide</h4>
            <div className="text-white/70 text-sm space-y-2">
              <p><strong>Account Information:</strong> Name, Email, Password, Birthday (for personalization + birthday greetings)</p>
              <p><strong>Health & Nutrition Preferences:</strong> Dietary focus (Diabetes, GLP-1, Cardiac, Anti-Inflammatory, General Nutrition), Sex, age, height, weight, Allergies, Activity level, Glycemic preferences, Macro goals and meal preferences, Cravings and food preferences, Fridge items you enter manually</p>
              <p><strong>Coaching / ProCare Data:</strong> If you connect with a trainer, coach, or physician through My Perfect Meals ProCare, we collect goals and assigned nutrition plans, coach-assigned adjustments, and progress notes.</p>
            </div>

            <h4 className="text-md font-medium text-white/90 mt-4">1.2 Automatically Collected Information</h4>
            <p className="text-white/70 text-sm">Device type, OS, app version, IP address, usage patterns, error logs and crash diagnostics.</p>

            <h4 className="text-md font-medium text-white/90 mt-4">1.3 Financial Information</h4>
            <p className="text-white/70 text-sm">We DO NOT collect or store your credit card information. Apple In-App Purchases: Apple manages all billing directly. Stripe (website only): Stripe processes all payments; we never store card numbers.</p>

            <h4 className="text-md font-medium text-white/90 mt-4">1.4 Sensitive Health Data</h4>
            <p className="text-white/70 text-sm">My Perfect Meals does not diagnose, treat, or provide medical care. Any health-related data you share is for nutrition personalization only. We do not store protected health information (PHI) as defined by HIPAA.</p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">2. How We Use Your Information</h3>
            <ul className="text-white/70 text-sm list-disc list-inside space-y-1">
              <li>Personalize meals, macros, and AI recommendations</li>
              <li>Provide Diabetes, GLP-1, Cardiac, and Anti-Inflammatory guardrails</li>
              <li>Build shopping lists and automate meal planning</li>
              <li>Provide birthday greetings</li>
              <li>Improve AI accuracy</li>
              <li>Offer ProCare client-coach functionality</li>
              <li>Inform you of updates, new features, or account changes</li>
              <li>Support security, fraud prevention, and authentication</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">3. How We Share Your Information</h3>
            <p className="text-white/70 text-sm">We only share your information in the following situations:</p>
            
            <h4 className="text-md font-medium text-white/90 mt-3">3.1 With Your Coach or Physician</h4>
            <p className="text-white/70 text-sm">If you join a ProCare plan or connect with a trainer/doctor, they may see your nutrition data, assigned dietary focus, progress logs, and selected meals and macros. You control whether you connect to a coach.</p>

            <h4 className="text-md font-medium text-white/90 mt-3">3.2 With Service Providers</h4>
            <p className="text-white/70 text-sm">We use third-party vendors for database hosting, email delivery, analytics, crash reporting, and payment processing (Stripe + Apple).</p>

            <h4 className="text-md font-medium text-white/90 mt-3">3.3 Legal Requirements</h4>
            <p className="text-white/70 text-sm">We may disclose information if required by law enforcement, court order, fraud investigation, or App Store compliance.</p>
            
            <p className="text-white/80 text-sm font-medium mt-3">We do not sell or rent your information. Ever.</p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">4. Data Security</h3>
            <p className="text-white/70 text-sm">We use token-based authentication, encrypted data transmission (HTTPS), secure storage for user profiles, strict access controls, and continuous security monitoring. No system is 100% secure, but we maintain industry-standard protections.</p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">5. Your Rights</h3>
            <p className="text-white/70 text-sm">Depending on your region, you may request a copy of your data, update or delete your data, withdraw consent, or close your account at any time.</p>
            <p className="text-white/70 text-sm">Contact us at <a href="mailto:support@myperfectmeals.com" className="text-lime-400 underline">support@myperfectmeals.com</a> for requests.</p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">6. Children's Privacy</h3>
            <p className="text-white/70 text-sm">My Perfect Meals is intended for users 13+. We do not knowingly collect data from children under 13.</p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">7. AI Usage Disclosure</h3>
            <p className="text-white/70 text-sm">My Perfect Meals uses generative AI to suggest meals, personalize macros, transform cravings into healthier versions, and provide dietary recommendations within your selected guardrails. AI suggestions are not medical advice.</p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-white">8. Changes to This Policy</h3>
            <p className="text-white/70 text-sm">We may update this policy periodically. Continued use of the app means you accept the updated version.</p>
          </section>

          <section className="space-y-3 border-t border-white/10 pt-4">
            <h3 className="text-lg font-semibold text-white">9. Contact Us</h3>
            <p className="text-white/70 text-sm">My Perfect Meals</p>
            <p className="text-white/70 text-sm">Support Email: <a href="mailto:support@myperfectmeals.com" className="text-lime-400 underline">support@myperfectmeals.com</a></p>
          </section>
        </div>

        <div className="h-20" />
      </div>
    </motion.div>
  );
}
