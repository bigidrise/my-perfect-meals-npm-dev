// client/src/lib/queue.ts
type Job = { id: string; url: string; body: any; ts: number };
const QKEY = "mpm.queue.macros";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function readQ(): Job[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(QKEY) || "[]"); } catch { return []; }
}

function writeQ(q: Job[]) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch {}
}

export async function queueOrPost(url: string, body: any) {
  if (typeof window === 'undefined') return false;
  
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    if (res.ok) return true;
  } catch {
    // network error → will queue
  }
  
  const q = readQ();
  q.push({ id: uid(), url, body, ts: Date.now() });
  writeQ(q);
  return false;
}

export async function flushQueue() {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  
  const q = readQ();
  if (!q.length) return;
  
  const remaining: Job[] = [];
  for (const job of q) {
    try {
      const res = await fetch(job.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(job.body),
      });
      if (!res.ok) remaining.push(job);
    } catch { remaining.push(job); }
  }
  writeQ(remaining);
}

export function startQueueAutoFlush() {
  if (typeof window === 'undefined') return () => {};
  
  flushQueue();
  const onl = () => flushQueue();
  window.addEventListener("online", onl);
  const id = window.setInterval(() => flushQueue(), 30000);
  return () => { window.removeEventListener("online", onl); window.clearInterval(id); };
}
