const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const { runPush, commandRunner } = require("./push-dev.cjs");
const { checkUpdates, isCheckpoint } = require("./push-policy.cjs");
const { runHook } = require("./pre-push.cjs");

const remote = "https://github.replit.internal/bigidrise/my-perfect-meals-npm-dev.git";
const sha = "a".repeat(40), old = "b".repeat(40), zero = "0".repeat(40);
const update = (destination, local = "refs/heads/dev", localSha = sha) =>
  `${local} ${localSha} refs/heads/${destination} ${old}\n`;

function fixture(options = {}) {
  const calls = [];
  let validationDone = false, fetches = 0;
  const run = (command, args) => {
    calls.push([command, ...args]);
    if (options.fail === `${command} ${args[0]}`) {
      const error = new Error("Simulated command failure");
      error.exitCode = 7;
      throw error;
    }
    if (command === "npm") {
      validationDone = true;
      if (options.validationFails) throw new Error("Validation failed");
      return "PASS";
    }
    switch (args[0]) {
      case "symbolic-ref": return validationDone && options.branchAfter ? options.branchAfter : (options.branch || "dev");
      case "status": return options.dirty || (validationDone && options.dirtyAfter ? " M package.json" : "");
      case "remote": return args.includes("--push") && options.pushUrl ? options.pushUrl : (options.url || remote);
      case "fetch": fetches++; return "";
      case "rev-list": return fetches > 1 && options.race ? "1 1" : (options.counts || "2 0");
      case "rev-parse": return validationDone && options.headChanged ? old : sha;
      case "push": return "Simulated dev push";
      case "merge-base": return "";
      default: throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
    }
  };
  return { calls, run };
}

test("clean dev push validates without startup and uses only explicit dev refspec", () => {
  const f = fixture();
  runPush({ run: f.run, write() {} });
  assert.deepEqual(f.calls.filter(c => c[1] === "push"), [
    ["git", "push", "origin", "refs/heads/dev:refs/heads/dev"],
  ]);
  assert.deepEqual(f.calls.find(c => c[0] === "npm"), ["npm", "run", "validate", "--", "--no-start"]);
  assert.ok(f.calls.every(c => !["add", "commit", "config", "merge", "rebase", "reset"].includes(c[1])));
});

for (const [name, options] of Object.entries({
  wrong_branch: { branch: "production" },
  main_branch: { branch: "main" },
  staging_branch: { branch: "staging" },
  dirty: { dirty: "?? unreviewed.txt" },
  staged: { dirty: "M  package.json" },
  divergent: { counts: "2 3" },
  behind: { counts: "0 2" },
  wrong_repository: { url: "https://github.com/other/repository.git" },
  fake_host: { url: "https://github.com.attacker.invalid/bigidrise/my-perfect-meals-npm-dev.git" },
  validation_failure: { validationFails: true },
  dirty_after_validation: { dirtyAfter: true },
  changed_head: { headChanged: true },
  switched_branch: { branchAfter: "production" },
  multiple_push_destinations: { pushUrl: `${remote}\nhttps://github.com/other/repository.git` },
  remote_race: { race: true },
  fetch_failure: { fail: "git fetch" },
  missing_remote: { fail: "git remote" },
  detached_head: { fail: "git symbolic-ref" },
})) {
  test(`refuses ${name} before any push`, () => {
    const f = fixture(options);
    assert.throws(() => runPush({ run: f.run, write() {} }));
    assert.equal(f.calls.filter(c => c[1] === "push").length, 0);
  });
}

test("push failure is propagated rather than reported as success", () => {
  const f = fixture({ fail: "git push" });
  assert.throws(() => runPush({ run: f.run, write() {} }), /Simulated command failure/);
});
test("old commit-message arguments are rejected without staging or committing", () => {
  const f = fixture();
  assert.throws(() => runPush({ run: f.run, args: ["snapshot"], write() {} }), /no arguments/);
  assert.equal(f.calls.length, 0);
});

