#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { isCheckpoint, checkUpdates } = require("./push-policy.cjs");
const { commandRunner } = require("./push-dev.cjs");

function runHook({ remoteName, remote, input, run }) {
  if (isCheckpoint(remoteName, remote)) return;
  const branch = run("git", ["symbolic-ref", "--quiet", "--short", "HEAD"]).trim();
  checkUpdates(remoteName, remote, input, branch);
  const assertClean = () => {
    if (run("git", ["status", "--porcelain=v1", "--untracked-files=normal"]).trim()) {
      throw new Error("Refusing push: working tree is dirty.");
    }
  };
  assertClean();
  const head = run("git", ["rev-parse", "HEAD"]).trim();
  for (const line of input.trim() ? input.trim().split(/\r?\n/) : []) {
    const [, localSha, destination, remoteSha] = line.trim().split(/\s+/);
    if (destination === "refs/heads/dev") {
      if (localSha !== head) throw new Error("Refusing push: dev update does not match the checked-out HEAD.");
      if (!/^0+$/.test(remoteSha)) {
        run("git", ["merge-base", "--is-ancestor", remoteSha, localSha]);
      }
    }
  }
  run("npm", ["run", "validate", "--", "--no-start"]);
  assertClean();
  if (run("git", ["symbolic-ref", "--quiet", "--short", "HEAD"]).trim() !== branch ||
      run("git", ["rev-parse", "HEAD"]).trim() !== head) {
    throw new Error("Refusing push: branch or HEAD changed during hook validation.");
  }
}

if (require.main === module) {
  try {
    runHook({
      remoteName: process.argv[2], remote: process.argv[3],
      input: fs.readFileSync(0, "utf8"),
      run: commandRunner(path.resolve(__dirname, "../..")),
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = error.exitCode || 1;
  }
}
module.exports = { runHook };
