import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, CheckCircle2, Circle, Clock, Lock, Award, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AFFILIATE_MODULES } from "@/data/affiliateCertification";
import { apiRequest } from "@/lib/queryClient";

interface ModuleProgress {
  moduleId: string;
  status: string;
  score: number | null;
  completedAt: string | null;
  lastViewedAt: string | null;
}

interface CertificationData {
  certification: {
    status: string;
    score: number;
    certificateNumber: string;
    certificateName: string | null;
    completedAt: string;
  } | null;
  moduleProgress: ModuleProgress[];
}

function statusIcon(status: string) {
  if (status === "completed") return <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />;
  if (status === "in_progress") return <Clock className="h-5 w-5 text-orange-400 flex-shrink-0" />;
  if (status === "quiz_failed") return <Clock className="h-5 w-5 text-red-400 flex-shrink-0" />;
  return <Circle className="h-5 w-5 text-white/20 flex-shrink-0" />;
}

function statusLabel(status: string) {
  if (status === "completed") return <span className="text-xs text-green-400 font-medium">Completed</span>;
  if (status === "in_progress") return <span className="text-xs text-orange-400 font-medium">In Progress</span>;
  if (status === "quiz_failed") return <span className="text-xs text-red-400 font-medium">Quiz — Retry</span>;
  return <span className="text-xs text-white/30">Not Started</span>;
}

