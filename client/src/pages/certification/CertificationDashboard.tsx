import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { CheckCircle2, Circle, Clock, Lock, Award, X, PlayCircle, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AFFILIATE_MODULES, COACHING_MODULES, MARKETING_COACHING_MODULES } from "@/data/affiliateCertification";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { BC_HEADER } from "@/components/BusinessCenterShell";
import { AcademyBackButton } from "@/components/AcademyBackButton";

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
  if (status === "completed") return <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />;
  if (status === "in_progress") return <PlayCircle className="h-5 w-5 text-orange-400 flex-shrink-0" />;
  if (status === "quiz_failed") return <Clock className="h-5 w-5 text-red-400 flex-shrink-0" />;
  return <Circle className="h-5 w-5 text-gray-600 flex-shrink-0" />;
}

function statusLabel(status: string) {
  if (status === "completed") return <span className="text-xs text-green-500 font-medium">Completed</span>;
  if (status === "in_progress") return <span className="text-xs text-orange-400 font-semibold">Current — Tap to Continue</span>;
  if (status === "quiz_failed") return <span className="text-xs text-red-400 font-medium">Quiz — Retry</span>;
  return <span className="text-xs text-gray-500">Not Started</span>;
}

export default function CertificationDashboard() {
  const [location, setLocation] = useLocation();
  const params = useParams<{ pathId: string }>();
  const pathId = params.pathId ?? "social";
  const certType = pathId === "marketing" ? "marketing_coaching" : `affiliate_${pathId}`;

  const { user } = useAuth();

  const [data, setData] = useState<CertificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNameModal, setShowNameModal] = useState(false);
  const [certFirstName, setCertFirstName] = useState("");
  const [certLastName, setCertLastName] = useState("");
  const [nameSaving, setNameSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      // apiRequest already returns parsed JSON — do NOT call .json() again
      const json = await apiRequest(
        `/api/certifications/${certType}/progress?_t=${Date.now()}`
      );
      if (pathId === "marketing" && json.certification?.status === "completed") {
        setLocation(
          `/business-center/affiliate/${pathId}/certification/complete`,
          { replace: true },
        );
        return;
      }
      setData(json);
    } catch {
      setData((prev) => prev ?? { certification: null, moduleProgress: [] });
    } finally {
      setLoading(false);
    }
  }, [certType, pathId, setLocation]);

  // Only load once auth is established — prevents 401 race on hard reload
  useEffect(() => {
    if (user) {
      load();
    }
  }, [user, load]);

  const prevLocationRef = useRef<string | null>(null);
  useEffect(() => {
    const dashboardPath = `/business-center/affiliate/${pathId}/certification`;
    if (prevLocationRef.current !== null && location === dashboardPath) {
      setLoading(true);
      load();
    }
    prevLocationRef.current = location;
  }, [location, pathId, load]);

  useEffect(() => {
    // apiRequest already returns parsed JSON — do NOT call .json() again
    apiRequest("/api/certifications/certificate-name")
      .then((d) => {
        if (d.certificateName) {
          const parts = d.certificateName.trim().split(" ");
          setCertFirstName(parts.slice(0, -1).join(" ") || parts[0]);
          setCertLastName(parts.length > 1 ? parts[parts.length - 1] : "");
        }
      })
      .catch(() => {});
  }, []);

  const modules = pathId === "marketing" ? MARKETING_COACHING_MODULES : pathId === "coaching" ? COACHING_MODULES : AFFILIATE_MODULES;

  const progressMap = new Map(
    (data?.moduleProgress ?? []).map((p) => [p.moduleId, p])
  );

  const completedCount = modules.filter(
    (m) => progressMap.get(m.id)?.status === "completed"
  ).length;

  const totalModules = modules.length;
  const progressPct = Math.round((completedCount / totalModules) * 100);
  const allDone = completedCount === totalModules;

  // Find the first module the user should work on next
  const currentModuleIndex = modules.findIndex((m) => {
    const s = progressMap.get(m.id)?.status;
    return s === "in_progress" || s === "quiz_failed";
  });
  const nextNotStartedIndex = modules.findIndex((m, i) => {
    const s = progressMap.get(m.id)?.status ?? "not_started";
    const prevDone = i === 0 || progressMap.get(modules[i - 1].id)?.status === "completed";
    return s === "not_started" && prevDone;
  });
  const continueIndex = currentModuleIndex !== -1 ? currentModuleIndex : nextNotStartedIndex;
  const continueModule = continueIndex !== -1 ? modules[continueIndex] : null;

  const handleModuleClick = (moduleId: string, moduleIndex: number) => {
    const prevModule = moduleIndex > 0 ? modules[moduleIndex - 1] : null;
    const prevStatus = prevModule ? progressMap.get(prevModule.id)?.status : "completed";
    if (moduleIndex > 0 && prevStatus !== "completed") return;
    setLocation(`/business-center/affiliate/${pathId}/certification/${moduleId}`);
  };

  const handleContinue = () => {
    if (continueModule) {
      setLocation(`/business-center/affiliate/${pathId}/certification/${continueModule.id}`);
    }
  };

  const handleCompleteWithName = async () => {
    const fullName = `${certFirstName.trim()} ${certLastName.trim()}`.trim();
    if (!fullName) return;
    setNameSaving(true);
    try {
      // apiRequest already returns parsed JSON — do NOT call .json() again
      const json = await apiRequest(`/api/certifications/${certType}/complete`, {
        method: "POST",
        body: JSON.stringify({ certificateName: fullName }),
        headers: { "Content-Type": "application/json" },
      });
      if (json.ok) {
        setLocation(`/business-center/affiliate/${pathId}/certification/complete`);
      }
    } catch {
      // handled
    } finally {
      setNameSaving(false);
    }
  };

  const certPathLabel = pathId === "coaching" ? "Business & Coaching" : "Social & Referral";

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black pb-28"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div
        className={`fixed top-0 left-0 right-0 z-50 ${BC_HEADER}`}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <AcademyBackButton
            onClick={() => setLocation(pathId === "marketing" ? "/academy" : `/business-center/affiliate/${pathId}`)}
            label={pathId === "marketing" ? "Academy" : "Back"}
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white truncate">Affiliate Certification</h1>
            <p className="text-xs text-white/60">{certPathLabel} Path</p>
          </div>
          <button
            onClick={() => setLocation("/business-center")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform"
          >
            <Building2 className="h-4 w-4" />
            Business Suite
          </button>
        </div>
      </div>

      <div
        className="px-4 max-w-2xl mx-auto space-y-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}
      >
        {/* Certification complete banner */}
        {data?.certification?.status === "completed" && (
          <motion.div
            className="flex items-center gap-3 p-4 rounded-2xl bg-green-900/30 border border-green-500/30"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Award className="h-6 w-6 text-green-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Certification Complete</p>
              <p className="text-xs text-gray-400 font-mono">{data.certification.certificateNumber}</p>
            </div>
            <button
              onClick={() => setLocation(`/business-center/affiliate/${pathId}/certification/complete`)}
              className="px-3 py-1.5 rounded-xl bg-green-500/20 text-green-400 text-xs font-medium active:scale-[0.95] transition-transform"
            >
              View
            </button>
          </motion.div>
        )}

        {/* Progress bar */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-white">Progress</span>
            {loading ? (
              <div className="h-4 w-10 rounded bg-white/10 animate-pulse" />
            ) : (
              <span className="text-sm font-bold text-orange-400">{progressPct}%</span>
            )}
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            {loading ? (
              <div className="h-full w-1/3 rounded-full bg-white/10 animate-pulse" />
            ) : (
              <motion.div
                className="h-full bg-orange-500 rounded-full"
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            )}
          </div>
          {loading ? (
            <div className="h-3 w-36 rounded bg-white/10 animate-pulse" />
          ) : (
            <p className="text-xs text-gray-400">{completedCount} of {totalModules} modules complete</p>
          )}
        </div>

        {/* Continue Certification CTA */}
        {!loading && continueModule && !allDone && !data?.certification && (
          <motion.button
            className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm flex items-center justify-between active:scale-[0.98] transition-transform"
            onClick={handleContinue}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-xs text-orange-200 font-medium uppercase tracking-wide">Continue Certification</span>
              <span className="text-base font-bold text-white">
                {continueIndex === modules.length - 1
                  ? "Final Assessment"
                  : `Module ${continueIndex + 1} — ${continueModule.title}`}
              </span>
            </div>
            <PlayCircle className="h-6 w-6 text-white/80 flex-shrink-0" />
          </motion.button>
        )}

        {/* Module list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-orange-400/40 border-t-orange-400 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {modules.map((module, i) => {
              const progress = progressMap.get(module.id);
              const status = progress?.status ?? "not_started";
              const isFirstModule = i === 0;
              const prevCompleted = i === 0 || progressMap.get(modules[i - 1].id)?.status === "completed";
              const isLocked = !isFirstModule && !prevCompleted && status === "not_started";
              const isFinal = module.id === "final-assessment";
              const isCurrent = i === continueIndex && !allDone;

              const showSeparator = isCurrent && completedCount > 0 && i > 0;

              return (
                <div key={module.id}>
                  {showSeparator && (
                    <div className="flex items-center gap-3 py-2">
                      <div className="flex-1 h-px bg-white/10" />
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">Up Next</span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>
                  )}
                  <motion.button
                    className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 ${
                      isLocked
                        ? "bg-white/5 border-white/10 opacity-50 cursor-default"
                        : isFinal && !prevCompleted
                        ? "bg-white/5 border-white/10 opacity-50 cursor-default"
                        : isCurrent
                        ? "bg-orange-500/20 border border-orange-500/40"
                        : status === "completed"
                        ? "bg-white/5 border-white/5"
                        : "bg-white/5 border-white/10 active:scale-[0.98]"
                    }`}
                    onClick={() => !isLocked && handleModuleClick(module.id, i)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <div className="flex items-center gap-3">
                      {isLocked ? (
                        <Lock className="h-5 w-5 text-gray-600 flex-shrink-0" />
                      ) : (
                        statusIcon(status)
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs flex-shrink-0 text-gray-500">
                            {isFinal ? "Final" : `Module ${i + 1}`}
                          </span>
                          <h3 className={`text-sm font-semibold truncate ${status === "completed" ? "text-gray-400" : "text-white"}`}>
                            {module.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {statusLabel(status)}
                          {progress?.score != null && (
                            <span className="text-xs text-gray-500">· Score: {progress.score}%</span>
                          )}
                          {status === "not_started" && !isLocked && (
                            <span className="text-xs text-gray-500">· ~{module.estimatedMinutes} min</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.button>
                </div>
              );
            })}
          </div>
        )}

        {/* Complete button when all done */}
        {allDone && !data?.certification && (
          <motion.button
            className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform"
            onClick={() => setShowNameModal(true)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            Complete Certification
          </motion.button>
        )}
      </div>

      {/* Name capture modal — dark overlay */}
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
                className="absolute top-4 right-4 p-1.5 rounded-xl bg-black/40 text-white/50 active:scale-95 transition-transform"
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
                    className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50"
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
                    className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50"
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
