import { useState } from "react";
import { apiUrl } from '@/lib/resolveApiBase';
import { Button } from "@/components/ui/button";

export default function TestimonialForm() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const maxLen = 1500;

  const submit = async () => {
    const content = text.trim();
    if (!content) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/testimonials/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "test-user", content, platform: "internal" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      setText("");
      alert("Saved!");
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={maxLen}
        placeholder="Share your experience…"
        className="w-full min-h-[140px] p-3 rounded-xl bg-white/5 border border-white/20 text-white placeholder:text-white/50"
        data-testid="input-testimonial-content"
      />
      <div className="text-xs text-white/60" data-testid="text-character-count">{text.length}/{maxLen}</div>
      <Button
        onClick={submit}
        disabled={loading || !text.trim()}
        className="rounded-xl bg-white text-black hover:bg-white/90"
        data-testid="button-submit-testimonial"
      >
        {loading ? "Saving…" : "Save Testimonial"}
      </Button>
    </div>
  );
}