export default function CertificationDashboard() {
  const [, setLocation] = useLocation();
  const params = useParams<{ pathId: string }>();
  const pathId = params.pathId ?? "social";
  const certType = `affiliate_${pathId}`;

  const [data, setData] = useState<CertificationData | null>(null);
  const [loading, setLoading] = useState(true);
  // Name modal state
  const [showNameModal, setShowNameModal] = useState(false);
  const [certFirstName, setCertFirstName] = useState("");
  const [certLastName, setCertLastName] = useState("");
  const [nameSaving, setNameSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiRequest(`/api/certifications/${certType}/progress`);
        const json = await res.json();
        setData(json);
      } catch {
        setData({ certification: null, moduleProgress: [] });
      } finally {
        setLoading(false);
      }
    };
    load();

    // Refresh whenever the user navigates back to this page
    const handleVisibility = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);
    };
  }, [certType]);

  // Pre-fill name from any existing cert
  useEffect(() => {
    apiRequest("/api/certifications/certificate-name")
      .then((r) => r.json())
      .then((d) => {
        if (d.certificateName) {
          const parts = d.certificateName.trim().split(" ");
          setCertFirstName(parts.slice(0, -1).join(" ") || parts[0]);
          setCertLastName(parts.length > 1 ? parts[parts.length - 1] : "");
        }
      })
      .catch(() => {});
  }, []);

  const progressMap = new Map(
    (data?.moduleProgress ?? []).map((p) => [p.moduleId, p])
  );

  const completedCount = AFFILIATE_MODULES.filter(
    (m) => progressMap.get(m.id)?.status === "completed"
  ).length;

  const totalModules = AFFILIATE_MODULES.length;
  const progressPct = Math.round((completedCount / totalModules) * 100);
  const allDone = completedCount === totalModules;

  const handleModuleClick = (moduleId: string, moduleIndex: number) => {
    const prevModule = moduleIndex > 0 ? AFFILIATE_MODULES[moduleIndex - 1] : null;
    const prevStatus = prevModule ? progressMap.get(prevModule.id)?.status : "completed";
    if (moduleIndex > 0 && prevStatus !== "completed") return;
    setLocation(`/business-center/affiliate/${pathId}/certification/${moduleId}`);
  };

  const handleCompleteWithName = async () => {
    const fullName = `${certFirstName.trim()} ${certLastName.trim()}`.trim();
    if (!fullName) return;
    setNameSaving(true);
    try {
      const res = await apiRequest(`/api/certifications/${certType}/complete`, {
        method: "POST",
        body: JSON.stringify({ certificateName: fullName }),
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.ok) {
        setLocation(`/business-center/affiliate/${pathId}/certification/complete`);
      }
    } catch {
      // handled
    } finally {
      setNameSaving(false);
    }
  };

  const handleCompleteClick = () => {
    setShowNameModal(true);
  };

  const certPathLabel = pathId === "coaching" ? "Business & Coaching" : "Social & Referral";

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-900 to-black/80 pb-28"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div
        className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/10"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => setLocation(`/business-center/affiliate/${pathId}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white truncate">Affiliate Certification</h1>
            <p className="text-xs text-white/50">{certPathLabel} Path</p>
          </div>
        </div>
      </div>

      <div
        className="px-4 max-w-2xl mx-auto space-y-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}
      >
        {/* Certification complete banner */}
        {data?.certification?.status === "completed" && (
          <motion.div
            className="flex items-center gap-3 p-4 rounded-2xl bg-green-500/10 border border-green-500/30"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Award className="h-6 w-6 text-green-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Certification Complete</p>
              <p className="text-xs text-white/50 font-mono">{data.certification.certificateNumber}</p>
            </div>
            <button
              onClick={() => setLocation(`/business-center/affiliate/${pathId}/certification/complete`)}
              className="px-3 py-1.5 rounded-xl bg-green-500/20 text-green-300 text-xs font-medium active:scale-[0.95] transition-transform"
            >
              View
            </button>
          </motion.div>
        )}

        {/* Progress bar */}
        <div className="p-4 rounded-2xl bg-black/30 backdrop-blur-lg border border-white/10 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-white">Progress</span>
            <span className="text-sm font-bold text-orange-400">{progressPct}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-orange-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
          <p className="text-xs text-white/40">{completedCount} of {totalModules} modules complete</p>
        </div>

        {/* Module list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-orange-400/40 border-t-orange-400 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {AFFILIATE_MODULES.map((module, i) => {
              const progress = progressMap.get(module.id);
              const status = progress?.status ?? "not_started";
              const isFirstModule = i === 0;
              const prevCompleted = i === 0 || progressMap.get(AFFILIATE_MODULES[i - 1].id)?.status === "completed";
              const isLocked = !isFirstModule && !prevCompleted && status === "not_started";
              const isFinal = module.id === "final-assessment";

              return (
                <motion.button
                  key={module.id}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 ${
                    isLocked
                      ? "bg-black/20 border-white/5 opacity-50 cursor-default"
                      : isFinal && !prevCompleted
                      ? "bg-black/20 border-white/5 opacity-50 cursor-default"
                      : "bg-black/30 backdrop-blur-lg border-white/10 active:scale-[0.98]"
                  }`}
                  onClick={() => !isLocked && handleModuleClick(module.id, i)}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <div className="flex items-center gap-3">
                    {isLocked ? (
                      <Lock className="h-5 w-5 text-white/20 flex-shrink-0" />
                    ) : (
                      statusIcon(status)
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white/40 flex-shrink-0">
                          {isFinal ? "Final" : `Module ${i + 1}`}
                        </span>
                        <h3 className="text-sm font-semibold text-white truncate">{module.title}</h3>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {statusLabel(status)}
                        {progress?.score != null && (
                          <span className="text-xs text-white/30">· Score: {progress.score}%</span>
                        )}
                        {status === "not_started" && !isLocked && (
                          <span className="text-xs text-white/30">· ~{module.estimatedMinutes} min</span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* Complete button */}
        {allDone && !data?.certification && (
          <motion.button
            className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform"
            onClick={handleCompleteClick}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            Complete Certification
          </motion.button>
        )}
      </div>

      {/* Name capture modal */}
      <AnimatePresence>
        {showNameModal && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center px-4 pb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowNameModal(false)}
            />
            <motion.div
              className="relative w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-3xl p-6 space-y-5"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
            >
              <button
                className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/5 text-white/40 active:scale-95 transition-transform"
                onClick={() => setShowNameModal(false)}
              >
                <X className="h-4 w-4" />
              </button>

              <div className="space-y-1">
                <h2 className="text-base font-bold text-white">Before Your Certificate Is Issued</h2>
                <p className="text-xs text-white/50 leading-relaxed">
                  Enter your full name exactly as you want it to appear on your certificate.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 font-medium">First Name</label>
                  <input
                    type="text"
                    value={certFirstName}
                    onChange={(e) => setCertFirstName(e.target.value)}
                    placeholder="First name"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 font-medium">Last Name</label>
                  <input
                    type="text"
                    value={certLastName}
                    onChange={(e) => setCertLastName(e.target.value)}
                    placeholder="Last name"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && certFirstName.trim() && certLastName.trim()) {
                        handleCompleteWithName();
                      }
                    }}
                  />
                </div>
              </div>

              <button
                onClick={handleCompleteWithName}
                disabled={!certFirstName.trim() || !certLastName.trim() || nameSaving}
                className="w-full p-3.5 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {nameSaving ? "Issuing Certificate…" : "Issue My Certificate"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
