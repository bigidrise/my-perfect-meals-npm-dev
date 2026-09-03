import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { CheckCircle2, Play, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";
import { AcademyBackButton } from "@/components/AcademyBackButton";

interface CertModule {
  slug: string;
  title: string;
  description?: string;
  moduleType: string;
  videoUrl?: string;
  sortOrder: number;
}

function extractYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

export default function PlatformCertVideo() {
  const [, setLocation] = useLocation();
  const params = useParams<{ certType: string; slug: string }>();
  const certType = params.certType ?? "platform";
  const slug = params.slug ?? "";

  const [module, setModule] = useState<CertModule | null>(null);
  const [nextModule, setNextModule] = useState<CertModule | null>(null);
  const [videoWatchedPct, setVideoWatchedPct] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showIntro, setShowIntro] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const lastReportedRef = useRef(0);
  const viewedRef = useRef(false);
  const ytPlayerRef = useRef<any>(null);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const youtubeId = module?.videoUrl ? extractYouTubeId(module.videoUrl) : null;

  useEffect(() => {
    if (!slug) return;
    apiRequest(`/api/certifications/${certType}/modules`)
      .then((data: { modules: CertModule[] }) => {
        const mods = data.modules ?? [];
        const mod = mods.find((m) => m.slug === slug);
        if (mod) setModule(mod);
        const idx = mods.findIndex((m) => m.slug === slug);
        const next = mods[idx + 1];
        if (next) setNextModule(next);
      })
      .catch(() => {});

    apiRequest(`/api/certifications/${certType}/progress?_t=${Date.now()}`)
      .then((d: { moduleProgress?: Array<{ moduleId: string; status: string; videoWatchedPct: number | null }> }) => {
        const prog = d.moduleProgress?.find((p) => p.moduleId === slug);
        if (prog) {
          setVideoWatchedPct(prog.videoWatchedPct ?? 0);
          if (prog.status === "completed") {
            setIsCompleted(true);
            setShowIntro(false);
          }
        }
      })
      .catch(() => {});

    if (!viewedRef.current) {
      viewedRef.current = true;
      apiRequest(`/api/certifications/${certType}/modules/${slug}/view`, { method: "POST" }).catch(() => {});
    }
  }, [certType, slug]);

  const reportProgress = useCallback((pct: number) => {
    if (pct - lastReportedRef.current < 5 && pct < 99) return;
    lastReportedRef.current = pct;
    apiRequest(`/api/certifications/${certType}/modules/${slug}/video-progress`, {
      method: "POST",
      body: JSON.stringify({ pct }),
      headers: { "Content-Type": "application/json" },
    }).then((res: { status?: string }) => {
      if (res.status === "completed") setIsCompleted(true);
    }).catch(() => {});
  }, [certType, slug]);

  const handleVideoComplete = useCallback(() => {
    if (isCompleted) return;
    setIsCompleted(true);
    setIsPlaying(false);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    reportProgress(100);
  }, [isCompleted, reportProgress]);

  // Regular <video> handlers — complete only on ended
  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    const pct = Math.round((v.currentTime / v.duration) * 100);
    setVideoWatchedPct(pct);
    reportProgress(pct);
  }, [reportProgress]);

  // YouTube IFrame API setup
  useEffect(() => {
    if (!youtubeId || isCompleted || showIntro) return;

    const initPlayer = () => {
      if (!ytContainerRef.current) return;
      const player = new (window as any).YT.Player(ytContainerRef.current, {
        videoId: youtubeId,
        width: "100%",
        height: "100%",
        playerVars: { controls: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onStateChange: (e: any) => {
            const PLAYING = 1, PAUSED = 2, ENDED = 0;
            if (e.data === PLAYING) {
              setIsPlaying(true);
              if (progressTimerRef.current) clearInterval(progressTimerRef.current);
              progressTimerRef.current = setInterval(() => {
                try {
                  const cur = player.getCurrentTime?.();
                  const dur = player.getDuration?.();
                  if (cur && dur && dur > 0) {
                    const pct = Math.min(99, Math.round((cur / dur) * 100));
                    setVideoWatchedPct(pct);
                    reportProgress(pct);
                  }
                } catch {}
              }, 3000);
            }
            if (e.data === PAUSED) {
              setIsPlaying(false);
              if (progressTimerRef.current) clearInterval(progressTimerRef.current);
            }
            if (e.data === ENDED) {
              if (progressTimerRef.current) clearInterval(progressTimerRef.current);
              handleVideoComplete();
            }
          },
        },
      });
      ytPlayerRef.current = player;
    };

    const loadAPI = () => {
      if ((window as any).YT?.Player) {
        initPlayer();
      } else {
        const prev = (window as any).onYouTubeIframeAPIReady;
        (window as any).onYouTubeIframeAPIReady = () => {
          prev?.();
          initPlayer();
        };
        if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
          const tag = document.createElement("script");
          tag.src = "https://www.youtube.com/iframe_api";
          document.head.appendChild(tag);
        }
      }
    };

    loadAPI();

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      try { ytPlayerRef.current?.destroy?.(); } catch {}
      ytPlayerRef.current = null;
    };
  }, [youtubeId, isCompleted, showIntro, reportProgress, handleVideoComplete]);

  const goToQuiz = () => {
    if (!nextModule) { setLocation(`/certifications/${certType}`); return; }
    if (nextModule.moduleType === "video") {
      setLocation(`/certifications/${certType}/video/${nextModule.slug}`);
    } else {
      setLocation(`/certifications/${certType}/quiz/${nextModule.slug}`);
    }
  };

  // ── INTRO SCREEN ──────────────────────────────────────────────────────────
  const CERT_LABELS: Record<string, string> = {
    platform: "ProCare Certification",
    business_success: "Business Success Certification",
  };
  const certLabel = CERT_LABELS[certType] ?? "Certification";

  if (showIntro && !isCompleted) {
    return (
      <motion.div
        className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} pb-28`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className={`academy-navigation-header fixed top-0 left-0 right-0 z-50 ${BC_HEADER}`} style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
            <AcademyBackButton onClick={() => setLocation(`/certifications/${certType}`)} />
            <h1 className="text-base font-bold text-white">{certLabel}</h1>
          </div>
        </div>

        <div className="px-4 max-w-2xl mx-auto flex flex-col items-center justify-center min-h-screen gap-8" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 4rem)" }}>
          <motion.div
            className="w-full space-y-6 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="h-24 w-24 rounded-full bg-orange-500/20 border-2 border-orange-500/40 flex items-center justify-center mx-auto">
              <Play className="h-10 w-10 text-orange-400 ml-1" />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-orange-400 font-semibold uppercase tracking-widest">{certLabel}</p>
              <h1 className="text-2xl font-black text-white leading-tight">
                {module?.title ?? "Training Video"}
              </h1>
              {module?.description && (
                <p className="text-sm text-white/60 leading-relaxed max-w-sm mx-auto">{module.description}</p>
              )}
            </div>

            <div className="flex items-center justify-center gap-6 text-xs text-white/40 pt-2">
              <span>Watch full video to continue</span>
              <span>·</span>
              <span>Knowledge check required</span>
              <span>·</span>
              <span>80% to pass</span>
            </div>

            <button
              onClick={() => setShowIntro(false)}
              className="w-full max-w-sm mx-auto p-4 rounded-2xl bg-orange-600 text-white font-bold text-base active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            >
              <Play className="h-5 w-5" />
              Start Training
            </button>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  // ── VIDEO SCREEN ──────────────────────────────────────────────────────────
  return (
    <motion.div
      className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} pb-28`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className={`academy-navigation-header fixed top-0 left-0 right-0 z-50 ${BC_HEADER}`} style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <AcademyBackButton onClick={() => setLocation(`/certifications/${certType}`)} />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white truncate">{module?.title ?? "Training Video"}</h1>
            <p className="text-xs text-white/40">{isCompleted ? "Training complete" : "Watch to the end to unlock the quiz"}</p>
          </div>
          {isCompleted && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-green-500/20 border border-green-500/30">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
              <span className="text-xs text-green-400 font-semibold">Complete</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 max-w-2xl mx-auto space-y-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}>

        {module?.description && !isCompleted && (
          <p className="text-xs text-white/40 leading-relaxed px-1">{module.description}</p>
        )}

        {/* Video player */}
        <div className="rounded-2xl overflow-hidden bg-black border border-white/10">
          {youtubeId ? (
            <div className="relative aspect-video">
              <div ref={ytContainerRef} className="absolute inset-0 w-full h-full" />
            </div>
          ) : module?.videoUrl ? (
            <video
              ref={videoRef}
              src={module.videoUrl}
              className="w-full aspect-video"
              controls
              playsInline
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => handleVideoComplete()}
            />
          ) : (
            <div className="aspect-video flex flex-col items-center justify-center gap-3 bg-black/60">
              <div className="h-14 w-14 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                <Lock className="h-6 w-6 text-orange-400/50" />
              </div>
              <p className="text-sm text-white/50 font-medium">Video Coming Soon</p>
              <p className="text-xs text-white/30">This training video is being prepared.</p>
            </div>
          )}
        </div>

        {/* Progress bar — shown while watching */}
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
            <p className="text-xs text-white/30">Watch to the end to unlock the Knowledge Check</p>
          </div>
        )}

        {/* Admin bypass — no video URL only */}
        {!module?.videoUrl && !isCompleted && (
          <button
            onClick={() => handleVideoComplete()}
            className="w-full p-3 rounded-xl bg-black/40 border border-white/10 text-xs text-white/50 active:scale-[0.98] transition-transform"
          >
            Mark as Watched (video not yet available)
          </button>
        )}

        {/* Completion state — Proceed to Knowledge Check */}
        {isCompleted && (
          <motion.div className="space-y-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-green-500/10 border border-green-500/30">
              <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">Training Complete</p>
                <p className="text-xs text-white/50">You've unlocked the Knowledge Check for this module.</p>
              </div>
            </div>
            {nextModule && (
              <button
                onClick={goToQuiz}
                className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform"
              >
                Proceed to Knowledge Check →
              </button>
            )}
            {!nextModule && (
              <button
                onClick={() => setLocation(`/certifications/${certType}`)}
                className="w-full p-4 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform"
              >
                Return to Overview
              </button>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
