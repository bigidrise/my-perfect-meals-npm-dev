import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClientProfile } from "@/lib/proData";
import { BUILDER_MAP, type BuilderKey } from "@/lib/builderMap";
import { Activity, Target, LayoutDashboard, Tablet, CheckCircle2, ArrowRight, Send, Loader2, Globe } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

interface TabletEntry {
  id: string;
  body: string;
  authorUserId: string;
  createdAt: string;
  translatedBody?: string;
}

interface ProClientFolderModalProps {
  client: ClientProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (path: string) => void;
  isPhysician: boolean;
}

const BUILDER_LABELS: Record<string, string> = {
  general: "General Nutrition",
  general_nutrition: "General Nutrition",
  performance: "Performance & Competition",
  performance_competition: "Performance & Competition",
  diabetic: "Diabetic",
  glp1: "GLP-1",
  "anti-inflammatory": "Anti-Inflammatory",
  anti_inflammatory: "Anti-Inflammatory",
  weekly: "Weekly",
};

function getBuilderLabel(client: ClientProfile): string | null {
  const raw = client.assignedBuilder || client.activeBoardId;
  if (!raw) return null;
  return BUILDER_LABELS[raw] || raw.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getRoleLabel(role?: string): string {
  if (!role) return "Professional";
  const map: Record<string, string> = {
    trainer: "Trainer",
    doctor: "Doctor",
    np: "Nurse Practitioner",
    rn: "RN",
    pa: "PA",
    nutritionist: "Nutritionist",
    dietitian: "Dietitian",
  };
  return map[role] || role;
}

const translationCache = new Map<string, string>();

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function ProClientFolderModal({
  client,
  open,
  onOpenChange,
  onNavigate,
  isPhysician,
}: ProClientFolderModalProps) {
  const [notes, setNotes] = useState<TabletEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const clientId = client?.clientUserId || client?.id;

  const fetchNotes = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/pro/tablet/${clientId}`), {
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 403) setError("No access to this client");
        else setError("Failed to load notes");
        return;
      }
      const data = await res.json();
      setNotes(data.notes || []);
    } catch {
      setError("Failed to load notes");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (open && clientId) {
      fetchNotes();
    }
    if (!open) {
      setNotes([]);
      setInput("");
      setError(null);
    }
  }, [open, clientId, fetchNotes]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [notes]);

  const handleSend = async () => {
    if (!input.trim() || !clientId || sending) return;
    setSending(true);
    try {
      const res = await fetch(apiUrl(`/api/pro/tablet/${clientId}`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({ body: input.trim() }),
      });
      if (!res.ok) throw new Error("Failed to send");
      const data = await res.json();
      setNotes((prev) => [...prev, data.note]);
      setInput("");
    } catch {
      setError("Failed to send note");
    } finally {
      setSending(false);
    }
  };

  const handleTranslate = async (entry: TabletEntry) => {
    if (translatingId) return;
    const cacheKey = `${entry.id}_translate`;
    if (translationCache.has(cacheKey)) {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === entry.id
            ? { ...n, translatedBody: n.translatedBody ? undefined : translationCache.get(cacheKey) }
            : n
        )
      );
      return;
    }
    setTranslatingId(entry.id);
    try {
      const res = await fetch(apiUrl("/api/translate"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        credentials: "include",
        body: JSON.stringify({
          content: { name: "Tablet Note", description: entry.body },
          targetLanguage: navigator.language?.split("-")[0] || "es",
        }),
      });
      if (!res.ok) throw new Error("Translation failed");
      const data = await res.json();
      const translated = data.translated?.description || data.description || entry.body;
      translationCache.set(cacheKey, translated);
      setNotes((prev) =>
        prev.map((n) => (n.id === entry.id ? { ...n, translatedBody: translated } : n))
      );
    } catch {
      setError("Translation failed");
    } finally {
      setTranslatingId(null);
    }
  };

  if (!client) return null;

  const builderLabel = getBuilderLabel(client);
  const workspace = isPhysician ? "clinician" : "trainer";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl text-white">{client.name}</DialogTitle>
          <DialogDescription className="text-white/50">
            {client.email || "No email on file"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <div className="flex flex-wrap gap-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <CheckCircle2 className="h-3 w-3" />
              {client.archived ? "Archived" : "Active"}
            </div>
            {client.role && (
              <div className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-400/30">
                {getRoleLabel(client.role)}
              </div>
            )}
            {builderLabel && (
              <div className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-300 border border-orange-400/30">
                {builderLabel}
              </div>
            )}
          </div>

          <div className="border-t border-white/10 pt-3 space-y-2">
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="flex items-center gap-2 text-white/60 text-xs mb-2">
                <Tablet className="w-3.5 h-3.5" />
                Client Tablet
              </div>

              {loading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-white/40" />
                </div>
              )}

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              {!loading && !error && (
                <>
                  <div
                    ref={scrollRef}
                    className="max-h-48 overflow-y-auto space-y-2 mb-2"
                  >
                    {notes.length === 0 && (
                      <p className="text-xs text-white/30 py-2">No notes yet</p>
                    )}
                    {notes.map((entry) => (
                      <div
                        key={entry.id}
                        className="bg-white/5 rounded-md p-2 border border-white/5"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-white/40">
                            Coach &middot; {formatTimestamp(entry.createdAt)}
                          </span>
                          <button
                            onClick={() => handleTranslate(entry)}
                            disabled={translatingId === entry.id}
                            className="text-white/30 hover:text-white/60 p-0.5"
                            title="Translate"
                          >
                            {translatingId === entry.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Globe className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap">
                          {entry.translatedBody || entry.body}
                        </p>
                        {entry.translatedBody && (
                          <p className="text-[10px] text-white/30 mt-1 italic">
                            Original: {entry.body}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Write a note..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-white/20"
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      disabled={!input.trim() || sending}
                      onClick={handleSend}
                      className="bg-purple-600 hover:bg-purple-700 px-3 self-end"
                    >
                      {sending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>

            <Button
              variant="outline"
              className="w-full justify-between bg-white/5 border-white/10 text-white hover:bg-white/10"
              onClick={() => {
                onOpenChange(false);
                localStorage.setItem("pro-client-id", client.clientUserId || client.id);
                localStorage.setItem("pro-return-route", "/pro/clients");
                localStorage.setItem("pro-session", "true");
                onNavigate("/biometrics");
              }}
            >
              <span className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                View Biometrics
              </span>
              <ArrowRight className="w-4 h-4 text-white/40" />
            </Button>

            <Button
              variant="outline"
              className="w-full justify-between bg-white/5 border-white/10 text-white hover:bg-white/10"
              onClick={() => {
                onOpenChange(false);
                localStorage.setItem("pro-client-id", client.clientUserId || client.id);
                localStorage.setItem("pro-return-route", "/pro/clients");
                localStorage.setItem("pro-session", "true");
                onNavigate("/macro-counter");
              }}
            >
              <span className="flex items-center gap-2">
                <Target className="w-4 h-4 text-green-400" />
                Macro Calculator
              </span>
              <ArrowRight className="w-4 h-4 text-white/40" />
            </Button>

            <Button
              className="w-full justify-between bg-purple-600 text-white hover:bg-purple-700"
              onClick={() => {
                onOpenChange(false);
                const builderKey = (client.assignedBuilder || client.activeBoardId) as BuilderKey | undefined;
                const navId = client.clientUserId || client.userId || client.id;
                if (builderKey && BUILDER_MAP[builderKey]) {
                  onNavigate(`/pro/clients/${navId}/${BUILDER_MAP[builderKey].proRoute}`);
                } else {
                  onNavigate(`/pro/clients/${navId}/${workspace}`);
                }
              }}
            >
              <span className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                {(() => {
                  const bk = (client.assignedBuilder || client.activeBoardId) as BuilderKey | undefined;
                  return bk && BUILDER_MAP[bk]
                    ? `Open ${BUILDER_MAP[bk].label} Builder`
                    : "Go To Client Dashboard";
                })()}
              </span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
