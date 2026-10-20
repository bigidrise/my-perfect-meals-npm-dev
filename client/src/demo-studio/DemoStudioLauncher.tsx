import { useEffect, useRef, useState } from "react";
import { DEMO_ASSET_BASE, DEMO_STORAGE_KEY, makeDemoDocument } from "./frameDocument";
import { validateDemoState } from "./state";

export default function DemoStudioLauncher({ onClose }: { onClose: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [documentText, setDocumentText] = useState("");
  const [error, setError] = useState("");
  const [channel] = useState(() => crypto.randomUUID());
  const allowed = import.meta.env.DEV && !import.meta.env.PROD && import.meta.env.MODE === "development";
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== "null" ||
          event.data?.type !== "mpm-demo-state" || event.data.channel !== channel ||
          !validateDemoState(event.data.state)) return;
      // Exactly one namespaced key. Never read, copy, enumerate or clear account storage.
      try { sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(event.data.state)); }
      catch { setError("Demo state cannot be retained after closing this window. It remains isolated in memory."); }
    };
    window.addEventListener("message", receive);
    void (async () => {
      try {
        const [bundle, styles] = await Promise.all([
          fetch(`${DEMO_ASSET_BASE}/bundle.js`, { credentials: "omit", cache: "no-store" }),
          fetch(`${DEMO_ASSET_BASE}/styles.css?direct`, { credentials: "omit", cache: "no-store" }),
        ]);
        if (!bundle.ok || !styles.ok) throw new Error("Prepare Demo Studio assets with npm run demo:prepare, then reopen Demo Studio.");
        const [js, css] = await Promise.all([bundle.text(), styles.text()]);
        if (!js.includes("mpm-demo-studio-runtime-v1") || !css.includes("--safe-area-inset-top")) {
          throw new Error("Demo assets are missing or invalid. Run npm run demo:prepare, then reopen Demo Studio.");
        }
        let saved: unknown = null;
        try { saved = JSON.parse(sessionStorage.getItem(DEMO_STORAGE_KEY) ?? "null"); } catch { /* start fresh */ }
        if (active) setDocumentText(makeDemoDocument(js, css, saved, channel));
      } catch (e) { if (active) setError(e instanceof Error ? e.message : String(e)); }
    })();
    return () => { active = false; window.removeEventListener("message", receive); };
  }, [allowed, channel]);
  if (!allowed) return <div role="alert">Demo Studio is available in Development only.</div>;
  return <section className="fixed inset-0 z-[10000] bg-slate-950 flex flex-col" aria-label="Demo Studio">
    <div className="flex justify-between items-center px-4 py-2 bg-slate-950 text-white border-b border-amber-500/40">
      <span className="text-sm font-semibold">My Perfect Meals · Demo Mode · Development only</span>
      <button onClick={onClose} className="rounded px-3 py-2 border border-white/30">Close Demo Studio</button>
    </div>
    {error && <p role="alert" className="p-4 text-amber-100">{error}</p>}
    {!documentText && !error && <p role="status" className="p-6 text-white">Loading isolated Demo Studio…</p>}
    {documentText && <iframe ref={frame} title="Isolated My Perfect Meals Demo Mode"
      sandbox="allow-scripts" srcDoc={documentText} className="w-full flex-1 border-0 bg-black"
      referrerPolicy="no-referrer" />}
  </section>;
}
