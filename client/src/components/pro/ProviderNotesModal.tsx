import { useState, useEffect, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Trash2, Archive, Pencil, Check, X, AlertTriangle } from "lucide-react";
import { apiUrl } from "@/lib/resolveApiBase";
import { getAuthHeaders } from "@/lib/auth";

interface NoteEntry {
  id: string;
  body: string;
  authorUserId: string;
  entryType: "note";
  sender: "pro";
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProviderNotesModalProps {
  clientId: string;
  clientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function ProviderNotesModal({
  clientId,
  clientName,
  open,
  onOpenChange,
  currentUserId,
}: ProviderNotesModalProps) {
  const [activeNotes, setActiveNotes] = useState<NoteEntry[]>([]);
  const [archivedNotes, setArchivedNotes] = useState<NoteEntry[]>([]);
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [bulkArchiving, setBulkArchiving] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchNotes = useCallback(async (archived: boolean) => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/pro/tablet/${clientId}/notes?archived=${archived}`), {
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) {
        setError("Failed to load notes");
        return;
      }
      const data = await res.json();
      if (archived) {
        setArchivedNotes(data.notes || []);
      } else {
        setActiveNotes(data.notes || []);
      }
    } catch {
      setError("Failed to load notes");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (open && clientId) {
      fetchNotes(false);
      fetchNotes(true);
    }
    if (!open) {
      setActiveNotes([]);
      setArchivedNotes([]);
      setInput("");
      setError(null);
      setTab("active");
      setEditingId(null);
      setBulkResult(null);
    }
  }, [open, clientId, fetchNotes]);

  const handleCreate = async () => {
    if (!input.trim() || !clientId || sending) return;
    setSending(true);
    try {
      const res = await fetch(apiUrl(`/api/pro/tablet/${clientId}/notes`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ body: input.trim() }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      setActiveNotes((prev) => [data.entry, ...prev]);
      setInput("");
    } catch {
      setError("Failed to save note");
    } finally {
      setSending(false);
    }
  };

  const handleEdit = async (noteId: string) => {
    if (!editBody.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(apiUrl(`/api/pro/tablet/${clientId}/notes/${noteId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ body: editBody.trim() }),
      });
      if (!res.ok) throw new Error("Failed to edit");
      const data = await res.json();
      setActiveNotes((prev) => prev.map((n) => (n.id === noteId ? data.entry : n)));
      setEditingId(null);
      setEditBody("");
    } catch {
      setError("Failed to edit note");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (deletingId) return;
    setDeletingId(noteId);
    try {
      const res = await fetch(apiUrl(`/api/pro/tablet/${clientId}/notes/${noteId}`), {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setActiveNotes((prev) => prev.filter((n) => n.id !== noteId));
      setArchivedNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch {
      setError("Failed to delete note");
    } finally {
      setDeletingId(null);
    }
  };

  const handleArchiveToggle = async (note: NoteEntry) => {
    if (archivingId) return;
    setArchivingId(note.id);
    try {
      const res = await fetch(apiUrl(`/api/pro/tablet/${clientId}/notes/${note.id}/archive`), {
        method: "PATCH",
        headers: { ...getAuthHeaders() },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to archive");
      const data = await res.json();
      if (data.entry.archived) {
        setActiveNotes((prev) => prev.filter((n) => n.id !== note.id));
        setArchivedNotes((prev) => [data.entry, ...prev]);
      } else {
        setArchivedNotes((prev) => prev.filter((n) => n.id !== note.id));
        setActiveNotes((prev) => [data.entry, ...prev]);
      }
    } catch {
      setError("Failed to archive note");
    } finally {
      setArchivingId(null);
    }
  };

  const handleBulkArchive = async (months: number) => {
    if (bulkArchiving) return;
    setBulkArchiving(true);
    setBulkResult(null);
    try {
      const res = await fetch(apiUrl(`/api/pro/tablet/${clientId}/notes/bulk-archive`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        credentials: "include",
        body: JSON.stringify({ olderThanMonths: months }),
      });
      if (!res.ok) throw new Error("Failed to bulk archive");
      const data = await res.json();
      setBulkResult(`Archived ${data.archivedCount} note${data.archivedCount !== 1 ? "s" : ""}`);
      fetchNotes(false);
      fetchNotes(true);
    } catch {
      setError("Failed to bulk archive");
    } finally {
      setBulkArchiving(false);
    }
  };

  const currentNotes = tab === "active" ? activeNotes : archivedNotes;
  const showArchiveBanner = tab === "active" && activeNotes.length > 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-white/10 text-white max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg text-white">Provider Notes — {clientName}</DialogTitle>
          <DialogDescription className="text-white/50">
            Private notes (not visible to client)
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0 gap-3">
          <div className="flex rounded-md overflow-hidden border border-white/10">
            <button
              onClick={() => setTab("active")}
              className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                tab === "active"
                  ? "bg-purple-600 text-white"
                  : "bg-white/5 text-white/50 hover:text-white/70"
              }`}
            >
              Active ({activeNotes.length})
            </button>
            <button
              onClick={() => setTab("archived")}
              className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
                tab === "archived"
                  ? "bg-purple-600 text-white"
                  : "bg-white/5 text-white/50 hover:text-white/70"
              }`}
            >
              Archived ({archivedNotes.length})
            </button>
          </div>

          {showArchiveBanner && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-amber-300 font-medium">
                  You have {activeNotes.length} active notes. Archive older notes?
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs bg-white/5 border-white/10 text-white hover:bg-white/10"
                  onClick={() => handleBulkArchive(12)}
                  disabled={bulkArchiving}
                >
                  {bulkArchiving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Older than 12mo"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs bg-white/5 border-white/10 text-white hover:bg-white/10"
                  onClick={() => handleBulkArchive(24)}
                  disabled={bulkArchiving}
                >
                  Older than 24mo
                </Button>
              </div>
              {bulkResult && (
                <p className="text-xs text-green-400 mt-2">{bulkResult}</p>
              )}
            </div>
          )}

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
              <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 min-h-0 max-h-[40vh]">
                {currentNotes.length === 0 && (
                  <p className="text-xs text-white/30 py-4 text-center">
                    {tab === "active" ? "No active notes" : "No archived notes"}
                  </p>
                )}
                {currentNotes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-md p-2.5 border bg-white/5 border-white/10"
                  >
                    {editingId === note.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-xs text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-white/20"
                          rows={3}
                          autoFocus
                        />
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 px-2 h-6 text-xs"
                            onClick={() => handleEdit(note.id)}
                            disabled={sending || !editBody.trim()}
                          >
                            {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="px-2 h-6 text-xs border-white/10 text-white hover:bg-white/10"
                            onClick={() => { setEditingId(null); setEditBody(""); }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-white/40">
                            {formatTimestamp(note.createdAt)}
                            {note.updatedAt !== note.createdAt && (
                              <> &middot; edited {formatTimestamp(note.updatedAt)}</>
                            )}
                          </span>
                          <div className="flex items-center gap-1">
                            {!note.archived && note.authorUserId === currentUserId && (
                              <button
                                onClick={() => { setEditingId(note.id); setEditBody(note.body); }}
                                className="text-white/40 active:text-white/70 p-1 min-w-[28px] min-h-[28px] flex items-center justify-center"
                                title="Edit"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={() => handleArchiveToggle(note)}
                              disabled={archivingId === note.id}
                              className="text-white/40 active:text-amber-400 p-1 min-w-[28px] min-h-[28px] flex items-center justify-center"
                              title={note.archived ? "Unarchive" : "Archive"}
                            >
                              {archivingId === note.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Archive className="w-3 h-3" />
                              )}
                            </button>
                            {note.authorUserId === currentUserId && (
                              <button
                                onClick={() => handleDelete(note.id)}
                                disabled={deletingId === note.id}
                                className="text-white/40 active:text-red-400 p-1 min-w-[28px] min-h-[28px] flex items-center justify-center"
                                title="Delete permanently"
                              >
                                {deletingId === note.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-white/80 leading-relaxed whitespace-pre-wrap">
                          {note.body}
                        </p>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {tab === "active" && (
                <div className="flex gap-2 pt-2 border-t border-white/10">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Write a private note..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/30 resize-none focus:outline-none focus:border-white/20"
                    rows={2}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleCreate();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    disabled={!input.trim() || sending}
                    onClick={handleCreate}
                    className="bg-zinc-700 hover:bg-zinc-600 px-3 self-end"
                  >
                    {sending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileText className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
