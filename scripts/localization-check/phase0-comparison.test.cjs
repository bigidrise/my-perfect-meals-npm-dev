const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { incrementalArguments } = require("./phase0-comparison.cjs");
const target = "a".repeat(40);

test("PR Phase 0 forwards the exact target SHA without changing non-PR historical defaults", () => {
  assert.deepEqual(incrementalArguments(["--ci"], { GITHUB_EVENT_NAME: "pull_request", I18N_PR_BASE_SHA: target }),
    ["scripts/localization-check/cli.cjs", "--base", target]);
  for (const event of [undefined, "push", "workflow_dispatch"])
    assert.deepEqual(incrementalArguments(["--ci"], { GITHUB_EVENT_NAME: event }), ["scripts/localization-check/cli.cjs"]);
  assert.deepEqual(incrementalArguments(["--ci", "--base", target], {}), ["scripts/localization-check/cli.cjs", "--base", target]);
});

test("missing, malformed or conflicting PR targets cannot fall back to adoption or HEAD", () => {
  for (const base of [undefined, "", "HEAD", "HEAD~1", "a".repeat(39), "--json", `${target};echo unsafe`])
    assert.throws(() => incrementalArguments(["--ci"], { GITHUB_EVENT_NAME: "pull_request", I18N_PR_BASE_SHA: base }), /actual pull_request.base.sha/);
  assert.throws(() => incrementalArguments(["--base", "b".repeat(40)], {
    GITHUB_EVENT_NAME: "pull_request", I18N_PR_BASE_SHA: target,
  }), /does not match/);
  for (const args of [["--base"], ["--base", "HEAD"], ["--skip"], ["--base", target, "--base", target]])
    assert.throws(() => incrementalArguments(args, {}));
});

test("workflow supplies GitHub PR metadata and wrapper executes the selected guard arguments", () => {
  const root = path.resolve(__dirname, "../..");
  const workflow = fs.readFileSync(path.join(root, ".github/workflows/localization.yml"), "utf8");
  const wrapper = fs.readFileSync(path.join(root, "scripts/i18n-phase0-validate.ts"), "utf8");
  assert.match(workflow, /fetch-depth: 0/);
  assert.match(workflow, /I18N_PR_BASE_SHA: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
  assert.match(wrapper, /execFileSync\(process\.execPath, incrementalArguments\(process\.argv\.slice\(2\), process\.env\)/);
  assert.match(wrapper, /validateSourceDispositions/);
  for (const gate of ["GATE_02", "GATE_03", "GATE_07", "GATE_08", "GATE_09"])
    assert.ok(wrapper.includes(gate));
});
