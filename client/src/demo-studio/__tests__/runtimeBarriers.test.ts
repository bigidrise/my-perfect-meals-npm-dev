/** @jest-environment jsdom */
import { runInThisContext } from "node:vm";
import { installDemoIsolation } from "../isolation";
import { DemoStore, freshDemo } from "../state";

jest.mock("../runtimeAuthority", () => ({ assertIsolatedDemoRuntime: jest.fn() }));

describe("installed browser barriers", () => {
  (globalThis as any).structuredClone = runInThisContext("structuredClone");
  const store = new DemoStore(freshDemo());
  const originalFetch = jest.fn(() => { throw new Error("A live fetch must never run"); });
  const browserHref = window.location.href;
  beforeAll(() => {
    // Standard Node web primitives, not a transport fallback.
    Object.assign(globalThis, runInThisContext("({ Response, Request, Headers })"));
    (globalThis as any).__MPM_DEMO_STATIC_IMAGES__ = {};
    window.fetch = originalFetch;
    installDemoIsolation(store);
  });
  it("replaces both stores rather than reading an account's existing browser storage", () => {
    localStorage.setItem("demo-only", "example");
    expect(store.state.local["demo-only"]).toBe("example");
    sessionStorage.setItem("draft", "synthetic");
    expect(store.state.session.draft).toBe("synthetic");
    localStorage.clear();
    expect(store.state.local).toEqual({});
  });
  it("routes profile reads and saves locally, discarding credential headers", async () => {
    const result = await window.fetch("https://demo.invalid/api/users/profile", {
      method: "PUT", credentials: "include", headers: { authorization: "Bearer not-a-real-token" },
      body: JSON.stringify({ firstName: "Morgan" }),
    });
    expect((await result.json()).firstName).toBe("Morgan");
    const read = await window.fetch("/api/user/profile");
    expect((await read.json()).id).toBe("demo-studio-user");
    expect(originalFetch).not.toHaveBeenCalled();
  });
  it("blocks live/unknown requests even when callers explicitly supply credentials", async () => {
    for (const url of ["https://production.example/api/user/profile", "/api/auth/login", "/api/unknown"]) {
      await expect(window.fetch(url, { credentials: "include" })).rejects.toThrow("Not connected");
    }
    expect(originalFetch).not.toHaveBeenCalled();
  });
  it("blocks alternative transports rather than bypassing the fetch adapter", () => {
    expect(() => new XMLHttpRequest()).toThrow();
    expect(() => new WebSocket("wss://production.example")).toThrow();
    expect(() => navigator.sendBeacon("https://production.example", "synthetic")).toThrow();
    expect(originalFetch).not.toHaveBeenCalled();
  });
  it("routes imperative navigation to demo state without changing the browser URL", () => {
    const location = (window as any).__mpmDemoLocation;
    location.href = "/dashboard";
    expect(store.state.workflow).toBe("dashboard");
    location.assign("https://production.example/dashboard");
    expect(store.state.workflow).toBeNull();
    expect(window.location.href).toBe(browserHref);
    window.open("/macro-counter");
    expect(store.state.workflow).toBe("macro");
  });
  it("also isolates browser history navigation", () => {
    history.pushState({}, "", "/onboarding");
    expect(store.state.workflow).toBe("onboarding");
    history.back();
    expect(store.state.workflow).toBeNull();
    expect(window.location.href).toBe(browserHref);
  });
});
