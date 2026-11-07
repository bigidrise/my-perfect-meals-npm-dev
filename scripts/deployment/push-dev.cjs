#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { REPOSITORY, assertGitHub } = require("./push-policy.cjs");

function commandRunner(cwd) {
  return (command, args) => {
    const result = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 50 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      const error = new Error(`${command} ${args[0]} failed (exit ${result.status}).\n${result.stdout || ""}${result.stderr || ""}`);
      error.exitCode = result.status || 1;
      throw error;
    }
    return result.stdout || "";
  };
}

function runPush({ run, write = console.log, args = [] }) {
  if (args.length) throw new Error("Push helpers accept no arguments. Stage and commit reviewed changes manually first.");
  const git = (...args) => run("git", args).trim();
  const assertCleanDev = () => {
    if (git("symbolic-ref", "--quiet", "--short", "HEAD") !== "dev") {
      throw new Error("Refusing push: the current local branch must be dev.");
    }
    if (git("status", "--porcelain=v1", "--untracked-files=normal")) {
      throw new Error("Refusing push: working tree is dirty. Review and commit changes manually.");
    }
  };
  const assertOrigin = () => {
    assertGitHub(git("remote", "get-url", "origin"), REPOSITORY);
    const destinations = git("remote", "get-url", "--push", "--all", "origin").split(/\r?\n/);
    for (const destination of destinations) assertGitHub(destination, REPOSITORY);
  };
  const assertFastForward = () => {
    git("fetch", "--no-tags", "origin", "refs/heads/dev:refs/remotes/origin/dev");
    const counts = git("rev-list", "--left-right", "--count", "HEAD...refs/remotes/origin/dev");
    if (!/^\d+\s+\d+$/.test(counts)) throw new Error("Could not verify dev ancestry.");
    const [ahead, behind] = counts.split(/\s+/).map(Number);
    if (behind !== 0) throw new Error(`Refusing push: dev is ${ahead} ahead / ${behind} behind GitHub dev. Reconcile separately.`);
    return ahead;
  };
  assertCleanDev();
  assertOrigin();
  assertFastForward();
  const validatedHead = git("rev-parse", "HEAD");
  write("Running validation without application startup...");
  run("npm", ["run", "validate", "--", "--no-start"]);
  assertCleanDev();
  assertOrigin();
  if (git("rev-parse", "HEAD") !== validatedHead) throw new Error("HEAD changed during validation; push refused.");
  assertFastForward();
  // Explicit destination; no force, automatic commits, merge, or publishing.
  const output = run("git", ["push", "origin", "refs/heads/dev:refs/heads/dev"]);
  if (output.trim()) write(output.trim());
  write("GitHub dev push completed. Production still requires a founder-reviewed PR, explicit synchronization, Publish, and verification.");
}

if (require.main === module) {
  try {
    runPush({ run: commandRunner(path.resolve(__dirname, "../..")), args: process.argv.slice(2) });
  } catch (error) {
    console.error(error.message);
    process.exitCode = error.exitCode || 1;
  }
}
module.exports = { commandRunner, runPush };
