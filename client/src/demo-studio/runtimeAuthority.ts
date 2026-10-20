import { permitsDemoIdentity } from "./authority";

export function assertIsolatedDemoRuntime(): void {
  const accepted = typeof window !== "undefined" && permitsDemoIdentity({
    development: import.meta.env.DEV,
    production: import.meta.env.PROD,
    mode: import.meta.env.MODE,
    childFrame: window.parent !== window,
    opaqueOrigin: window.origin === "null",
    srcDoc: document.URL === "about:srcdoc",
    marker: document.querySelector('meta[name="mpm-demo-studio"]')?.getAttribute("content") === "phase-1",
  });
  if (!accepted) throw new Error("Synthetic identity is restricted to the isolated Development Demo Studio");
}
