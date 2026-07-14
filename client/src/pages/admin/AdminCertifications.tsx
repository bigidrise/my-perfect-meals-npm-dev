import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Plus, Trash2, Edit3, Save, X, ChevronDown, ChevronUp, RefreshCw, Mail, Send, ArrowUpDown, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

type Tab = "modules" | "questions" | "progress" | "updates" | "waitlist";

interface CertModule {
  id: string;
  certType: string;
  slug: string;
  title: string;
  description?: string;
  moduleType: string;
  videoUrl?: string;
  sortOrder: number;
  passingScorePct: number;
  questionLimit: number;
  isActive: boolean;
}

interface Question {
  id: string;
  certType: string;
  moduleSlug: string;
  questionText: string;
  isActive: boolean;
  sortOrder: number;
  options: Array<{ id: string; optionText: string; isCorrect: boolean; sortOrder: number }>;
}

interface UpdateModule {
  id: string;
  title: string;
  description?: string;
  videoUrl?: string;
  isRequired: boolean;
  releasedAt?: string;
}

interface ProgressRow {
  userId: string;
  certType: string;
  status: string;
  score?: number;
  completedAt?: string;
  certificateNumber?: string;
}

interface WaitlistRow {
  userId: string;
  email: string;
  firstName?: string;
  username?: string;
  status: string;
  notifiedAt?: string | null;
  emailSentAt?: string | null;
  createdAt?: string;
}

interface RecoveryEvent {
  id: string;
  recoveredAt: string;
  rowCount: number;
  userIds: string[];
}

const CERT_TYPES = ["platform", "business_success"];

