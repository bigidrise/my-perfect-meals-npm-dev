import { demoRequest, UnsupportedDemoRequest } from "./adapter";
import { DemoStore } from "./state";
import { assertIsolatedDemoRuntime } from "./runtimeAuthority";

declare const __MPM_DEMO_STATIC_IMAGES__: Record<string, string>;

/** Memory-only Storage API. clear() can never reach the browser's real Storage. */
export class DemoMemoryStorage implements Storage {
  constructor(private data: () => Record<string, string>, private changed: () => void) {}
  get length() { return Object.keys(this.data()).length; }
  key(i: number) { return Object.keys(this.data())[i] ?? null; }
  getItem(key: string) { return Object.hasOwn(this.data(), String(key)) ? this.data()[String(key)] : null; }
  setItem(key: string, value: string) {
    if (this.getItem(key) === String(value)) return;
    Object.defineProperty(this.data(), String(key), {
      value: String(value), configurable: true, enumerable: true, writable: true,
    });
    this.changed();
  }
  removeItem(key: string) { delete this.data()[String(key)]; this.changed(); }
  clear() { for (const key of Object.keys(this.data())) delete this.data()[key]; this.changed(); }
}

export function installDemoIsolation(store: DemoStore) {
  assertIsolatedDemoRuntime();
  const origin = "https://demo.invalid";
  const navigate = (value: string, replace = false) => {
    if (value.startsWith(`${origin}/`)) value = value.slice(origin.length);
    store.navigate(value, { replace });
  };
  // Only the separate demo bundle rewrites browser Location reads/writes to
  // this object; the main application and its actual Location are untouched.
  const demoLocation = {
    origin, protocol: "https:", hostname: "demo.invalid", host: "demo.invalid", port: "",
    get href() { return `${origin}${store.state.path}`; },
    set href(value: string) { navigate(value); },
    get pathname() { return new URL(`${origin}${store.state.path}`).pathname; },
    set pathname(value: string) { navigate(value); },
    get search() { return new URL(`${origin}${store.state.path}`).search; },
    set search(value: string) { navigate(`${store.state.path.split(/[?#]/)[0]}${value}`); },
    get hash() { return new URL(`${origin}${store.state.path}`).hash; },
    set hash(value: string) { navigate(`${store.state.path.split("#")[0]}${value}`); },
    assign: (url: string) => navigate(url), replace: (url: string) => navigate(url, true),
    reload: () => store.navigate(store.state.path, { replace: true }),
    toString: () => `${origin}${store.state.path}`,
  };
  Object.defineProperty(window, "__mpmDemoLocation", { value: demoLocation, configurable: false });
  window.open = (url?: string | URL) => { navigate(String(url ?? "/")); return null; };
  window.history.pushState = (_data, _unused, url) => { if (url) navigate(String(url)); };
  window.history.replaceState = (_data, _unused, url) => { if (url) navigate(String(url), true); };
  window.history.back = () => store.travel(-1);
  window.history.forward = () => store.travel(1);
  window.history.go = (delta = 0) => store.travel(delta);
  Object.defineProperty(window, "localStorage", { configurable: false,
    value: new DemoMemoryStorage(() => store.state.local, store.changed) });
  Object.defineProperty(window, "sessionStorage", { configurable: false,
    value: new DemoMemoryStorage(() => store.state.session, store.changed) });
  const blocked = (label: string): never => {
    if (!store.blocked.has(label)) { store.blocked.add(label); store.changed(); }
    throw new UnsupportedDemoRequest("BLOCKED", label);
  };
  window.fetch = async (input, init) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    try {
      // Do not forward Request headers, cookies, credentials, or an abort handler.
      return await demoRequest(store, raw, {
        method: init?.method ?? (input instanceof Request ? input.method : "GET"),
        body: init?.body ?? (input instanceof Request ? await input.clone().text() : undefined),
      });
    } catch (error) {
      if (error instanceof UnsupportedDemoRequest) {
        const label = error.message;
        if (!store.blocked.has(label)) { store.blocked.add(label); store.changed(); }
      }
      throw error;
    }
  };
  for (const key of ["XMLHttpRequest", "WebSocket", "EventSource", "Worker", "SharedWorker",
    "SpeechRecognition", "webkitSpeechRecognition"] as const) {
    Object.defineProperty(window, key, { value: class { constructor() { blocked(key); } }, configurable: false });
  }
  Object.defineProperty(navigator, "sendBeacon", { value: () => { blocked("sendBeacon"); }, configurable: false });
  if ("speechSynthesis" in window) Object.defineProperty(window, "speechSynthesis", {
    value: { speaking: false, pending: false, paused: false, onvoiceschanged: null,
      getVoices: () => [], cancel: () => {}, pause: () => {}, resume: () => {},
      speak: () => blocked("Speech synthesis is outside Phase 1 Demo Mode"),
    }, configurable: false,
  });
  if (navigator.mediaDevices) {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () => Promise.reject(new Error("Live recording and uploads are outside Phase 1 Demo Mode")),
    });
  }
  document.addEventListener("click", event => {
    const anchor = (event.target as Element)?.closest?.("a");
    if (!anchor) return;
    event.preventDefault();
    store.navigate(anchor.getAttribute("href") ?? "/");
  }, true);
  // Keep the actual customer logos/avatar without allowing static HTTP reads
  // from this opaque frame. Only these build-time public assets are embedded.
  const useEmbeddedImage = (image: HTMLImageElement) => {
    const source = image.getAttribute("src") ?? "";
    if (!source.startsWith("/")) return;
    const embedded = __MPM_DEMO_STATIC_IMAGES__[source.split("?")[0]];
    if (embedded) { image.removeAttribute("srcset"); image.src = embedded; }
  };
  const useEmbeddedBackground = (element: Element) => {
    const style = (element as HTMLElement).style;
    if (!style?.backgroundImage) return;
    const previous = style.backgroundImage;
    const embedded = previous.replace(/url\((["']?)(\/[^)"']+)\1\)/g, (original, _quote, source) => {
      const data = __MPM_DEMO_STATIC_IMAGES__[source];
      return data ? `url("${data}")` : original;
    });
    if (embedded !== previous) style.backgroundImage = embedded;
  };
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "attributes" && record.target instanceof HTMLImageElement) useEmbeddedImage(record.target);
      if (record.type === "attributes" && record.target instanceof Element) useEmbeddedBackground(record.target);
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node instanceof HTMLImageElement) useEmbeddedImage(node);
        node.querySelectorAll("img").forEach(useEmbeddedImage);
        useEmbeddedBackground(node);
        node.querySelectorAll("[style]").forEach(useEmbeddedBackground);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "style"] });
}
