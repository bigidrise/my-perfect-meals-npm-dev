import { useEffect, useMemo, useState } from "react";
import { apiUrl } from '@/lib/resolveApiBase';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Testimonial = {
  id: string;
  userId: string;
  content: string;
  platform: "internal" | "facebook";
  status: "pending" | "posted" | "failed";
  createdAt: string;
};

async function apiList(status: string | null, offset = 0, limit = 20) {
  const u = new URL(apiUrl("/api/testimonials"));
  if (status) u.searchParams.set("status", status);
  u.searchParams.set("offset", String(offset));
  u.searchParams.set("limit", String(limit));
  const res = await fetch(u.toString());
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json?.error || "List failed");
  return json as { items: Testimonial[]; limit: number; offset: number };
}

async function apiSetStatus(id: string, status: Testimonial["status"]) {
  const res = await fetch(apiUrl(`/api/testimonials/${id}/status`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json?.error || "Update failed");
  return json as { testimonial: Testimonial };
}

async function apiPostToFacebook(id: string) {
  const res = await fetch(apiUrl(`/api/facebook/share`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ testimonialId: id }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json?.error || "Facebook share failed");
  return json;
}

export default function AdminModerationPage() {
  const [items, setItems] = useState<Testimonial[]>([]);
  const [status, setStatus] = useState<"" | "pending" | "posted" | "failed">("pending");
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  const selectedLabel = useMemo(() => status || "all", [status]);

  const load = async (ofs = 0) => {
    setLoading(true);
    setMsg(null);
    try {
      const data = await apiList(status || null, ofs, 20);
      setItems(data.items);
      setOffset(ofs);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const mark = async (id: string, newStatus: Testimonial["status"]) => {
    try {
      await apiSetStatus(id, newStatus);
      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, status: newStatus } : t)));
    } catch (e: any) {
      alert(`Failed to update: ${e.message}`);
    }
  };

  const postFB = async (id: string) => {
    try {
      // optimistic mark while posting
      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, status: "pending" } : t)));
      await apiPostToFacebook(id);
      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, status: "posted" } : t)));
    } catch (e: any) {
      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, status: "failed" } : t)));
      alert(`Facebook error: ${e.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-black to-zinc-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="relative">
          <div className="pointer-events-none absolute inset-x-0 -top-1 h-1 bg-gradient-to-r from-amber-300/70 via-orange-400/80 to-pink-500/70" />
          <h1 className="text-3xl font-extrabold text-white tracking-tight text-center">Admin Moderation</h1>
          <p className="text-center text-white/60 mt-1">Filter: <span className="text-white/90">{selectedLabel}</span></p>
        </div>

        {/* Filters + actions */}
        <Card className="rounded-2xl border border-white/15 bg-black/40 text-white backdrop-blur-xl">
          <CardContent className="p-4 flex flex-wrap items-center gap-2">
            <Button onClick={() => setStatus("pending")} className={`rounded-xl ${status==="pending" ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"}`} data-testid="button-filter-pending">Pending</Button>
            <Button onClick={() => setStatus("posted")}  className={`rounded-xl ${status==="posted"  ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"}`} data-testid="button-filter-posted">Posted</Button>
            <Button onClick={() => setStatus("failed")}  className={`rounded-xl ${status==="failed"  ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"}`} data-testid="button-filter-failed">Failed</Button>
            <Button onClick={() => setStatus("")}        className={`rounded-xl ${status===""        ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"}`} data-testid="button-filter-all">All</Button>
            <div className="ml-auto">
              <Button onClick={() => load(offset)} className="rounded-xl bg-white/10 text-white hover:bg-white/20" data-testid="button-refresh">Refresh</Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="rounded-2xl border border-white/15 bg-black/40 text-white backdrop-blur-xl overflow-hidden">
          <CardHeader className="py-3 border-b border-white/10">
            <CardTitle className="text-lg">Testimonials</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5">
                  <tr>
                    <th className="text-left p-3">Created</th>
                    <th className="text-left p-3">User</th>
                    <th className="text-left p-3">Content</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => (
                    <tr key={t.id} className="border-t border-white/10" data-testid={`row-testimonial-${t.id}`}>
                      <td className="p-3 whitespace-nowrap text-white/80" data-testid={`text-date-${t.id}`}>{new Date(t.createdAt).toLocaleString()}</td>
                      <td className="p-3 text-white/90" data-testid={`text-user-${t.id}`}>{t.userId}</td>
                      <td className="p-3 max-w-[560px]">
                        <div className="line-clamp-3 break-words text-white/90" data-testid={`text-content-${t.id}`}>{t.content}</div>
                      </td>
                      <td className="p-3">
                        <span className={
                          t.status === "posted" ? "px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300"
                          : t.status === "failed" ? "px-2 py-1 rounded-full bg-rose-500/15 text-rose-300"
                          : "px-2 py-1 rounded-full bg-amber-500/15 text-amber-300"
                        } data-testid={`status-${t.id}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={() => mark(t.id, "pending")} className="rounded-xl bg-white/10 hover:bg-white/20 text-white" data-testid={`button-pending-${t.id}`}>Set Pending</Button>
                          <Button onClick={() => mark(t.id, "posted")}  className="rounded-xl bg-white/10 hover:bg-white/20 text-white" data-testid={`button-posted-${t.id}`}>Mark Posted</Button>
                          <Button onClick={() => mark(t.id, "failed")}  className="rounded-xl bg-white/10 hover:bg-white/20 text-white" data-testid={`button-failed-${t.id}`}>Mark Failed</Button>
                          <Button onClick={() => postFB(t.id)} className="rounded-xl bg-white text-black hover:bg-white/90" data-testid={`button-facebook-${t.id}`}>Post to FB</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && !loading && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-white/60" data-testid="text-no-items">No items.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {loading && <div className="p-3 text-center text-white/60" data-testid="text-loading">Loading…</div>}
          </CardContent>
        </Card>

        {/* Footer / Pager */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-white/60" data-testid="text-item-count">Showing {items.length} items</div>
          <div className="flex gap-2">
            <Button onClick={() => load(Math.max(0, offset - 20))} className="rounded-xl bg-white/10 text-white hover:bg-white/20" data-testid="button-prev">Prev</Button>
            <Button onClick={() => load(offset + 20)} className="rounded-xl bg-white/10 text-white hover:bg-white/20" data-testid="button-next">Next</Button>
          </div>
        </div>

        {/* Info note */}
        <div className="text-xs text-white/60 text-center" data-testid="text-facebook-note">
          Note: "Post to FB" requires <code>USE_FACEBOOK=true</code> and valid <code>FB_GROUP_ID</code>/<code>FB_TOKEN</code>. If disabled/missing, it returns an error but won't crash.
        </div>
      </div>
    </div>
  );
}