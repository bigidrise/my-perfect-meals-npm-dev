// Offline shim v2: intercepts both fetch() and XMLHttpRequest (Axios) calls
// to /api/macros/log or /macros/log and writes to localStorage (macros_offline_v1).
// Enable with VITE_MACROS_OFFLINE=1 (client env). Optional debug: VITE_MACROS_SHIM_DEBUG=1

// 🔥 TEMPORARY: Hardcode ENABLED until ENV vars work
const ENABLED = true; // (import.meta as any).env?.VITE_MACROS_OFFLINE === "1";
const DEBUG   = true; // (import.meta as any).env?.VITE_MACROS_SHIM_DEBUG === "1";

console.log('[SHIM] Loading... ENABLED=', ENABLED, 'DEBUG=', DEBUG);

function log(...args: any[]) { if (DEBUG) console.log("[macros-shim]", ...args); }

// match /api/macros/log, /macros/log, any query
const MATCH = /\/(?:api\/)?macros\/log(?:[?#]|$)/i;

// ---- store helpers ----
function dayKey(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function readStore() {
  try { return JSON.parse(localStorage.getItem("macros_offline_v1") || "{}"); } catch { return {}; }
}
function writeStore(store: any) {
  try { localStorage.setItem("macros_offline_v1", JSON.stringify(store)); } catch {}
}
function kcalFrom(p?: number, c?: number, f?: number, kcal?: number) {
  const P = typeof p === "number" ? p : 0;
  const C = typeof c === "number" ? c : 0;
  const F = typeof f === "number" ? f : 0;
  return typeof kcal === "number" && kcal > 0 ? kcal : Math.round(P*4 + C*4 + F*9);
}
function mergeToday({ protein=0, carbs=0, fat=0, calories }: { protein?: number; carbs?: number; fat?: number; calories?: number; }) {
  const store = readStore();
  const key = dayKey();
  const rows: any[] = Array.isArray(store.rows) ? store.rows : [];
  let row = rows.find(r => r.day === key);
  if (!row) { row = { day: key, kcal: 0, protein: 0, carbs: 0, fat: 0 }; rows.unshift(row); }

  const kcal = kcalFrom(protein, carbs, fat, calories);
  row.protein = Math.round((row.protein || 0) + (protein || 0));
  row.carbs   = Math.round((row.carbs   || 0) + (carbs   || 0));
  row.fat     = Math.round((row.fat     || 0) + (fat     || 0));
  row.kcal    = Math.round((row.kcal    || 0) +  kcal);

  writeStore({ rows: rows.slice(0, 90) });
  window.dispatchEvent(new Event("macros:updated"));

  const payload = { ok: true, source: "offline-shim", day: key, totals: { kcal: row.kcal, protein: row.protein, carbs: row.carbs, fat: row.fat } };
  log("merged", payload);
  return payload;
}

function parseBody(body: any) {
  // handle stringified JSON, FormData, URLSearchParams
  try {
    if (!body) return {};
    if (typeof body === "string") return JSON.parse(body);
    if (body instanceof FormData) {
      const obj: any = {};
      for (const [k, v] of body.entries()) obj[k] = typeof v === "string" ? Number(v) || v : v;
      return obj;
    }
    if (body instanceof URLSearchParams) {
      const obj: any = {};
      for (const [k, v] of (body as URLSearchParams).entries()) obj[k] = Number(v) || v;
      return obj;
    }
    // raw object
    return body;
  } catch { return {}; }
}

if (ENABLED && typeof window !== "undefined") {
  log("ENABLED");

  // -------- fetch interceptor --------
  const origFetch = window.fetch;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : (input as Request).url;
    const method = (init?.method || "GET").toUpperCase();
    if (method === "POST" && MATCH.test(url)) {
      const payload = parseBody((init as any)?.body);
      log("fetch intercept", method, url, payload);
      try {
        const result = mergeToday({
          protein: typeof payload.protein === "number" ? payload.protein : Number(payload.protein) || 0,
          carbs:   typeof payload.carbs   === "number" ? payload.carbs   : Number(payload.carbs)   || 0,
          fat:     typeof payload.fat     === "number" ? payload.fat     : Number(payload.fat)     || 0,
          calories:typeof payload.calories=== "number" ? payload.calories: Number(payload.calories)|| undefined,
        });
        return new Response(JSON.stringify(result), { status: 200, headers: { "Content-Type": "application/json" } });
      } catch (e:any) {
        return new Response(JSON.stringify({ ok:false, error: e?.message || "offline-shim-error" }),
          { status: 500, headers: { "Content-Type": "application/json" } });
      }
    }
    return origFetch(input as any, init);
  };

  // -------- XHR interceptor (Axios & friends) --------
  const XHR = window.XMLHttpRequest;
  function wrapXHR() {
    const proto = XHR.prototype;
    const origOpen = proto.open;
    const origSend = proto.send;

    (proto as any)._shim = { url: "", method: "GET" };

    proto.open = function(method: string, url: string, ...rest: any[]) {
      (this as any)._shim = { url, method: (method || "GET").toUpperCase() };
      return origOpen.apply(this, [method, url, ...rest] as any);
    };

    proto.send = function(body?: any) {
      const info = (this as any)._shim || { url: "", method: "GET" };
      if (info.method === "POST" && MATCH.test(info.url)) {
        const payload = parseBody(body);
        log("xhr intercept", info.method, info.url, payload);
        try {
          const result = mergeToday({
            protein: typeof payload.protein === "number" ? payload.protein : Number(payload.protein) || 0,
            carbs:   typeof payload.carbs   === "number" ? payload.carbs   : Number(payload.carbs)   || 0,
            fat:     typeof payload.fat     === "number" ? payload.fat     : Number(payload.fat)     || 0,
            calories:typeof payload.calories=== "number" ? payload.calories: Number(payload.calories)|| undefined,
          });

          // fabricate a successful XHR response
          const respText = JSON.stringify(result);
          Object.defineProperty(this, "readyState", { value: 4 });
          Object.defineProperty(this, "status", { value: 200 });
          Object.defineProperty(this, "responseText", { value: respText });
          Object.defineProperty(this, "response", { value: respText });

          // fire events/callbacks
          if (typeof (this as any).onreadystatechange === "function") (this as any).onreadystatechange(new Event("readystatechange"));
          if (typeof (this as any).onload === "function") (this as any).onload(new Event("load"));
          this.dispatchEvent?.(new Event("readystatechange"));
          this.dispatchEvent?.(new Event("load"));
          return; // do NOT hit network
        } catch (e) {
          Object.defineProperty(this, "readyState", { value: 4 });
          Object.defineProperty(this, "status", { value: 500 });
          Object.defineProperty(this, "responseText", { value: `{"ok":false}` });
          if (typeof (this as any).onreadystatechange === "function") (this as any).onreadystatechange(new Event("readystatechange"));
          if (typeof (this as any).onerror === "function") (this as any).onerror(new Event("error"));
          this.dispatchEvent?.(new Event("readystatechange"));
          this.dispatchEvent?.(new Event("error"));
          return;
        }
      }
      return origSend.apply(this, [body]);
    };
  }
  if (window.XMLHttpRequest) wrapXHR();

  // expose debug toggle
  (window as any).__macros_dbg = {
    enableLog(flag: boolean) { (window as any).localStorage?.setItem("__macros_dbg", flag ? "1":"0"); },
  };
}
