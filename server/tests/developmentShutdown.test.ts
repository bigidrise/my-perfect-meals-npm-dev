import { EventEmitter } from "node:events";
import fs from "node:fs";
import {
  developmentShutdownEnabled,
  installDevelopmentShutdown,
  registerDevelopmentShutdownResource,
} from "../bootstrap/developmentShutdown";

function harness(env = { NODE_ENV: "development" } as Record<string, string | undefined>) {
  const signals = new EventEmitter();
  const calls: string[] = [];
  let completeDrain!: () => void;
  const server = {
    close: jest.fn((callback: (error?: Error) => void) => {
      calls.push("stop accepting");
      completeDrain = callback;
    }),
    closeIdleConnections: jest.fn(() => calls.push("idle connections")),
  };
  const closeVite = jest.fn(async () => { calls.push("Vite"); });
  const closeDatabase = jest.fn(async () => { calls.push("database"); });
  const exit = jest.fn();
  const log = jest.fn();
  const shutdown = installDevelopmentShutdown({
    env, server: server as any, signals: signals as any,
    closeVite, closeDatabase, exit, log, timeoutMs: 100,
    stopWarmup: () => { calls.push("warmup"); },
  });
  return { signals, calls, server, closeVite, closeDatabase, exit, log, shutdown, drain: () => completeDrain() };
}

describe("Development-only graceful shutdown", () => {
  afterEach(() => jest.useRealTimers());

  it.each([
    { NODE_ENV: "production" },
    { NODE_ENV: "development", REPLIT_DEPLOYMENT: "1" },
    { NODE_ENV: "test" },
    {},
  ])("never installs shutdown behavior outside unpublished Development: %j", env => {
    expect(developmentShutdownEnabled(env)).toBe(false);
    const h = harness(env);
    expect(h.shutdown).toBeUndefined();
    expect(h.signals.eventNames()).toEqual([]);
    expect(h.exit).not.toHaveBeenCalled();
  });

  it.each(["SIGTERM", "SIGINT"])("drains requests before closing resources for %s", async signal => {
    const h = harness();
    const remove = registerDevelopmentShutdownResource("test resource", async () => { h.calls.push("resource"); });
    try {
      h.signals.emit(signal);
      const pending = h.shutdown!.shutdown();
      expect(h.server.close).toHaveBeenCalledTimes(1);
      expect(h.closeVite).not.toHaveBeenCalled();
      expect(h.closeDatabase).not.toHaveBeenCalled();
      expect(h.exit).not.toHaveBeenCalled();
      h.drain();
      expect(await pending).toBe(true);
      expect(h.calls).toEqual(["stop accepting", "idle connections", "warmup", "Vite", "resource", "database"]);
      expect(h.exit).toHaveBeenCalledWith(0);
    } finally { remove(); h.shutdown!.dispose(); }
  });

  it("repeated signals share one drain and one clean exit", async () => {
    const h = harness();
    h.signals.emit("SIGTERM");
    h.signals.emit("SIGINT");
    h.signals.emit("SIGTERM");
    h.drain();
    await h.shutdown!.shutdown();
    expect(h.server.close).toHaveBeenCalledTimes(1);
    expect(h.closeDatabase).toHaveBeenCalledTimes(1);
    expect(h.exit).toHaveBeenCalledTimes(1);
    h.shutdown!.dispose();
    expect(h.signals.eventNames()).toEqual([]);
  });

  it("a stalled request prevents database closure and forced exit", async () => {
    jest.useFakeTimers();
    const h = harness();
    const pending = h.shutdown!.shutdown();
    await jest.advanceTimersByTimeAsync(100);
    expect(await pending).toBe(false);
    expect(h.closeDatabase).not.toHaveBeenCalled();
    expect(h.exit).not.toHaveBeenCalled();
    expect(h.log).toHaveBeenCalledWith(expect.stringContaining("no forced exit"));
    h.shutdown!.dispose();
  });

  it("cleanup failure does not force termination or close the pool early", async () => {
    const h = harness();
    h.closeVite.mockRejectedValueOnce(new Error("synthetic close failure"));
    const pending = h.shutdown!.shutdown();
    h.drain();
    expect(await pending).toBe(false);
    expect(h.closeDatabase).not.toHaveBeenCalled();
    expect(h.exit).not.toHaveBeenCalled();
    h.shutdown!.dispose();
  });

  it("Production notification cleanup retains its existing SIGTERM behavior", () => {
    const source = fs.readFileSync("server/queue/notifyQueue.ts", "utf8");
    expect(source).toContain('process.on("SIGTERM", closeNotificationResources)');
    expect(source).toContain("if (developmentShutdownEnabled(process.env))");
  });
});
