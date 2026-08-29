import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Bell, CheckCircle2, Play, Clock, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { BC_GRADIENT, BC_HEADER } from "@/components/BusinessCenterShell";
import { AcademyBackButton } from "@/components/AcademyBackButton";

interface UpdateModule {
  id: string;
  title: string;
  description?: string;
  videoUrl?: string;
  isRequired: boolean;
  releasedAt: string;
  userProgress: {
    videoWatched: boolean;
    completed: boolean;
    completedAt: string | null;
  };
}

export default function UpdatesInbox() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [updates, setUpdates] = useState<UpdateModule[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [watchingId, setWatchingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    apiRequest("/api/lms/updates")
      .then((d: { updates: UpdateModule[]; pendingCount: number }) => {
        setUpdates(d.updates ?? []);
        setPendingCount(d.pendingCount ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const handleMarkComplete = async (id: string) => {
    try {
      await apiRequest(`/api/lms/updates/${id}/complete`, { method: "POST" });
      setUpdates((prev) => prev.map((u) => u.id === id ? { ...u, userProgress: { ...u.userProgress, completed: true, completedAt: new Date().toISOString() } } : u));
      setPendingCount((prev) => Math.max(0, prev - 1));
    } catch { }
  };

  const pending = updates.filter((u) => u.isRequired && !u.userProgress.completed);
  const completed = updates.filter((u) => u.userProgress.completed);
  const optional = updates.filter((u) => !u.isRequired && !u.userProgress.completed);

  return (
    <motion.div
      className={`min-h-screen bg-gradient-to-br ${BC_GRADIENT} pb-28`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className={`fixed top-0 left-0 right-0 z-50 ${BC_HEADER}`} style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="px-4 py-3 flex items-center gap-3 max-w-2xl mx-auto">
          <AcademyBackButton onClick={() => setLocation("/learning")} />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white">Platform Updates</h1>
            <p className="text-xs text-white/40">{pendingCount > 0 ? `${pendingCount} pending` : "All caught up"}</p>
          </div>
        </div>
      </div>

      <div className="px-4 max-w-2xl mx-auto space-y-5" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 5.5rem)" }}>
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-orange-400/40 border-t-orange-400 rounded-full animate-spin" /></div>
        ) : updates.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Bell className="h-10 w-10 text-white/20" />
            <p className="text-sm text-white/40">No platform updates yet.</p>
            <p className="text-xs text-white/30">New builders, protocols, and features will appear here.</p>
          </div>
        ) : (
          <>
            {/* Pending required */}
            {pending.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-amber-400 uppercase tracking-widest font-semibold px-1">Required Updates</p>
                {pending.map((u, i) => (
                  <motion.div key={u.id} className="rounded-2xl bg-amber-500/10 border border-amber-500/30 overflow-hidden" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <button className="w-full text-left p-4" onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}>
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white">{u.title}</p>
                          {u.description && <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{u.description}</p>}
                          <p className="text-xs text-white/30 mt-1">{new Date(u.releasedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
                        </div>
                        <span className="text-xs text-amber-400 font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 flex-shrink-0">Required</span>
                      </div>
                    </button>
                    {expandedId === u.id && (
                      <motion.div className="px-4 pb-4 space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        {u.videoUrl && (
                          <video
                            key={watchingId === u.id ? "active" : "idle"}
                            src={u.videoUrl}
                            className="w-full aspect-video rounded-xl"
                            controls
                            playsInline
                            onPlay={() => setWatchingId(u.id)}
                            onEnded={() => {
                              apiRequest(`/api/lms/updates/${u.id}/watch`, { method: "POST" }).catch(() => {});
                            }}
                          />
                        )}
                        <button onClick={() => handleMarkComplete(u.id)} className="w-full p-3.5 rounded-2xl bg-amber-500 text-black font-bold text-sm active:scale-[0.98] transition-transform">
                          Mark as Complete
                        </button>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {/* Optional */}
            {optional.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-white/40 uppercase tracking-widest font-semibold px-1">Optional Updates</p>
                {optional.map((u, i) => (
                  <motion.div key={u.id} className="rounded-2xl bg-black/30 border border-white/10 overflow-hidden" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <button className="w-full text-left p-4" onClick={() => setExpandedId(expandedId === u.id ? null : u.id)}>
                      <div className="flex items-start gap-3">
                        <Bell className="h-5 w-5 text-white/30 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white">{u.title}</p>
                          {u.description && <p className="text-xs text-white/50 mt-0.5 leading-relaxed">{u.description}</p>}
                        </div>
                      </div>
                    </button>
                    {expandedId === u.id && (
                      <motion.div className="px-4 pb-4 space-y-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        {u.videoUrl && <video src={u.videoUrl} className="w-full aspect-video rounded-xl" controls playsInline onEnded={() => apiRequest(`/api/lms/updates/${u.id}/watch`, { method: "POST" }).catch(() => {})} />}
                        <button onClick={() => handleMarkComplete(u.id)} className="w-full p-3.5 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.98] transition-transform">
                          Mark as Complete
                        </button>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {/* Completed */}
            {completed.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-green-400/60 uppercase tracking-widest font-semibold px-1">Completed</p>
                {completed.map((u, i) => (
                  <motion.div key={u.id} className="p-4 rounded-2xl bg-black/20 border border-white/5 flex items-center gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                    <CheckCircle2 className="h-5 w-5 text-green-400/50 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white/50">{u.title}</p>
                      {u.userProgress.completedAt && <p className="text-xs text-white/25 mt-0.5">Completed {new Date(u.userProgress.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
