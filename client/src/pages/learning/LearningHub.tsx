import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Award, BookOpen, ChevronRight, CheckCircle2, Clock, AlertCircle, Bell } from "lucide-react";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

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
  const [businessStatus, setBusinessStatus] = useState<CertStatus | null>(null);
  const [affiliateStatus, setAffiliateStatus] = useState<AffiliateStatus | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [platformRes, businessRes, affiliateRes, updatesRes] = await Promise.allSettled([
          apiRequest("/api/certifications/platform/progress"),
          apiRequest("/api/certifications/business_success/progress"),
          apiRequest("/api/certifications/affiliate-status"),
          apiRequest("/api/lms/updates"),
        ]);
        if (platformRes.status === "fulfilled") {
          const d = platformRes.value as { certification: CertStatus | null };
          setPlatformStatus(d.certification ?? { status: "not_started" });
        }
        if (businessRes.status === "fulfilled") {
          const d = businessRes.value as { certification: CertStatus | null };
          setBusinessStatus(d.certification ?? { status: "not_started" });
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
        className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-28"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div
          className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/10"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
            <button
              onClick={() => setLocation("/business-center")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
            >
              ← Back
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-white">Learning & Certifications</h1>
              <p className="text-xs text-white/40">MPM Professional Training</p>
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
          {/* Affiliate unlock status */}
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
                  {affiliateStatus.eligible ? "Affiliate Access Unlocked" : "Complete Both Certifications to Unlock Affiliate Access"}
                </p>
                <p className="text-xs text-white/50 mt-0.5">
                  {affiliateStatus.eligible
                    ? "Your affiliate code, dashboard, and marketing resources are available."
                    : "Affiliate code, dashboard, and marketing resources are locked until both certifications are complete."}
                </p>
              </div>
            </motion.div>
          )}

          {/* Phase 1 — Business Success Cert */}
          <div className="space-y-2">
            <p className="text-xs text-white/40 uppercase tracking-widest font-semibold px-1">Phase 1</p>
            <motion.button
              className="w-full p-4 rounded-2xl bg-black/30 backdrop-blur-lg border border-white/10 text-left active:scale-[0.98] transition-transform"
              onClick={() => setLocation("/certifications/business_success")}
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
                    Platform philosophy, marketing principles, affiliate expectations, and business fundamentals.
                  </p>
                  <div className="mt-2">{loading ? <div className="h-3 w-24 rounded bg-white/10 animate-pulse" /> : statusBadge(businessStatus?.status)}</div>
                </div>
                <ChevronRight className="h-5 w-5 text-white/30 flex-shrink-0" />
              </div>
            </motion.button>
          </div>

          {/* Phase 2 — Platform Cert */}
          <div className="space-y-2">
            <p className="text-xs text-white/40 uppercase tracking-widest font-semibold px-1">Phase 2</p>
            <motion.button
              className="w-full p-4 rounded-2xl bg-black/30 backdrop-blur-lg border border-white/10 text-left active:scale-[0.98] transition-transform"
              onClick={() => setLocation("/certifications/platform")}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                  <Award className="h-6 w-6 text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-bold text-white">Platform Certification</h2>
                  <p className="text-xs text-white/50 mt-0.5 leading-relaxed">
                    3 training videos, module quizzes, and a 20-question final assessment.
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    {loading ? <div className="h-3 w-24 rounded bg-white/10 animate-pulse" /> : statusBadge(platformStatus?.status)}
                    {platformStatus?.status === "completed" && platformStatus.isCurrentVersion === false && (
                      <span className="flex items-center gap-1 text-xs text-amber-400 font-medium">
                        <AlertCircle className="h-3 w-3" /> Updates pending
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-white/30 flex-shrink-0" />
              </div>
            </motion.button>
          </div>

          {/* Update Modules */}
          <motion.button
            className="w-full p-4 rounded-2xl bg-black/20 border border-white/5 text-left active:scale-[0.98] transition-transform"
            onClick={() => setLocation("/certifications/updates")}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${pendingUpdates > 0 ? "bg-amber-500/20 border border-amber-500/30" : "bg-white/5 border border-white/10"}`}>
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
        </div>
    </motion.div>
  );
}
