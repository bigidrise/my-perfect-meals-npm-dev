import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Share2, Briefcase, ChevronRight, X, UserCheck, Stethoscope, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";

const paths = [
  {
    id: "social",
    track: "social_affiliate",
    title: "Social & Referral Affiliate",
    description:
      "For influencers, content creators, social media promoters, and individuals who want to refer users to My Perfect Meals.",
    icon: Share2,
    resources: [
      "Affiliate Certification",
      "Marketing Resources",
      "Monthly Marketing Packets",
      "Affiliate Dashboard",
      "Referral Link Management",
    ],
    route: "/business-center/affiliate/social",
    requiresProvider: false,
  },
  {
    id: "coaching",
    track: "business_affiliate",
    title: "Business & Coaching Affiliate",
    description:
      "For trainers, coaches, business owners, wellness professionals, and organizations that plan to actively use My Perfect Meals in their business.",
    icon: Briefcase,
    resources: [
      "Affiliate Certification",
      "Platform Certification",
      "Business Success Academy",
      "Marketing Resources",
      "Monthly Marketing Packets",
      "Affiliate Dashboard",
      "Referral Link Management",
    ],
    route: "/business-center/affiliate/coaching",
    requiresProvider: true,
  },
];

export default function AffiliateOpportunities() {
  const [, setLocation] = useLocation();
  const [checking, setChecking] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  async function handlePathClick(path: typeof paths[0]) {
    if (!path.requiresProvider) {
      // Register track silently, then navigate
      try {
        await apiRequest("/api/affiliate/register-track", {
          method: "POST",
          body: JSON.stringify({ track: path.track }),
          headers: { "Content-Type": "application/json" },
        });
      } catch {
        // Non-blocking — track registration failure should not block navigation
      }
      setLocation(path.route);
      return;
    }

    // Business path — check eligibility first
    setChecking(path.id);
    try {
      const data = await apiRequest("/api/affiliate/eligibility") as {
        business: { eligible: boolean; reason?: string };
      };

      if (data.business.eligible) {
        // Register track, then navigate
        try {
          await apiRequest("/api/affiliate/register-track", {
            method: "POST",
            body: JSON.stringify({ track: path.track }),
            headers: { "Content-Type": "application/json" },
          });
        } catch {
          // Non-blocking
        }
        setLocation(path.route);
      } else {
        // Store intended destination for post-onboarding return
        localStorage.setItem("mpm.affiliate.returnPath", path.route);
        localStorage.setItem("mpm.affiliate.pendingTrack", path.track);
        setShowModal(true);
      }
    } catch {
      // On error, show modal as a safe fallback
      localStorage.setItem("mpm.affiliate.returnPath", path.route);
      localStorage.setItem("mpm.affiliate.pendingTrack", path.track);
      setShowModal(true);
    } finally {
      setChecking(null);
    }
  }

  return (
    <>
      <motion.div
        className="min-h-screen bg-gradient-to-br from-black/60 via-orange-900 to-black/80 pb-28"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Header */}
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
            <button
              onClick={() => setLocation("/business-center")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <h1 className="text-lg font-bold text-white">Affiliate Opportunities</h1>
          </div>
        </div>

        {/* Content */}
        <div
          className="px-4 max-w-2xl mx-auto space-y-5"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5rem)" }}
        >
          <div className="text-center py-4">
            <h2 className="text-xl font-bold text-white mb-2">Choose Your Path</h2>
            <p className="text-white/60 text-sm leading-relaxed">
              Select the affiliate path that best describes how you plan to promote My Perfect Meals.
            </p>
          </div>

          {paths.map((path, i) => {
            const Icon = path.icon;
            const isChecking = checking === path.id;
            return (
              <motion.button
                key={path.id}
                className="w-full text-left p-5 rounded-2xl bg-black/30 backdrop-blur-lg border border-orange-500/30 active:scale-[0.98] transition-all duration-200 disabled:opacity-60"
                onClick={() => handlePathClick(path)}
                disabled={!!checking}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-orange-500/20 flex-shrink-0 mt-0.5">
                    <Icon className="h-6 w-6 text-orange-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-white">{path.title}</h3>
                      {isChecking ? (
                        <div className="w-4 h-4 border-2 border-orange-400/40 border-t-orange-400 rounded-full animate-spin flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-white/30 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-white/60 mt-1 leading-relaxed">{path.description}</p>

                    {/* Resource preview */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {path.resources.map((r) => (
                        <span
                          key={r}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-300"
                        >
                          {r}
                        </span>
                      ))}
                    </div>

                    {path.requiresProvider && (
                      <div className="mt-3 flex items-center gap-1.5">
                        <UserCheck className="h-3 w-3 text-orange-400/70" />
                        <span className="text-[10px] text-orange-400/70 font-medium">Provider account required</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* Professional Account Required Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
          >
            <motion.div
              className="w-full max-w-sm bg-[#111] border border-orange-500/30 rounded-3xl overflow-hidden"
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 280, damping: 24 }}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-1">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-orange-500/20">
                    <Briefcase className="h-5 w-5 text-orange-400" />
                  </div>
                  <h2 className="text-base font-bold text-white">Professional Account Required</h2>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-xl bg-white/5 text-white/50 active:scale-[0.95] transition-transform"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                <p className="text-sm text-white/70 leading-relaxed">
                  The Business &amp; Coaching Affiliate Program is designed for professionals who use My Perfect Meals in their business or practice, including:
                </p>

                <div className="grid grid-cols-2 gap-1.5">
                  {["Personal Trainers", "Nutrition Coaches", "Health Coaches", "Dietitians", "Physicians", "Wellness Professionals"].map((role) => (
                    <div key={role} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/15">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                      <span className="text-xs text-orange-200">{role}</span>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-white/50 leading-relaxed">
                  To continue, you must first create and activate a professional provider account.
                </p>
              </div>

              {/* Action buttons */}
              <div className="px-5 pb-5 space-y-2">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setLocation("/procare-welcome?role=trainer&returnTo=/business-center/affiliate/coaching");
                  }}
                  className="w-full p-3.5 rounded-2xl bg-orange-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                  <UserCheck className="h-4 w-4" />
                  Become a Coach
                </button>

                <button
                  onClick={() => {
                    setShowModal(false);
                    setLocation("/physician-welcome?returnTo=/business-center/affiliate/coaching");
                  }}
                  className="w-full p-3.5 rounded-2xl bg-white/10 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                  <Stethoscope className="h-4 w-4" />
                  Become a Physician
                </button>

                <button
                  onClick={() => {
                    setShowModal(false);
                    setLocation("/procare-info");
                  }}
                  className="w-full p-3 rounded-2xl bg-white/5 text-white/60 font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                >
                  <Info className="h-4 w-4" />
                  Learn More
                </button>

                <button
                  onClick={() => setShowModal(false)}
                  className="w-full p-3 rounded-xl text-white/40 font-medium text-sm active:scale-[0.98] transition-transform"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
