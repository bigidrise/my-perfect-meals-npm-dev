import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  Link2,
  Percent,
  RefreshCw,
  Users,
} from "lucide-react";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { apiRequest } from "@/lib/queryClient";

const PROGRAM_HIGHLIGHTS = [
  "Dedicated onboarding and implementation support",
  "Business Success & Platform Certification through the MPM Academy",
  "Marketing materials and positioning guidance",
  "Affiliate tools, referral link, QR code, and commission structure",
  "Early feature access and a direct feedback channel",
  "40% recurring commission on every subscription you refer",
];

const TERMS = [
  "Commissions are paid monthly when your balance reaches $25.",
  "Referrals are tracked with a 60-day cookie — no commission on refunds or cancellations.",
  "Affiliate links must not be used in spam, misleading claims, or coupon hijacking.",
  "MPM may update program terms for new enrollments; your founding commission is locked in.",
  "Accounts may be terminated for abuse or policy violations.",
];

export default function FoundingAffiliatePage() {
  const [, setLocation] = useLocation();
  const isDesktop = useIsDesktop();
  const [acknowledged, setAcknowledged] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  useEffect(() => {
    document.title = "Founding Affiliate Program | My Perfect Meals";
    // Check if already registered
    apiRequest("/api/affiliate/account")
      .then((data: any) => {
        if (data?.account?.affiliateTrack) setAlreadyRegistered(true);
      })
      .catch(() => {});
    return () => {
      document.title = "My Perfect Meals";
    };
  }, []);

  const handleBeginAcademy = async () => {
    if (!acknowledged || registering) return;
    setRegistering(true);
    setError("");
    try {
      if (!alreadyRegistered) {
        await apiRequest("/api/affiliate/register-track", {
          method: "POST",
          body: JSON.stringify({ track: "social_affiliate" }),
          headers: { "Content-Type": "application/json" },
        });
      }
      setLocation("/business-center/affiliate/social/certification");
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("already_registered") || msg.includes("already_activated")) {
        setLocation("/business-center/affiliate/social/certification");
      } else {
        setError("Could not start enrollment. Please try again.");
        setRegistering(false);
      }
    }
  };

  return (
    <motion.div
      className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} pb-28`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      {!isDesktop && (
        <div
          className={`fixed top-0 left-0 right-0 z-50 ${BC_HEADER}`}
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
            <button
              onClick={() => setLocation("/business-center/partners")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <h1 className="text-base font-bold text-white truncate">Founding Affiliate Program</h1>
          </div>
        </div>
      )}

      <div
        className="px-4 max-w-2xl mx-auto space-y-5"
        style={{
          paddingTop: isDesktop
            ? "2rem"
            : "calc(env(safe-area-inset-top, 0px) + 5.5rem)",
        }}
      >
        {isDesktop && (
          <button
            onClick={() => setLocation("/business-center/partners")}
            className="flex items-center gap-1.5 text-orange-400 text-sm font-medium mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Partners
          </button>
        )}

        {/* Hero */}
        <motion.div
          className="text-center pt-2 pb-4"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/20 border border-orange-500/30 mb-4">
            <Award className="h-3.5 w-3.5 text-orange-400" />
            <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Founding Affiliate Program</span>
          </div>
          <h1 className="text-2xl font-black text-white leading-tight mb-3">
            Earn recurring commission<br />sharing what works.
          </h1>
          <p className="text-sm text-gray-300 leading-relaxed max-w-sm mx-auto">
            Designed for coaches, educators, practitioners, influencers, and businesses
            that want to incorporate My Perfect Meals into their existing services.
          </p>
        </motion.div>

        {/* Commission callout */}
        <motion.div
          className="bg-orange-500/20 border border-orange-500/30 rounded-2xl p-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Percent className="h-4 w-4 text-orange-400" />
            <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Founding Affiliate Commission</span>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 text-center bg-orange-500/30 border border-orange-400/30 rounded-xl py-3">
              <div className="text-3xl font-black text-orange-300">40%</div>
              <div className="text-[10px] text-orange-400 font-medium mt-0.5">You Earn</div>
            </div>
            <div className="text-gray-500 text-xs font-bold">/</div>
            <div className="flex-1 text-center bg-white/10 border border-white/10 rounded-xl py-3">
              <div className="text-3xl font-black text-white/60">60%</div>
              <div className="text-[10px] text-gray-400 font-medium mt-0.5">My Perfect Meals</div>
            </div>
          </div>
          <p className="text-xs text-gray-300 leading-relaxed">
            A <span className="text-white font-semibold">40% recurring commission</span> on every subscription
            you refer — for as long as that subscriber stays active. This founding rate is locked in for every
            affiliate who joins now.
          </p>
        </motion.div>

        {/* What you get */}
        <motion.div
          className="bg-white/5 border border-white/10 rounded-2xl p-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-orange-400" />
            <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">What's Included</span>
          </div>
          <div className="space-y-2.5">
            {PROGRAM_HIGHLIGHTS.map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span className="text-xs text-gray-300 leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* How it works */}
        <motion.div
          className="bg-white/5 border border-white/10 rounded-2xl p-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="h-4 w-4 text-orange-400" />
            <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">How It Works</span>
          </div>
          <div className="space-y-3">
            {[
              {
                step: "1",
                title: "Complete the Affiliate Academy",
                detail: "Learn the platform, the nutrition science behind it, and how to represent MPM to your audience.",
              },
              {
                step: "2",
                title: "Your affiliate account is created",
                detail: "Once certified, your affiliate account is automatically activated — no additional steps needed from you.",
              },
              {
                step: "3",
                title: "Share your referral link",
                detail: "Use your unique link, QR code, or promo code. Every subscription referred earns 40% recurring commission.",
              },
              {
                step: "4",
                title: "Get paid monthly",
                detail: "Payouts are processed monthly through your Rewardful payout dashboard once your balance reaches $25.",
              },
            ].map(({ step, title, detail }) => (
              <div key={step} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-orange-500/30 border border-orange-500/40 flex items-center justify-center flex-shrink-0 text-[11px] font-black text-orange-300">
                  {step}
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{title}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Referral tool preview */}
        <motion.div
          className="bg-white/5 border border-white/10 rounded-2xl p-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.21 }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="h-4 w-4 text-orange-400" />
            <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">Your Affiliate Dashboard Will Include</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              "Referral link",
              "QR code",
              "Referral token",
              "Commission tracking",
              "Payout portal access",
              "Invite tools",
            ].map((item) => (
              <div key={item} className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                <span className="text-xs text-gray-400">{item}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Terms */}
        <motion.div
          className="bg-white/5 border border-white/10 rounded-2xl p-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
        >
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Program Terms</p>
          <div className="space-y-2">
            {TERMS.map((term, i) => (
              <p key={i} className="text-[11px] text-gray-500 leading-relaxed">
                • {term}
              </p>
            ))}
          </div>
        </motion.div>

        {/* Acknowledgment + CTA */}
        <motion.div
          className="space-y-4 pb-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.27 }}
        >
          {!alreadyRegistered && (
            <button
              onClick={() => setAcknowledged((v) => !v)}
              className="w-full flex items-start gap-3 p-4 rounded-2xl border transition-all active:scale-[0.98]"
              style={{
                backgroundColor: acknowledged ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)",
                borderColor: acknowledged ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.12)",
              }}
            >
              <div
                className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                style={{
                  backgroundColor: acknowledged ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.1)",
                  border: acknowledged ? "1px solid rgba(34,197,94,0.5)" : "1px solid rgba(255,255,255,0.2)",
                }}
              >
                {acknowledged && <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />}
              </div>
              <p className="text-xs text-gray-300 leading-relaxed text-left">
                I have read and agree to the Founding Affiliate Program terms, including the 40% recurring
                commission structure, payout policies, and acceptable use requirements.
              </p>
            </button>
          )}

          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}

          <button
            onClick={alreadyRegistered ? () => setLocation("/business-center/affiliate/social/certification") : handleBeginAcademy}
            disabled={!alreadyRegistered && (!acknowledged || registering)}
            className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            {registering ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Enrolling…
              </>
            ) : alreadyRegistered ? (
              <>
                <GraduationCap className="h-4 w-4" />
                Continue to Affiliate Academy
                <ChevronRight className="h-4 w-4" />
              </>
            ) : (
              <>
                <GraduationCap className="h-4 w-4" />
                Begin My Affiliate Academy
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>

          {!alreadyRegistered && (
            <p className="text-[11px] text-gray-500 text-center leading-relaxed px-2">
              No fee to join. Enrollment automatically places you in the
              Founding Affiliate Academy. Your affiliate account activates upon certification completion.
            </p>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
