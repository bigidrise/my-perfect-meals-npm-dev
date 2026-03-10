import { useState, useRef, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, Send, Loader2, Globe, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

export function CoachMessagesCard() {
  const [tabletOpen, setTabletOpen] = useState(false);
  const [tabletMessages, setTabletMessages] = useState<any[]>([]);
  const [tabletLoading, setTabletLoading] = useState(false);
  const [tabletError, setTabletError] = useState<string | null>(null);
  const [tabletInput, setTabletInput] = useState("");
  const [tabletSending, setTabletSending] = useState(false);
  const [tabletTranslatingId, setTabletTranslatingId] = useState<string | null>(null);
  const [tabletHasUnread, setTabletHasUnread] = useState(false);
  const tabletScrollRef = useRef<HTMLDivElement>(null);
  const tabletTranslationCache = useRef(new Map<string, string>());
  const tabletInitialLoad = useRef(true);

  const fetchClientTablet = useCallback(async () => {
    if (tabletInitialLoad.current) {
      setTabletLoading(true);
    }
    setTabletError(null);
    try {
      const res = await fetch(apiUrl("/api/client/tablet"), {
        headers: { ...getAuthHeaders() },
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        if (res.status === 404) setTabletError("No active coach connection");
        else setTabletError("Failed to load messages");
        return;
      }
      const data = await res.json();
      const msgs = data.messages || [];
      setTabletMessages(msgs);

      const lastSeenKey = "mpm.tablet.client.lastSeen";
      const lastSeen = localStorage.getItem(lastSeenKey);
      const coachMsgs = msgs.filter((m: any) => m.sender === "pro");
      if (coachMsgs.length > 0) {
        const latestTime = new Date(coachMsgs[coachMsgs.length - 1].createdAt).getTime();
        const seenTime = lastSeen ? parseInt(lastSeen, 10) : 0;
        setTabletHasUnread(latestTime > seenTime);
      } else {
        setTabletHasUnread(false);
      }
    } catch {
      setTabletError("Failed to load messages");
    } finally {
      setTabletLoading(false);
      tabletInitialLoad.current = false;
    }
  }, []);

  const handleTabletSend = async () => {
    if (!tabletInput.trim() || tabletSending) return;
    setTabletSending(true);
    try {
      const res = await fetch(apiUrl("/api/client/tablet/message"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ body: tabletInput.trim() }),
      });
      if (!res.ok) {
        if (res.status === 422) {
          const errData = await res.json().catch(() => ({}));
          setTabletError(errData.error || "Message blocked by content policy");
          return;
        }
        throw new Error("Failed to send");
      }
      const data = await res.json();
      setTabletMessages((prev) => [...prev, data.entry]);
      setTabletInput("");
    } catch {
      setTabletError("Failed to send message");
    } finally {
      setTabletSending(false);
    }
  };

  const handleTabletTranslate = async (entry: any) => {
    if (tabletTranslatingId) return;
    const cacheKey = `${entry.id}_translate`;
    if (tabletTranslationCache.current.has(cacheKey)) {
      setTabletMessages((prev) =>
        prev.map((n: any) =>
          n.id === entry.id
            ? { ...n, translatedBody: n.translatedBody ? undefined : tabletTranslationCache.current.get(cacheKey) }
            : n
        )
      );
      return;
    }
    setTabletTranslatingId(entry.id);
    try {
      const res = await fetch(apiUrl("/api/translate"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({
          content: { name: "Message", description: entry.body },
          targetLanguage: navigator.language?.split("-")[0] || "es",
        }),
      });
      if (!res.ok) throw new Error("Translation failed");
      const data = await res.json();
      const translated = data.translated?.description || data.description || entry.body;
      tabletTranslationCache.current.set(cacheKey, translated);
      setTabletMessages((prev) =>
        prev.map((n: any) => (n.id === entry.id ? { ...n, translatedBody: translated } : n))
      );
    } catch {
      setTabletError("Translation failed");
    } finally {
      setTabletTranslatingId(null);
    }
  };

  const handleTabletDelete = async (entry: any) => {
    try {
      const res = await fetch(apiUrl(`/api/client/tablet/entry/${entry.id}`), {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setTabletMessages((prev) => prev.filter((m: any) => m.id !== entry.id));
    } catch {
      setTabletError("Failed to delete message");
    }
  };

  useEffect(() => {
    if (!tabletOpen) {
      fetchClientTablet();
      const bgInterval = setInterval(fetchClientTablet, 30000);
      return () => clearInterval(bgInterval);
    }
  }, [tabletOpen, fetchClientTablet]);

  useEffect(() => {
    if (tabletOpen) {
      tabletInitialLoad.current = true;
      fetchClientTablet();
      const interval = setInterval(fetchClientTablet, 10000);
      localStorage.setItem("mpm.tablet.client.lastSeen", Date.now().toString());
      return () => clearInterval(interval);
    }
  }, [tabletOpen, fetchClientTablet]);

  useEffect(() => {
    if (tabletScrollRef.current) {
      tabletScrollRef.current.scrollTop = tabletScrollRef.current.scrollHeight;
    }
  }, [tabletMessages]);

  return (
    <>
      <Card
        className="cursor-pointer active:scale-[0.98] bg-black/30 backdrop-blur-lg border border-orange-500/30 transition-all duration-300 rounded-xl shadow-md relative overflow-hidden"
        onClick={() => setTabletOpen(!tabletOpen)}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/20 relative">
              <MessageSquare className="h-5 w-5 text-orange-400" />
              {tabletHasUnread && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse" />
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-white">Messages From Your Coach</h3>
              <p className="text-xs text-white/70">View and reply to your coach</p>
            </div>
            {tabletOpen ? (
              <ChevronUp className="h-4 w-4 text-white/40" />
            ) : (
              <ChevronDown className="h-4 w-4 text-white/40" />
            )}
          </div>
        </CardContent>
      </Card>

      {tabletOpen && (
        <div className="bg-black/30 backdrop-blur-lg border border-orange-500/20 rounded-xl p-4 space-y-3">
          {tabletLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-white/40" />
            </div>
          )}
          {tabletError && (
            <p className="text-sm text-red-400">{tabletError}</p>
          )}
          {!tabletLoading && !tabletError && (
            <>
              <div ref={tabletScrollRef} className="max-h-64 overflow-y-auto space-y-2">
                {tabletMessages.length === 0 && (
                  <p className="text-xs text-white/30 py-2">No messages yet</p>
                )}
                {tabletMessages.map((entry: any) => (
                  <div
                    key={entry.id}
                    className={`rounded-md p-2.5 border ${
                      entry.sender === "client"
                        ? "bg-blue-500/10 border-blue-500/20 ml-6"
                        : "bg-white/5 border-white/5 mr-6"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-white/40">
                        {entry.sender === "client" ? "You" : "Coach"} &middot;{" "}
                        {new Date(entry.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}{" "}
                        {new Date(entry.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleTabletTranslate(entry); }}
                          disabled={tabletTranslatingId === entry.id}
                          className="text-blue-400 p-0.5"
                          title="Translate"
                        >
                          {tabletTranslatingId === entry.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Globe className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleTabletDelete(entry); }}
                          className="text-red-500 p-0.5"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
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
              <div className="flex gap-2">
                <textarea
                  value={tabletInput}
                  onChange={(e) => setTabletInput(e.target.value)}
                  placeholder="Reply to your coach..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-orange-500/50"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleTabletSend();
                    }
                  }}
                />
                <Button
                  size="sm"
                  disabled={!tabletInput.trim() || tabletSending}
                  onClick={handleTabletSend}
                  className="bg-orange-600 hover:bg-orange-700 px-3 self-end"
                >
                  {tabletSending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
