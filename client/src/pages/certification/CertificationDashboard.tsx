import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, CheckCircle2, Circle, Clock, Lock, Award } from "lucide-react";
import { motion } from "framer-motion";
import { AFFILIATE_MODULES, PASSING_SCORE } from "@/data/affiliateCertification";
import { apiRequest } from "@/lib/queryClient";

interface ModuleProgress {
  moduleId: string;
  status: string;
  score: number | null;
  completedAt: string | null;
  lastViewedAt: string | null;
}

interface CertificationData {
  certification: { status: string; score: number; certificateNumber: string; completedAt: string } | null;
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
  }, [certType]);

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

  const handleComplete = async () => {
    try {
      const res = await apiRequest(`/api/certifications/${certType}/complete`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.ok) {
        setLocation(`/business-center/affiliate/${pathId}/certification/complete`);
      }
    } catch {
      // handled
    }
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
            onClick={handleComplete}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            Complete Certification
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
