import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Globe, Trash2, X } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

interface MessageEntry {
  id: string;
  body: string;
  authorUserId: string;
  entryType: "message";
  sender: "client" | "pro";
  createdAt: string;
  translatedBody?: string;
}

interface MessagesModalProps {
  clientId: string;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
}

const translationCache = new Map<string, string>();

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function MessagesModal({
  clientId,
  clientName,
  open,
  onOpenChange,
  currentUserId,
}: MessagesModalProps) {
  const [messages, setMessages] = useState<MessageEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/pro/tablet/${clientId}/messages`), {
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 403) setError("No access to this client");
        else setError("Failed to load messages");
        return;
      }
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      setError("Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (open && clientId) {
      fetchMessages();
    }
    if (!open) {
      setMessages([]);
      setInput("");
      setError(null);
    }
  }, [open, clientId, fetchMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !clientId || sending) return;
    setSending(true);
    try {
      const res = await fetch(apiUrl(`/api/pro/tablet/${clientId}/messages`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ body: input.trim() }),
      });
      if (!res.ok) throw new Error("Failed to send");
      const data = await res.json();
      setMessages((prev) => [...prev, data.entry]);
      setInput("");
    } catch {
      setError("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (entry: MessageEntry) => {
    if (deletingId) return;
    setDeletingId(entry.id);
    try {
      const res = await fetch(apiUrl(`/api/pro/tablet/${clientId}/messages/${entry.id}/delete`), {
        method: "PATCH",
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to delete message");
        return;
      }
      setMessages((prev) => prev.filter((m) => m.id !== entry.id));
    } catch {
      setError("Failed to delete message");
    } finally {
      setDeletingId(null);
    }
  };

  const handleTranslate = async (entry: MessageEntry) => {
    if (translatingId) return;
    const cacheKey = `${entry.id}_translate`;
    if (translationCache.has(cacheKey)) {
      setMessages((prev) =>
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
      setMessages((prev) =>
        prev.map((n) => (n.id === entry.id ? { ...n, translatedBody: translated } : n))
      );
    } catch {
      setError("Translation failed");
    } finally {
      setTranslatingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg text-white">Messages — {clientName}</DialogTitle>
          <DialogDescription className="text-white/50">
            Shared thread with your client
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 gap-3">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-white/40" />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {!loading && !error && (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 min-h-0 max-h-[50vh]">
                {messages.length === 0 && (
                  <p className="text-xs text-white/30 py-4 text-center">No messages yet</p>
                )}
                {messages.map((entry) => (
                  <div
                    key={entry.id}
                    className={`rounded-md p-2.5 border group ${
                      entry.sender === "client"
                        ? "bg-blue-500/10 border-blue-500/20 ml-6"
                        : "bg-white/5 border-white/5 mr-6"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-white/40">
                        {entry.sender === "client" ? "Client" : "Coach"} &middot; {formatTimestamp(entry.createdAt)}
                      </span>
                      <div className="flex items-center gap-1">
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
                        {entry.authorUserId === currentUserId && (
                          <button
                            onClick={() => handleDelete(entry)}
                            disabled={deletingId === entry.id}
                            className="text-white/20 hover:text-red-400 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete for you"
                          >
                            {deletingId === entry.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
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

              <div className="flex gap-2 pt-2 border-t border-white/10">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Write a message to client..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-white/20"
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
      </DialogContent>
    </Dialog>
  );
}
