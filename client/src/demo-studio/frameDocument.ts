import { validateDemoState } from "./state";

export const DEMO_STORAGE_KEY = "mpm.demoStudio.phase1";
export const DEMO_ASSET_BASE = "/.demo-studio-runtime";
const literal = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

export function makeDemoDocument(js: string, css: string, initialState: unknown, channel: string) {
  // Opaque origin plus CSP are independent of the JavaScript request adapter.
  // No allow-same-origin, network, form submissions, frames, or remote assets.
  return `<!doctype html><html class="dark"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="mpm-demo-studio" content="phase-1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; media-src blob: data:; frame-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
<title>My Perfect Meals · Demo Mode</title><style>${css.replace(/<\/style/gi, "<\\/style")}
html,body,#root{height:100%;margin:0}
.demo-studio{height:100dvh;min-height:0!important;display:flex;flex-direction:column;overflow:auto}
.ds-stage{flex:1;min-height:360px;position:relative;display:flex;flex-direction:column}
.ds-stage>div{flex:1;min-height:0;position:relative}
</style>
</head><body><div id="root"></div><script>window.__mpmDemoInitialState=${literal(validateDemoState(initialState) ? initialState : null)};
window.__mpmDemoChannel=${literal(channel)};</script><script>${js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
}
