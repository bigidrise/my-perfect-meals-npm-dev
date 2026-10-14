import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Client } from "pg";

/** A private Unix socket, no TCP listener, no connection-string or env fallback.
 * Existing PostgreSQL binaries are required. Never provision/use an app database.
 */
export async function disposablePostgres() {
  const bin = dirname(execFileSync("which", ["initdb"], { encoding: "utf8" }).trim());
  const root = mkdtempSync(join(tmpdir(), "pilot-sql-"));
  const data = join(root, "data"), socket = join(root, "socket");
  mkdirSync(socket, { mode: 0o700 });
  // Strip credentials and PostgreSQL environment overrides from child processes.
  const env = { PATH: process.env.PATH, HOME: root, LANG: "C" };
  const run = (name: string, args: string[]) => execFileSync(join(bin, name), args, {
    env, stdio: "pipe", timeout: 30000,
  });
  let started = false;
  const client = new Client({ host: socket, port: 55439, database: "postgres", user: "pilot_test", ssl: false });
  try {
    run("initdb", ["-D", data, "-A", "trust", "-U", "pilot_test", "--no-locale", "--encoding=UTF8"]);
    run("pg_ctl", ["-D", data, "-l", join(root, "postgres.log"), "-o", `-F -k ${socket} -h '' -p 55439`, "-w", "start"]);
    started = true;
    await client.connect();
    if ((await client.query("SELECT inet_server_addr() IS NULL AS local_socket")).rows[0]?.local_socket !== true) {
      throw new Error("Disposable PostgreSQL must use its private Unix socket");
    }
    return {
      client,
      close: async () => {
        try { await client.end(); }
        finally {
          try { run("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]); }
          finally { rmSync(root, { recursive: true, force: true }); }
        }
      },
    };
  } catch (error) {
    try { await client.end(); } catch {}
    try { if (started) run("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]); }
    finally { rmSync(root, { recursive: true, force: true }); }
    throw error;
  }
}
