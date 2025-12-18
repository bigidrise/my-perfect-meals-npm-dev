// server/services/errorLog.ts
// Ring buffer of last N errors for QA dashboard.
const MAX = 50;
let buf: { ts: number; error: string; code?: string }[] = [];

export function pushError(error: string, code?: string) {
  buf.push({ ts: Date.now(), error, code });
  if (buf.length > MAX) buf = buf.slice(-MAX);
}

export function getErrors() { 
  return buf.slice().reverse(); 
}