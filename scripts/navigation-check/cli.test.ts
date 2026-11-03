import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const cli = path.resolve("scripts/navigation-check/cli.ts");
function fixture(routeSource: string, destinations: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mpm-navigation-"));
  for (const directory of ["client/src/components", "shared/coaching", "server/services/coaching"])
    fs.mkdirSync(path.join(root, directory), { recursive: true });
  fs.writeFileSync(path.join(root, "client/src/components/Router.tsx"), routeSource);
  fs.writeFileSync(path.join(root, "shared/coaching/navigation.ts"), destinations);
  try {
    const run = spawnSync(process.execPath,
      ["--import", pathToFileURL(require.resolve("tsx")).href, cli, "--json"],
      { cwd: root, encoding: "utf8", timeout: 20_000, env: { ...process.env, NODE_ENV: "development" } });
    assert.ifError(run.error);
    return { status: run.status, output: run.stdout, error: run.stderr };
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test("CLI succeeds for matching destinations and fails when that route is removed", () => {
  const before = fixture('<Route path="/edit-profile"/>', 'const action = { route: "/edit-profile" };');
  assert.equal(before.status, 0, before.error);
  assert.equal(JSON.parse(before.output).matched, 1);
  const after = fixture('<Route path="/profile"/>', 'const action = { route: "/edit-profile" };');
  assert.equal(after.status, 1, after.error);
  assert.equal(JSON.parse(after.output).invalid[0].value, "/edit-profile");
});

test("CLI catches the broken GLP-1-style destination in a real control", () => {
  const run = fixture('<><Route path="/edit-profile"/><button onClick={() => navigate("/profile/edit")}>GLP-1</button></>', "");
  assert.equal(run.status, 1, run.error);
  assert.equal(JSON.parse(run.output).invalid[0].value, "/profile/edit");
});

test("CLI fails closed for missing or unresolved route authority", () => {
  assert.equal(fixture("const noRoutes = true;", "").status, 1);
  const dynamic = fixture('<><Route path="/auth"/><Route path={importedPath}/></>', "");
  assert.equal(dynamic.status, 1, dynamic.error);
});
