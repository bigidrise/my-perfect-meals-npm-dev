import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Award, BookOpen, ChevronRight, CheckCircle2, Clock, AlertCircle, Bell, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";

interface CertStatus {
  status: "not_started" | "in_progress" | "completed";
  score?: number;
  completedAt?: string;
  isCurrentVersion?: boolean;
  updatesPending?: number;
}

interface AffiliateStatus {
  eligible: boolean;
  businessCertified: boolean;
  platformCertified: boolean;
}

export default function LearningHub() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [platformStatus, setPlatformStatus] = useState<CertStatus | null>(null);
  const [phase1Status, setPhase1Status] = useState<CertStatus | null>(null);
  const [affiliateStatus, setAffiliateStatus] = useState<AffiliateStatus | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [platformRes, phase1Res, affiliateRes, updatesRes] = await Promise.allSettled([
          apiRequest("/api/certifications/phase1-status"),
          apiRequest("/api/certifications/affiliate_social/progress"),
          apiRequest("/api/certifications/affiliate-status"),
          apiRequest("/api/lms/updates"),
        ]);
        if (platformRes.status === "fulfilled") {
          const d = platformRes.value as { phase1Complete: boolean; certification: CertStatus | null };
          setPlatformStatus(d.certification ?? { status: "not_started" });
        }
        if (phase1Res.status === "fulfilled") {
          const d = phase1Res.value as { certification: CertStatus | null };
          setPhase1Status(d.certification ?? { status: "not_started" });
        }
        if (affiliateRes.status === "fulfilled") setAffiliateStatus(affiliateRes.value as AffiliateStatus);
        if (updatesRes.status === "fulfilled") {
          const d = updatesRes.value as { pendingCount: number };
          setPendingUpdates(d.pendingCount ?? 0);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const phase1Complete = phase1Status?.status === "completed";

  function statusBadge(status?: string) {
    if (status === "completed") return (
      <span className="flex items-center gap-1 text-xs font-semibold text-green-400">
        <CheckCircle2 className="h-3.5 w-3.5" /> Certified
      </span>
    );
    if (status === "in_progress") return (
      <span className="flex items-center gap-1 text-xs font-semibold text-orange-400">
        <Clock className="h-3.5 w-3.5" /> In Progress
      </span>
    );
    return <span className="text-xs text-white/30">Not Started</span>;
  }

  return (
    <motion.div
      className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} pb-28`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div
        className={`fixed top-0 left-0 right-0 z-50 ${BC_HEADER}`}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => setLocation("/business-center/affiliate/coaching")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
          >
            ← Back
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white">Learning & Certifications</h1>
            <p className="text-xs text-white/40">Coaching & Professional Training</p>
          </div>
          {pendingUpdates > 0 && (
            <button onClick={() => setLocation("/certifications/updates")} className="relative p-2 rounded-xl bg-orange-500/20 border border-orange-500/30">
              <Bell className="h-4 w-4 text-orange-400" />
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-orange-500 text-[10px] font-bold text-white flex items-center justify-center">{pendingUpdates}</span>
            </button>
          )}
        </div>
      </div>

      <div
        className="px-4 max-w-2xl mx-auto space-y-5"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}
      >
        {/* Affiliate unlock status banner */}
        {affiliateStatus && (
          <motion.div
            className={`flex items-start gap-3 p-4 rounded-2xl border ${affiliateStatus.eligible ? "bg-green-500/10 border-green-500/30" : "bg-orange-500/10 border-orange-500/30"}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {affiliateStatus.eligible ? (
              <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-semibold text-white">
                {affiliateStatus.eligible
                  ? "Coaching Affiliate Access Unlocked"
                  : "Complete Phase 1 & Phase 2 to Unlock Coaching Affiliate Access"}
              </p>
              <p className="text-xs text-white/50 mt-0.5">
                {affiliateStatus.eligible
                  ? "Your affiliate code, dashboard, and marketing resources are available."
                  : "Your affiliate code, dashboard, and marketing resources unlock after both certifications are complete."}
              </p>
            </div>
          </motion.div>
        )}

        {/* Phase 1 — Business Success Certification (same cert as social affiliates) */}
        <div className="space-y-2">
          <p className="text-xs text-white/40 uppercase tracking-widest font-semibold px-1">Phase 1</p>
          <motion.button
            className="w-full p-4 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 text-left active:scale-[0.98] transition-transform"
            onClick={() => setLocation("/business-center/affiliate/social/certification")}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-6 w-6 text-orange-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-white">Business Success Certification</h2>
                <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
                  8 modules — platform philosophy, marketing principles, affiliate standards, and business fundamentals.
                </p>
                <div className="mt-2">
                  {loading
                    ? <div className="h-3 w-24 rounded bg-white/10 animate-pulse" />
                    : statusBadge(phase1Status?.status)}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-white/30 flex-shrink-0" />
            </div>
          </motion.button>
        </div>

        {/* Phase 2 — Platform Certification (locked until Phase 1 complete) */}
        <div className="space-y-2">
          <p className="text-xs text-white/40 uppercase tracking-widest font-semibold px-1">Phase 2</p>
          <motion.button
            className={`w-full p-4 rounded-2xl backdrop-blur-md border text-left transition-transform ${phase1Complete ? "bg-black/50 border-white/10 active:scale-[0.98]" : "bg-black/20 border-white/5 opacity-50 cursor-default"}`}
            onClick={() => { if (phase1Complete) setLocation("/certifications/platform"); }}
            disabled={!phase1Complete}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${phase1Complete ? "bg-orange-500/20 border border-orange-500/30" : "bg-black/30 border border-white/10"}`}>
                {phase1Complete
                  ? <Award className="h-6 w-6 text-orange-400" />
                  : <Lock className="h-6 w-6 text-white/30" />}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-white">
                  ProCare Certification
                </h2>
                <p className="text-xs mt-0.5 leading-relaxed text-white/50">
                  {phase1Complete
                    ? "3 training videos, module quizzes, and a 20-question final assessment."
                    : "Complete Phase 1 — Business Success Certification — to unlock."}
                </p>
                <div className="flex items-center gap-3 mt-2">
                  {loading
                    ? <div className="h-3 w-24 rounded bg-white/10 animate-pulse" />
                    : statusBadge(platformStatus?.status)}
                  {platformStatus?.status === "completed" && platformStatus.isCurrentVersion === false && (
                    <span className="flex items-center gap-1 text-xs text-amber-400 font-medium">
                      <AlertCircle className="h-3 w-3" /> Updates pending
                    </span>
                  )}
                </div>
              </div>
              {phase1Complete
                ? <ChevronRight className="h-5 w-5 text-white/30 flex-shrink-0" />
                : <Lock className="h-4 w-4 text-white/20 flex-shrink-0" />}
            </div>
          </motion.button>
        </div>

        {/* Platform Updates (only shown after Phase 1 complete) */}
        {phase1Complete && (
          <motion.button
            className="w-full p-4 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 text-left active:scale-[0.98] transition-transform"
            onClick={() => setLocation("/certifications/updates")}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${pendingUpdates > 0 ? "bg-amber-500/20 border border-amber-500/30" : "bg-black/30 border border-white/10"}`}>
                <Bell className={`h-6 w-6 ${pendingUpdates > 0 ? "text-amber-400" : "text-white/30"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-white">Platform Updates</h2>
                <p className="text-xs text-white/40 mt-0.5">New builders, protocols, ProCare features, and tools.</p>
                {pendingUpdates > 0 && (
                  <p className="text-xs text-amber-400 font-semibold mt-1">{pendingUpdates} update{pendingUpdates !== 1 ? "s" : ""} pending</p>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-white/30 flex-shrink-0" />
            </div>
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
