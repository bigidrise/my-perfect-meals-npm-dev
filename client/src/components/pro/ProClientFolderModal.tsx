import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClientProfile } from "@/lib/proData";
import { Activity, Target, LayoutDashboard, Tablet, CheckCircle2, ArrowRight, Send, Loader2, Globe, FileText, MessageSquare } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

interface TabletEntry {
  id: string;
  body: string;
  authorUserId: string;
  entryType: "message" | "note";
  visibility: string;
  sender: "client" | "pro";
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
  beach_body: "Beach Body",
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
  const [messages, setMessages] = useState<TabletEntry[]>([]);
  const [notes, setNotes] = useState<TabletEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"messages" | "notes">("messages");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msgInput, setMsgInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [sending, setSending] = useState(false);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const msgScrollRef = useRef<HTMLDivElement>(null);
  const noteScrollRef = useRef<HTMLDivElement>(null);

  const clientId = client?.clientUserId || client?.userId || client?.id;

  const fetchTablet = useCallback(async () => {
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
        else setError("Failed to load tablet");
        return;
      }
      const data = await res.json();
      setMessages(data.messages || []);
      setNotes(data.notes || []);
    } catch {
      setError("Failed to load tablet");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (open && clientId) {
      fetchTablet();
    }
    if (!open) {
      setMessages([]);
      setNotes([]);
      setMsgInput("");
      setNoteInput("");
      setError(null);
      setActiveTab("messages");
    }
  }, [open, clientId, fetchTablet]);

  useEffect(() => {
    if (activeTab === "messages" && msgScrollRef.current) {
      msgScrollRef.current.scrollTop = msgScrollRef.current.scrollHeight;
    }
    if (activeTab === "notes" && noteScrollRef.current) {
      noteScrollRef.current.scrollTop = noteScrollRef.current.scrollHeight;
    }
  }, [messages, notes, activeTab]);

  const handleSendMessage = async () => {
    if (!msgInput.trim() || !clientId || sending) return;
    setSending(true);
    try {
      const res = await fetch(apiUrl(`/api/pro/tablet/${clientId}/message`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ body: msgInput.trim() }),
      });
      if (!res.ok) throw new Error("Failed to send");
      const data = await res.json();
      setMessages((prev) => [...prev, data.entry]);
      setMsgInput("");
    } catch {
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleSaveNote = async () => {
    if (!noteInput.trim() || !clientId || sending) return;
    setSending(true);
    try {
      const res = await fetch(apiUrl(`/api/pro/tablet/${clientId}/note`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ body: noteInput.trim() }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      setNotes((prev) => [...prev, data.entry]);
      setNoteInput("");
    } catch {
      setError("Failed to save note");
    } finally {
      setSending(false);
    }
  };

  const handleTranslate = async (entry: TabletEntry) => {
    if (translatingId) return;
    const cacheKey = `${entry.id}_translate`;
    if (translationCache.has(cacheKey)) {
      const setFn = entry.entryType === "message" ? setMessages : setNotes;
      setFn((prev) =>
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
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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
      const setFn = entry.entryType === "message" ? setMessages : setNotes;
      setFn((prev) =>
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

  const renderEntryList = (entries: TabletEntry[], scrollRef: React.RefObject<HTMLDivElement | null>, showTranslate: boolean) => (
    <div ref={scrollRef} className="max-h-48 overflow-y-auto space-y-2 mb-2">
      {entries.length === 0 && (
        <p className="text-xs text-white/30 py-2">
          {activeTab === "messages" ? "No messages yet" : "No notes yet"}
        </p>
      )}
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={`rounded-md p-2 border ${
            entry.sender === "client"
              ? "bg-blue-500/10 border-blue-500/20 ml-4"
              : "bg-white/5 border-white/5 mr-4"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-white/40">
              {entry.sender === "client" ? "Client" : "Coach"} &middot; {formatTimestamp(entry.createdAt)}
            </span>
            {showTranslate && (
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
            )}
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
  );

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

              <div className="flex rounded-md overflow-hidden border border-white/10 mb-3">
                <button
                  onClick={() => setActiveTab("messages")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === "messages"
                      ? "bg-purple-600 text-white"
                      : "bg-white/5 text-white/50 hover:text-white/70"
                  }`}
                >
                  <MessageSquare className="w-3 h-3" />
                  Messages
                </button>
                <button
                  onClick={() => setActiveTab("notes")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === "notes"
                      ? "bg-purple-600 text-white"
                      : "bg-white/5 text-white/50 hover:text-white/70"
                  }`}
                >
                  <FileText className="w-3 h-3" />
                  Provider Notes
                </button>
              </div>

              {loading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-white/40" />
                </div>
              )}

              {error && (
                <p className="text-sm text-red-400 mb-2">{error}</p>
              )}

              {!loading && !error && activeTab === "messages" && (
                <>
                  {renderEntryList(messages, msgScrollRef, true)}
                  <div className="flex gap-2">
                    <textarea
                      value={msgInput}
                      onChange={(e) => setMsgInput(e.target.value)}
                      placeholder="Write a message to client..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-white/20"
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      disabled={!msgInput.trim() || sending}
                      onClick={handleSendMessage}
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

              {!loading && !error && activeTab === "notes" && (
                <>
                  {renderEntryList(notes, noteScrollRef, false)}
                  <div className="flex gap-2">
                    <textarea
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="Write a private note..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-white/20"
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSaveNote();
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      disabled={!noteInput.trim() || sending}
                      onClick={handleSaveNote}
                      className="bg-zinc-700 hover:bg-zinc-600 px-3 self-end"
                    >
                      {sending ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileText className="w-3.5 h-3.5" />
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
                localStorage.setItem("pro-client-id", client.clientUserId || client.userId || client.id);
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
                localStorage.setItem("pro-client-id", client.clientUserId || client.userId || client.id);
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
                const navId = client.clientUserId || client.userId || client.id;
                onNavigate(`/pro/clients/${navId}/${workspace}`);
              }}
            >
              <span className="flex items-center gap-2">
                <LayoutDashboard className="w-4 h-4" />
                Go To Client Dashboard
              </span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
