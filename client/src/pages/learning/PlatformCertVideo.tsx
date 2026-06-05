import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, CheckCircle2, Play, Pause } from "lucide-react";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";

interface CertModule {
  slug: string;
  title: string;
  description?: string;
  moduleType: string;
  videoUrl?: string;
  sortOrder: number;
}

export default function PlatformCertVideo() {
  const [, setLocation] = useLocation();
  const params = useParams<{ certType: string; slug: string }>();
  const certType = params.certType ?? "platform";
  const slug = params.slug ?? "";

  const [module, setModule] = useState<CertModule | null>(null);
  const [nextSlug, setNextSlug] = useState<string | null>(null);
  const [videoWatchedPct, setVideoWatchedPct] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastReportedRef = useRef(0);
  const viewedRef = useRef(false);

  useEffect(() => {
    if (!slug) return;
    apiRequest(`/api/certifications/${certType}/modules`)
      .then((data: { modules: CertModule[] }) => {
        const mods = data.modules ?? [];
        const mod = mods.find((m) => m.slug === slug);
        if (mod) setModule(mod);
        const idx = mods.findIndex((m) => m.slug === slug);
        const next = mods[idx + 1];
        if (next) setNextSlug(next.slug);
      })
      .catch(() => {});

    apiRequest(`/api/certifications/${certType}/progress?_t=${Date.now()}`)
      .then((d: { moduleProgress?: Array<{ moduleId: string; status: string; videoWatchedPct: number | null }> }) => {
        const prog = d.moduleProgress?.find((p) => p.moduleId === slug);
        if (prog) {
          setVideoWatchedPct(prog.videoWatchedPct ?? 0);
          if (prog.status === "completed") setIsCompleted(true);
        }
      })
      .catch(() => {});

    if (!viewedRef.current) {
      viewedRef.current = true;
      apiRequest(`/api/certifications/${certType}/modules/${slug}/view`, { method: "POST" }).catch(() => {});
    }
  }, [certType, slug]);

  const reportProgress = useCallback((pct: number) => {
    if (pct - lastReportedRef.current < 5 && pct < 90) return;
    lastReportedRef.current = pct;
    apiRequest(`/api/certifications/${certType}/modules/${slug}/video-progress`, {
      method: "POST",
      body: JSON.stringify({ pct }),
      headers: { "Content-Type": "application/json" },
    }).then((res: { status?: string }) => {
      if (res.status === "completed") setIsCompleted(true);
    }).catch(() => {});
  }, [certType, slug]);

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const pct = Math.round((v.currentTime / v.duration) * 100);
    setVideoWatchedPct(pct);
    if (pct >= 90 && !isCompleted) {
      setIsCompleted(true);
      reportProgress(pct);
    } else {
      reportProgress(pct);
    }
  }, [isCompleted, reportProgress]);

  const handleContinue = () => {
    if (!nextSlug) {
      setLocation(`/certifications/${certType}`);
      return;
    }
    // next module slug — could be quiz or another video
    const moduleTypeGuess = nextSlug.startsWith("quiz") ? "quiz" : nextSlug === "final" ? "quiz" : "video";
    if (moduleTypeGuess === "video") {
      setLocation(`/certifications/${certType}/video/${nextSlug}`);
    } else {
      setLocation(`/certifications/${certType}/quiz/${nextSlug}`);
    }
  };

  // Actually we need to check next module type from the list
  const [nextModuleType, setNextModuleType] = useState<string | null>(null);
  useEffect(() => {
    if (!nextSlug) return;
    apiRequest(`/api/certifications/${certType}/modules`)
      .then((data: { modules: CertModule[] }) => {
        const next = (data.modules ?? []).find((m) => m.slug === nextSlug);
        if (next) setNextModuleType(next.moduleType);
      }).catch(() => {});
  }, [certType, nextSlug]);

  const goToNext = () => {
    if (!nextSlug) { setLocation(`/certifications/${certType}`); return; }
    if (nextModuleType === "video") {
      setLocation(`/certifications/${certType}/video/${nextSlug}`);
    } else {
      setLocation(`/certifications/${certType}/quiz/${nextSlug}`);
    }
  };

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-900 to-black/80 pb-28"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/10" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <button onClick={() => setLocation(`/certifications/${certType}`)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white truncate">{module?.title ?? "Training Video"}</h1>
            <p className="text-xs text-white/40">Watch to unlock the quiz</p>
          </div>
          {isCompleted && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-green-500/20 border border-green-500/30">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
              <span className="text-xs text-green-400 font-semibold">Watched</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 max-w-2xl mx-auto space-y-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}>

        {/* Module description */}
        {module?.description && (
          <p className="text-xs text-white/40 leading-relaxed px-1">{module.description}</p>
        )}

        {/* Video player */}
        <div className="rounded-2xl overflow-hidden bg-black border border-white/10">
          {module?.videoUrl ? (
            <div className="relative">
              <video
                ref={videoRef}
                src={module.videoUrl}
                className="w-full aspect-video"
                controls
                playsInline
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => {
                  setIsPlaying(false);
                  reportProgress(100);
                  setIsCompleted(true);
                }}
              />
            </div>
          ) : (
            <div className="aspect-video flex flex-col items-center justify-center gap-3 bg-black/60">
              <div className="h-14 w-14 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                <Play className="h-6 w-6 text-orange-400 ml-1" />
              </div>
              <p className="text-sm text-white/50 font-medium">Video Coming Soon</p>
              <p className="text-xs text-white/30">This training video is being prepared.</p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {!isCompleted && videoWatchedPct > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">Watch progress</span>
              <span className="text-xs text-orange-400 font-semibold">{videoWatchedPct}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-orange-500 rounded-full"
                animate={{ width: `${videoWatchedPct}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-xs text-white/30">Watch at least 90% to unlock the quiz</p>
          </div>
        )}

        {/* If no video URL, allow bypass for admin/testing */}
        {!module?.videoUrl && (
          <button
            onClick={() => { setIsCompleted(true); reportProgress(100); }}
            className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white/40 active:scale-[0.98] transition-transform"
          >
            Mark as Watched (video not yet available)
          </button>
        )}

        {/* Continue button — appears when ≥90% watched */}
        {isCompleted && (
          <motion.div className="space-y-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-green-500/10 border border-green-500/30">
              <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">Video Complete</p>
                <p className="text-xs text-white/50">You've unlocked the quiz for this module.</p>
              </div>
            </div>
            {nextSlug && (
              <button
                onClick={goToNext}
                className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform"
              >
                Continue to Quiz →
              </button>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
