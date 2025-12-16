import { useState, useEffect } from "react";
import { apiUrl } from '@/lib/resolveApiBase';
import { type Comment } from "@shared/schema";

interface PostCommentsProps {
  postId: string;
}

export default function PostComments({ postId }: PostCommentsProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [text, setText] = useState("");

  async function loadMore(initial = false) {
    if (loading || (!hasMore && !initial)) return;
    setLoading(true);
    try {
      const url = new URL(apiUrl(`/api/community/posts/${postId}/comments`), window.location.origin);
      if (cursor) url.searchParams.set("cursor", cursor);
      url.searchParams.set("limit", "20");
      const res = await fetch(url);
      const data = await res.json();
      setItems((prev) => [...prev, ...data.items]);
      setCursor(data.nextCursor ?? null);
      setHasMore(Boolean(data.nextCursor));
    } catch (error) {
      console.error("Failed to load comments:", error);
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!text.trim()) return;
    const payload = { text: text.trim(), isAnonymous: false };
    
    // Optimistic insert
    const temp: Comment = {
      id: `local_${Date.now()}`,
      postId,
      userId: "00000000-0000-0000-0000-000000000001",
      authorDisplay: "You",
      createdAt: new Date(),
      text: payload.text,
    };
    setItems((prev) => [temp, ...prev]);
    setText("");
    
    try {
      const res = await fetch(apiUrl(`/api/community/posts/${postId}/comments`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (res.ok) {
        const newComment = await res.json();
        // Replace optimistic comment with real one
        setItems((prev) => prev.map(item => 
          item.id === temp.id ? newComment : item
        ));
      }
    } catch (error) {
      console.error("Failed to post comment:", error);
      // Keep optimistic comment on error
    }
  }

  useEffect(() => {
    if (open && items.length === 0) {
      loadMore(true);
    }
  }, [open]);

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-sm text-white/80 hover:text-white transition-colors"
        data-testid={`button-toggle-comments-${postId}`}
      >
        {open ? "Hide comments" : "View comments"}
      </button>

      {open && (
        <div className="mt-3 rounded-xl bg-black/30 border border-white/10 p-3">
          {/* Comment composer */}
          <div className="flex gap-2 mb-3">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write a comment…"
              className="flex-1 bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-white placeholder:text-white/50 text-sm"
              data-testid={`input-comment-${postId}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <button
              onClick={submit}
              disabled={!text.trim()}
              className="px-3 py-2 rounded-lg bg-white text-purple-700 hover:bg-white/90 disabled:bg-white/50 disabled:cursor-not-allowed text-sm font-medium"
              data-testid={`button-post-comment-${postId}`}
            >
              Post
            </button>
          </div>

          {/* Comments list */}
          <div className="space-y-3 max-h-72 overflow-auto pr-1">
            {items.map((c) => (
              <div key={c.id} className="text-sm" data-testid={`comment-${c.id}`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-medium">
                    {c.authorDisplay.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="font-medium text-white">{c.authorDisplay}</div>
                  <div className="text-white/60 text-xs">
                    {new Date(c.createdAt).toLocaleTimeString([], { 
                      hour: "2-digit", 
                      minute: "2-digit" 
                    })}
                  </div>
                </div>
                <div className="ml-8 text-white/90 leading-relaxed">{c.text}</div>
              </div>
            ))}
            
            {hasMore && (
              <button
                onClick={() => loadMore()}
                disabled={loading}
                className="text-white/80 hover:text-white text-xs underline"
                data-testid={`button-load-more-comments-${postId}`}
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            )}
            
            {!items.length && !loading && (
              <div className="text-white/60 text-sm text-center py-4">
                Be the first to comment.
              </div>
            )}
            
            {loading && items.length === 0 && (
              <div className="text-white/60 text-sm text-center py-4">
                Loading comments...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}