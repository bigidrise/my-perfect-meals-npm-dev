import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const workspace = fileURLToPath(new URL("../", import.meta.url));
const script = path.join(workspace, "scripts/release-check.sh");

// Exercise the real validation script without running builds, contacting any
// server, or using an account. The complete real release check runs separately.
function runReleaseCheck({ domain = "release-preview.test", target, type, response } = {}) {
  const sandbox = mkdtempSync(path.join(tmpdir(), "release-smoke-origin-test-"));
  try {
    const bin = path.join(sandbox, "bin");
    mkdirSync(bin);
    const requests = path.join(sandbox, "requests.jsonl");
    writeFileSync(path.join(bin, "npm"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    writeFileSync(path.join(bin, "curl"), `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const after = flag => args[args.indexOf(flag) + 1];
const url = args.find(arg => /^https?:\\/\\//.test(arg));
const headers = args.flatMap((arg, i) => arg === "-H" ? [args[i + 1]] : []);
const method = args.includes("-X") ? after("-X") : "GET";
const payload = args.includes("-d") ? JSON.parse(after("-d")) : null;
fs.appendFileSync(process.env.REQUEST_LOG, JSON.stringify({ url, headers, method, payload, args }) + "\\n");
if (url.endsWith("/api/health")) {
  process.stdout.write(JSON.stringify({ ok:true, hasOpenAI:true, hasS3:true }));
} else if (method === "POST") {
  const override = payload.type === process.env.OVERRIDE_TYPE
    ? JSON.parse(process.env.OVERRIDE_RESPONSE) : {};
  if (override.transportFailure) process.exit(28);
  const status = override.status ?? 401;
  const body = override.rawBody ?? JSON.stringify(override.body ?? {
    error: "Authentication required", code: "AUTH_REQUIRED",
  });
  process.stdout.write(body + "\\n" + status);
} else {
  process.stdout.write("401");
}
`, { mode: 0o755 });
    const env = {
      ...process.env,
      PATH: `${bin}:${process.env.PATH}`,
      REQUEST_LOG: requests,
      OVERRIDE_TYPE: type ?? "",
      OVERRIDE_RESPONSE: JSON.stringify(response ?? {}),
    };
    delete env.REPLIT_DEV_DOMAIN;
    if (domain !== null) env.REPLIT_DEV_DOMAIN = domain;
    const result = spawnSync("bash", [script, ...(target ? [target] : [])], {
      cwd: workspace, env, encoding: "utf8", timeout: 15000,
    });
    assert.equal(result.error, undefined);
    return {
      status: result.status,
      output: `${result.stdout}${result.stderr}`.replace(/\x1b\[[0-9;]*m/g, ""),
      posts: readFileSync(requests, "utf8").trim().split("\n")
        .map(line => JSON.parse(line)).filter(request => request.method === "POST"),
    };
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

for (const scenario of [
  { name: "configured Development origin", origin: "https://release-preview.test" },
  {
    name: "explicit Development target takes precedence and preserves its port",
    target: "https://explicit-preview.test:5443/",
    origin: "https://explicit-preview.test:5443",
  },
  { name: "local fallback without Development configuration", domain: null, origin: "http://localhost:5000" },
]) {
  test(scenario.name, () => {
    const result = runReleaseCheck(scenario);
    assert.equal(result.status, 0, result.output);
    assert.match(result.output, /Passed:\s+13/);
    assert.match(result.output, /Warnings:\s+0/);
    assert.match(result.output, /Failed:\s+0/);
    assert.equal(result.posts.length, 2);
    assert.deepEqual(result.posts.map(post => post.payload), [
      { type: "health-check" },
      { type: "create-with-chef", input: "health-probe" },
    ]);
    for (const post of result.posts) {
      assert.equal(post.url, `${scenario.origin}/api/meals/generate`);
      assert.ok(post.headers.includes(`Origin: ${scenario.origin}`));
      assert.ok(post.headers.includes("Content-Type: application/json"));
      assert.equal(post.headers.length, 2, "No auth/token/bypass headers");
      assert.ok(!post.args.includes("-b") && !post.args.includes("--cookie"));
      assert.equal(post.args[post.args.indexOf("-w") + 1], "\n%{http_code}");
    }
    assert.match(result.output, /Meal generation endpoint reached authentication \(401 AUTH_REQUIRED\)/);
    assert.match(result.output, /AI generation gate reached authentication \(401 AUTH_REQUIRED\)/);
  });
}

for (const type of ["health-check", "create-with-chef"]) {
  for (const scenario of [
    {
      name: "rejects CSRF Origin rejection instead of counting it as auth success",
      response: { status: 403, body: { code: "CSRF_ORIGIN_REJECTED" } },
      message: /was rejected by CSRF, not authentication/,
    },
    {
      name: "checks response code, not just a 401 status",
      response: { status: 401, body: { code: "CSRF_TOKEN_INVALID" } },
      message: /was rejected by CSRF, not authentication/,
    },
    {
      name: "rejects another 401 reason",
      response: { status: 401, body: { code: "SESSION_EXPIRED" } },
      message: /unexpected authentication response/,
    },
    {
      name: "rejects unauthenticated success even with the auth code",
      response: { status: 200, body: { code: "AUTH_REQUIRED" } },
      message: /unexpected authentication response/,
    },
    {
      name: "rejects a validation failure rather than proving authentication",
      response: { status: 400, body: { code: "INVALID_INPUT" } },
      message: /unexpected authentication response/,
    },
    {
      name: "rejects malformed JSON",
      response: { status: 401, rawBody: "not JSON" },
      message: /invalid or uncoded JSON response/,
    },
    {
      name: "rejects an uncoded JSON response",
      response: { status: 401, body: { error: "Authentication required" } },
      message: /invalid or uncoded JSON response/,
    },
    {
      name: "fails on transport errors or timeouts",
      response: { transportFailure: true },
      message: /probe transport failed or timed out/,
    },
  ]) {
    test(`${type}: ${scenario.name}`, () => {
      const result = runReleaseCheck({ type, response: scenario.response });
      assert.equal(result.status, 1, result.output);
      assert.match(result.output, scenario.message);
      assert.match(result.output, /Passed:\s+12/);
      assert.match(result.output, /Warnings:\s+0/);
      assert.match(result.output, /Failed:\s+1/);
    });
  }
}
