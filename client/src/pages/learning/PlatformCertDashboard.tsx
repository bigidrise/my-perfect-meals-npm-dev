import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, CheckCircle2, Circle, Clock, Lock, Award, PlayCircle, FileText, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { parseLessonParam } from "@/lib/parseLessonParam";
import { resolveScrollTarget, LESSON_MODULE_TYPES } from "@/lib/resolveScrollTarget";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";
import { useAuth } from "@/contexts/AuthContext";
import { createProfessionalLegalRecoveryUrl } from "@/lib/professionalLegalRecovery";

interface CertModule {
  id: string;
  slug: string;
  title: string;
  description: string;
  moduleType: "video" | "quiz" | "final_assessment";
  sortOrder: number;
  passingScorePct: number;
  questionLimit: number;
}

interface ModuleProgress {
  moduleId: string;
  status: string;
  score: number | null;
  videoWatchedPct: number | null;
  completedAt: string | null;
}

interface CertData {
  certification: {
    status: string;
    score: number;
    certificateNumber: string;
    certificateName: string | null;
    completedAt: string;
    isCurrentVersion: boolean;
    updatesPending: number;
  } | null;
  moduleProgress: ModuleProgress[];
}

const CERT_LABELS: Record<string, { title: string; subtitle: string }> = {
  platform: { title: "ProCare Certification", subtitle: "MPM Professional Training" },
  procare_certification: { title: "ProCare Certification", subtitle: "MPM Professional Training" },
  business_success: { title: "Business Success Certification", subtitle: "MPM Affiliate & Partner Training" },
};

function statusIcon(status: string, videoWatchedPct?: number | null) {
  if (status === "completed" || status === "passed") return <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />;
  if (status === "in_progress") {
    if (videoWatchedPct != null && videoWatchedPct > 0) return <PlayCircle className="h-5 w-5 text-orange-400 flex-shrink-0" />;
    return <PlayCircle className="h-5 w-5 text-orange-400 flex-shrink-0" />;
  }
  if (status === "quiz_failed") return <Clock className="h-5 w-5 text-red-400 flex-shrink-0" />;
  return <Circle className="h-5 w-5 text-white/20 flex-shrink-0" />;
}

function statusLabel(status: string, moduleType: string, score?: number | null, videoPct?: number | null) {
  if (status === "completed") {
    if (moduleType === "video") return <span className="text-xs text-green-400 font-medium">Watched</span>;
    return <span className="text-xs text-green-400 font-medium">Passed{score != null ? ` · ${score}%` : ""}</span>;
  }
  if (status === "in_progress") {
    if (moduleType === "video" && videoPct != null && videoPct > 0) return <span className="text-xs text-orange-400 font-semibold">{videoPct}% watched — tap to continue</span>;
    return <span className="text-xs text-orange-400 font-semibold">Current — Tap to Continue</span>;
  }
  if (status === "quiz_failed") return <span className="text-xs text-red-400 font-medium">Failed{score != null ? ` (${score}%)` : ""} — Retry</span>;
  return <span className="text-xs text-white/30">Not Started</span>;
}

