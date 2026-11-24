// Select only the comparison scope. The guard still validates history/resources,
// and Phase 0 still runs every independent clinical and hardcoded-copy gate.
function incrementalArguments(argv, env) {
  let explicitBase;
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === "--ci") continue;
    if (argv[index] !== "--base" || explicitBase !== undefined || !argv[index + 1])
      throw Error(`Unknown, duplicate or incomplete Phase 0 argument: ${argv[index]}`);
    explicitBase = argv[++index];
  }
  const isPullRequest = env.GITHUB_EVENT_NAME === "pull_request";
  const target = env.I18N_PR_BASE_SHA;
  if (isPullRequest && !/^[a-f0-9]{40}$/.test(target || ""))
    throw Error("Pull-request localization requires the actual pull_request.base.sha; no historical or HEAD fallback.");
  if (isPullRequest && explicitBase !== undefined && explicitBase !== target)
    throw Error("Explicit comparison base does not match the actual pull-request target.");
  const base = isPullRequest ? target : explicitBase;
  if (base !== undefined && !/^[a-f0-9]{40}$/.test(base))
    throw Error("Phase 0 comparison base must be a full commit SHA.");
  return ["scripts/localization-check/cli.cjs", ...(base ? ["--base", base] : [])];
}
module.exports = { incrementalArguments };