for (const url of [
  remote, "https://github.com/bigidrise/my-perfect-meals-npm-dev.git",
  "git@github.com:bigidrise/my-perfect-meals-npm-dev.git",
  "ssh://git@github.com/bigidrise/my-perfect-meals-npm-dev.git",
]) {
  for (const destination of ["main", "production", "staging"]) {
    test(`blocks ${destination} explicit refspec at ${url}`, () => {
      assert.throws(() => checkUpdates("origin", url, update(destination, "HEAD"), "dev"), /Refusing direct/);
    });
  }
}
test("blocks forbidden deletions and a forbidden second destination", () => {
  assert.throws(() => checkUpdates("origin", remote, update("main", "(delete)", zero), "dev"));
  assert.throws(() => checkUpdates("origin", remote, update("dev") + update("production"), "dev"));
});
test("dev cannot be overwritten from another branch or deleted", () => {
  assert.throws(() => checkUpdates("origin", remote, update("dev", "refs/heads/release/test"), "dev"));
  assert.throws(() => checkUpdates("origin", remote, update("dev"), "production"));
  assert.throws(() => checkUpdates("origin", remote, update("dev", "refs/heads/dev", zero), "dev"));
});
test("allows named dev source and isolated release branches", () => {
  assert.equal(checkUpdates("origin", remote, update("dev"), "dev").checkpoint, false);
  assert.equal(checkUpdates("origin", remote, update("release/review", "refs/heads/release/review"), "release/review").checkpoint, false);
});
test("checkpoint backup bypasses validation and branch inspection", () => {
  runHook({ remoteName: "gitsafe-backup", remote: "git://gitsafe:5418/backup.git", input: update("main"),
    run() { throw new Error("Checkpoint must not invoke validation or Git."); } });
});
test("checkpoint remote name cannot disguise a GitHub push", () => {
  assert.equal(isCheckpoint("gitsafe-backup", remote), false);
  assert.throws(() => checkUpdates("gitsafe-backup", remote, update("main"), "dev"));
});
test("malformed updates and unknown destinations fail closed", () => {
  assert.throws(() => checkUpdates("origin", remote, "invalid", "dev"));
  assert.throws(() => checkUpdates("origin", "file:///tmp/remote.git", update("dev"), "dev"));
});
test("hook blocks a forbidden ref before validation", () => {
  const f = fixture();
  assert.throws(() => runHook({ remoteName: "origin", remote, input: update("production"), run: f.run }));
  assert.equal(f.calls.filter(c => c[0] === "npm").length, 0);
});
test("hook validates permitted updates without startup and propagates failures", () => {
  const f = fixture();
  runHook({ remoteName: "origin", remote, input: update("dev"), run: f.run });
  assert.deepEqual(f.calls.find(c => c[0] === "npm"), ["npm", "run", "validate", "--", "--no-start"]);
  const bad = fixture({ validationFails: true });
  assert.throws(() => runHook({ remoteName: "origin", remote, input: update("dev"), run: bad.run }));
});
for (const [name, options] of Object.entries({
  dirty: { dirty: "?? unreviewed.txt" },
  dirty_after: { dirtyAfter: true },
  branch_switched: { branchAfter: "production" },
  head_changed: { headChanged: true },
  force_push_divergence: { fail: "git merge-base" },
})) {
  test(`raw dev push hook refuses ${name}`, () => {
    const f = fixture(options);
    assert.throws(() => runHook({ remoteName: "origin", remote, input: update("dev"), run: f.run }));
  });
}
test("all helper entrypoints delegate to the same guard without build/start/commit", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(pkg.scripts.push, "node scripts/deployment/push-dev.cjs");
  for (const file of ["push.sh", "validate-and-push.sh"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /exec node scripts\/deployment\/push-dev\.cjs/);
    assert.doesNotMatch(source, /git (add|commit|config|push)|npm run (build|dev|start)/);
  }
});
test("command runner preserves real nonzero child exit status", () => {
  const run = commandRunner(process.cwd());
  assert.throws(() => run(process.execPath, ["-e", "process.exit(7)"]), error => error.exitCode === 7);
});
test("shell entrypoints and validator retain valid shell syntax", () => {
  for (const file of ["push.sh", "validate-and-push.sh", "scripts/validate.sh", "scripts/install-hooks.sh"]) {
    const result = spawnSync("bash", ["-n", file], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
});

test("no-start is parsed and guarded before the existing boot command", () => {
  const source = readFileSync("scripts/validate.sh", "utf8");
  assert.match(source, /elif \[ "\$arg" = "--no-start" \]; then\s+NO_START=1/);
  assert.match(source, /if \[ "\$NO_START" -eq 1 \] \|\|/);
  assert.ok(source.indexOf('if [ "$NO_START" -eq 1 ]') < source.indexOf("tsx server/devBootstrap.ts"));
  assert.doesNotMatch(source, /Merge dev → main|git pull in production shell/);
});

test("real guard CLI refuses forbidden refs without invoking a push or validation", () => {
  for (const destination of ["main", "production", "staging"]) {
    const result = spawnSync(process.execPath, ["scripts/deployment/pre-push.cjs", "origin", remote], {
      input: update(destination, "HEAD"), encoding: "utf8",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Refusing direct GitHub update/);
    assert.doesNotMatch(result.stdout, /VALIDATION|Push completed/);
  }
});