export default function AdminCertifications() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("modules");
  const [selectedCertType, setSelectedCertType] = useState("platform");

  // Modules state
  const [modules, setModules] = useState<CertModule[]>([]);
  const [editingModule, setEditingModule] = useState<CertModule | null>(null);
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [savingModuleId, setSavingModuleId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Questions state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState({ certType: "platform", moduleSlug: "", questionText: "", options: [{ text: "", isCorrect: false }, { text: "", isCorrect: false }] });
  const [showNewQ, setShowNewQ] = useState(false);
  const [savingQuestion, setSavingQuestion] = useState(false);

  // Updates state
  const [updates, setUpdates] = useState<UpdateModule[]>([]);
  const [newUpdate, setNewUpdate] = useState({ title: "", description: "", videoUrl: "", isRequired: false });
  const [showNewUpdate, setShowNewUpdate] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);

  // Progress state
  const [progress, setProgress] = useState<ProgressRow[]>([]);

  // Waitlist state
  const [waitlist, setWaitlist] = useState<WaitlistRow[]>([]);
  const [waitlistStats, setWaitlistStats] = useState<{
    total: number;
    notified: number;
    pending: number;
    oldestEntry: string | null;
    newestEntry: string | null;
    previewEmails: string[];
  } | null>(null);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [waitlistFilter, setWaitlistFilter] = useState<"all" | "notified" | "pending">("all");
  const [waitlistSort, setWaitlistSort] = useState<"notified-desc" | "notified-asc" | "joined-desc">("joined-desc");
  const [notifyResult, setNotifyResult] = useState<{
    sent: number;
    skipped: number;
    failed: number;
    failures: string[];
  } | null>(null);
  const [notifyError, setNotifyError] = useState<string | null>(null);
  const [emailConfigured, setEmailConfigured] = useState<boolean | null>(null);
  const [recoveryEvents, setRecoveryEvents] = useState<RecoveryEvent[]>([]);
  const [expandedRecovery, setExpandedRecovery] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const flash = (msg: string) => { setMessage(msg); setTimeout(() => setMessage(null), 3000); };

  // Load waitlist stats when switching to waitlist tab
  useEffect(() => {
    if (!user || tab !== "waitlist") return;
    setWaitlistLoading(true);
    setNotifyResult(null);
    setNotifyError(null);
    Promise.all([
      apiRequest("/api/admin/certifications/marketing-coaching/waitlist-stats"),
      apiRequest("/api/admin/certifications/marketing-coaching/waitlist"),
      apiRequest("/api/admin/config/email-status"),
      apiRequest("/api/admin/certifications/marketing-coaching/recovery-events").catch(() => ({ events: [] })),
    ])
      .then(([stats, list, emailStatus, recovery]: any) => {
        setWaitlistStats(stats);
        setWaitlist(list.waitlist ?? []);
        setEmailConfigured(emailStatus?.configured ?? false);
        setRecoveryEvents(recovery.events ?? []);
      })
      .catch(() => {})
      .finally(() => setWaitlistLoading(false));
  }, [user, tab]);

  // Load data when tab/certType changes
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    if (tab === "modules") {
      apiRequest(`/api/admin/certifications/modules/${selectedCertType}`)
        .then((d: { modules: CertModule[] }) => setModules(d.modules ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else if (tab === "questions") {
      apiRequest(`/api/admin/certifications/questions/${selectedCertType}`)
        .then((d: { questions: Question[] }) => setQuestions(d.questions ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else if (tab === "progress") {
      apiRequest(`/api/admin/certifications/progress?certType=${selectedCertType}&limit=100`)
        .then((d: { progress: ProgressRow[] }) => setProgress(d.progress ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else if (tab === "updates") {
      apiRequest(`/api/admin/certifications/updates`)
        .then((d: { updates: UpdateModule[] }) => setUpdates(d.updates ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      // waitlist tab uses its own dedicated loading state
      setLoading(false);
    }
  }, [user, tab, selectedCertType]);

  const handleSaveVideoUrl = async (mod: CertModule) => {
    setSavingModuleId(mod.id);
    try {
      await apiRequest(`/api/admin/certifications/modules/${mod.id}`, {
        method: "PUT",
        body: JSON.stringify({ title: mod.title, description: mod.description, videoUrl: editingModule?.videoUrl ?? mod.videoUrl, sortOrder: mod.sortOrder, passingScorePct: mod.passingScorePct, questionLimit: mod.questionLimit, isActive: mod.isActive }),
        headers: { "Content-Type": "application/json" },
      });
      setModules((prev) => prev.map((m) => m.id === mod.id ? { ...m, videoUrl: editingModule?.videoUrl ?? m.videoUrl } : m));
      setEditingModule(null);
      flash("Saved!");
    } catch { flash("Save failed"); }
    finally { setSavingModuleId(null); }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await apiRequest(`/api/admin/certifications/seed/${selectedCertType}`, { method: "POST" }) as { message: string };
      flash(res.message);
      // Reload
      const d = await apiRequest(`/api/admin/certifications/modules/${selectedCertType}`) as { modules: CertModule[] };
      setModules(d.modules ?? []);
    } catch { flash("Seed failed"); }
    finally { setSeeding(false); }
  };

  const handleCreateQuestion = async () => {
    if (!newQuestion.questionText.trim() || newQuestion.options.filter(o => o.text.trim()).length < 2) {
      flash("Enter question text and at least 2 options");
      return;
    }
    setSavingQuestion(true);
    try {
      await apiRequest("/api/admin/certifications/questions", {
        method: "POST",
        body: JSON.stringify({
          certType: selectedCertType,
          moduleSlug: newQuestion.moduleSlug,
          questionText: newQuestion.questionText,
          options: newQuestion.options.filter(o => o.text.trim()).map(o => ({ text: o.text, isCorrect: o.isCorrect })),
        }),
        headers: { "Content-Type": "application/json" },
      });
      const d = await apiRequest(`/api/admin/certifications/questions/${selectedCertType}`) as { questions: Question[] };
      setQuestions(d.questions ?? []);
      setNewQuestion({ certType: selectedCertType, moduleSlug: "", questionText: "", options: [{ text: "", isCorrect: false }, { text: "", isCorrect: false }] });
      setShowNewQ(false);
      flash("Question created");
    } catch { flash("Failed to create question"); }
    finally { setSavingQuestion(false); }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm("Delete this question?")) return;
    try {
      await apiRequest(`/api/admin/certifications/questions/${id}`, { method: "DELETE" });
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      flash("Deleted");
    } catch { flash("Delete failed"); }
  };

  const handleCreateUpdate = async () => {
    if (!newUpdate.title.trim()) { flash("Title required"); return; }
    setSavingUpdate(true);
    try {
      await apiRequest("/api/admin/certifications/updates", {
        method: "POST",
        body: JSON.stringify({ ...newUpdate, releasedAt: new Date().toISOString() }),
        headers: { "Content-Type": "application/json" },
      });
      const d = await apiRequest("/api/admin/certifications/updates") as { updates: UpdateModule[] };
      setUpdates(d.updates ?? []);
      setNewUpdate({ title: "", description: "", videoUrl: "", isRequired: false });
      setShowNewUpdate(false);
      flash("Update module created and released");
    } catch { flash("Failed to create update"); }
    finally { setSavingUpdate(false); }
  };

  const handleDeleteUpdate = async (id: string) => {
    if (!confirm("Delete this update?")) return;
    try {
      await apiRequest(`/api/admin/certifications/updates/${id}`, { method: "DELETE" });
      setUpdates((prev) => prev.filter((u) => u.id !== id));
      flash("Deleted");
    } catch { flash("Delete failed"); }
  };

  const handleNotifyWaitlist = async (force = false) => {
    if (notifying) return;
    const confirmed = confirm(force
      ? "Re-notify ALL waitlisted users (including already-notified)? This will send duplicate emails to anyone already notified."
      : "Send enrollment-open emails to all un-notified waitlisted users?");
    if (!confirmed) return;
    setNotifying(true);
    setNotifyResult(null);
    setNotifyError(null);
    try {
      const url = `/api/admin/certifications/marketing-coaching/notify-waitlist${force ? "?force=true" : ""}`;
      const res = await apiRequest(url, { method: "POST" }) as { ok: boolean; sent: number; skipped: number; failed: number; failures: string[] };
      setNotifyResult({ sent: res.sent, skipped: res.skipped, failed: res.failed, failures: res.failures ?? [] });
      flash(`Done — ${res.sent} sent, ${res.skipped} skipped, ${res.failed} failed`);
      const [stats, listData] = await Promise.all([
        apiRequest(`/api/admin/certifications/marketing-coaching/waitlist-stats`) as Promise<{ total: number; notified: number; pending: number; previewEmails: string[] }>,
        apiRequest(`/api/admin/certifications/marketing-coaching/waitlist`) as Promise<{ waitlist: WaitlistRow[] }>,
      ]);
      setWaitlistStats(stats);
      setWaitlist(listData.waitlist ?? []);
    } catch (err: any) {
      const msg = err?.message || "Notify failed";
      if (msg.includes("already in progress")) {
        flash("A notify job is already running — please wait.");
      } else {
        setNotifyError(msg);
      }
    } finally {
      setNotifying(false);
    }
  };


  const tabCls = (t: Tab) => `px-4 py-2 rounded-xl text-xs font-semibold transition-all ${tab === t ? "bg-orange-600 text-white" : "bg-white/5 text-white/50 active:scale-[0.96]"}`;

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 pb-28"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/10" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <div className="px-4 py-3 flex items-center gap-3 max-w-3xl mx-auto">
          <button onClick={() => setLocation("/")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs font-medium active:scale-[0.95] transition-transform">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white">Certification Admin</h1>
            <p className="text-xs text-white/40">Content management panel</p>
          </div>
        </div>
        <div className="px-4 pb-3 max-w-3xl mx-auto flex items-center gap-2 overflow-x-auto">
          <button className={tabCls("modules")} onClick={() => setTab("modules")}>Modules</button>
          <button className={tabCls("questions")} onClick={() => setTab("questions")}>Questions</button>
          <button className={tabCls("progress")} onClick={() => setTab("progress")}>Progress</button>
          <button className={tabCls("updates")} onClick={() => setTab("updates")}>Updates</button>
          <button className={tabCls("waitlist")} onClick={() => setTab("waitlist")}>Waitlist</button>
        </div>
      </div>

      <div className="px-4 max-w-3xl mx-auto space-y-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 7.5rem)" }}>
        {/* Flash message */}
        <AnimatePresence>
          {message && (
            <motion.div className="p-3 rounded-xl bg-orange-500/20 border border-orange-500/30 text-sm text-orange-300 text-center" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {message}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cert type selector (not for updates or waitlist tabs) */}
        {tab !== "updates" && tab !== "waitlist" && (
          <div className="flex gap-2">
            {CERT_TYPES.map((ct) => (
              <button key={ct} onClick={() => setSelectedCertType(ct)} className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${selectedCertType === ct ? "bg-white/20 text-white" : "bg-white/5 text-white/40 active:scale-[0.96]"}`}>
                {ct === "platform" ? "Platform Cert" : "Business Success"}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-orange-400/40 border-t-orange-400 rounded-full animate-spin" /></div>
        ) : (
          <>
            {/* ── MODULES TAB ── */}
            {tab === "modules" && (
              <div className="space-y-3">
                {modules.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-black/20 border border-white/5 text-center space-y-3">
                    <p className="text-sm text-white/40">No modules yet for {selectedCertType}.</p>
                    <button onClick={handleSeed} disabled={seeding} className="px-5 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-semibold active:scale-[0.97] disabled:opacity-40">
                      {seeding ? "Seeding…" : `Seed ${selectedCertType === "platform" ? "Platform" : "Business Success"} Certification`}
                    </button>
                  </div>
                ) : (
                  <>
                    {modules.map((mod) => (
                      <div key={mod.id} className="p-4 rounded-2xl bg-black/30 border border-white/10 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-white/30 font-semibold uppercase tracking-wider">{mod.moduleType}</span>
                              <span className="text-[10px] text-white/20">#{mod.sortOrder}</span>
                            </div>
                            <p className="text-sm font-semibold text-white mt-0.5">{mod.title}</p>
                            {mod.description && <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{mod.description}</p>}
                          </div>
                        </div>

                        {/* Video URL editor for video modules */}
                        {mod.moduleType === "video" && (
                          <div className="space-y-2">
                            <p className="text-xs text-white/50 font-medium">Video URL</p>
                            {editingModule?.id === mod.id ? (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={editingModule.videoUrl ?? ""}
                                  onChange={(e) => setEditingModule({ ...editingModule, videoUrl: e.target.value })}
                                  placeholder="https://storage.example.com/video.mp4"
                                  className="flex-1 bg-white/5 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50"
                                />
                                <button onClick={() => handleSaveVideoUrl(mod)} disabled={savingModuleId === mod.id} className="px-3 py-2 rounded-xl bg-orange-600 text-white text-xs font-semibold active:scale-[0.96] disabled:opacity-40">
                                  {savingModuleId === mod.id ? "…" : <Save className="h-3.5 w-3.5" />}
                                </button>
                                <button onClick={() => setEditingModule(null)} className="px-3 py-2 rounded-xl bg-white/10 text-white/50 text-xs active:scale-[0.96]">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <p className={`text-xs flex-1 truncate font-mono ${mod.videoUrl ? "text-orange-400" : "text-white/20"}`}>
                                  {mod.videoUrl ?? "No URL set"}
                                </p>
                                <button onClick={() => setEditingModule({ ...mod })} className="px-3 py-1.5 rounded-xl bg-white/10 text-white/60 text-xs font-medium active:scale-[0.96]">
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Quiz config */}
                        {(mod.moduleType === "quiz" || mod.moduleType === "final_assessment") && (
                          <div className="flex items-center gap-4 text-xs text-white/40">
                            <span>Passing: {mod.passingScorePct}%</span>
                            <span>Questions: {mod.questionLimit}</span>
                          </div>
                        )}
                      </div>
                    ))}
                    <button onClick={handleSeed} disabled={seeding} className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white/40 flex items-center justify-center gap-2 active:scale-[0.97]">
                      <RefreshCw className="h-3.5 w-3.5" />
                      {seeding ? "Checking…" : "Re-seed (no-op if already seeded)"}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ── QUESTIONS TAB ── */}
            {tab === "questions" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/40">{questions.length} question{questions.length !== 1 ? "s" : ""} for {selectedCertType}</p>
                  <button onClick={() => setShowNewQ(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 text-white text-xs font-semibold active:scale-[0.96]">
                    <Plus className="h-3.5 w-3.5" /> Add Question
                  </button>
                </div>

                {/* New question form */}
                <AnimatePresence>
                  {showNewQ && (
                    <motion.div className="p-4 rounded-2xl bg-black/40 border border-orange-500/30 space-y-3" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                      <div className="space-y-1.5">
                        <label className="text-xs text-white/50">Module</label>
                        <select value={newQuestion.moduleSlug} onChange={(e) => setNewQuestion({ ...newQuestion, moduleSlug: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50">
                          <option value="">Select module…</option>
                          {modules.filter(m => m.moduleType === "quiz").map(m => <option key={m.slug} value={m.slug}>{m.title}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-white/50">Question</label>
                        <textarea value={newQuestion.questionText} onChange={(e) => setNewQuestion({ ...newQuestion, questionText: e.target.value })} rows={2} placeholder="Enter question text…" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 resize-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-white/50">Answer Options (check correct)</label>
                        {newQuestion.options.map((opt, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <input type="checkbox" checked={opt.isCorrect} onChange={(e) => {
                              const opts = newQuestion.options.map((o, j) => j === i ? { ...o, isCorrect: e.target.checked } : o);
                              setNewQuestion({ ...newQuestion, options: opts });
                            }} className="h-4 w-4 accent-orange-500" />
                            <input type="text" value={opt.text} onChange={(e) => {
                              const opts = newQuestion.options.map((o, j) => j === i ? { ...o, text: e.target.value } : o);
                              setNewQuestion({ ...newQuestion, options: opts });
                            }} placeholder={`Option ${i + 1}`} className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none" />
                            {newQuestion.options.length > 2 && <button onClick={() => setNewQuestion({ ...newQuestion, options: newQuestion.options.filter((_, j) => j !== i) })} className="p-1.5 text-white/30 active:scale-95"><Trash2 className="h-3.5 w-3.5" /></button>}
                          </div>
                        ))}
                        {newQuestion.options.length < 5 && (
                          <button onClick={() => setNewQuestion({ ...newQuestion, options: [...newQuestion.options, { text: "", isCorrect: false }] })} className="text-xs text-orange-400 flex items-center gap-1 active:scale-95">
                            <Plus className="h-3.5 w-3.5" /> Add option
                          </button>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleCreateQuestion} disabled={savingQuestion} className="flex-1 p-3 rounded-xl bg-orange-600 text-white text-sm font-semibold active:scale-[0.97] disabled:opacity-40">
                          {savingQuestion ? "Saving…" : "Save Question"}
                        </button>
                        <button onClick={() => setShowNewQ(false)} className="px-4 py-3 rounded-xl bg-white/10 text-white/50 text-sm active:scale-[0.97]">Cancel</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {questions.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-black/20 border border-white/5 text-center">
                    <p className="text-sm text-white/30">No questions yet. Seed the modules first, then add questions.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {questions.map((q) => (
                      <div key={q.id} className="rounded-2xl bg-black/30 border border-white/10 overflow-hidden">
                        <button className="w-full text-left p-4 flex items-start gap-3" onClick={() => setExpandedQuestion(expandedQuestion === q.id ? null : q.id)}>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-white/30 mb-1">{q.moduleSlug}</p>
                            <p className="text-sm text-white font-medium leading-snug">{q.questionText}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {expandedQuestion === q.id ? <ChevronUp className="h-4 w-4 text-white/30" /> : <ChevronDown className="h-4 w-4 text-white/30" />}
                          </div>
                        </button>
                        {expandedQuestion === q.id && (
                          <motion.div className="px-4 pb-4 space-y-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            {q.options.map((opt) => (
                              <div key={opt.id} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${opt.isCorrect ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-white/3 text-white/50"}`}>
                                {opt.isCorrect && <span className="text-green-400 font-bold">✓</span>}
                                <span className="flex-1">{opt.optionText}</span>
                              </div>
                            ))}
                            <button onClick={() => handleDeleteQuestion(q.id)} className="flex items-center gap-1.5 text-xs text-red-400/60 mt-2 active:scale-95">
                              <Trash2 className="h-3.5 w-3.5" /> Delete question
                            </button>
                          </motion.div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── PROGRESS TAB ── */}
            {tab === "progress" && (
              <div className="space-y-2">
                <p className="text-xs text-white/40">{progress.length} record{progress.length !== 1 ? "s" : ""} for {selectedCertType}</p>
                {progress.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-black/20 border border-white/5 text-center">
                    <p className="text-sm text-white/30">No certification records yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {progress.map((row, i) => (
                      <div key={`${row.userId}-${row.certType}`} className="p-4 rounded-2xl bg-black/30 border border-white/10">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono text-white/40 truncate">{row.userId}</p>
                            <p className={`text-sm font-semibold mt-0.5 ${row.status === "completed" ? "text-green-400" : row.status === "in_progress" ? "text-orange-400" : "text-white/50"}`}>
                              {row.status === "completed" ? "Certified" : row.status === "in_progress" ? "In Progress" : "Not Started"}
                              {row.score != null && ` · ${row.score}%`}
                            </p>
                          </div>
                          {row.certificateNumber && <p className="text-xs font-mono text-orange-400 flex-shrink-0">{row.certificateNumber}</p>}
                        </div>
                        {row.completedAt && <p className="text-xs text-white/20 mt-1">{new Date(row.completedAt).toLocaleDateString()}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── UPDATES TAB ── */}
            {tab === "updates" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white/40">{updates.length} update module{updates.length !== 1 ? "s" : ""}</p>
                  <button onClick={() => setShowNewUpdate(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-600 text-white text-xs font-semibold active:scale-[0.96]">
                    <Plus className="h-3.5 w-3.5" /> New Update
                  </button>
                </div>

                <AnimatePresence>
                  {showNewUpdate && (
                    <motion.div className="p-4 rounded-2xl bg-black/40 border border-orange-500/30 space-y-3" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      <div className="space-y-1.5">
                        <label className="text-xs text-white/50">Title</label>
                        <input type="text" value={newUpdate.title} onChange={(e) => setNewUpdate({ ...newUpdate, title: e.target.value })} placeholder="e.g. New Carnivore Builder — June 2026" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/50" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-white/50">Description</label>
                        <textarea value={newUpdate.description} onChange={(e) => setNewUpdate({ ...newUpdate, description: e.target.value })} rows={2} placeholder="Brief description of what's new…" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none resize-none" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-white/50">Video URL (optional)</label>
                        <input type="text" value={newUpdate.videoUrl} onChange={(e) => setNewUpdate({ ...newUpdate, videoUrl: e.target.value })} placeholder="https://…" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none" />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={newUpdate.isRequired} onChange={(e) => setNewUpdate({ ...newUpdate, isRequired: e.target.checked })} className="h-4 w-4 accent-orange-500" />
                        <span className="text-sm text-white/70">Required (users must complete to stay current)</span>
                      </label>
                      <div className="flex gap-2">
                        <button onClick={handleCreateUpdate} disabled={savingUpdate} className="flex-1 p-3 rounded-xl bg-orange-600 text-white text-sm font-semibold active:scale-[0.97] disabled:opacity-40">
                          {savingUpdate ? "Releasing…" : "Release Update"}
                        </button>
                        <button onClick={() => setShowNewUpdate(false)} className="px-4 py-3 rounded-xl bg-white/10 text-white/50 text-sm active:scale-[0.97]">Cancel</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {updates.length === 0 && !showNewUpdate ? (
                  <div className="p-6 rounded-2xl bg-black/20 border border-white/5 text-center">
                    <p className="text-sm text-white/30">No update modules yet.</p>
                    <p className="text-xs text-white/20 mt-1">Create updates to notify affiliates of new features.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {updates.map((u) => (
                      <div key={u.id} className="p-4 rounded-2xl bg-black/30 border border-white/10 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-white">{u.title}</p>
                            {u.isRequired && <span className="text-[10px] text-amber-400 font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20">Required</span>}
                          </div>
                          {u.description && <p className="text-xs text-white/50 leading-relaxed">{u.description}</p>}
                          {u.videoUrl && <p className="text-xs font-mono text-orange-400/60 mt-1 truncate">{u.videoUrl}</p>}
                          {u.releasedAt && <p className="text-xs text-white/20 mt-1">Released {new Date(u.releasedAt).toLocaleDateString()}</p>}
                        </div>
                        <button onClick={() => handleDeleteUpdate(u.id)} className="p-1.5 text-red-400/40 active:scale-95 flex-shrink-0">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── WAITLIST TAB ── */}
            {tab === "waitlist" && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-white">Marketing &amp; Coaching Waitlist</p>
                  <p className="text-xs text-white/40 mt-0.5">Preview the audience, then send enrollment notifications.</p>
                </div>

                {waitlistLoading ? (
                  <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-orange-400/40 border-t-orange-400 rounded-full animate-spin" /></div>
                ) : waitlistStats ? (
                  <>
                    {/* Stats cards */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-4 rounded-2xl bg-black/30 border border-white/10 text-center">
                        <p className="text-2xl font-bold text-orange-400">{waitlistStats.total}</p>
                        <p className="text-[10px] text-white/40 mt-1 uppercase tracking-wider">Total</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-black/30 border border-white/10 text-center">
                        <p className="text-2xl font-bold text-green-400">{waitlistStats.notified}</p>
                        <p className="text-[10px] text-white/40 mt-1 uppercase tracking-wider">Notified</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-black/30 border border-white/10 text-center">
                        <p className="text-2xl font-bold text-yellow-400">{waitlistStats.pending}</p>
                        <p className="text-[10px] text-white/40 mt-1 uppercase tracking-wider">Pending</p>
                      </div>
                    </div>

                    {/* Date range */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-2xl bg-black/20 border border-white/5 text-center">
                        <p className="text-xs font-semibold text-white/70 leading-snug">
                          {waitlistStats.oldestEntry ? new Date(waitlistStats.oldestEntry).toLocaleDateString() : "—"}
                        </p>
                        <p className="text-[10px] text-white/40 mt-1 uppercase tracking-wider">Oldest</p>
                      </div>
                      <div className="p-3 rounded-2xl bg-black/20 border border-white/5 text-center">
                        <p className="text-xs font-semibold text-white/70 leading-snug">
                          {waitlistStats.newestEntry ? new Date(waitlistStats.newestEntry).toLocaleDateString() : "—"}
                        </p>
                        <p className="text-[10px] text-white/40 mt-1 uppercase tracking-wider">Newest</p>
                      </div>
                    </div>

                    {/* Email preview */}
                    {waitlistStats.previewEmails.length > 0 && (
                      <div className="p-4 rounded-2xl bg-black/30 border border-white/10 space-y-2">
                        <div className="flex items-center gap-2 mb-1">
                          <Mail className="h-3.5 w-3.5 text-white/30" />
                          <p className="text-xs text-white/50 font-medium">Email Preview (up to 20)</p>
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                          {waitlistStats.previewEmails.map((email) => (
                            <p key={email} className="text-xs font-mono text-white/60 truncate">{email}</p>
                          ))}
                        </div>
                        {waitlistStats.total > waitlistStats.previewEmails.length && (
                          <p className="text-[10px] text-white/30 pt-1">+{waitlistStats.total - waitlistStats.previewEmails.length} more not shown</p>
                        )}
                      </div>
                    )}

                    {waitlistStats.total === 0 && (
                      <div className="p-6 rounded-2xl bg-black/20 border border-white/5 text-center">
                        <p className="text-sm text-white/30">No one on the waitlist right now.</p>
                      </div>
                    )}

                    {/* Send result / error */}
                    <AnimatePresence>
                      {notifyError && (
                        <motion.div
                          className="p-4 rounded-2xl bg-black/40 border border-red-500/40 space-y-1"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                        >
                          <p className="text-sm font-semibold text-red-400">Send aborted — no rows modified</p>
                          <p className="text-xs text-red-300/80">{notifyError}</p>
                        </motion.div>
                      )}
                      {notifyResult && (
                        <motion.div
                          className="p-4 rounded-2xl bg-black/40 border border-orange-500/30 space-y-2"
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                        >
                          <p className="text-sm font-semibold text-orange-300">Notification sent</p>
                          <div className="flex gap-4 text-xs">
                            <span className="text-green-400 font-semibold">{notifyResult.sent} sent</span>
                            <span className="text-white/40">{notifyResult.skipped} skipped (already notified)</span>
                            {notifyResult.failed > 0 && <span className="text-red-400">{notifyResult.failed} failed</span>}
                          </div>
                          {notifyResult.failures.length > 0 && (
                            <div className="space-y-0.5 pt-1">
                              <p className="text-[10px] text-red-400/60 uppercase tracking-wider font-semibold">Failed addresses</p>
                              {notifyResult.failures.map((e) => (
                                <p key={e} className="text-xs font-mono text-red-400/70">{e}</p>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Action buttons */}
                    {waitlistStats.total > 0 && (
                      <div className="space-y-2">
                        {emailConfigured === false && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                            <Mail className="h-4 w-4 text-red-400 flex-shrink-0" />
                            <p className="text-xs text-red-400 font-medium">Email not configured — set RESEND_API_KEY to enable notifications</p>
                          </div>
                        )}
                        {waitlistStats.pending === 0 && emailConfigured !== false && (
                          <p className="text-xs text-yellow-400/80 text-center py-1">
                            All waitlisted users have already been notified. Nothing to send.
                          </p>
                        )}
                        <button
                          onClick={() => handleNotifyWaitlist(false)}
                          disabled={notifying || waitlistStats.pending === 0 || emailConfigured === false}
                          className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-orange-600 text-white font-semibold text-sm active:scale-[0.97] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Send className="h-4 w-4" />
                          {emailConfigured === false
                            ? "Email not configured"
                            : notifying
                            ? "Sending…"
                            : waitlistStats.pending === 0
                            ? "Notify Waitlist (0 pending)"
                            : `Notify Waitlist (${waitlistStats.pending} pending)`}
                        </button>
                        <button
                          onClick={() => handleNotifyWaitlist(true)}
                          disabled={notifying || emailConfigured === false}
                          className="w-full p-3 rounded-2xl bg-white/5 border border-white/10 text-white/40 text-xs font-medium active:scale-[0.97] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {emailConfigured === false ? "Email not configured" : "Force Re-notify All (including already-notified)"}
                        </button>
                        <div className="p-3 rounded-2xl bg-black/20 border border-white/5 space-y-1">
                          <p className="text-[10px] text-white/40 font-semibold uppercase tracking-wider">Recovery info</p>
                          <p className="text-[10px] text-white/30 leading-relaxed">
                            "Notify Waitlist" skips anyone already confirmed sent. If the server restarted mid-send, any in-flight rows are automatically reset on boot and will be retried on the next run — no manual action needed. Use "Force Re-notify All" only if you intentionally want to re-send to everyone, including confirmed recipients.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Detailed user list */}
                    <div className="space-y-3 pt-4 border-t border-white/10">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-white/40">
                            {(() => {
                              const filtered = waitlistFilter === "all" ? waitlist : waitlistFilter === "notified" ? waitlist.filter(r => r.notifiedAt) : waitlist.filter(r => !r.notifiedAt);
                              return `${filtered.length} user${filtered.length !== 1 ? "s" : ""}${waitlistFilter !== "all" ? ` (${waitlistFilter})` : " on waitlist"}`;
                            })()}
                          </p>
                          <div className="flex gap-1 text-[10px]">
                            {(["all", "notified", "pending"] as const).map((f) => (
                              <button
                                key={f}
                                onClick={() => setWaitlistFilter(f)}
                                className={`px-2.5 py-1 rounded-full font-semibold capitalize transition-colors ${
                                  waitlistFilter === f
                                    ? f === "notified"
                                      ? "bg-green-500/25 text-green-400 border border-green-500/40"
                                      : f === "pending"
                                      ? "bg-orange-500/25 text-orange-400 border border-orange-500/40"
                                      : "bg-white/20 text-white border border-white/30"
                                    : "bg-white/5 text-white/35 border border-white/10"
                                }`}
                              >
                                {f}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-1 text-[10px]">
                          <ArrowUpDown className="h-3 w-3 text-white/30" />
                          {([
                            { value: "notified-desc", label: "Notified ↓" },
                            { value: "notified-asc",  label: "Notified ↑" },
                            { value: "joined-desc",   label: "Joined ↓"   },
                          ] as const).map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => setWaitlistSort(opt.value)}
                              className={`px-2.5 py-1 rounded-full font-semibold transition-colors ${
                                waitlistSort === opt.value
                                  ? "bg-white/20 text-white border border-white/30"
                                  : "bg-white/5 text-white/35 border border-white/10"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {waitlist.length === 0 ? (
                        <div className="p-6 rounded-2xl bg-black/20 border border-white/5 text-center">
                          <p className="text-sm text-white/30">No one on the waitlist yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {(() => {
                            const filtered = waitlistFilter === "all" ? waitlist : waitlistFilter === "notified" ? waitlist.filter(r => r.notifiedAt) : waitlist.filter(r => !r.notifiedAt);
                            const sorted = [...filtered].sort((a, b) => {
                              if (waitlistSort === "notified-desc") {
                                const ta = a.notifiedAt ? new Date(a.notifiedAt).getTime() : 0;
                                const tb = b.notifiedAt ? new Date(b.notifiedAt).getTime() : 0;
                                return tb - ta;
                              }
                              if (waitlistSort === "notified-asc") {
                                const ta = a.notifiedAt ? new Date(a.notifiedAt).getTime() : Infinity;
                                const tb = b.notifiedAt ? new Date(b.notifiedAt).getTime() : Infinity;
                                return ta - tb;
                              }
                              // joined-desc (default): newest join first
                              const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                              const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                              return tb - ta;
                            });
                            if (sorted.length === 0) {
                              return (
                                <div className="p-6 rounded-2xl bg-black/20 border border-white/5 text-center">
                                  <p className="text-sm text-white/30">No {waitlistFilter} users on the waitlist.</p>
                                </div>
                              );
                            }
                            return sorted.map((row) => (
                            <div key={row.userId} className="p-4 rounded-2xl bg-black/30 border border-white/10">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-white truncate">
                                    {row.firstName || row.username || "Unknown"}
                                  </p>
                                  <p className="text-xs text-white/40 truncate mt-0.5">{row.email}</p>
                                  {row.createdAt && (
                                    <p className="text-xs text-white/20 mt-1">
                                      Joined {new Date(row.createdAt).toLocaleDateString()}
                                    </p>
                                  )}
                                </div>
                                <div className="flex-shrink-0 text-right">
                                  {row.emailSentAt ? (
                                    <div className="space-y-1">
                                      <span className="inline-block px-2.5 py-1 rounded-full bg-green-500/15 border border-green-500/20 text-green-400 text-[10px] font-bold uppercase tracking-wide">
                                        Email Sent
                                      </span>
                                      <p className="text-[10px] text-white/60">
                                        {new Date(row.emailSentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                      </p>
                                    </div>
                                  ) : row.notifiedAt ? (
                                    <div className="space-y-0.5">
                                      <span className="inline-block px-2.5 py-1 rounded-full bg-yellow-500/15 border border-yellow-500/20 text-yellow-400 text-[10px] font-bold uppercase tracking-wide">
                                        In Progress
                                      </span>
                                      <p className="text-[10px] text-white/25">claimed</p>
                                    </div>
                                  ) : (
                                    <span className="inline-block px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/35 text-[10px] font-semibold uppercase tracking-wide">
                                      Pending
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ));
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Recovery History */}
                    <div className="space-y-3 pt-4 border-t border-white/10">
                      <div className="flex items-center gap-2">
                        <RotateCcw className="h-3.5 w-3.5 text-white/30" />
                        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider">Boot Recovery History</p>
                      </div>
                      {recoveryEvents.length === 0 ? (
                        <div className="p-4 rounded-2xl bg-black/20 border border-white/5 text-center">
                          <p className="text-xs text-white/25">No restart recoveries recorded yet.</p>
                          <p className="text-[10px] text-white/15 mt-1">Events appear here when the server restarts mid-send and auto-resets orphaned rows.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {recoveryEvents.map((evt) => (
                            <div key={evt.id} className="rounded-2xl bg-black/30 border border-white/10 overflow-hidden">
                              <button
                                onClick={() => setExpandedRecovery(expandedRecovery === evt.id ? null : evt.id)}
                                className="w-full flex items-center justify-between gap-3 p-4 text-left active:bg-white/5"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-500/15 border border-orange-500/20">
                                    <RotateCcw className="h-3 w-3 text-orange-400" />
                                  </span>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-white">
                                      {evt.rowCount} user{evt.rowCount !== 1 ? "s" : ""} auto-recovered
                                    </p>
                                    <p className="text-[10px] text-white/35 mt-0.5">
                                      {new Date(evt.recoveredAt).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                                <span className="flex-shrink-0 text-white/30">
                                  {expandedRecovery === evt.id ? (
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  )}
                                </span>
                              </button>
                              {expandedRecovery === evt.id && (
                                <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
                                  <p className="text-[10px] text-white/35 uppercase tracking-wider font-semibold">Affected User IDs</p>
                                  <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                                    {evt.userIds.map((uid) => (
                                      <p key={uid} className="text-xs font-mono text-white/50">{uid}</p>
                                    ))}
                                  </div>
                                  <p className="text-[10px] text-white/25 pt-1 leading-relaxed">
                                    These rows were claimed mid-send (notified_at set, email_sent_at null) and were automatically reset on boot. They will be retried on the next notify run.
                                  </p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="p-6 rounded-2xl bg-black/20 border border-white/5 text-center">
                    <p className="text-sm text-white/30">Failed to load waitlist data.</p>
                    <button
                      onClick={() => {
                        setWaitlistLoading(true);
                        Promise.all([
                          apiRequest("/api/admin/certifications/marketing-coaching/waitlist-stats"),
                          apiRequest("/api/admin/certifications/marketing-coaching/waitlist")
                        ])
                          .then(([stats, list]: any) => {
                            setWaitlistStats(stats);
                            setWaitlist(list.waitlist ?? []);
                          })
                          .catch(() => {})
                          .finally(() => setWaitlistLoading(false));
                      }}
                      className="mt-3 px-4 py-2 rounded-xl bg-white/10 text-white/50 text-xs font-medium active:scale-[0.96]"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
