import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

function message(child: ChildProcess, type: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.removeListener("message", receive);
      reject(new Error(`Synthetic shutdown fixture did not send ${type}`));
    }, 5_000);
    function receive(value: any) {
      if (value?.type !== type) return;
      clearTimeout(timer);
      child.removeListener("message", receive);
      resolve(value);
    }
    child.on("message", receive);
  });
}

it("real SIGTERM drains an active HTTP request and releases both fixture ports without forced termination", async () => {
  const moduleUrl = pathToFileURL(path.resolve("server/bootstrap/developmentShutdown.ts")).href;
  // This child imports only the dependency-free shutdown module. No app, Vite,
  // database, storage or provider modules; no credentials inherited.
  const source = `
    import http from "node:http";
    import net from "node:net";
    import { installDevelopmentShutdown } from ${JSON.stringify(moduleUrl)};
    let held;
    const server = http.createServer((_req, res) => {
      held = res;
      process.send({type:"holding"});
    });
    const viteStandIn = net.createServer();
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    await new Promise(resolve => viteStandIn.listen(0, "127.0.0.1", resolve));
    installDevelopmentShutdown({
      server,
      closeVite: () => new Promise((resolve, reject) => viteStandIn.close(error => error ? reject(error) : resolve())),
      closeDatabase: async () => { process.send({type:"database-closed"}); },
      stopWarmup: () => {},
      log: text => { if (text.includes("Draining")) process.send({type:"draining"}); },
    });
    process.on("message", value => {
      if (value === "complete") held.end("completed normally");
    });
    process.send({type:"ready", httpPort:server.address().port, vitePort:viteStandIn.address().port});
  `;
  const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", source], {
    env: { PATH: process.env.PATH, NODE_ENV: "development" },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  let errors = "";
  child.stderr!.on("data", value => { errors += value; });
  const exited = once(child, "exit");
  let request: http.ClientRequest | undefined;
  try {
    const ready = await message(child, "ready");
    const holding = message(child, "holding");
    const response = new Promise<string>((resolve, reject) => {
      request = http.get(`http://127.0.0.1:${ready.httpPort}`, res => {
        let body = "";
        res.on("data", chunk => { body += chunk; });
        res.on("end", () => resolve(body));
        res.on("error", reject);
      });
      request.on("error", reject);
    });
    await holding;
    const draining = message(child, "draining");
    const databaseClosed = message(child, "database-closed");
    child.kill("SIGTERM");
    await draining;
    expect(child.exitCode).toBeNull();
    child.send("complete");
    expect(await response).toBe("completed normally");
    await databaseClosed;
    expect(await exited).toEqual([0, null]);
    expect(errors).toBe("");
    // Rebinding both exact ports proves no old listener survived.
    for (const port of [ready.httpPort, ready.vitePort]) {
      const probe = http.createServer();
      await new Promise<void>((resolve, reject) => {
        probe.once("error", reject);
        probe.listen(port, "127.0.0.1", () => probe.close(error => error ? reject(error) : resolve()));
      });
    }
  } finally {
    request?.destroy();
    // Failure cleanup applies only to this credential-free synthetic child.
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }
}, 15_000);
