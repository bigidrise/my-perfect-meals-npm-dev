import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";

// No supplied database URL is accepted. This runner owns a fresh local cluster.
const directory = mkdtempSync(join(tmpdir(), "mpm-billing-isolated-"));
const net = createServer();
await new Promise(resolve => net.listen(0, "127.0.0.1", resolve));
const port = net.address().port;
await new Promise(resolve => net.close(resolve));
const env = { PATH: process.env.PATH, HOME: process.env.HOME, LANG: "C.UTF-8", TMPDIR: tmpdir() };
const run = (cmd, args, extra = {}) => {
  const result = spawnSync(cmd, args, { stdio: "inherit", env: { ...env, ...extra } });
  if (result.status !== 0) throw new Error(`${cmd} failed (${result.status})`);
};
let started = false;
try {
  run("initdb", ["-D", directory, "-A", "trust", "-U", "billing_fixture", "--no-locale", "-E", "UTF8"]);
  run("pg_ctl", ["-D", directory, "-l", join(directory, "server.log"), "-o", `-h 127.0.0.1 -p ${port} -k ${directory}`, "-w", "start"]);
  started = true;
  run("createdb", ["-h", "127.0.0.1", "-p", String(port), "-U", "billing_fixture", "billing_safeguards_isolated"]);
  run(process.execPath, ["--import", "tsx", "--test", "--test-concurrency=1",
    "tests/billing-safeguards.isolated.ts"], {
    NODE_ENV: "test",
    BILLING_ISOLATED_TEST_URL: `postgresql://billing_fixture@127.0.0.1:${port}/billing_safeguards_isolated`,
    BILLING_CHECKOUT_SAFEGUARDS_ENABLED: "true",
    ACCOUNT_EMAIL_UNIQUENESS_ENABLED: "true",
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (started) spawnSync("pg_ctl", ["-D", directory, "-m", "fast", "-w", "stop"], { env, stdio: "inherit" });
  rmSync(directory, { recursive: true, force: true });
}