export default function PlatformCertDashboard() {
  const [location, setLocation] = useLocation();
  const params = useParams<{ certType: string }>();
  const certType = params.certType ?? "platform";
  const meta = CERT_LABELS[certType] ?? CERT_LABELS.platform;

  const { user } = useAuth();
  const [modules, setModules] = useState<CertModule[]>([]);
  const [data, setData] = useState<CertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNameModal, setShowNameModal] = useState(false);
  const [certFirstName, setCertFirstName] = useState("");
  const [certLastName, setCertLastName] = useState("");
  const [nameSaving, setNameSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [modulesRes, progressRes] = await Promise.all([
        apiRequest(`/api/certifications/${certType}/modules`),
        apiRequest(`/api/certifications/${certType}/progress?_t=${Date.now()}`),
      ]);
      setModules((modulesRes as { modules: CertModule[] }).modules ?? []);
      setData(progressRes as CertData);
    } catch {
      setData((prev) => prev ?? { certification: null, moduleProgress: [] });
    } finally {
      setLoading(false);
    }
  }, [certType]);

  useEffect(() => { if (user) load(); }, [user, load]);

  // Gate: professionals must complete personal onboarding before Phase 1 — Platform Mastery
  useEffect(() => {
    if (!user) return;
    if (user.professionalRole && !user.onboardingCompletedAt && certType === "platform") {
      setLocation("/professional-onboarding-bridge");
    }
  }, [user?.id, user?.onboardingCompletedAt, certType]);

  const prevLocationRef = useRef<string | null>(null);
  useEffect(() => {
    const dashPath = `/certifications/${certType}`;
    if (prevLocationRef.current !== null && location === dashPath) {
      setLoading(true);
      load();
    }
    prevLocationRef.current = location;
  }, [location, certType, load]);

  const targetLessonNum = useMemo(() => {
    // Use the shared LESSON_MODULE_TYPES constant so this count stays in sync
    // with resolveScrollTarget — adding a new lesson type in one place is enough.
    const lessonModules = modules.filter((m) =>
      (LESSON_MODULE_TYPES as readonly string[]).includes(m.moduleType),
    );
    const total = lessonModules.length > 0 ? lessonModules.length : undefined;
    return parseLessonParam(window.location.search, total);
  }, [modules]);

  const moduleEls = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    if (loading) return;
    const el = resolveScrollTarget(modules, targetLessonNum, moduleEls.current);
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    }
  }, [loading, targetLessonNum, modules]);

  useEffect(() => {
    apiRequest("/api/certifications/certificate-name").then((d: { certificateName?: string }) => {
      if (d.certificateName) {
        const parts = d.certificateName.trim().split(" ");
        setCertFirstName(parts.slice(0, -1).join(" ") || parts[0]);
        setCertLastName(parts.length > 1 ? parts[parts.length - 1] : "");
      }
    }).catch(() => {});
  }, []);

  const progressMap = new Map((data?.moduleProgress ?? []).map((p) => [p.moduleId, p]));

  function isModuleLocked(idx: number): boolean {
    if (idx === 0) return false;
    const prev = modules[idx - 1];
    const prevProgress = progressMap.get(prev.slug);
    return prevProgress?.status !== "completed";
  }

  function isModuleCompleted(slug: string): boolean {
    return progressMap.get(slug)?.status === "completed";
  }

  const completedCount = modules.filter((m) => isModuleCompleted(m.slug)).length;
  const totalModules = modules.length;
  const progressPct = totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0;
  const allDone = totalModules > 0 && completedCount === totalModules;

  const continueIdx = modules.findIndex((m, i) => {
    if (isModuleLocked(i)) return false;
    const s = progressMap.get(m.slug)?.status ?? "not_started";
    return s !== "completed";
  });
  const continueModule = continueIdx !== -1 ? modules[continueIdx] : null;

  function handleModuleClick(mod: CertModule, idx: number) {
    if (isModuleLocked(idx)) return;
    if (mod.moduleType === "video") {
      setLocation(`/certifications/${certType}/video/${mod.slug}`);
    } else {
      setLocation(`/certifications/${certType}/quiz/${mod.slug}`);
    }
  }

  const handleContinue = () => {
    if (!continueModule) return;
    handleModuleClick(continueModule, continueIdx);
  };

  const handleCompleteWithName = async () => {
    const fullName = `${certFirstName.trim()} ${certLastName.trim()}`.trim();
    if (!fullName) return;
    setNameSaving(true);
    try {
      const json = await apiRequest(`/api/certifications/${certType}/complete`, {
        method: "POST",
        body: JSON.stringify({ certificateName: fullName }),
        headers: { "Content-Type": "application/json" },
      });
      if ((json as { ok: boolean }).ok) {
        if (certType === "procare_certification") {
          setLocation(
            createProfessionalLegalRecoveryUrl(
              `/certifications/${certType}/complete`,
              "professional-workspace",
            ),
          );
        } else {
          setLocation(`/certifications/${certType}/complete`);
        }
      }
    } catch { } finally {
      setNameSaving(false);
    }
  };

  return (
    <motion.div
      className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} pb-28`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className={`fixed top-0 left-0 right-0 z-50 ${BC_HEADER}`} style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <button onClick={() => setLocation("/business-center/academy")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform">
            <ArrowLeft className="h-4 w-4" /> Academy
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white truncate">{meta.title}</h1>
            <p className="text-xs text-white/50">{meta.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="px-4 max-w-2xl mx-auto space-y-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}>

        {/* Certified banner */}
        {data?.certification?.status === "completed" && (
          <motion.div className="flex items-center gap-3 p-4 rounded-2xl bg-green-500/10 border border-green-500/30" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
            <Award className="h-6 w-6 text-green-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Certification Complete</p>
              <p className="text-xs text-white/50 font-mono">{data.certification.certificateNumber}</p>
            </div>
            <button onClick={() => setLocation(`/certifications/${certType}/complete`)} className="px-3 py-1.5 rounded-xl bg-green-500/20 text-green-300 text-xs font-medium active:scale-[0.95] transition-transform">
              View
            </button>
          </motion.div>
        )}

        {/* Progress bar */}
        <div className="p-4 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-white">Progress</span>
            {loading ? <div className="h-4 w-10 rounded bg-white/10 animate-pulse" /> : <span className="text-sm font-bold text-orange-400">{progressPct}%</span>}
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            {loading ? <div className="h-full w-1/3 rounded-full bg-white/10 animate-pulse" /> : (
              <motion.div className="h-full bg-orange-500 rounded-full" animate={{ width: `${progressPct}%` }} transition={{ duration: 0.6, ease: "easeOut" }} />
            )}
          </div>
          {!loading && <p className="text-xs text-white/40">{completedCount} of {totalModules} steps complete</p>}
        </div>

        {/* Continue CTA */}
        {!loading && continueModule && !allDone && !data?.certification && (
          <motion.button
            className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm flex items-center justify-between active:scale-[0.98] transition-transform"
            onClick={handleContinue}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-xs text-orange-200 font-medium uppercase tracking-wide">
                {continueModule.moduleType === "video" ? "Watch Video" : continueModule.moduleType === "final_assessment" ? "Final Assessment" : "Take Quiz"}
              </span>
              <span className="text-base font-bold text-white">{continueModule.title}</span>
            </div>
            {continueModule.moduleType === "video" ? <PlayCircle className="h-6 w-6 text-white/80 flex-shrink-0" /> : <ChevronRight className="h-6 w-6 text-white/80 flex-shrink-0" />}
          </motion.button>
        )}

        {/* Module list */}
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-orange-400/40 border-t-orange-400 rounded-full animate-spin" /></div>
        ) : modules.length === 0 ? (
          <div className="p-6 rounded-2xl bg-black/20 border border-white/5 text-center">
            <p className="text-sm text-white/40">Certification content is being prepared.</p>
            <p className="text-xs text-white/30 mt-1">Check back soon.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {modules.map((mod, i) => {
              const progress = progressMap.get(mod.slug);
              const status = progress?.status ?? "not_started";
              const locked = isModuleLocked(i);
              const isCurrent = i === continueIdx && !allDone;
              const showSeparator = isCurrent && completedCount > 0 && i > 0;

              return (
                <div key={mod.slug} ref={(el) => { if (el) moduleEls.current.set(mod.slug, el); else moduleEls.current.delete(mod.slug); }}>
                  {showSeparator && (
                    <div className="flex items-center gap-3 py-2">
                      <div className="flex-1 h-px bg-white/10" />
                      <span className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">Up Next</span>
                      <div className="flex-1 h-px bg-white/10" />
                    </div>
                  )}
                  <motion.button
                    className={`w-full text-left p-4 rounded-2xl border transition-all duration-200 ${locked ? "bg-black/20 border-white/5 opacity-50 cursor-default" : isCurrent ? "bg-orange-500/10 border-orange-500/30" : status === "completed" ? "bg-black/30 border-white/10" : "bg-black/50 backdrop-blur-md border-white/10 active:scale-[0.98]"}`}
                    onClick={() => !locked && handleModuleClick(mod, i)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <div className="flex items-center gap-3">
                      {locked ? <Lock className="h-5 w-5 text-white/20 flex-shrink-0" /> : statusIcon(status, progress?.videoWatchedPct)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/30 flex-shrink-0">
                            {mod.moduleType === "final_assessment" ? "Final" : mod.moduleType === "video" ? `Video ${Math.ceil((i + 1) / 2)}` : `Quiz ${Math.ceil((i + 1) / 2)}`}
                          </span>
                          <h3 className={`text-sm font-semibold truncate ${status === "completed" ? "text-white/50" : "text-white"}`}>{mod.title}</h3>
                        </div>
                        <div className="mt-0.5">{statusLabel(status, mod.moduleType, progress?.score, progress?.videoWatchedPct)}</div>
                      </div>
                      {mod.moduleType === "video" ? <PlayCircle className="h-4 w-4 text-white/20 flex-shrink-0" /> : <FileText className="h-4 w-4 text-white/20 flex-shrink-0" />}
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
            Claim Your Certificate
          </motion.button>
        )}
      </div>

      {/* Name modal */}
      <AnimatePresence>
        {showNameModal && (
          <motion.div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center px-4 pb-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowNameModal(false)} />
            <motion.div className="relative w-full max-w-sm bg-[#1a1a1a] border border-white/10 rounded-3xl p-6 space-y-5" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}>
              <button className="absolute top-4 right-4 p-1.5 rounded-xl bg-black/40 text-white/50 active:scale-95" onClick={() => setShowNameModal(false)}>✕</button>
              <div>
                <h2 className="text-base font-bold text-white">Before Your Certificate Is Issued</h2>
                <p className="text-xs text-white/50 mt-1 leading-relaxed">Enter your full name exactly as you want it to appear on your certificate.</p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 font-medium">First Name</label>
                  <input type="text" value={certFirstName} onChange={(e) => setCertFirstName(e.target.value)} placeholder="First name" className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50" autoFocus />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-white/50 font-medium">Last Name</label>
                  <input type="text" value={certLastName} onChange={(e) => setCertLastName(e.target.value)} placeholder="Last name" className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-orange-500/50" onKeyDown={(e) => { if (e.key === "Enter" && certFirstName.trim() && certLastName.trim()) handleCompleteWithName(); }} />
                </div>
              </div>
              <button onClick={handleCompleteWithName} disabled={!certFirstName.trim() || !certLastName.trim() || nameSaving} className="w-full p-3.5 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed">
                {nameSaving ? "Issuing Certificate…" : "Issue My Certificate"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
