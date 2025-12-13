import { useState } from "react";
import { apiUrl } from '@/lib/resolveApiBase';

export default function PostToFacebookButton({ testimonialId }: { testimonialId: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const post = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(apiUrl("/api/facebook/share"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testimonialId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      setMsg("Posted to Facebook ✅");
    } catch (e: any) {
      setMsg(`Failed: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button 
        onClick={post} 
        disabled={loading} 
        className="px-3 py-2 rounded bg-black text-white disabled:opacity-50"
        data-testid="button-facebook-post"
      >
        {loading ? "Posting…" : "Post as Admin (FB)"}
      </button>
      {msg && <div className="text-xs mt-1 opacity-70" data-testid="text-facebook-status">{msg}</div>}
    </div>
  );
}